import Phaser from 'phaser'
import { SCENES } from '../constants.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import { getSoundManager } from '../systems/SoundManager.js'
import DialogueSystem from '../systems/DialogueSystem.js'
import WorkPlayer from '../systems/WorkPlayer.js'
import { gameState, setShiftStage } from '../state.js'
import {
  addWorkBackground,
  addZoneMarker,
  preloadWorkAssets,
  prepareWorkScene
} from '../work/workUtils.js'

const ENTRANCE = { x: 700, y: 638 }

export default class CeasaFacadeScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.CEASA_FACADE })
    this.busy = false
  }

  init(data = {}) {
    this.arrivedFromBus = data.from === 'bus'
    this.busy = false
  }

  preload() {
    preloadWorkAssets(this)
  }

  create() {
    prepareWorkScene(this)
    addWorkBackground(this, 'ceasa-facade')
    this.add
      .rectangle(640, 360, 1280, 720, 0x1d160f, 0.08)
      .setDepth(-9)

    setShiftStage('ceasa_facade')
    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(false)

    this.player = new WorkPlayer(this, {
      x: 940,
      y: 672,
      height: 360,
      bounds: { left: 150, right: 1160, top: 565, bottom: 688 },
      obstacles: [
        new Phaser.Geom.Rectangle(70, 600, 210, 95),
        new Phaser.Geom.Rectangle(1000, 600, 175, 95)
      ],
      onInteract: () => this.interactNearest()
    })
    this.player.sprite.setFlipX(true)

    this.dialogue = new DialogueSystem(this)

    addZoneMarker(this, ENTRANCE.x, ENTRANCE.y, 250, 64, 0xffc96c, 'ENTRADA DO GALPÃO')

    this.entranceZone = this.add
      .zone(ENTRANCE.x, ENTRANCE.y, 260, 150)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    this.entranceZone.on('pointerdown', () => {
      if (!this.isNearEntrance()) return this.tooFar()
      this.enterCeasa()
    })

    this.handleWorkInteract = () => this.interactNearest()
    this.handleMove = (vector) => this.player?.setTouchVector(vector)
    this.handleToggleSound = () => {
      const enabled = this.soundManager.toggle()
      gameBus.emit(EVENTS.SOUND_STATE, enabled)
      if (enabled) this.soundManager.play('ui')
    }
    gameBus.on(EVENTS.REQUEST_WORK_INTERACT, this.handleWorkInteract)
    gameBus.on(EVENTS.WORK_MOVE, this.handleMove)
    gameBus.on(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    this.events.once('shutdown', this.shutdown, this)

    gameBus.emit(EVENTS.CHARACTER_STATE, 'idle')
    gameBus.emit(EVENTS.SOUND_STATE, !this.soundManager.muted)
    gameBus.emit(EVENTS.LOCATION, { scene: 'work', area: 'ceasa-facade', traveling: false })
    this.prompt = ''
    this.emitMission()
    this.cameras.main.fadeIn(420, 16, 11, 7)
    gameBus.emit(EVENTS.READY)
    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        snapshot: () => ({ x: this.player?.sprite?.x, y: this.player?.sprite?.y, busy: this.busy })
      }
    }

    this.time.delayedCall(620, () => {
      this.dialogue.say('workArriveCeasa', { force: true, interrupt: true, priority: 24 })
    })
  }

  emitMission() {
    const shift = gameState.shift
    gameBus.emit(EVENTS.WORK_STATE, {
      active: true,
      scene: 'ceasa-facade',
      phase: 'arriving_at_ceasa',
      title: 'Chegada ao CEASA',
      objective: 'Caminhe até a entrada do galpão e entre para bater o ponto.',
      progress: null,
      detail: 'A entrada fica no portão central.',
      clockedIn: Boolean(shift?.clockedIn),
      completed: false,
      carrying: null,
      controls: true,
      stage: shift?.stage ?? 'ceasa_facade'
    })
  }

  isNearEntrance() {
    return this.player?.distanceTo(ENTRANCE.x, ENTRANCE.y) <= 150
  }

  interactNearest() {
    if (this.busy) return
    if (this.isNearEntrance()) return this.enterCeasa()
    this.tooFar()
  }

  tooFar() {
    this.soundManager.play('error')
    gameBus.emit(EVENTS.TOAST, 'Caminhe até a entrada do CEASA.')
  }

  enterCeasa() {
    if (this.busy) return
    this.busy = true
    this.player.setLocked(true)
    this.soundManager.play('door')
    gameBus.emit(EVENTS.TOAST, 'Entrando no galpão...')
    this.cameras.main.fadeOut(380, 10, 8, 6)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.CEASA, { from: 'facade' })
    })
  }

  update(time, delta) {
    this.player?.update(delta)
    const next = this.isNearEntrance()
      ? 'E — Entrar no CEASA'
      : 'Caminhe até a entrada do CEASA'
    if (next !== this.prompt) {
      this.prompt = next
      gameBus.emit(EVENTS.WORK_PROMPT, { text: next })
    }
  }

  shutdown() {
    if (import.meta.env.DEV && window.__mascot?.scene === this) delete window.__mascot
    gameBus.off(EVENTS.REQUEST_WORK_INTERACT, this.handleWorkInteract)
    gameBus.off(EVENTS.WORK_MOVE, this.handleMove)
    gameBus.off(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    this.player?.destroy()
    this.dialogue?.destroy()
    this.player = null
    this.dialogue = null
    this.soundManager = null
  }
}
