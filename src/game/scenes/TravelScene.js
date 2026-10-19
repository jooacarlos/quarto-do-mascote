import Phaser from 'phaser'
import { ASSET_BASE, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../constants.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import { getSoundManager } from '../systems/SoundManager.js'
import { ensureEffectTextures } from '../effects.js'

export default class TravelScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.TRAVEL })
  }

  init(data = {}) {
    this.target = data.target ?? SCENES.DUCK
    this.area = data.area ?? 'dance'
    this.from = data.from ?? 'bedroom'
    this.traveling = false
  }

  preload() {
    this.load.setPath(ASSET_BASE)
    if (!this.textures.exists('duck-exterior')) {
      this.load.image('duck-exterior', 'duck-exterior.webp')
    }
  }

  create() {
    ensureEffectTextures(this)
    this.cameras.main.setBackgroundColor('#070409')
    this.cameras.main.fadeIn(260, 0, 0, 0)

    const background = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'duck-exterior')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(0)

    this.tweens.add({
      targets: background,
      scale: 1.06,
      duration: 2200,
      ease: 'Sine.easeOut'
    })

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x050208, 0.26)
      .setDepth(1)

    const glow = this.add
      .image(GAME_WIDTH / 2, 300, 'warm-glow')
      .setDisplaySize(760, 420)
      .setTint(0xff4fd8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.22)
      .setDepth(2)

    this.tweens.add({
      targets: glow,
      alpha: 0.42,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    const goingToDuck = this.target === SCENES.DUCK
    const title = goingToDuck ? 'DUCK' : 'QUARTO'
    const kicker = goingToDuck ? 'NIGHTCLUB & LOUNGE' : 'DO MASCOTE'
    const message = goingToDuck ? 'Entrando na balada...' : 'Voltando para casa...'

    this.add
      .text(GAME_WIDTH / 2, 236, kicker, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffe6fb',
        letterSpacing: 7
      })
      .setOrigin(0.5)
      .setAlpha(0.8)
      .setDepth(3)

    this.add
      .text(GAME_WIDTH / 2, 306, title, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '86px',
        fontStyle: 'bold',
        color: '#fff4ff',
        stroke: goingToDuck ? '#ff3fd4' : '#e6a35c',
        strokeThickness: 7
      })
      .setOrigin(0.5)
      .setShadow(0, 0, goingToDuck ? '#ff3fd4' : '#e6a35c', 30, true, true)
      .setDepth(3)

    const dots = goingToDuck ? '•  •  •' : '•  •  •'
    this.add
      .text(GAME_WIDTH / 2, 398, message, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '19px',
        fontStyle: 'bold',
        color: '#fff4ea'
      })
      .setOrigin(0.5)
      .setAlpha(0.86)
      .setDepth(3)

    this.add
      .text(GAME_WIDTH / 2, 438, dots, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '22px',
        color: '#ffd3f6'
      })
      .setOrigin(0.5)
      .setAlpha(0.7)
      .setDepth(3)

    const sound = getSoundManager()
    sound.setClubMode(false)
    sound.play('travel')

    gameBus.emit(EVENTS.TRAVEL_STATE, {
      phase: 'traveling',
      from: this.from,
      target: goingToDuck ? 'duck' : 'bedroom'
    })

    this.time.delayedCall(1450, () => {
      this.cameras.main.fadeOut(480, 5, 2, 8)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(this.target, {
          from: this.from,
          fromTravel: true,
          area: this.area
        })
      })
    })

    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        travel: (target = this.target) => {
          this.scene.start(target, { from: this.from, area: this.area })
        },
        snapshot: () => ({ scene: 'travel', target: this.target, area: this.area })
      }
    }

    this.events.once('shutdown', () => {
      if (import.meta.env.DEV && window.__mascot?.scene === this) {
        delete window.__mascot
      }
    })
  }
}
