/**
 * Generates the PWA raster icons from the same geometry as the favicon.
 *
 * Written by hand as a minimal PNG encoder (zlib comes from node:zlib) so the
 * project needs no image toolchain and no binary assets in git. Run it with
 * `node scripts/make-icons.mjs` after changing the mark.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

const BG = [11, 26, 43, 255]
const TURQUOISE = [46, 196, 182, 255]
const GOLD = [224, 179, 84, 255]
const DOT = [232, 217, 168, 255]

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, pixels) {
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Distance from a point to a line segment — used to draw round-capped lines. */
function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function render(size, { maskable }) {
  const pixels = Buffer.alloc(size * size * 4)
  // Maskable icons must keep their content inside a safe circle, so the mark
  // is drawn smaller and the background bleeds to the edges.
  const inset = maskable ? 0.3 : 0.24
  const a = size * inset
  const b = size * (1 - inset)
  const lineWidth = size * (maskable ? 0.055 : 0.062)
  const dotRadius = size * (maskable ? 0.062 : 0.07)
  const cornerRadius = maskable ? 0 : size * 0.22
  const dots = [
    [a, a],
    [b, a],
    [a, b],
    [b, b],
  ]
  const lines = [
    [a, a, b, a, TURQUOISE],
    [b, a, b, b, GOLD],
    [b, b, a, b, TURQUOISE],
  ]

  const put = (index, color, alpha) => {
    for (let c = 0; c < 3; c++) {
      pixels[index + c] = Math.round(pixels[index + c] * (1 - alpha) + color[c] * alpha)
    }
    pixels[index + 3] = Math.max(pixels[index + 3], Math.round(255 * alpha))
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4
      const px = x + 0.5
      const py = y + 0.5

      // rounded-rect background
      let inside = 1
      if (cornerRadius > 0) {
        const qx = Math.max(cornerRadius - px, px - (size - cornerRadius), 0)
        const qy = Math.max(cornerRadius - py, py - (size - cornerRadius), 0)
        const distance = Math.hypot(qx, qy) - cornerRadius
        inside = Math.max(0, Math.min(1, 0.5 - distance))
      }
      if (inside > 0) put(index, BG, inside)

      for (const [x1, y1, x2, y2, color] of lines) {
        const distance = segmentDistance(px, py, x1, y1, x2, y2) - lineWidth / 2
        const alpha = Math.max(0, Math.min(1, 0.5 - distance))
        if (alpha > 0) put(index, color, alpha * inside)
      }

      for (const [dx, dy] of dots) {
        const distance = Math.hypot(px - dx, py - dy) - dotRadius
        const alpha = Math.max(0, Math.min(1, 0.5 - distance))
        if (alpha > 0) put(index, DOT, alpha * inside)
      }
    }
  }
  return encodePng(size, pixels)
}

for (const [name, size, options] of [
  ['icon-192.png', 192, { maskable: false }],
  ['icon-512.png', 512, { maskable: false }],
  ['maskable-512.png', 512, { maskable: true }],
  ['apple-touch-icon.png', 180, { maskable: false }],
]) {
  writeFileSync(join(outDir, name), render(size, options))
  console.log(`wrote icons/${name} (${size}px)`)
}
