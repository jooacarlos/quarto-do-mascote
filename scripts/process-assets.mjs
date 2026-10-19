import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'assets-source')
const OUT = path.join(ROOT, 'public', 'assets')
const TMP = path.join(ROOT, 'scripts', '.tmp')

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

async function readRaw(file) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height, channels: info.channels }
}

function estimateBackground(data, width, height, channels) {
  const samples = []
  const step = Math.max(1, Math.floor(width / 120))
  const add = (x, y) => {
    const i = (y * width + x) * channels
    samples.push([data[i], data[i + 1], data[i + 2]])
  }
  for (let x = 0; x < width; x += step) {
    add(x, 0)
    add(x, height - 1)
  }
  for (let y = 0; y < height; y += step) {
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
  const tolerance = options.tolerance ?? 34
  const background = options.background
  const bg = background ?? estimateBackground(data, width, height, channels)
  const total = width * height
  const alpha = new Uint8Array(total).fill(255)
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0

  const distance = (i) => {
    const p = i * channels
    return Math.max(
      Math.abs(data[p] - bg[0]),
      Math.abs(data[p + 1] - bg[1]),
      Math.abs(data[p + 2] - bg[2])
    )
  }

  const seed = (i) => {
    if (visited[i]) return
    visited[i] = 1
    if (distance(i) <= tolerance) {
      alpha[i] = 0
      queue[tail++] = i
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
        const softness = Math.max(14, tolerance * 0.85)
        alpha[index] = clamp(Math.round(((edge - tolerance * 0.55) / softness) * 255), 0, 255)
      }
    }
  }

  for (let i = 0; i < total; i += 1) {
    data[i * channels + 3] = alpha[i]
  }
  return { background: bg, alpha }
}

function alphaBounds(alpha, width, height, threshold = 12) {
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
  if (maxX < 0) return { left: 0, top: 0, width, height }
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  }
}

function removeEnclosedBackground(data, alpha, width, height, channels, background, options = {}) {
  const maxDistance = options.maxDistance ?? 26
  const minArea = options.minArea ?? 5000
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)
  const distanceToBackground = (index) => {
    const offset = index * channels
    return Math.max(
      Math.abs(data[offset] - background[0]),
      Math.abs(data[offset + 1] - background[1]),
      Math.abs(data[offset + 2] - background[2])
    )
  }

  for (let start = 0; start < total; start += 1) {
    if (visited[start] || alpha[start] === 0) continue
    let head = 0
    let tail = 0
    visited[start] = 1
    if (distanceToBackground(start) > maxDistance) continue
    queue[tail++] = start
    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = (index / width) | 0
      const neighbors = []
      if (x > 0) neighbors.push(index - 1)
      if (x < width - 1) neighbors.push(index + 1)
      if (y > 0) neighbors.push(index - width)
      if (y < height - 1) neighbors.push(index + width)
      for (const neighbor of neighbors) {
        if (visited[neighbor] || alpha[neighbor] === 0) continue
        visited[neighbor] = 1
        if (distanceToBackground(neighbor) <= maxDistance) {
          queue[tail++] = neighbor
        }
      }
    }
    if (tail >= minArea) {
      for (let i = 0; i < tail; i += 1) {
        const index = queue[i]
        alpha[index] = 0
        data[index * channels + 3] = 0
      }
    }
  }
}

function fillSmallHoles(data, alpha, width, height, channels, maxArea) {
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)

  for (let start = 0; start < total; start += 1) {
    if (visited[start] || alpha[start] !== 0) continue
    let head = 0
    let tail = 0
    let touchesBorder = false
    visited[start] = 1
    queue[tail++] = start
    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = (index / width) | 0
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true
      if (x > 0) {
        const neighbor = index - 1
        if (!visited[neighbor] && alpha[neighbor] === 0) {
          visited[neighbor] = 1
          queue[tail++] = neighbor
        }
      }
      if (x < width - 1) {
        const neighbor = index + 1
        if (!visited[neighbor] && alpha[neighbor] === 0) {
          visited[neighbor] = 1
          queue[tail++] = neighbor
        }
      }
      if (y > 0) {
        const neighbor = index - width
        if (!visited[neighbor] && alpha[neighbor] === 0) {
          visited[neighbor] = 1
          queue[tail++] = neighbor
        }
      }
      if (y < height - 1) {
        const neighbor = index + width
        if (!visited[neighbor] && alpha[neighbor] === 0) {
          visited[neighbor] = 1
          queue[tail++] = neighbor
        }
      }
    }
    if (touchesBorder || tail > maxArea) continue

    let red = 0
    let green = 0
    let blue = 0
    let samples = 0
    for (let i = 0; i < tail; i += 1) {
      const index = queue[i]
      const x = index % width
      const y = (index / width) | 0
      const neighbors = []
      if (x > 0) neighbors.push(index - 1)
      if (x < width - 1) neighbors.push(index + 1)
      if (y > 0) neighbors.push(index - width)
      if (y < height - 1) neighbors.push(index + width)
      for (const neighbor of neighbors) {
        if (alpha[neighbor] === 0) continue
        const offset = neighbor * channels
        red += data[offset]
        green += data[offset + 1]
        blue += data[offset + 2]
        samples += 1
      }
    }
    if (samples === 0) continue
    const fillRed = Math.round(red / samples)
    const fillGreen = Math.round(green / samples)
    const fillBlue = Math.round(blue / samples)
    for (let i = 0; i < tail; i += 1) {
      const index = queue[i]
      const offset = index * channels
      data[offset] = fillRed
      data[offset + 1] = fillGreen
      data[offset + 2] = fillBlue
      data[offset + 3] = 255
      alpha[index] = 255
    }
  }
}

function removeSmallIslands(data, alpha, width, height, channels, minArea) {
  const total = width * height
  const visited = new Uint8Array(total)
  const queue = new Int32Array(total)

  for (let start = 0; start < total; start += 1) {
    if (visited[start] || alpha[start] === 0) continue
    let head = 0
    let tail = 0
    visited[start] = 1
    queue[tail++] = start
    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = (index / width) | 0
      const neighbors = []
      if (x > 0) neighbors.push(index - 1)
      if (x < width - 1) neighbors.push(index + 1)
      if (y > 0) neighbors.push(index - width)
      if (y < height - 1) neighbors.push(index + width)
      for (const neighbor of neighbors) {
        if (visited[neighbor] || alpha[neighbor] === 0) continue
        visited[neighbor] = 1
        queue[tail++] = neighbor
      }
    }
    if (tail >= minArea) continue
    for (let i = 0; i < tail; i += 1) {
      const index = queue[i]
      alpha[index] = 0
      data[index * channels + 3] = 0
    }
  }
}

function recolorShadowBoxes(data, alpha, width, height, channels, boxes) {
  const normalized = boxes.map(([x0, y0, x1, y1]) => ({
    x0: Math.floor(x0 * width),
    x1: Math.ceil(x1 * width),
    y0: Math.floor(y0 * height),
    y1: Math.ceil(y1 * height)
  }))
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inBox = normalized.some((box) => x >= box.x0 && x < box.x1 && y >= box.y0 && y < box.y1)
      if (!inBox) continue
      const index = y * width + x
      if (alpha[index] === 0) continue
      const offset = index * channels
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const luminance = (r + g + b) / 3
      if (max - min < 24 && luminance > 135) {
        data[offset] = 38
        data[offset + 1] = 28
        data[offset + 2] = 22
      }
    }
  }
}

function distanceInsideObject(alpha, width, height, limit) {
  const total = width * height
  const distances = new Uint8Array(total).fill(255)
  const queue = new Int32Array(total)
  let head = 0
  let tail = 0
  for (let i = 0; i < total; i += 1) {
    if (alpha[i] !== 0) continue
    const x = i % width
    const y = (i / width) | 0
    if (
      (x > 0 && alpha[i - 1] > 0) ||
      (x < width - 1 && alpha[i + 1] > 0) ||
      (y > 0 && alpha[i - width] > 0) ||
      (y < height - 1 && alpha[i + width] > 0)
    ) {
      distances[i] = 1
      queue[tail++] = i
    }
  }
  while (head < tail) {
    const index = queue[head++]
    const distance = distances[index]
    if (distance >= limit) continue
    const x = index % width
    const y = (index / width) | 0
    const neighbors = []
    if (x > 0) neighbors.push(index - 1)
    if (x < width - 1) neighbors.push(index + 1)
    if (y > 0) neighbors.push(index - width)
    if (y < height - 1) neighbors.push(index + width)
    for (const neighbor of neighbors) {
      if (alpha[neighbor] === 0 || distances[neighbor] !== 255) continue
      distances[neighbor] = distance + 1
      queue[tail++] = neighbor
    }
  }
  return distances
}

async function applyShadowBoxes(file, boxes) {
  const source = await fs.readFile(file)
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const alpha = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i += 1) {
    alpha[i] = data[i * channels + 3]
  }
  recolorShadowBoxes(data, alpha, width, height, channels, boxes)
  const output = await sharp(data, { raw: { width, height, channels } })
    .webp({ quality: 92, alphaQuality: 100, effort: 5 })
    .toBuffer()
  await fs.writeFile(file, output)
}

async function cutout(input, output, options = {}) {
  const { data, width, height, channels } = await readRaw(input)
  const { alpha, background } = removeBackground(data, width, height, channels, options)
  if (options.removeEnclosedBackground) {
    removeEnclosedBackground(data, alpha, width, height, channels, background, {
      maxDistance: options.enclosedBgDistance ?? 20,
      minArea: options.enclosedBgMinArea ?? 6000
    })
  }
  if (options.fillHoles) {
    fillSmallHoles(data, alpha, width, height, channels, options.fillHoles)
  }
  if (options.removeIslands) {
    removeSmallIslands(data, alpha, width, height, channels, options.removeIslands)
  }
  if (options.darkenSoftEdges) {
    for (let i = 0; i < width * height; i += 1) {
      const offset = i * channels
      const a = data[offset + 3]
      if (a <= 0 || a >= 238) continue
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const luminance = (r + g + b) / 3
      if (max - min < 28 && luminance > 125) {
        data[offset] = 44
        data[offset + 1] = 32
        data[offset + 2] = 25
      }
    }
  }
  if (options.darkenShadow) {
    const limit = options.shadowDistance ?? 160
    const distances = distanceInsideObject(alpha, width, height, limit)
    for (let i = 0; i < width * height; i += 1) {
      const distance = distances[i]
      if (distance === 0 || distance === 255) continue
      const offset = i * channels
      if (data[offset + 3] === 0) continue
      const r = data[offset]
      const g = data[offset + 1]
      const b = data[offset + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const luminance = (r + g + b) / 3
      if (max - min < 18 && luminance > 140) {
        data[offset] = 38
        data[offset + 1] = 28
        data[offset + 2] = 22
      }
    }
  }
  const bounds = alphaBounds(alpha, width, height, options.alphaThreshold ?? 12)
  const pad = options.pad ?? 4
  const left = clamp(bounds.left - pad, 0, width - 1)
  const top = clamp(bounds.top - pad, 0, height - 1)
  const cropWidth = Math.min(bounds.width + pad * 2, width - left)
  const cropHeight = Math.min(bounds.height + pad * 2, height - top)
  const buffer = await sharp(data, {
    raw: { width, height, channels }
  })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .png()
    .toBuffer()

  let image = sharp(buffer)
  if (options.maxWidth || options.maxHeight) {
    image = image.resize({
      width: options.maxWidth,
      height: options.maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
  }
  await image
    .webp({ quality: options.quality ?? 92, alphaQuality: 100, effort: 5 })
    .toFile(output)
  return {
    width: cropWidth,
    height: cropHeight,
    background,
    bounds
  }
}

async function processRoom() {
  const source = path.join(SRC, 'room-background.jpg')
  const destination = path.join(OUT, 'room.webp')
  await sharp(source)
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 88, effort: 5 })
    .toFile(destination)
}

async function splitDuo() {
  const source = path.join(SRC, 'character-duo.png')
  const meta = await sharp(source).metadata()
  const left = await sharp(source)
    .extract({ left: 0, top: 0, width: 720, height: meta.height })
    .png()
    .toBuffer()
  const right = await sharp(source)
    .extract({ left: 816, top: 0, width: 720, height: meta.height })
    .png()
    .toBuffer()
  return { left, right }
}

async function prepareCharacter(input, output, options = {}) {
  const { data, width, height, channels } = await readRaw(input)
  const { alpha, background } = removeBackground(data, width, height, channels, {
    tolerance: options.tolerance ?? 35,
    background: options.background
  })
  const bounds = alphaBounds(alpha, width, height, 16)
  const pad = 4
  const left = clamp(bounds.left - pad, 0, width - 1)
  const top = clamp(bounds.top - pad, 0, height - 1)
  const cropWidth = Math.min(bounds.width + pad * 2, width - left)
  const cropHeight = Math.min(bounds.height + pad * 2, height - top)
  const bodyHeight = options.bodyHeight ?? 700
  const canvasWidth = 600
  const canvasHeight = 800
  const bottomPad = options.bottomPad ?? 22
  const resized = await sharp(data, { raw: { width, height, channels } })
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ height: bodyHeight, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer()
  const resizedMeta = await sharp(resized).metadata()
  const leftPosition = Math.round((canvasWidth - resizedMeta.width) / 2)
  const topPosition = canvasHeight - bottomPad - resizedMeta.height
  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resized, left: leftPosition, top: topPosition }])
    .webp({ quality: 95, alphaQuality: 100, effort: 5 })
    .toFile(output)
  return { background, bounds, resized: resizedMeta }
}

async function processCharacters() {
  const idle = await prepareCharacter(path.join(SRC, 'character-idle.png'), path.join(OUT, 'char-idle.webp'), {
    tolerance: 36
  })
  const duo = await splitDuo()
  const duoRaw = await readRaw(path.join(SRC, 'character-duo.png'))
  const duoBackground = estimateBackground(duoRaw.data, duoRaw.width, duoRaw.height, duoRaw.channels)
  const wave = await prepareCharacter(duo.left, path.join(OUT, 'char-wave.webp'), {
    tolerance: 34,
    background: duoBackground
  })
  const blink = await prepareCharacter(duo.right, path.join(OUT, 'char-blink.webp'), {
    tolerance: 34,
    background: duoBackground
  })
  return { idle, wave, blink, duoBackground }
}

function connectedComponents(alpha, width, height, threshold = 24) {
  const total = width * height
  const visited = new Uint8Array(total)
  const labels = new Int32Array(total).fill(-1)
  const queue = new Int32Array(total)
  const found = []
  for (let start = 0; start < total; start += 1) {
    if (visited[start] || alpha[start] <= threshold) continue
    const id = found.length
    let head = 0
    let tail = 0
    queue[tail++] = start
    visited[start] = 1
    labels[start] = id
    let minX = width
    let minY = height
    let maxX = -1
    let maxY = -1
    let area = 0
    while (head < tail) {
      const index = queue[head++]
      const x = index % width
      const y = (index / width) | 0
      area += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          const neighbor = ny * width + nx
          if (visited[neighbor] || alpha[neighbor] <= threshold) continue
          visited[neighbor] = 1
          labels[neighbor] = id
          queue[tail++] = neighbor
        }
      }
    }
    if (area >= 2200) {
      found.push({ id, left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, area })
    }
  }
  const components = found.sort((a, b) => (a.top - b.top) || (a.left - b.left))
  return { components, labels }
}

async function processDecor() {
  const source = path.join(SRC, 'decor-sheet.jpg')
  const { data, width, height, channels } = await readRaw(source)
  const { alpha } = removeBackground(data, width, height, channels, { tolerance: 74 })
  await fs.mkdir(TMP, { recursive: true })
  const { components, labels } = connectedComponents(alpha, width, height, 24)
  const selections = new Map([
    [0, { name: 'decor-frame-abstract.webp', width: 500 }],
    [1, { name: 'decor-frame-landscape.webp', width: 500 }],
    [6, { name: 'decor-plant.webp', width: 500 }],
    [11, { name: 'decor-rug.webp', width: 1100 }]
  ])
  const exported = []
  const prepared = []
  for (let index = 0; index < components.length; index += 1) {
    const component = components[index]
    const pad = 6
    const left = clamp(component.left - pad, 0, width - 1)
    const top = clamp(component.top - pad, 0, height - 1)
    const cropWidth = Math.min(component.width + pad * 2, width - left)
    const cropHeight = Math.min(component.height + pad * 2, height - top)
    const crop = Buffer.alloc(cropWidth * cropHeight * 4)
    for (let y = 0; y < cropHeight; y += 1) {
      for (let x = 0; x < cropWidth; x += 1) {
        const sourceIndex = (top + y) * width + (left + x)
        if (labels[sourceIndex] !== component.id) continue
        const from = sourceIndex * channels
        const to = (y * cropWidth + x) * 4
        crop[to] = data[from]
        crop[to + 1] = data[from + 1]
        crop[to + 2] = data[from + 2]
        crop[to + 3] = data[from + 3]
      }
    }
    const selection = selections.get(index)
    if (selection) {
      await sharp(crop, { raw: { width: cropWidth, height: cropHeight, channels: 4 } })
        .resize({ width: selection.width, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 92, alphaQuality: 100, effort: 5 })
        .toFile(path.join(OUT, selection.name))
      exported.push(selection.name)
    }
    const buffer = await sharp(crop, { raw: { width: cropWidth, height: cropHeight, channels: 4 } })
      .resize({ width: 260, height: 260, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer()
    const label = String(index + 1).padStart(2, '0')
    const file = path.join(TMP, `decor-${label}.png`)
    await fs.writeFile(file, buffer)
    const meta = await sharp(buffer).metadata()
    prepared.push({ index, label, file, meta, component })
  }

  const columns = 5
  const cellWidth = 300
  const cellHeight = 300
  const rows = Math.ceil(prepared.length / columns)
  const sheetWidth = columns * cellWidth
  const sheetHeight = rows * cellHeight
  const composites = []
  for (let i = 0; i < prepared.length; i += 1) {
    const item = prepared[i]
    const column = i % columns
    const row = Math.floor(i / columns)
    const x = column * cellWidth + Math.round((cellWidth - item.meta.width) / 2)
    const y = row * cellHeight + 40
    composites.push({ input: item.file, left: x, top: y })
    const labelSvg = Buffer.from(
      `<svg width="300" height="40"><text x="150" y="28" font-family="Arial" font-size="24" fill="#ffffff" text-anchor="middle">${item.label}</text></svg>`
    )
    composites.push({ input: labelSvg, left: column * cellWidth, top: row * cellHeight })
  }
  const backgroundSvg = Buffer.from(
    `<svg width="${sheetWidth}" height="${sheetHeight}"><rect width="100%" height="100%" fill="#4a4a4a"/></svg>`
  )
  await sharp(backgroundSvg).composite(composites).png().toFile(path.join(TMP, 'decor-contact-sheet.png'))

  return { components, count: prepared.length, exported }
}

async function processFurniture() {
  const jobs = [
    ['bed.jpg', 'bed.webp', { maxWidth: 1100, tolerance: 82, darkenSoftEdges: true, darkenShadow: true, shadowDistance: 190, removeEnclosedBackground: true, fillHoles: 600, removeIslands: 60, shadowBoxes: [[0, 0.93, 1, 1]] }],
    ['desk.jpg', 'desk.webp', { maxWidth: 1200, tolerance: 82, darkenSoftEdges: true, darkenShadow: true, shadowDistance: 190, removeEnclosedBackground: true, fillHoles: 600, removeIslands: 60, shadowBoxes: [[0, 0.94, 1, 1]] }],
    ['bedside-table.jpg', 'bedside-table.webp', { maxWidth: 520, tolerance: 78, darkenSoftEdges: true, darkenShadow: true, shadowDistance: 130, removeEnclosedBackground: true, fillHoles: 100, removeIslands: 40, shadowBoxes: [[0, 0.94, 1, 1]] }],
    ['lamp.jpg', 'lamp.webp', { maxWidth: 420, tolerance: 30, darkenSoftEdges: true, fillHoles: 60, removeIslands: 30, shadowBoxes: [[0, 0.92, 1, 1]] }],
    ['window.jpg', 'window.webp', { maxWidth: 850, tolerance: 56, darkenSoftEdges: true }],
    ['chair.jpg', 'chair.webp', { maxWidth: 520, tolerance: 82, darkenSoftEdges: true, darkenShadow: true, shadowDistance: 190, removeEnclosedBackground: true, fillHoles: 100, removeIslands: 60, shadowBoxes: [[0, 0.94, 1, 1]] }],
    ['computer.jpg', 'computer.webp', { maxWidth: 520, tolerance: 46, darkenSoftEdges: true, fillHoles: 200, removeIslands: 40, shadowBoxes: [[0, 0.6, 0.24, 0.98], [0, 0.88, 0.55, 1], [0, 0.92, 1, 1]] }]
  ]
  const results = {}
  for (const [input, output, options] of jobs) {
    const destination = path.join(OUT, output)
    results[output] = await cutout(path.join(SRC, input), destination, options)
    if (options.shadowBoxes) {
      await applyShadowBoxes(destination, options.shadowBoxes)
    }
  }
  return results
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  await processRoom()
  const characters = await processCharacters()
  const furniture = await processFurniture()
  const decor = await processDecor()

  const report = {
    characters,
    furniture,
    decorComponents: decor.count,
    decor: decor.components
  }
  await fs.writeFile(path.join(TMP, 'asset-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
