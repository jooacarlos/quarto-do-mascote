import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SOURCE = path.resolve('assets-source/ceasa')
const OUT = path.resolve('public/assets')

async function background(file, output) {
  await sharp(path.join(SOURCE, file))
    .resize(1600, 900, { fit: 'cover' })
    .webp({ quality: 84 })
    .toFile(path.join(OUT, output))
  console.log(output)
}

async function cutout(file, output, crop, width, tolerance = 52) {
  const { data, info } = await sharp(path.join(SOURCE, file))
    .extract(crop)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: w, height: h } = info
  const pixels = new Uint8ClampedArray(data)
  const seed = [pixels[0], pixels[1], pixels[2]]
  const visited = new Uint8Array(w * h)
  const queue = new Int32Array(w * h)
  let head = 0
  let tail = 0

  const isBackground = (index) => {
    const offset = index * 4
    const dr = pixels[offset] - seed[0]
    const dg = pixels[offset + 1] - seed[1]
    const db = pixels[offset + 2] - seed[2]
    return dr * dr + dg * dg + db * db <= tolerance * tolerance
  }

  const push = (index) => {
    if (index < 0 || index >= w * h || visited[index] || !isBackground(index)) return
    visited[index] = 1
    queue[tail++] = index
  }

  for (let x = 0; x < w; x += 1) {
    push(x)
    push((h - 1) * w + x)
  }
  for (let y = 0; y < h; y += 1) {
    push(y * w)
    push(y * w + w - 1)
  }

  while (head < tail) {
    const index = queue[head++]
    const x = index % w
    const y = (index / w) | 0
    if (x > 0) push(index - 1)
    if (x < w - 1) push(index + 1)
    if (y > 0) push(index - w)
    if (y < h - 1) push(index + w)
  }

  for (let index = 0; index < w * h; index += 1) {
    if (!visited[index]) continue
    const offset = index * 4
    pixels[offset + 3] = 0
  }

  await sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
    .resize({ width, fit: 'inside', withoutEnlargement: false })
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(path.join(OUT, output))
  console.log(output)
}

await fs.mkdir(OUT, { recursive: true })

await Promise.all([
  background('facade.jpg', 'ceasa-facade.webp'),
  background('warehouse.jpg', 'ceasa-warehouse.webp'),
  background('bus-stop.jpg', 'ceasa-street.webp'),
  background('bus-interior.jpg', 'ceasa-bus-interior.webp'),
  background('break-room.jpg', 'ceasa-breakroom.webp')
])

await cutout('props.jpg', 'ceasa-clock.webp', { left: 30, top: 1020, width: 910, height: 900 }, 480)
await cutout('props.jpg', 'ceasa-forklift.webp', { left: 90, top: 80, width: 840, height: 760 }, 540)
await cutout('market-assets.jpg', 'ceasa-crate-tomato.webp', { left: 950, top: 140, width: 510, height: 540 }, 420)
await cutout('market-assets.jpg', 'ceasa-crate-lettuce.webp', { left: 1480, top: 140, width: 520, height: 520 }, 420)
await cutout('market-assets.jpg', 'ceasa-crate-banana.webp', { left: 100, top: 860, width: 560, height: 460 }, 420)
await cutout('market-assets.jpg', 'ceasa-crate-carrot.webp', { left: 700, top: 840, width: 580, height: 500 }, 420)
await cutout('market-assets.jpg', 'ceasa-crate-empty.webp', { left: 1350, top: 840, width: 540, height: 480 }, 400)
await cutout('market-assets.jpg', 'ceasa-pallet.webp', { left: 1150, top: 1480, width: 850, height: 500 }, 620)
await cutout('workers.jpg', 'ceasa-worker-1.webp', { left: 20, top: 280, width: 500, height: 1640 }, 420)
await cutout('workers.jpg', 'ceasa-worker-2.webp', { left: 480, top: 240, width: 520, height: 1700 }, 420)
await cutout('workers.jpg', 'ceasa-worker-3.webp', { left: 1000, top: 280, width: 470, height: 1650 }, 420)
await cutout('workers.jpg', 'ceasa-worker-4.webp', { left: 1470, top: 280, width: 500, height: 1650 }, 420)
