import fs from 'node:fs/promises'
import path from 'node:path'

export default async function globalSetup() {
  await fs.rm(path.resolve('outputs/playwright-evidence'), { recursive: true, force: true })
}
