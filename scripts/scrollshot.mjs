// Dev helper: captures screenshots of the page at several scroll positions
// to verify the scroll-driven 3D animation. Usage: node scripts/scrollshot.mjs
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:5173/')
await page.waitForTimeout(8000)

const stops = [
  [0.25, 'shot-airflow.png'],
  [0.5, 'shot-cushion.png'],
  [0.72, 'shot-traction.png'],
  [1.0, 'shot-finale.png'],
]

for (const [ratio, file] of stops) {
  const max = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'smooth' }), max * ratio)
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `screenshots/${file}` })
}

await browser.close()
console.log('done')
