import Phaser from 'phaser'
import { SCENES } from '../constants.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import { getSoundManager } from '../systems/SoundManager.js'
import DialogueSystem from '../systems/DialogueSystem.js'
import WorkPlayer from '../systems/WorkPlayer.js'
import { beginShift, gameState, setShiftStage } from '../state.js'
import {
  addWorkBackground,
  addZoneMarker,
  preloadWorkAssets,
  prepareWorkScene
} from '../work/workUtils.js'

const BUS_STOP = { x: 1045, y: 646 }
const BUS_DOOR = { x: 650, y: 652 }

export default class StreetScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.STREET })
    this.waiting = false
    this.boardEnabled = false
    this.busy = false
    this.nearest = null
  }

  init(data = {}) {
    this.arrivedFromHome = data.from === 'bedroom'
    this.waiting = false
    this.boardEnabled = false
    this.busy = false
    this.nearest = null
  }

  preload() {
    preloadWorkAssets(this)
  }

  create() {
    prepareWorkScene(this)
    addWorkBackground(this, 'ceasa-street')
    this.add
      .rectangle(640, 360, 1280, 720, 0x1a1310, 0.1)
      .setDepth(-9)

    if (!gameState.shift || gameState.shift.paid) beginShift()
    setShiftStage('street')

    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(false)
    this.characters = { sprite: null, state: 'idle' }

    this.player = new WorkPlayer(this, {
      x: 265,
      y: 666,
      height: 360,
      bounds: { left: 120, right: 1170, top: 565, bottom: 684 },
      obstacles: [],
      onInteract: () => this.interactNearest()
    })
    this.player.sprite.setDepth(666)
    this.characters.sprite = this.player.sprite
    this.charShadow = this.player.shadow

    this.dialogue = new DialogueSystem(this)

    addZoneMarker(this, BUS_STOP.x, BUS_STOP.y, 150, 46, 0xffd27a, 'PONTO 101')
    this.busDoorMarker = addZoneMarker(
      this,
      BUS_DOOR.x,
      BUS_DOOR.y,
      150,
      46,
      0x8fffe0,
      'EMBARQUE'
    )
    this.busDoorMarker.glow.setVisible(false)
    this.busDoorMarker.text.setVisible(false)

    this.busStopZone = this.add
      .zone(BUS_STOP.x, BUS_STOP.y, 220, 110)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    this.busStopZone.on('pointerdown', () => {
      if (!this.isNear(BUS_STOP)) return this.tooFar()
      this.reachBusStop()
    })

    this.busDoorZone = this.add
      .zone(BUS_DOOR.x, BUS_DOOR.y, 190, 120)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    this.busDoorZone.on('pointerdown', () => {
      if (!this.boardEnabled) return
      if (!this.isNear(BUS_DOOR)) return this.tooFar()
      this.boardBus()
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
    gameBus.emit(EVENTS.LOCATION, { scene: 'work', area: 'street', traveling: false })
    this.emitMission('going_to_bus_stop')
    this.cameras.main.fadeIn(360, 14, 10, 8)
    this.time.delayedCall(80, () => gameBus.emit(EVENTS.READY))
    this.time.delayedCall(650, () => {
      this.dialogue.say(this.arrivedFromHome ? 'workStart' : 'workStreet', {
        interrupt: true,
        priority: 22
      })
    })

    this.soundManager.play('ui')
    this.prompt = ''

    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        snapshot: () => ({
          x: this.player?.sprite?.x,
          y: this.player?.sprite?.y,
          locked: this.player?.locked,
          waiting: this.waiting,
          boardEnabled: this.boardEnabled,
          busy: this.busy,
          prompt: this.player?.sprite?.anims?.currentAnim?.key
        })
      }
    }
  }

  emitMission(phase) {
    const waiting = phase === 'waiting_for_bus'
    const boarding = phase === 'boarding_bus'
    gameBus.emit(EVENTS.WORK_STATE, {
      active: true,
      scene: 'street',
      phase,
      title: 'Primeiro dia no CEASA',
      objective: waiting
        ? 'O 101 Downtown está chegando. Espere as portas abrirem.'
        : boarding
          ? 'As portas abriram. Caminhe até a porta do ônibus e embarque.'
          : 'Vá até o ponto de ônibus e espere o 101 Downtown.',
      progress: null,
      detail:
        phase === 'going_to_bus_stop'
          ? 'Use WASD, setas ou o direcional na tela.'
          : 'Chegue perto e use E ou o botão Interagir.',
      clockedIn: Boolean(gameState.shift?.clockedIn),
      completed: false,
      carrying: null,
      stage: gameState.shift?.stage ?? 'street'
    })
  }

  reachBusStop() {
    if (this.waiting || this.busy) return
    this.waiting = true
    this.player.setLocked(true)
    this.soundManager.play('door')
    this.emitMission('waiting_for_bus')
    gameBus.emit(EVENTS.TOAST, 'Ônibus 101 Downtown chegando...')
    this.dialogue.say('workBusWaiting', { interrupt: true, priority: 18 })
    this.time.delayedCall(2600, () => {
      if (!this.sys.isActive()) return
      this.waiting = false
      this.busy = false
      this.boardEnabled = true
      this.player.setLocked(false)
      this.busDoorMarker.glow.setVisible(true)
      this.busDoorMarker.text.setVisible(true)
      this.emitMission('boarding_bus')
      gameBus.emit(EVENTS.TOAST, 'Portas abertas. Embarque pela porta dianteira.')
      this.soundManager.play('ui')
    })
  }

  boardBus() {
    if (this.busy || !this.boardEnabled) return
    this.busy = true
    this.player.setLocked(true)
    this.dialogue.say('workBusBoard', { force: true, interrupt: true, priority: 30 })
    this.soundManager.play('door')
    setShiftStage('bus')
    gameBus.emit(EVENTS.TRAVEL_STATE, {
      phase: 'traveling',
      from: 'street',
      target: 'work'
    })
    this.time.delayedCall(500, () => {
      this.cameras.main.fadeOut(380, 10, 10, 16)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENES.BUS, { from: 'street' })
      })
    })
  }

  isNear(point, radius = 125) {
    return this.player?.distanceTo(point.x, point.y) <= radius
  }

  tooFar() {
    this.soundManager.play('error')
    gameBus.emit(EVENTS.TOAST, 'Chegue mais perto para interagir.')
  }

  interactNearest() {
    if (this.busy) return
    if (this.boardEnabled && this.isNear(BUS_DOOR)) return this.boardBus()
    if (!this.waiting && this.isNear(BUS_STOP)) return this.reachBusStop()
    if (this.boardEnabled) return this.tooFar()
    this.tooFar()
  }

  update(time, delta) {
    this.player?.update(delta)
    const next = this.boardEnabled
      ? this.isNear(BUS_DOOR)
        ? 'E — Embarcar no ônibus'
        : 'Caminhe até a porta do ônibus'
      : !this.waiting && this.isNear(BUS_STOP)
        ? 'E — Esperar o ônibus'
        : ''
    if (next !== this.prompt) {
      this.prompt = next
      gameBus.emit(EVENTS.WORK_PROMPT, { text: next })
    }
  }

  shutdown() {
    gameBus.off(EVENTS.REQUEST_WORK_INTERACT, this.handleWorkInteract)
    gameBus.off(EVENTS.WORK_MOVE, this.handleMove)
    gameBus.off(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    this.player?.destroy()
    this.dialogue?.destroy()
    this.player = null
    this.dialogue = null
    this.soundManager = null
    if (import.meta.env.DEV && window.__mascot?.scene === this) delete window.__mascot
  }
}
