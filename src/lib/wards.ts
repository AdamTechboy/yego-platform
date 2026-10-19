import { useEffect, useState } from 'react'

export type WardMap = Record<string, Record<string, string[]>>

let cache: WardMap | null = null
let pending: Promise<WardMap> | null = null

export async function loadWards(): Promise<WardMap> {
  if (cache) return cache
  if (!pending) {
    pending = fetch('/data/wards.json')
      .then((response) => {
        if (!response.ok) throw new Error('Could not load the ward list.')
        return response.json() as Promise<WardMap>
      })
      .then((data) => {
        cache = data
        return data
      })
      .finally(() => {
        pending = null
      })
  }
  return pending
}

export function useWards(): WardMap | null {
  const [wards, setWards] = useState<WardMap | null>(cache)
  useEffect(() => {
    if (cache) return
    let active = true
    void loadWards()
      .then((data) => {
        if (active) setWards(data)
      })
      .catch(() => {
        if (active) setWards(null)
      })
    return () => {
      active = false
    }
  }, [])
  return wards
}
