import { ASSET_BASE, GAME_HEIGHT, GAME_WIDTH } from '../constants.js'
import { MUSEUM_ASSETS } from '../museum.js'

export function preloadMuseumAssets(scene) {
  scene.load.setPath(ASSET_BASE)
  for (const asset of MUSEUM_ASSETS) {
    if (!scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, asset.file)
    }
  }
}

export function addCoverImage(scene, key, options = {}) {
  const source = scene.textures.get(key).getSourceImage()
  const scale = Math.max(GAME_WIDTH / source.width, GAME_HEIGHT / source.height)
  return scene.add
    .image(options.x ?? GAME_WIDTH / 2, options.y ?? GAME_HEIGHT / 2, key)
    .setScale(scale * (options.zoom ?? 1))
    .setDepth(options.depth ?? -10)
}

export function addCinemaScrims(scene, depth = 100) {
  scene.add
    .rectangle(GAME_WIDTH / 2, 36, GAME_WIDTH, 120, 0x03080d, 0.72)
    .setDepth(depth)
  scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT - 58, GAME_WIDTH, 164, 0x03080d, 0.82)
    .setDepth(depth)
}

export function addButton(scene, options) {
  const {
    x,
    y,
    label,
    width = 180,
    height = 44,
    onClick,
    primary = false,
    depth = 2000,
    fontSize = 15
  } = options

  const baseColor = primary ? 0xf0b76b : 0x081820
  const hoverColor = primary ? 0xffcf8a : 0x11303c
  const borderColor = primary ? 0xffe8b8 : 0x8fe8ff
  const textColor = primary ? '#2b1808' : '#dffaff'

  const background = scene.add
    .rectangle(x, y, width, height, baseColor, primary ? 0.96 : 0.86)
    .setStrokeStyle(1, borderColor, primary ? 0.86 : 0.44)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true })

  const text = scene.add
    .text(x, y, label, {
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: `${fontSize}px`,
      fontStyle: 'bold',
      color: textColor,
      letterSpacing: 1
    })
    .setOrigin(0.5)
    .setDepth(depth + 1)

  let enabled = true

  background.on('pointerover', () => {
    if (!enabled) return
    background.setFillStyle(hoverColor, 0.98)
  })
  background.on('pointerout', () => {
    if (!enabled) return
    background.setFillStyle(baseColor, primary ? 0.96 : 0.86)
  })
  background.on('pointerdown', () => {
    if (enabled) onClick?.()
  })

  return {
    background,
    text,
    setLabel(value) {
      text.setText(value)
    },
    setEnabled(value) {
      enabled = Boolean(value)
      background.setAlpha(enabled ? 1 : 0.45)
      text.setAlpha(enabled ? 1 : 0.5)
    }
  }
}
