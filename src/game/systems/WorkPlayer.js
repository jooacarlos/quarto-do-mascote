import Phaser from 'phaser'
import { addSoftShadow } from '../effects.js'

const PLAYER_HEIGHT = 380
const FOOT_WIDTH = 74
const FOOT_HEIGHT = 30

export default class WorkPlayer {
  constructor(scene, options = {}) {
    this.scene = scene
    this.height = options.height ?? PLAYER_HEIGHT
    this.bounds = options.bounds ?? { left: 80, right: 1200, top: 500, bottom: 690 }
    this.obstacles = options.obstacles ?? []
    this.speed = options.speed ?? 230
    this.carrySpeed = options.carrySpeed ?? 150
    this.onInteract = options.onInteract
    this.locked = false
    this.touch = { x: 0, y: 0 }
    this.grounded = true
    this.carry = null
    this.carryTexture = null
    this.shadow = addSoftShadow(
      scene,
      options.x ?? 640,
      (options.y ?? 650) - 2,
      150,
      28,
      0.3,
      (options.y ?? 650) - 1
    )

    this.sprite = scene.add
      .sprite(options.x ?? 640, options.y ?? 650, 'char-idle')
      .setOrigin(0.5, 1)
      .setDisplaySize(this.height * 0.75, this.height)
      .setDepth(options.y ?? 650)

    this.cursors = scene.input.keyboard.createCursorKeys()
    this.keys = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    })
    this.interactKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    this.interactKey.on('down', () => {
      if (!this.locked) this.onInteract?.()
    })
    scene.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE
    ])

    this.handleTouch = (vector) => {
      this.touch.x = Phaser.Math.Clamp(Number(vector?.x) || 0, -1, 1)
      this.touch.y = Phaser.Math.Clamp(Number(vector?.y) || 0, -1, 1)
    }
  }

  setTouchVector(vector) {
    this.handleTouch(vector)
  }

  setLocked(locked) {
    this.locked = Boolean(locked)
    this.touch.x = 0
    this.touch.y = 0
    if (this.locked) this.stopWalking()
  }

  setCarry(texture) {
    this.carryTexture = texture
    if (!this.carry) {
      this.carry = this.scene.add
        .image(this.sprite.x, this.sprite.y - 150, texture)
        .setOrigin(0.5, 1)
        .setDepth(this.sprite.depth + 2)
    } else {
      this.carry.setTexture(texture)
    }
    const source = this.scene.textures.get(texture).getSourceImage()
    this.carry.setDisplaySize(104, (104 * source.height) / source.width)
    this.carry.setVisible(true)
    this.updateCarry()
    const baseScaleX = this.carry.scaleX
    const baseScaleY = this.carry.scaleY
    this.scene.tweens.add({
      targets: this.carry,
      scaleX: baseScaleX * 1.08,
      scaleY: baseScaleY * 1.08,
      duration: 120,
      yoyo: true,
      ease: 'Sine.easeOut'
    })
  }

  clearCarry() {
    this.carryTexture = null
    if (!this.carry) return
    const carry = this.carry
    this.carry = null
    this.scene.tweens.add({
      targets: carry,
      alpha: 0,
      y: carry.y + 18,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => carry.destroy()
    })
  }

  updateCarry() {
    if (!this.carry?.visible) return
    const direction = this.sprite.flipX ? -1 : 1
    this.carry.setPosition(this.sprite.x + direction * 55, this.sprite.y - this.height * 0.18)
    this.carry.setDepth(this.sprite.depth + 2)
    this.carry.setFlipX(this.sprite.flipX)
  }

  get isCarrying() {
    return Boolean(this.carryTexture)
  }

  distanceTo(x, y) {
    return Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y - 20, x, y)
  }

  update(delta) {
    if (!this.sprite?.active) return
    if (this.locked) {
      this.stopWalking()
      this.syncVisuals()
      return
    }

    let x = 0
    let y = 0
    if (this.cursors.left.isDown || this.keys.left.isDown) x -= 1
    if (this.cursors.right.isDown || this.keys.right.isDown) x += 1
    if (this.cursors.up.isDown || this.keys.up.isDown) y -= 1
    if (this.cursors.down.isDown || this.keys.down.isDown) y += 1
    if (x === 0 && y === 0) {
      x = this.touch.x
      y = this.touch.y
    }

    const length = Math.hypot(x, y)
    if (length < 0.08) {
      this.stopWalking()
      this.syncVisuals()
      return
    }

    x /= length
    y /= length
    const speed = this.isCarrying ? this.carrySpeed : this.speed
    const distance = (speed * delta) / 1000
    const nextX = this.sprite.x + x * distance
    const nextY = this.sprite.y + y * distance

    if (!this.collides(nextX, this.sprite.y)) this.sprite.x = nextX
    if (!this.collides(this.sprite.x, nextY)) this.sprite.y = nextY
    this.sprite.x = Phaser.Math.Clamp(this.sprite.x, this.bounds.left, this.bounds.right)
    this.sprite.y = Phaser.Math.Clamp(this.sprite.y, this.bounds.top, this.bounds.bottom)

    this.sprite.setFlipX(x < -0.05 ? true : x > 0.05 ? false : this.sprite.flipX)
    if (this.sprite.anims.currentAnim?.key !== 'mb-walk') {
      this.sprite.anims.play('mb-walk', true)
    }
    this.syncVisuals()
  }

  collides(x, y) {
    const foot = new Phaser.Geom.Rectangle(
      x - FOOT_WIDTH / 2,
      y - FOOT_HEIGHT,
      FOOT_WIDTH,
      FOOT_HEIGHT
    )
    for (const obstacle of this.obstacles) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(foot, obstacle)) return true
    }
    return false
  }

  stopWalking() {
    if (!this.sprite?.anims) return
    if (this.sprite.anims.currentAnim?.key === 'mb-walk') {
      this.sprite.anims.stop()
      this.sprite.setTexture('char-idle')
    }
  }

  syncVisuals() {
    this.sprite.setDepth(this.sprite.y + 4)
    this.shadow.setPosition(this.sprite.x, this.sprite.y - 2)
    this.shadow.setDepth(this.sprite.y - 1)
    this.updateCarry()
  }

  setPosition(x, y) {
    this.sprite.setPosition(x, y)
    this.sprite.setTexture('char-idle')
    this.sprite.anims.stop()
    this.sprite.setFlipX(false)
    this.touch.x = 0
    this.touch.y = 0
    this.syncVisuals()
  }

  destroy() {
    this.interactKey?.off('down')
    this.interactKey = null
    this.cursors = null
    this.keys = null
    this.carry?.destroy()
    this.carry = null
    this.shadow?.destroy()
    this.shadow = null
    this.sprite?.destroy()
    this.sprite = null
  }
}
