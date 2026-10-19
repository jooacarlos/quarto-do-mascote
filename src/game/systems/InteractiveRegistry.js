import { isCanvasPointer } from '../input.js'

export default class InteractiveRegistry {
  constructor(scene) {
    this.scene = scene
    this.items = []
  }

  add(target, options = {}) {
    if (!target.input) {
      target.setInteractive({ useHandCursor: true })
    }

    const baseScaleX = target.scaleX
    const baseScaleY = target.scaleY
    const hoverScale = options.hoverScale ?? 1.04

    const handleOver = () => {
      this.scene.tweens.add({
        targets: target,
        scaleX: baseScaleX * hoverScale,
        scaleY: baseScaleY * hoverScale,
        duration: 90,
        ease: 'Sine.easeOut',
        overwrite: true
      })
    }

    const handleOut = () => {
      this.scene.tweens.add({
        targets: target,
        scaleX: baseScaleX,
        scaleY: baseScaleY,
        duration: 120,
        ease: 'Sine.easeOut',
        overwrite: true
      })
    }

    const handleDown = (pointer) => {
      if (!isCanvasPointer(this.scene, pointer)) return
      options.onClick?.()
    }

    target.on('pointerover', handleOver)
    target.on('pointerout', handleOut)
    target.on('pointerdown', handleDown)

    this.items.push({ target, handleOver, handleOut, handleDown })
    return target
  }

  destroy() {
    for (const item of this.items) {
      item.target.off('pointerover', item.handleOver)
      item.target.off('pointerout', item.handleOut)
      item.target.off('pointerdown', item.handleDown)
    }
    this.items = []
  }
}
