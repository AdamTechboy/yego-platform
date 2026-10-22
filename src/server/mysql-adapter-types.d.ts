declare module '*.mjs' {
  export function bindMysql(sql: string, params?: unknown[]): { sql: string; params: unknown[] }
}
