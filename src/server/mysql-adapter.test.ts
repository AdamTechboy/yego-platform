import { describe, expect, it } from 'vitest'
import { bindMysql, mysqlConfig } from '../../scripts/mysql-adapter.mjs'

describe('MySQL configuration', () => {
  it('requires credentials', () => {
    expect(() => mysqlConfig({ DB_HOST: '127.0.0.1' })).toThrow(/DB_NAME/)
  })
  it('accepts local MySQL 8 connection settings', () => {
    const config = mysqlConfig({ DB_HOST: '127.0.0.1', DB_NAME: 'yego', DB_USER: 'app', DB_PASSWORD: 'secret' })
    expect(config.port).toBe(3306)
    expect(config.charset).toBe('utf8mb4')
  })
})

describe('MySQL parameter binding', () => {
  it('converts ordered parameters', () => {
    expect(bindMysql('select * from users where id = $1 and email = $2', ['id', 'email'])).toEqual({
      sql: 'select * from users where id = ? and email = ?',
      params: ['id', 'email'],
    })
  })
  it('handles repeated and out-of-order parameters', () => {
    expect(bindMysql('select $2, $1, $2', ['first', 'second'])).toEqual({
      sql: 'select ?, ?, ?',
      params: ['second', 'first', 'second'],
    })
  })
  it('does not rewrite placeholders in SQL strings or comments', () => {
    expect(bindMysql("select '$1' as example, $1 -- $2\n/* $3 */", [42])).toEqual({
      sql: "select '$1' as example, ? -- $2\n/* $3 */",
      params: [42],
    })
  })
  it('rejects missing parameters', () => {
    expect(() => bindMysql('select $2', ['only one'])).toThrow(/out of bounds/)
  })
})
