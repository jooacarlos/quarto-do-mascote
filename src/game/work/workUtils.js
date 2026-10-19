import { ASSET_BASE } from '../constants.js'
import { ASSETS, CEASA_ASSETS } from '../assets.js'
import { createCharacterAnimations } from '../animations.js'
import { ensureEffectTextures } from '../effects.js'

const WORK_CHARACTER_KEYS = new Set([
  'char-idle',
  'char-blink',
  'char-wave',
  'mb-walk-0',
  'mb-walk-1',
  'mb-walk-2',
  'mb-walk-3'
])

export function preloadWorkAssets(scene) {
  scene.load.setPath(ASSET_BASE)
  for (const asset of CEASA_ASSETS) {
    if (!scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, asset.file)
    }
  }
  for (const asset of ASSETS) {
    if (WORK_CHARACTER_KEYS.has(asset.key) && !scene.textures.exists(asset.key)) {
      scene.load.image(asset.key, asset.file)
    }
  }
}

export function prepareWorkScene(scene) {
  createCharacterAnimations(scene)
  ensureEffectTextures(scene)
}

export function addWorkBackground(scene, key, tint = 0xffffff, tintAlpha = 0) {
  const background = scene.add
    .image(640, 360, key)
    .setDisplaySize(1280, 720)
    .setDepth(-10)
  if (tintAlpha > 0) {
    scene.add
      .rectangle(640, 360, 1280, 720, tint, tintAlpha)
      .setDepth(-9)
  }
  return background
}

export function addZoneMarker(scene, x, y, width, height, color, label) {
  const glow = scene.add
    .ellipse(x, y, width, height, color, 0.16)
    .setStrokeStyle(3, color, 0.72)
    .setDepth(y - 2)
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.45, to: 0.95 },
    scaleX: { from: 0.96, to: 1.04 },
    scaleY: { from: 0.96, to: 1.04 },
    duration: 1100,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  })
  const text = scene.add
    .text(x, y - height / 2 - 8, label, {
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#fff8e8',
      stroke: '#3d2515',
      strokeThickness: 4,
      letterSpacing: 1
    })
    .setOrigin(0.5, 1)
    .setDepth(y + 12)
  return { glow, text }
}

export function workObjective({ title, objective, progress, detail }) {
  return { title, objective, progress, detail }
}
