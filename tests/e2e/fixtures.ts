import { test as base, expect } from '@playwright/test'
import fs from 'node:fs/promises'
import path from 'node:path'

const evidenceRoot = path.resolve('outputs/playwright-evidence')

export const test = base.extend({})

test.afterEach(async ({ page }, testInfo) => {
  const status = testInfo.status === testInfo.expectedStatus ? 'pass' : 'fail'
  const safeTitle = testInfo.title
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  const directory = path.join(evidenceRoot, testInfo.project.name, status)
  const screenshotPath = path.join(directory, `${safeTitle}.png`)

  await fs.mkdir(directory, { recursive: true })
  if (!page.isClosed()) {
    await page.screenshot({ path: screenshotPath, fullPage: true })
    await testInfo.attach('screenshot-evidence', {
      path: screenshotPath,
      contentType: 'image/png',
    })
  }
})

export { expect }
