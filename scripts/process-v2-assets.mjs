import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'assets-source', 'duck')
const OUT = path.join(ROOT, 'public', 'assets')
const TMP = path.join(ROOT, 'scripts', '.tmp', 'v2-assets')
const FRAME_WIDTH = 600
const FRAME_HEIGHT = 800
const FEET_Y = 790
const MAX_BODY_HEIGHT = 720
const MAX_BODY_WIDTH = 540

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

async function readRaw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

function estimateBackground(data, width, height, channels) {
  const samples = []
  const add = (x, y) => {
    const i = (y * width + x) * channels
    samples.push([data[i], data[i + 1], data[i + 2]])
  }
  const stepX = Math.max(1, Math.floor(width / 80))
  const stepY = Math.max(1, Math.floor(height / 80))
  for (let x = 0; x < width; x += stepX) {
    add(x, 0)
    add(x, height - 1)
  }
  for (let y = 0; y < height; y += stepY) {
    add(0, y)
    add(width - 1, y)
  }
  const median = (index) => {
    const values = samples.map((sample) => sample[index]).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }
  return [median(0), median(1), median(2)]
}

function removeBackground(data, width, height, channels, options = {}) {
  const tolerance = options.tolerance ?? 38
  const bg = options.background ?? estimateBackground(data, width, height, channels)
  const total = width * height
  const alpha = new Uint8Array(total).fill(255)
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  const distance = (index) => {
    const p = index * channels
    return Math.max(
      Math.abs(data[p] - bg[0]),
      Math.abs(data[p + 1] - bg[1]),
      Math.abs(data[p + 2] - bg[2])
    )
  }

  const seed = (index) => {
    if (visited[index]) return
    visited[index] = 1
    if (distance(index) <= tolerance) {
      alpha[index] = 0
      queue[tail++] = index
    }
  }

  for (let x = 0; x < width; x += 1) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width)
    seed(y * width + width - 1)
  }

  while (head < tail) {
    const index = queue[head++]
    const x = index % width
    const y = (index / width) | 0
    if (x > 0) seed(index - 1)
    if (x < width - 1) seed(index + 1)
    if (y > 0) seed(index - width)
    if (y < height - 1) seed(index + width)
  }

  const originalAlpha = alpha.slice()
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x
      if (originalAlpha[index] === 0) continue
      if (
        originalAlpha[index - 1] === 0 ||
        originalAlpha[index + 1] === 0 ||
        originalAlpha[index - width] === 0 ||
        originalAlpha[index + width] === 0
      ) {
        const edge = distance(index)
        const softness = Math.max(14, tolerance * 0.75)
        alpha[index] = clamp(Math.round(((edge - tolerance * 0.55) / softness) * 255), 0, 255)
      }
    }
  }

  for (let i = 0; i < total; i += 1) {
    data[i * channels + 3] = alpha[i]
  }

  return { background: bg, alpha }
}

function alphaBounds(alpha, width, height, threshold = 8) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alpha[y * width + x] > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

function keepLargestIsland(alpha, width, height, minArea = 350) {
  const total = width * height
  const seen = new Uint8Array(total)
  const queue = new Int32Array(total)
  const islands = []
  for (let start = 0; start < total; start += 1) {
    if (seen[start] || alpha[start] === 0) continue
    let head = 0
    let tail = 0
    seen[start] = 1
    queue[tail++] = start
    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = (index / width) | 0
      if (x > 0 && !seen[index - 1] && alpha[index - 1] > 0) {
        seen[index - 1] = 1
        queue[tail++] = index - 1
      }
      if (x < width - 1 && !seen[index + 1] && alpha[index + 1] > 0) {
        seen[index + 1] = 1
        queue[tail++] = index + 1
      }
      if (y > 0 && !seen[index - width] && alpha[index - width] > 0) {
        seen[index - width] = 1
        queue[tail++] = index - width
      }
      if (y < height - 1 && !seen[index + width] && alpha[index + width] > 0) {
        seen[index + width] = 1
        queue[tail++] = index + width
      }
    }
    islands.push({ start, size: tail, pixels: queue.slice(0, tail) })
  }
  if (islands.length === 0) return
  const keep = islands.reduce((best, island) => (island.size > best.size ? island : best))
  for (const island of islands) {
    if (island === keep) continue
    for (let i = 0; i < island.size; i += 1) alpha[island.pixels[i]] = 0
  }
  if (keep.size < minArea) {
    for (let i = 0; i < keep.size; i += 1) alpha[keep.pixels[i]] = 0
  }
}

async function cutout(file, options = {}) {
  const { data, width, height, channels } = await readRaw(file)
  removeBackground(data, width, height, channels, options)
  const alpha = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) alpha[i] = data[i * channels + 3]
  keepLargestIsland(alpha, width, height, options.minIsland ?? 350)
  for (const rect of options.exclude ?? []) {
    for (let y = Math.max(0, rect.y); y < Math.min(height, rect.y + rect.height); y += 1) {
      for (let x = Math.max(0, rect.x); x < Math.min(width, rect.x + rect.width); x += 1) {
        alpha[y * width + x] = 0
      }
    }
  }
  for (let i = 0; i < width * height; i += 1) data[i * channels + 3] = alpha[i]
  const bounds = alphaBounds(alpha, width, height)
  if (!bounds) throw new Error(`No foreground found in ${file}`)
  return {
    buffer: await sharp(data, { raw: { width, height, channels } })
      .extract(bounds)
      .png()
      .toBuffer(),
    width: bounds.width,
    height: bounds.height
  }
}

async function normalizeFrames(frames, options) {
  const maxWidth = Math.max(...frames.map((frame) => frame.width))
  const maxHeight = Math.max(...frames.map((frame) => frame.height))
  const scale = Math.min(options.maxWidth / maxWidth, options.maxHeight / maxHeight)
  const outputs = []
  for (const frame of frames) {
    const width = Math.max(1, Math.round(frame.width * scale))
    const height = Math.max(1, Math.round(frame.height * scale))
    const resized = await sharp(frame.buffer).resize(width, height, { fit: 'fill' }).png().toBuffer()
    const left = Math.round((options.width - width) / 2)
    const top = options.feetY - height
    const canvas = sharp({
      create: {
        width: options.width,
        height: options.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    }).composite([{ input: resized, left, top }])
    outputs.push(await canvas.webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer())
  }
  return outputs
}

async function extractGridFrames(file, columns, rows, indices) {
  const meta = await sharp(file).metadata()
  const cellWidth = meta.width / columns
  const cellHeight = meta.height / rows
  const frames = []
  for (const index of indices) {
    const column = index % columns
    const row = Math.floor(index / columns)
    const cell = await sharp(file)
      .extract({
        left: Math.round(column * cellWidth),
        top: Math.round(row * cellHeight),
        width: Math.floor(cellWidth),
        height: Math.floor(cellHeight)
      })
      .png()
      .toBuffer()
    frames.push(await cutout(cell))
  }
  return frames
}

async function saveFrames(frames, prefix) {
  for (let i = 0; i < frames.length; i += 1) {
    await fs.writeFile(path.join(OUT, `${prefix}-${i}.webp`), frames[i])
  }
}

async function processBackgrounds() {
  const backgrounds = [
    ['duck-dancefloor.jpg', 'duck-dancefloor.webp'],
    ['duck-bar.jpg', 'duck-bar.webp'],
    ['duck-vip.jpg', 'duck-vip.webp'],
    ['duck-exterior.jpg', 'duck-exterior.webp']
  ]
  for (const [source, output] of backgrounds) {
    await sharp(path.join(SRC, source))
      .resize(1600, 900, { fit: 'cover', position: 'centre' })
      .webp({ quality: 84, effort: 5 })
      .toFile(path.join(OUT, output))
  }
}

async function processCharacter() {
  const walk = await extractGridFrames(path.join(SRC, 'char-walk.jpg'), 4, 2, [0, 1, 2, 3])
  const walkFrames = await normalizeFrames(walk, {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    feetY: FEET_Y,
    maxWidth: MAX_BODY_WIDTH,
    maxHeight: MAX_BODY_HEIGHT
  })
  await saveFrames(walkFrames, 'mb-walk')

  const dance = await extractGridFrames(path.join(SRC, 'char-dance.jpg'), 4, 3, [2, 3, 6, 7, 8, 9, 10, 11])
  const danceFrames = await normalizeFrames(dance, {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    feetY: FEET_Y,
    maxWidth: MAX_BODY_WIDTH,
    maxHeight: MAX_BODY_HEIGHT
  })
  await saveFrames(danceFrames, 'mb-dance')

  const talk = await extractGridFrames(path.join(SRC, 'char-talk.jpg'), 4, 3, [8, 3, 6, 11])
  const happyFrames = await normalizeFrames(talk, {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    feetY: FEET_Y,
    maxWidth: MAX_BODY_WIDTH,
    maxHeight: MAX_BODY_HEIGHT
  })
  await saveFrames(happyFrames, 'mb-happy')

  const talkGesture = await extractGridFrames(path.join(SRC, 'char-talk.jpg'), 4, 3, [5, 3, 8, 0])
  const talkFrames = await normalizeFrames(talkGesture, {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    feetY: FEET_Y,
    maxWidth: MAX_BODY_WIDTH,
    maxHeight: MAX_BODY_HEIGHT
  })
  await saveFrames(talkFrames, 'mb-talk')

  const drink = await extractGridFrames(path.join(SRC, 'char-drink.jpg'), 5, 2, [1, 2, 3, 4, 5, 6, 7])
  const drinkFrames = await normalizeFrames(drink, {
    width: FRAME_WIDTH,
    height: FRAME_HEIGHT,
    feetY: FEET_Y,
    maxWidth: MAX_BODY_WIDTH,
    maxHeight: MAX_BODY_HEIGHT
  })
  await saveFrames(drinkFrames, 'mb-drink')

  const meta = await sharp(path.join(SRC, 'char-walk.jpg')).metadata()
  await fs.writeFile(
    path.join(TMP, 'character-frames.json'),
    JSON.stringify(
      {
        walk: walkFrames.length,
        dance: danceFrames.length,
        happy: happyFrames.length,
        talk: talkFrames.length,
        drink: drinkFrames.length,
        source: meta
      },
      null,
      2
    )
  )
}

async function processNpcs() {
  const lineup = path.join(SRC, 'char-lineup.jpg')
  const crops = [
    { left: 20, top: 330, width: 400, height: 1110, exclude: [{ x: 365, y: 280, width: 35, height: 360 }] },
    { left: 780, top: 330, width: 380, height: 1110, exclude: [{ x: 0, y: 300, width: 32, height: 360 }] },
    { left: 2335, top: 330, width: 417, height: 1110, exclude: [{ x: 0, y: 260, width: 32, height: 380 }] }
  ]
  for (let i = 0; i < crops.length; i += 1) {
    const { exclude, ...cropOptions } = crops[i]
    const crop = await sharp(lineup).extract(cropOptions).png().toBuffer()
    const person = await cutout(crop, { tolerance: 34, minIsland: 500, exclude })
    const frames = await normalizeFrames([person], {
      width: 440,
      height: 680,
      feetY: 670,
      maxWidth: 400,
      maxHeight: 620
    })
    await fs.writeFile(path.join(OUT, `npc-${i + 1}.webp`), frames[0])
  }
}

async function processBartender() {
  const frames = await extractGridFrames(path.join(SRC, 'char-bartender.jpg'), 4, 2, [2, 3])
  const outputs = await normalizeFrames(frames, {
    width: 440,
    height: 680,
    feetY: 670,
    maxWidth: 400,
    maxHeight: 620
  })
  await saveFrames(outputs, 'bartender')
}

async function processDiscoBall() {
  const source = path.join(SRC, 'props-nightclub.jpg')
  const crop = await sharp(source)
    .extract({ left: 180, top: 250, width: 460, height: 460 })
    .ensureAlpha()
    .png()
    .toBuffer()
  const mask = Buffer.from(
    '<svg width="460" height="460"><circle cx="230" cy="230" r="214" fill="#fff"/></svg>'
  )
  const raw = await readRaw(crop)
  removeBackground(raw.data, raw.width, raw.height, raw.channels, { tolerance: 24 })
  const cut = await sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: raw.channels }
  })
    .png()
    .toBuffer()
  const masked = await sharp(cut)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
  const ball = await sharp(masked)
    .trim()
    .resize({ height: 420, fit: 'inside' })
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toBuffer()
  await fs.writeFile(path.join(OUT, 'disco-ball.webp'), ball)
}

await fs.mkdir(OUT, { recursive: true })
await fs.mkdir(TMP, { recursive: true })
await processBackgrounds()
await processCharacter()
await processNpcs()
await processBartender()
await processDiscoBall()
console.log('V2 assets processed.')
