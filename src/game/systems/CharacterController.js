import Phaser from 'phaser'

const IDLE_TEXTURE = 'char-idle'
const BLINK_TEXTURE = 'char-blink'
const WAVE_TEXTURE = 'char-wave'

const BLINK_MIN_DELAY = 3200
const BLINK_MAX_DELAY = 6800
const BLINK_DURATION = 140
const WAVE_DURATION = 2000
const HAPPY_DURATION = 1900
const TALK_DURATION = 2800
const DRINK_DURATION = 2600

export default class CharacterController {
  constructor(scene, sprite, options = {}) {
    this.scene = scene
    this.sprite = sprite
    this.baseY = options.baseY ?? sprite.y
    this.blinkEnabled = options.blinkEnabled ?? true
    this.onStateChange = options.onStateChange
    this.state = 'idle'
    this.active = true
    this.blinkTimer = null
    this.actionTimer = null
    this.bobTween = null
    this.moveTween = null

    this.sprite.setTexture(IDLE_TEXTURE)
    this.sprite.y = this.baseY

    this.handleVisibility = this.handleVisibility.bind(this)
    document.addEventListener('visibilitychange', this.handleVisibility)
    this.scene.events.once('shutdown', this.destroy, this)

    this.scheduleBlink(2600)
  }

  setState(state) {
    this.state = state
    this.onStateChange?.(state)
  }

  clearActionTimer() {
    if (this.actionTimer) {
      this.actionTimer.remove(false)
      this.actionTimer = null
    }
  }

  clearMotion() {
    this.actionTimer = null
    this.bobTween?.stop()
    this.bobTween = null
    this.moveTween?.stop()
    this.moveTween = null
  }

  scheduleBlink(delay) {
    this.clearBlinkTimer()
    if (!this.active || !this.blinkEnabled || this.state !== 'idle') return
    const wait = delay ?? Phaser.Math.Between(BLINK_MIN_DELAY, BLINK_MAX_DELAY)
    this.blinkTimer = this.scene.time.delayedCall(wait, () => {
      this.blinkTimer = null
      this.doBlink()
    })
  }

  doBlink() {
    if (!this.active || !this.blinkEnabled || this.state !== 'idle') {
      this.scheduleBlink()
      return
    }
    this.setState('blinking')
    this.sprite.setTexture(BLINK_TEXTURE)
    this.blinkTimer = this.scene.time.delayedCall(BLINK_DURATION, () => {
      this.blinkTimer = null
      if (!this.active) return
      this.sprite.setTexture(IDLE_TEXTURE)
      this.setState('idle')
      this.scheduleBlink()
    })
  }

  blinkNow() {
    if (!this.active || !this.blinkEnabled || this.state !== 'idle') return false
    this.clearBlinkTimer()
    this.doBlink()
    return true
  }

  playTextured(texture, state) {
    this.clearActionTimer()
    this.clearBlinkTimer()
    this.sprite.anims.stop()
    this.sprite.setTexture(texture)
    this.sprite.y = this.baseY
    this.setState(state)
  }

  playAnimation(key, state) {
    this.clearActionTimer()
    this.clearBlinkTimer()
    this.sprite.anims.play(key, true)
    this.sprite.y = this.baseY
    this.setState(state)
  }

  idle() {
    this.clearActionTimer()
    this.clearMotion()
    this.sprite.anims.stop()
    this.sprite.setTexture(IDLE_TEXTURE)
    this.sprite.y = this.baseY
    this.setState('idle')
    this.scheduleBlink(2200)
  }

  wave() {
    if (!this.active || this.isBusy() || this.state === 'waving' || this.state === 'talking') return false
    this.playTextured(WAVE_TEXTURE, 'waving')
    this.bobTween = this.scene.tweens.add({
      targets: this.sprite,
      y: this.baseY - 4,
      duration: 170,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      overwrite: true
    })
    this.actionTimer = this.scene.time.delayedCall(WAVE_DURATION, () => {
      this.actionTimer = null
      this.bobTween?.stop()
      this.bobTween = null
      if (!this.active) return
      this.idle()
    })
    return true
  }

  happy(duration = HAPPY_DURATION) {
    if (!this.active || ['walking', 'drinking', 'talking'].includes(this.state)) return false
    this.playAnimation('mb-happy', 'happy')
    this.bobTween = this.scene.tweens.add({
      targets: this.sprite,
      y: this.baseY - 9,
      duration: 160,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      overwrite: true
    })
    this.actionTimer = this.scene.time.delayedCall(duration, () => {
      this.actionTimer = null
      this.bobTween?.stop()
      this.bobTween = null
      if (!this.active) return
      this.idle()
    })
    return true
  }

  dance() {
    if (!this.active || ['walking', 'drinking', 'talking', 'happy'].includes(this.state)) return false
    this.playAnimation('mb-dance', 'dancing')
    return true
  }

  talk(duration = TALK_DURATION) {
    if (!this.active) return false
    if (['walking', 'drinking', 'happy'].includes(this.state)) return false
    if (this.state === 'talking') {
      this.clearActionTimer()
      this.actionTimer = this.scene.time.delayedCall(duration, () => {
        this.actionTimer = null
        if (!this.active) return
        this.idle()
      })
      return true
    }
    this.bobTween?.stop()
    this.bobTween = null
    this.playAnimation('mb-talk', 'talking')
    this.actionTimer = this.scene.time.delayedCall(duration, () => {
      this.actionTimer = null
      if (!this.active) return
      this.idle()
    })
    return true
  }

  stopDance() {
    if (this.state !== 'dancing') return false
    this.idle()
    return true
  }

  drink(onComplete) {
    if (!this.active || ['walking', 'talking', 'happy'].includes(this.state)) return false
    this.playAnimation('mb-drink', 'drinking')
    this.actionTimer = this.scene.time.delayedCall(DRINK_DURATION, () => {
      this.actionTimer = null
      if (!this.active) return
      this.idle()
      onComplete?.()
    })
    return true
  }

  walkTo(x, y, duration = 1300, options = {}) {
    if (!this.active || this.state === 'walking') return false
    this.clearActionTimer()
    this.clearBlinkTimer()
    this.clearMotion()
    this.baseY = y
    this.sprite.anims.play('mb-walk', true)
    this.sprite.setFlipX(x < this.sprite.x)
    this.sprite.y = this.baseY
    this.setState('walking')
    this.moveTween = this.scene.tweens.add({
      targets: this.sprite,
      x,
      duration,
      ease: options.ease ?? 'Sine.easeInOut',
      onComplete: () => {
        this.moveTween = null
        if (!this.active) return
        this.sprite.x = x
        this.sprite.y = this.baseY
        this.sprite.setFlipX(false)
        this.idle()
        options.onComplete?.()
      }
    })
    return true
  }

  setPosition(x, y) {
    this.clearActionTimer()
    this.clearMotion()
    this.clearBlinkTimer()
    this.sprite.anims.stop()
    this.sprite.setTexture(IDLE_TEXTURE)
    this.sprite.setPosition(x, y)
    this.baseY = y
    this.sprite.setFlipX(false)
    this.setState('idle')
    this.scheduleBlink(2400)
  }

  faceLeft() {
    this.sprite.setFlipX(true)
  }

  faceRight() {
    this.sprite.setFlipX(false)
  }

  isBusy() {
    return ['walking', 'drinking', 'happy'].includes(this.state)
  }

  handleVisibility() {
    if (document.visibilityState === 'hidden') {
      this.pause()
    } else {
      this.resume()
    }
  }

  pause() {
    if (!this.active) return
    const wasActive = this.state !== 'idle'
    this.active = false
    this.clearBlinkTimer()
    this.clearActionTimer()
    this.clearMotion()
    this.sprite.anims.stop()
    this.sprite.setTexture(IDLE_TEXTURE)
    this.sprite.y = this.baseY
    this.state = 'idle'
    if (wasActive) this.onStateChange?.('idle')
  }

  resume() {
    if (this.active) return
    this.active = true
    this.scheduleBlink(2400)
  }

  clearBlinkTimer() {
    if (this.blinkTimer) {
      this.blinkTimer.remove(false)
      this.blinkTimer = null
    }
  }

  destroy() {
    this.active = false
    this.clearBlinkTimer()
    this.clearActionTimer()
    this.bobTween?.stop()
    this.bobTween = null
    this.moveTween?.stop()
    this.moveTween = null
    this.sprite?.anims?.stop()
    document.removeEventListener('visibilitychange', this.handleVisibility)
    this.scene.events.off('shutdown', this.destroy, this)
  }
}
