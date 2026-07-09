// Dev helper: captures a rapid burst of frames at several scroll positions
// and reports per-frame mean brightness so sudden flashes show up as spikes.
// Usage: node scripts/flickerprobe.mjs
import { chromium } from 'playwright'
import fs from 'node:fs'
import zlib from 'node:zlib'

function meanBrightness(pngBuffer) {
  // Minimal PNG decode: parse IDAT, unfilter, average RGB.
  let pos = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat = []
  while (pos < pngBuffer.length) {
    const len = pngBuffer.readUInt32BE(pos)
    const type = pngBuffer.toString('ascii', pos + 4, pos + 8)
    const data = pngBuffer.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported png: depth=${bitDepth} color=${colorType}`)
  }
  const bpp = colorType === 6 ? 4 : 3
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  let sum = 0
  let count = 0
  const prev = Buffer.alloc(stride)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1)
    const filter = raw[rowStart]
    const row = raw.subarray(rowStart + 1, rowStart + 1 + stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0
      const b = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = row[x]
      if (filter === 1) v = (v + a) & 0xff
      else if (filter === 2) v = (v + b) & 0xff
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
      }
      row[x] = v
    }
    row.copy(prev)
    // sample every 8th pixel's RGB
    for (let x = 0; x < width; x += 8) {
      const o = x * bpp
      sum += row[o] + row[o + 1] + row[o + 2]
      count += 3
    }
  }
  return sum / count
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text())
})
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto('http://localhost:5173/')
await page.waitForTimeout(9000)

fs.mkdirSync('screenshots/burst', { recursive: true })

const stops = [0, 0.25, 0.55, 0.72, 1.0]
for (const ratio of stops) {
  const max = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  )
  await page.evaluate((top) => window.scrollTo({ top, behavior: 'auto' }), max * ratio)
  await page.waitForTimeout(2500)
  const vals = []
  for (let i = 0; i < 14; i++) {
    const buf = await page.screenshot({ path: `screenshots/burst/r${ratio}-f${i}.png` })
    vals.push(meanBrightness(buf))
  }
  const min = Math.min(...vals)
  const max2 = Math.max(...vals)
  console.log(
    `scroll=${ratio}  brightness min=${min.toFixed(1)} max=${max2.toFixed(1)} spread=${(max2 - min).toFixed(1)}`,
    '\n  frames:', vals.map((v) => v.toFixed(1)).join(' '),
  )
}

await browser.close()
console.log('done')
