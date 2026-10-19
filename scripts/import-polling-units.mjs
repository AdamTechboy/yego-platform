import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'
import { withClient } from './db.mjs'

const source = process.argv[2] ?? 'https://raw.githubusercontent.com/Emeka-Onwuepe/Polling_Units_in_Nigeria/main/Nigeria_polling_units.csv'

function parseCsvLine(line) {
  const values = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        value += '"'
        i += 1
      } else if (char === '"') {
        quoted = false
      } else {
        value += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      values.push(value)
      value = ''
    } else {
      value += char
    }
  }
  values.push(value)
  return values
}

function stateAlias(value) {
  const name = value.trim().toLowerCase()
  if (name === 'nassarawa') return 'nasarawa'
  if (name === 'federal capital territory' || name === 'fct') return 'fct'
  return name
}

import { STATES } from '../src/lib/nigeria.ts'

const STATE_CODES = Object.fromEntries(STATES.map((state) => [state.name.toLowerCase(), state.code]))
STATE_CODES.nassarawa = STATE_CODES.nasarawa
STATE_CODES.fct = STATE_CODES['fct'] ?? STATE_CODES.federalcapitalterritory

await withClient(async (client) => {
  let lineReader
  if (/^https?:\/\//i.test(source)) {
    // Stream the download into a temporary line reader by fetching text in chunks.
    const response = await fetch(source)
    if (!response.ok) throw new Error(`Could not download polling units: ${response.status}`)
    const text = await response.text()
    lineReader = text.split(/\r?\n/)[Symbol.iterator]()
  } else {
    lineReader = createInterface({ input: createReadStream(source), crlfDelay: Infinity })[Symbol.asyncIterator]()
  }

  let header = true
  let batch = []
  let imported = 0
  let skipped = 0

  async function flush() {
    if (!batch.length) return
    const values = []
    const params = []
    let index = 1
    for (const row of batch) {
      values.push(`($${index},$${index + 1},$${index + 2},$${index + 3},$${index + 4},$${index + 5},$${index + 6})`)
      params.push(...row)
      index += 7
    }
    await client.query(
      `insert into polling_units (state_code, lga, ward, code, name, source, verified)
       values ${values.join(',')} on conflict (code) do nothing`,
      params,
    )
    imported += batch.length
    batch = []
  }

  const iterator = lineReader[Symbol.asyncIterator] ? lineReader : (async function* () { yield* lineReader })()
  for await (const line of iterator) {
    if (header) { header = false; continue }
    if (!line.trim()) continue
    const cells = parseCsvLine(line)
    if (cells.length < 10) { skipped += 1; continue }
    const state = stateAlias(cells[1])
    const stateCode = STATE_CODES[state]
    if (!stateCode) { skipped += 1; continue }
    const lga = cells[2].trim()
    const ward = cells[3].trim()
    const code = cells[8].trim()
    const name = cells[9].trim()
    if (!code || !name) { skipped += 1; continue }
    batch.push([stateCode, lga, ward, code, name, 'inec-dataset', false])
    if (batch.length >= 500) {
      await flush()
      if (imported % 10000 === 0) console.log(`imported ${imported}`)
    }
  }
  await flush()
  console.log(`polling units imported: ${imported}, skipped: ${skipped}`)
})
