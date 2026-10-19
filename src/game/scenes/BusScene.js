import Phaser from 'phaser'
import { SCENES } from '../constants.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import { getSoundManager } from '../systems/SoundManager.js'
import { addSoftShadow } from '../effects.js'
import { gameState, setShiftStage } from '../state.js'
import { addWorkBackground, preloadWorkAssets, prepareWorkScene } from '../work/workUtils.js'

export default class BusScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BUS })
    this.leaving = false
  }

  init(data = {}) {
    this.from = data.from ?? 'street'
    this.leaving = false
  }

  preload() {
    preloadWorkAssets(this)
  }

  create() {
    prepareWorkScene(this)
    setShiftStage('bus')
    this.cameras.main.setBackgroundColor('#171b2a')
    const background = addWorkBackground(this, 'ceasa-bus-interior')
    this.add
      .rectangle(640, 360, 1280, 720, 0x101322, 0.12)
      .setDepth(-9)

    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(false)
    this.soundManager.play('travel')

    this.charShadow = addSoftShadow(this, 270, 704, 130, 24, 0.25, 703)
    this.mbranco = this.add
      .sprite(270, 704, 'char-idle')
      .setOrigin(0.5, 1)
      .setDisplaySize(270, 360)
      .setDepth(704)
    this.tweens.add({
      targets: this.mbranco,
      y: 700,
      angle: 1.2,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
    this.tweens.add({
      targets: background,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 2800,
      ease: 'Sine.easeInOut'
    })

    const top = this.add
      .rectangle(640, 58, 1280, 116, 0x101426, 0.6)
      .setDepth(20)
    this.add
      .text(640, 40, 'LINHA 101  •  DOWNTOWN / CEASA', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#eaf7ff',
        letterSpacing: 3
      })
      .setOrigin(0.5)
      .setDepth(21)
    this.add
      .text(640, 78, 'Acompanhe a viagem até o centro atacadista', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '15px',
        color: '#a9d4e8'
      })
      .setOrigin(0.5)
      .setDepth(21)

    this.progressBg = this.add
      .rectangle(640, 660, 620, 8, 0x2d3956, 0.9)
      .setDepth(22)
    this.progress = this.add
      .rectangle(330, 660, 0, 8, 0x7ff0ff, 1)
      .setOrigin(0, 0.5)
      .setDepth(23)
    this.tweens.add({
      targets: this.progress,
      width: 620,
      duration: 3000,
      ease: 'Sine.easeInOut'
    })
    this.add
      .text(330, 682, 'PONTO DE ÔNIBUS', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#86a5be',
        letterSpacing: 1
      })
      .setDepth(23)
    this.add
      .text(950, 682, 'CEASA', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffd894',
        letterSpacing: 1
      })
      .setOrigin(1, 0)
      .setDepth(23)

    gameBus.emit(EVENTS.CHARACTER_STATE, 'idle')
    gameBus.emit(EVENTS.LOCATION, { scene: 'work', area: 'bus', traveling: true })
    gameBus.emit(EVENTS.WORK_STATE, {
      active: true,
      scene: 'bus',
      phase: 'traveling_to_ceasa',
      title: 'Primeiro dia no CEASA',
      objective: 'Acompanhe a viagem. O próximo ponto é o CEASA.',
      progress: null,
      detail: 'A viagem é curta; prepare-se para desembarcar.',
      clockedIn: Boolean(gameState.shift?.clockedIn),
      completed: false,
      carrying: null,
      controls: false,
      stage: 'bus'
    })
    gameBus.emit(EVENTS.READY)

    if (import.meta.env.DEV) {
      window.__mascot = { scene: this, snapshot: () => ({ scene: 'bus', leaving: this.leaving }) }
    }

    this.time.delayedCall(3100, () => this.arrive())
    this.events.once('shutdown', this.shutdown, this)
  }

  arrive() {
    if (this.leaving || !this.sys.isActive()) return
    this.leaving = true
    this.soundManager.play('door')
    gameBus.emit(EVENTS.TOAST, 'CEASA: desembarque pela porta dianteira.')
    this.cameras.main.fadeOut(520, 10, 10, 16)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.CEASA_FACADE, { from: 'bus' })
    })
  }

  shutdown() {
    if (import.meta.env.DEV && window.__mascot?.scene === this) delete window.__mascot
    this.mbranco?.destroy()
    this.charShadow?.destroy()
    this.mbranco = null
    this.charShadow = null
    this.soundManager = null
  }
}
