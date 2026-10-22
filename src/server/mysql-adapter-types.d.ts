declare module '../../scripts/mysql-adapter.mjs' {
  export function bindMysql(sql: string, params?: unknown[]): { sql: string; params: unknown[] }
}
