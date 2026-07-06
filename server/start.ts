import 'dotenv/config'
import { app } from './index.js'
import { databaseLabel } from './postgres-db.js'

const port = Number(process.env.PORT || 3001)

app.listen(port, '0.0.0.0', () => {
  console.log(`Franchise API aktif di http://localhost:${port}`)
  console.log(`Database: ${databaseLabel}`)
})
