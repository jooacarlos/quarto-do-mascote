import Phaser from 'phaser'

export function ensureEffectTextures(scene) {
  if (!scene.textures.exists('soft-shadow')) {
    const width = 256
    const height = 128
    const texture = scene.textures.createCanvas('soft-shadow', width, height)
    const context = texture.getContext()
    const gradient = context.createRadialGradient(width / 2, height / 2, 4, width / 2, height / 2, width / 2)
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)')
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, width, height)
    texture.refresh()
  }

  if (!scene.textures.exists('warm-glow')) {
    const size = 512
    const texture = scene.textures.createCanvas('warm-glow', size, size)
    const context = texture.getContext()
    const gradient = context.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
    gradient.addColorStop(0.38, 'rgba(255, 255, 255, 0.34)')
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    texture.refresh()
  }

  if (!scene.textures.exists('sparkle')) {
    const size = 96
    const texture = scene.textures.createCanvas('sparkle', size, size)
    const context = texture.getContext()
    const center = size / 2
    const gradient = context.createRadialGradient(center, center, 0, center, center, center)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.18, 'rgba(255, 236, 255, 0.85)')
    gradient.addColorStop(0.55, 'rgba(255, 160, 240, 0.22)')
    gradient.addColorStop(1, 'rgba(255, 160, 240, 0)')
    context.fillStyle = gradient
    context.beginPath()
    context.arc(center, center, center, 0, Math.PI * 2)
    context.fill()
    context.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(center, 8)
    context.lineTo(center, size - 8)
    context.moveTo(8, center)
    context.lineTo(size - 8, center)
    context.stroke()
    texture.refresh()
  }
}

export function addSoftShadow(scene, x, y, width, height, alpha = 0.26, depth = 1) {
  return scene.add
    .image(x, y, 'soft-shadow')
    .setDisplaySize(width, height)
    .setAlpha(alpha)
    .setDepth(depth)
}

export function addGlow(scene, x, y, width, height, tint, alpha = 0.25, depth = 1) {
  return scene.add
    .image(x, y, 'warm-glow')
    .setDisplaySize(width, height)
    .setTint(tint)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setAlpha(alpha)
    .setDepth(depth)
}
