import { expect, Page, test } from '@playwright/test'
import { getPayload } from 'payload'

import config from '../../src/payload.config.js'
import { login } from '../helpers/login'

const baseURL = 'http://localhost:3000'
const siteChromeUser = {
  email: 'site-chrome@payloadcms.com',
  password: 'test',
  role: 'admin' as const,
}

const seedSiteChromeUser = async () => {
  const payload = await getPayload({ config })
  const existing = await payload.find({
    collection: 'users',
    limit: 1,
    overrideAccess: true,
    where: {
      email: {
        equals: siteChromeUser.email,
      },
    },
  })

  if (existing.docs[0]) {
    await payload.update({
      id: existing.docs[0].id,
      collection: 'users',
      data: siteChromeUser,
      overrideAccess: true,
    })
    return
  }

  await payload.create({
    collection: 'users',
    data: siteChromeUser,
    overrideAccess: true,
  })
}

const cleanupSiteChromeUser = async () => {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    overrideAccess: true,
    where: {
      email: {
        equals: siteChromeUser.email,
      },
    },
  })
}

const expectGlobalNotice = async (page: Page, slug: 'footer' | 'header') => {
  await page.goto(`${baseURL}/admin/globals/${slug}`)

  await expect(page.getByRole('heading', { name: 'Primary section navigation' })).toBeVisible()
  await expect(
    page.getByText('The main newspaper links in the header and footer come from active items'),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open Sections' })).toHaveAttribute(
    'href',
    '/admin/collections/sections',
  )
  await expect(page.getByText('Supplemental nav items')).toBeVisible()
}

test.describe('Site chrome', () => {
  test.beforeAll(async () => {
    await seedSiteChromeUser()
  })

  test.afterAll(async () => {
    await cleanupSiteChromeUser()
  })

  test('clarifies section-owned navigation in header and footer globals', async ({ page }) => {
    await login({ page, user: siteChromeUser })

    await expectGlobalNotice(page, 'header')
    await expectGlobalNotice(page, 'footer')
  })

  test('uses stable compact header thresholds while scrolling', async ({ page }) => {
    await page.goto(baseURL)

    const header = page.locator('.site-header')

    await expect(header).toBeVisible()
    await expect(header).not.toHaveClass(/is-compact/)

    await page.evaluate(() => window.scrollTo(0, 113))
    await expect(header).toHaveClass(/is-compact/)

    await page.evaluate(() => window.scrollTo(0, 80))
    await expect(header).toHaveClass(/is-compact/)

    await page.evaluate(() => window.scrollTo(0, 55))
    await expect(header).not.toHaveClass(/is-compact/)
  })
})
