import mysql from 'mysql2/promise'

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
const missing = required.filter((key) => !process.env[key])
if (missing.length) {
  console.error('Missing MySQL environment variables:', missing.join(', '))
  process.exitCode = 1
} else {
  let connection
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectTimeout: 10_000,
      charset: 'utf8mb4',
      ssl: process.env.DB_SSL === 'true' ? {} : undefined,
    })
    const [[version]] = await connection.query('SELECT VERSION() AS version')
    const [[database]] = await connection.query('SELECT DATABASE() AS database_name')
    const [[privileges]] = await connection.query('SELECT CURRENT_USER() AS authenticated_user')
    console.log('MySQL connection successful')
    console.log('Server version:', version.version)
    console.log('Database:', database.database_name)
    console.log('Authenticated user:', privileges.authenticated_user)
  } catch (error) {
    console.error('MySQL connection failed:', error.code || error.name, error.message)
    process.exitCode = 1
  } finally {
    await connection?.end()
  }
}
