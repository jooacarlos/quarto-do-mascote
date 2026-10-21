import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SOURCE = path.resolve('assets-source/museum')
const ASSET_OUT = path.resolve('public/assets/museum')
const AUDIO_OUT = path.resolve('public/audio/museum')

async function background(file, output) {
  await sharp(path.join(SOURCE, file))
    .resize(1600, 900, { fit: 'cover' })
    .webp({ quality: 84 })
    .toFile(path.join(ASSET_OUT, output))
  console.log(output)
}

async function statueFromCutout(file, output) {
  await sharp(path.join(SOURCE, file))
    .trim({ threshold: 1 })
    .resize({ height: 720 })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(path.join(ASSET_OUT, output))
  console.log(output)
}

async function cutoutCharacter(file, output) {
  const { data, info } = await sharp(path.join(SOURCE, file))
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
    return dr * dr + dg * dg + db * db <= 58 * 58
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
    pixels[index * 4 + 3] = 0
  }

  await sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
    .trim({ threshold: 1 })
    .resize({ height: 720 })
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(path.join(ASSET_OUT, output))
  console.log(output)
}

async function copyAudio(file, output) {
  await fs.copyFile(path.join(SOURCE, 'audio', file), path.join(AUDIO_OUT, output))
  console.log(output)
}

await fs.mkdir(ASSET_OUT, { recursive: true })
await fs.mkdir(AUDIO_OUT, { recursive: true })

await Promise.all([
  background('quadro-paineiras.jpg', 'paineiras.webp'),
  background('museu-parte-de-dentro.jpg', 'lobby.webp'),
  background('museu-parte-de-fora.jpg', 'exterior.webp'),
  background('galeria-de-amigos-branco2.jpg', 'gallery-hall.webp'),
  background('galeria-de-amigos-branco3.jpg', 'gallery-atrium.webp'),
  background('branco-chegando-paineiras.jpg', 'story-chegando.webp'),
  background('branco-explorando-paineiras.jpg', 'story-explorando.webp'),
  background('branco-miguelBigode.jpg', 'story-miguel.webp'),
  background('branco-vitinho-paineiras.jpg', 'story-vitinho.webp'),
  background('vitin-paineiras-interações.jpg', 'story-vitinho-2.webp'),
  background('branco-levi.jpg', 'story-levi.webp'),
  background('branco-manuPaineiras.jpg', 'story-manu.webp'),
  background('manu-paineiras-interações.jpg', 'story-manu-2.webp'),
  background('revelação-branco-bigode.jpg', 'story-revelacao.webp'),
  background('Branco_growing_in_condominio_2K_20261021134106.jpg', 'story-growing.webp'),
  background('Branco_stands_in_heroic_pose_2K_20261021134109.jpg', 'story-heroico.webp'),
  background('galeria de amigos do branco.jpg', 'gallery-1.webp'),
])

await cutoutCharacter('vitin-paineiras.jpg', 'statue-vitinho.webp')
await cutoutCharacter('manu-paineiras.jpg', 'statue-manu.webp')
await statueFromCutout('cutout-levi.png', 'statue-levi.webp')
await statueFromCutout('cutout-miguel.png', 'statue-miguel.webp')

await Promise.all([
  copyAudio('branco-introdução-historia.mp3', '01-intro.mp3'),
  copyAudio('branco-falando-como-era-antes-de-ir-paineiras.mp3', '02-antes.mp3'),
  copyAudio('branco-carro-chegando-condomino.mp3', '03-chegando.mp3'),
  copyAudio('branco-explorando-condomino.mp3', '04-explorando.mp3'),
  copyAudio('branco-miguel.mp3', '05-miguel.mp3'),
  copyAudio('branco-vitinh.mp3', '06-vitinho.mp3'),
  copyAudio('branco-levi.mp3', '07-levi.mp3'),
  copyAudio('branco-manu.mp3', '08-manu.mp3'),
  copyAudio('branco-revelação-bigode.mp3', '09-revelacao.mp3'),
  copyAudio('final-da-historia.mp3', '10-final.mp3')
])
