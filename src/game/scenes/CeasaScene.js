import Phaser from 'phaser'
import { SCENES } from '../constants.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import { getSoundManager } from '../systems/SoundManager.js'
import DialogueSystem from '../systems/DialogueSystem.js'
import WorkPlayer from '../systems/WorkPlayer.js'
import { addSoftShadow } from '../effects.js'
import {
  BOX_TYPES,
  MAX_TOMATO_STEALS,
  TOMATO_STEAL_REWARD,
  acceptTask,
  clockIn,
  clockOut,
  deliverBox,
  gameState,
  nextBoxType,
  setShiftStage,
  stealTomato
} from '../state.js'
import {
  addWorkBackground,
  addZoneMarker,
  preloadWorkAssets,
  prepareWorkScene
} from '../work/workUtils.js'
import { maybeSpeak, registerInteractionPress, speak } from '../voice.js'

const CLOCK = { x: 1130, y: 640, radius: 90 }
const TRUCK = { x: 995, y: 622, radius: 180 }
const MANAGER = { x: 420, y: 630, radius: 150 }
const COWORKERS = [
  { id: 'lia', name: 'Lia', texture: 'ceasa-worker-1', x: 600, y: 664, dialogue: 'coworkerLia' },
  { id: 'davi', name: 'Davi', texture: 'ceasa-worker-3', x: 720, y: 650, dialogue: 'coworkerDavi' },
  { id: 'rita', name: 'Rita', texture: 'ceasa-worker-4', x: 840, y: 674, dialogue: 'coworkerRita' }
]
const ZONES = [
  { id: 'tomatoes', label: 'TOMATE', x: 250, y: 654, color: 0xff8b83, accepts: 'tomato' },
  { id: 'greens', label: 'FOLHAS', x: 490, y: 662, color: 0x9be28d, accepts: 'lettuce' },
  { id: 'fruits', label: 'FRUTAS', x: 735, y: 654, color: 0xffd36e, accepts: 'banana' }
]
const ZONE_LABEL_BY_TYPE = {
  tomato: 'TOMATE',
  lettuce: 'FOLHAS',
  banana: 'FRUTAS'
}
const TOMATO_STASH = { x: 910, y: 670, radius: 60 }

export default class CeasaScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.CEASA })
    this.busy = false
    this.prompt = ''
    this.crateSprites = []
    this.nearestNpc = null
    this.stealCooldownUntil = 0
  }

  init(data = {}) {
    this.from = data.from ?? 'facade'
    this.busy = false
    this.prompt = ''
    this.crateSprites = []
    this.nearestNpc = null
    this.stealCooldownUntil = 0
  }

  preload() {
    preloadWorkAssets(this)
  }

  create() {
    prepareWorkScene(this)
    addWorkBackground(this, 'ceasa-warehouse')
    this.add
      .rectangle(640, 360, 1280, 720, 0x10131b, 0.12)
      .setDepth(-9)

    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(false)
    this.soundManager.play('door')

    this.player = new WorkPlayer(this, {
      x: 1060,
      y: 676,
      height: 350,
      bounds: { left: 115, right: 1200, top: 535, bottom: 694 },
      obstacles: [
        new Phaser.Geom.Rectangle(0, 0, 355, 600),
        new Phaser.Geom.Rectangle(380, 0, 310, 585),
        new Phaser.Geom.Rectangle(920, 0, 360, 540)
      ],
      onInteract: () => this.interactNearest()
    })

    this.dialogue = new DialogueSystem(this)

    this.buildClock()
    this.buildTruck()
    this.buildZones()
    this.buildTomatoStash()
    this.buildWorkers()
    this.buildCrateStack()
    this.bindEvents()

    gameBus.emit(EVENTS.CHARACTER_STATE, 'idle')
    gameBus.emit(EVENTS.SOUND_STATE, !this.soundManager.muted)
    gameBus.emit(EVENTS.LOCATION, { scene: 'work', area: 'ceasa', traveling: false })
    this.emitMission()
    this.startWorkVoiceLoop()
    this.cameras.main.fadeIn(420, 12, 11, 12)
    gameBus.emit(EVENTS.READY)

    const shift = gameState.shift
    if (!shift?.clockedIn) {
      this.time.delayedCall(700, () => {
        this.dialogue.say('workArriveCeasa', { force: true, interrupt: true, priority: 18 })
      })
    } else if (!shift.completed) {
      this.time.delayedCall(700, () => {
        gameBus.emit(
          EVENTS.TOAST,
          shift.taskAccepted
            ? 'Expediente restaurado. Continue de onde parou.'
            : 'Expediente restaurado. Fale com o encarregado.'
        )
      })
    } else if (!shift.paid) {
      this.time.delayedCall(700, () => {
        gameBus.emit(EVENTS.TOAST, 'Tarefa concluída. Volte ao relógio para bater a saída.')
      })
    }

    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        snapshot: () => ({
          scene: 'ceasa',
          shift: gameState.shift,
          carrying: this.player?.isCarrying,
          balance: gameState.balance,
          nearest: this.prompt
        }),
        interact: () => this.interactNearest(),
        clock: () => this.useClock(),
        pickup: () => this.pickupBox()
      }
    }
  }

  bindEvents() {
    this.handleWorkInteract = () => this.interactNearest()
    this.handleMove = (vector) => this.player?.setTouchVector(vector)
    this.handleToggleSound = () => {
      const enabled = this.soundManager.toggle()
      gameBus.emit(EVENTS.SOUND_STATE, enabled)
      if (enabled) this.soundManager.play('ui')
    }
    this.handleWorkReturn = (target) => this.leaveWork(target)
    gameBus.on(EVENTS.REQUEST_WORK_INTERACT, this.handleWorkInteract)
    gameBus.on(EVENTS.WORK_MOVE, this.handleMove)
    gameBus.on(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    gameBus.on(EVENTS.REQUEST_WORK_RETURN, this.handleWorkReturn)
    this.events.once('shutdown', this.shutdown, this)
  }

  startWorkVoiceLoop() {
    if (this.workVoiceTimer) return
    const shift = gameState.shift
    if (!shift?.clockedIn || shift.paid || shift.kicked) return

    const trigger = () => {
      if (!this.sys.isActive()) return
      const current = gameState.shift
      if (!current || current.paid || current.kicked) return
      maybeSpeak(['workLula', 'workSuave', 'workCarta'], {
        chance: 0.6,
        cooldown: 12000,
        groupCooldown: 14000,
        volume: 0.85
      })
    }

    this.time.delayedCall(6000, trigger)
    this.workVoiceTimer = this.time.addEvent({ delay: 16000, loop: true, callback: trigger })
  }

  buildClock() {
    const pole = this.add.graphics().setDepth(CLOCK.y - 1)
    pole.fillStyle(0x30343c, 1)
    pole.fillRect(CLOCK.x - 17, 560, 34, 106)
    pole.fillStyle(0x191b20, 1)
    pole.fillEllipse(CLOCK.x, 666, 105, 22)
    addSoftShadow(this, CLOCK.x, 663, 145, 24, 0.3, CLOCK.y - 2)

    this.clockImage = this.add
      .image(CLOCK.x, 574, 'ceasa-clock')
      .setOrigin(0.5, 0)
      .setDisplaySize(140, 140)
      .setDepth(CLOCK.y)
      .setInteractive({ useHandCursor: true })
    this.clockImage.on('pointerdown', () => {
      if (!this.isNear(CLOCK)) return this.tooFar()
      this.useClock()
    })

    this.add
      .text(CLOCK.x, 722, 'RELÓGIO DE PONTO', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffe4a8',
        stroke: '#241a10',
        strokeThickness: 3,
        letterSpacing: 1
      })
      .setOrigin(0.5, 1)
      .setDepth(CLOCK.y + 5)

    const glow = this.add
      .ellipse(CLOCK.x, 670, 160, 54, 0xffd68a, 0.1)
      .setStrokeStyle(2, 0xffd68a, 0.38)
      .setDepth(CLOCK.y - 2)
    this.tweens.add({
      targets: glow,
      alpha: 0.28,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
  }

  buildTruck() {
    addZoneMarker(this, TRUCK.x, TRUCK.y, 250, 70, 0xffc36e, 'CAMINHÃO • CAIXAS')
    this.truckZone = this.add
      .zone(TRUCK.x, TRUCK.y, 280, 180)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
    this.truckZone.on('pointerdown', () => {
      if (!this.isNear(TRUCK)) return this.tooFar()
      this.pickupBox()
    })
    this.add
      .text(TRUCK.x, 512, 'DESCARREGAMENTO', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff0c4',
        stroke: '#2e1d0c',
        strokeThickness: 4,
        letterSpacing: 2
      })
      .setOrigin(0.5)
      .setDepth(620)
  }

  buildZones() {
    this.zoneVisuals = {}
    for (const zone of ZONES) {
      const visual = addZoneMarker(this, zone.x, zone.y, 210, 70, zone.color, zone.label)
      visual.glow.setInteractive({ useHandCursor: true })
      visual.glow.on('pointerdown', () => {
        if (!this.isNear(zone)) return this.tooFar()
        this.useZone(zone)
      })
      this.zoneVisuals[zone.id] = visual
    }
  }

  buildTomatoStash() {
    const { x, y } = TOMATO_STASH
    addSoftShadow(this, x, y + 4, 160, 26, 0.28, y - 1)

    const glow = this.add
      .ellipse(x, y - 24, 150, 70, 0xff8b83, 0.14)
      .setStrokeStyle(2, 0xff8b83, 0.5)
      .setDepth(y - 2)
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.4, to: 0.9 },
      scaleX: { from: 0.97, to: 1.04 },
      scaleY: { from: 0.97, to: 1.04 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    const stack = [
      { dx: -20, dy: 0 },
      { dx: 20, dy: 2 },
      { dx: 0, dy: -30 }
    ]
    for (const slot of stack) {
      const crate = this.add
        .image(x + slot.dx, y + slot.dy, 'ceasa-crate-tomato')
        .setOrigin(0.5, 1)
        .setDisplaySize(66, 58)
        .setDepth(y + slot.dy)
        .setInteractive({ useHandCursor: true })
      crate.on('pointerdown', () => {
        if (!this.isNear(TOMATO_STASH, TOMATO_STASH.radius)) return this.tooFar()
        this.stealTomatoes()
      })
    }

    this.add
      .text(x, y - 98, 'ROUBAR TOMATE', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffd9d4',
        stroke: '#3a1210',
        strokeThickness: 4,
        letterSpacing: 1
      })
      .setOrigin(0.5, 1)
      .setDepth(y + 6)
  }

  buildWorkers() {
    this.manager = this.createWorker({
      name: 'Seu Nilton',
      texture: 'ceasa-worker-2',
      x: MANAGER.x,
      y: MANAGER.y,
      height: 350,
      depth: MANAGER.y,
      dialogue: 'manager',
      radius: 150
    })
    this.manager.image.on('pointerdown', () => {
      if (!this.isNear(MANAGER)) return this.tooFar()
      this.talkToManager()
    })
    this.coworkers = COWORKERS.map((coworker) => {
      const worker = this.createWorker({ ...coworker, height: 305, depth: coworker.y })
      worker.image.on('pointerdown', () => {
        if (!this.isNear(worker)) return this.tooFar()
        this.talkToCoworker(coworker)
      })
      return worker
    })
  }

  createWorker({ name, texture, x, y, height, depth, dialogue, radius = 70 }) {
    addSoftShadow(this, x, y - 2, height * 0.36, 24, 0.28, depth - 1)
    const image = this.add
      .image(x, y, texture)
      .setOrigin(0.5, 1)
      .setInteractive({ useHandCursor: true })
    const source = this.textures.get(texture).getSourceImage()
    image.setDisplaySize((height * source.width) / source.height, height)
    image.setDepth(depth)
    const label = this.add
      .text(x, y - height - 7, name, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#fff4d8',
        stroke: '#24180f',
        strokeThickness: 3
      })
      .setOrigin(0.5, 1)
      .setDepth(depth + 2)
      .setAlpha(0.86)
    this.tweens.add({
      targets: image,
      y: y - 2,
      duration: 1800 + Math.random() * 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
    return { name, x, y, image, label, radius, dialogue }
  }

  buildCrateStack() {
    for (const crate of this.crateSprites) crate.image?.destroy()
    this.crateSprites = []
    const shift = gameState.shift
    if (!shift) return
    const start = shift.boxesDelivered
    for (let index = start; index < shift.boxesRequired; index += 1) {
      const type = shift.boxQueue[index]
      const texture = BOX_TYPES[type]?.texture ?? 'ceasa-crate-empty'
      const slot = index - start
      const x = 942 + (slot % 3) * 57
      const y = 606 - Math.floor(slot / 3) * 34
      const image = this.add
        .image(x, y, texture)
        .setOrigin(0.5, 1)
        .setDisplaySize(74, 64)
        .setDepth(y)
        .setInteractive({ useHandCursor: true })
      image.on('pointerdown', () => {
        if (!this.isNear(TRUCK)) return this.tooFar()
        this.pickupBox(index)
      })
      this.crateSprites.push({ image, index })
    }
  }

  emitMission() {
    const shift = gameState.shift
    if (!shift) return
    if (shift.kicked) {
      gameBus.emit(EVENTS.WORK_STATE, {
        active: true,
        scene: 'ceasa',
        phase: 'kicked',
        title: 'Mandado embora',
        objective: 'Voltar para o Taco Bell... mas você pode voltar depois.',
        progress: null,
        detail: 'Você roubou tomate demais e foi mandado embora do CEASA.',
        clockedIn: shift.clockedIn,
        completed: false,
        paid: false,
        carrying: null,
        controls: false,
        stage: 'kicked',
        balance: gameState.balance
      })
      return
    }
    const paid = shift.paid
    let phase = 'clocking_in'
    let title = 'Bater ponto'
    let objective = 'Vá até o relógio de ponto e registre a entrada.'
    let detail = 'O relógio fica à direita, perto da entrada.'
    let progress = null

    if (shift.completed && !paid) {
      phase = 'clocking_out'
      title = 'Fim do expediente'
      objective = 'Volte ao relógio de ponto e registre a saída para receber o salário.'
      detail = 'A tarefa já foi concluída. Falta só bater a saída.'
      progress = { delivered: shift.boxesDelivered, required: shift.boxesRequired }
    } else if (shift.clockedIn && !shift.taskAccepted) {
      phase = 'talking_to_manager'
      title = 'Receber a tarefa'
      objective = 'Procure Seu Nilton, o encarregado, e receba a tarefa do dia.'
      detail = 'Ele está no meio do galpão, de colete amarelo.'
    } else if (shift.taskAccepted && !shift.completed) {
      phase = 'working'
      const carrying = this.player?.isCarrying
      const next = nextBoxType()
      title = 'Descarregar o caminhão'
      objective = carrying
        ? `Leve a caixa de ${BOX_TYPES[next]?.label ?? 'mercadoria'} até a área de ${ZONE_LABEL_BY_TYPE[next] ?? 'destino'}.`
        : 'Pegue uma caixa no caminhão e leve até o setor correto.'
      detail = 'Caixas não podem ser entregues no setor errado.'
      progress = { delivered: shift.boxesDelivered, required: shift.boxesRequired }
    } else if (paid) {
      phase = 'shift_completed'
      title = 'Expediente concluído'
      objective = 'Salário recebido. Volte para casa ou vá para a Duck.'
      detail = 'O dinheiro já está no seu saldo.'
      progress = { delivered: shift.boxesDelivered, required: shift.boxesRequired }
    } else if (shift.clockedIn) {
      phase = 'working'
      title = 'Expediente em andamento'
      objective = 'Continue o trabalho no galpão.'
      progress = { delivered: shift.boxesDelivered, required: shift.boxesRequired }
    }

    gameBus.emit(EVENTS.WORK_STATE, {
      active: true,
      scene: 'ceasa',
      phase,
      title,
      objective,
      progress,
      detail,
      clockedIn: shift.clockedIn,
      completed: shift.completed,
      paid,
      carrying: this.player?.isCarrying ? nextBoxType() : null,
      controls: !paid,
      stage: shift.stage,
      balance: gameState.balance
    })
  }

  isNear(point, radius = point.radius ?? 145) {
    return this.player?.distanceTo(point.x, point.y) <= radius
  }

  nearestZone() {
    let best = null
    let distance = Infinity
    for (const zone of ZONES) {
      const next = this.player?.distanceTo(zone.x, zone.y) ?? Infinity
      if (next < distance) {
        best = zone
        distance = next
      }
    }
    return distance <= 140 ? best : null
  }

  pickupBox(index = null) {
    const shift = gameState.shift
    if (!shift || !shift.taskAccepted || shift.paid) {
      gameBus.emit(EVENTS.TOAST, 'Primeiro fale com o encarregado para receber a tarefa.')
      return
    }
    if (shift.completed) {
      gameBus.emit(EVENTS.TOAST, 'Todas as caixas já foram descarregadas.')
      return
    }
    if (this.player.isCarrying) {
      gameBus.emit(EVENTS.TOAST, 'Você já está carregando uma caixa. Entregue antes de pegar outra.')
      return
    }
    const type = nextBoxType()
    if (!type) return
    const sprite = this.crateSprites.find(
      (crate) => (index == null ? crate.index === shift.boxesDelivered : crate.index === index)
    )
    if (!sprite) return
    sprite.image.destroy()
    this.crateSprites = this.crateSprites.filter((crate) => crate !== sprite)
    this.player.setCarry(BOX_TYPES[type].texture)
    this.soundManager.play('pickup')
    gameBus.emit(EVENTS.TOAST, `Caixa de ${BOX_TYPES[type].label} na mão. Leve para ${ZONE_LABEL_BY_TYPE[type]}.`)
    this.emitMission()
    this.refreshPrompt()
  }

  useZone(zone) {
    const shift = gameState.shift
    if (!shift) return
    if (!this.player.isCarrying) {
      gameBus.emit(EVENTS.TOAST, 'Pegue uma caixa no caminhão antes de abastecer o setor.')
      return
    }
    const type = nextBoxType()
    if (!type) return
    if (zone.accepts !== type) {
      this.soundManager.play('error')
      gameBus.emit(
        EVENTS.TOAST,
        `Essa caixa é de ${BOX_TYPES[type].label}. Leve para a área de ${ZONE_LABEL_BY_TYPE[type]}.`
      )
      return
    }
    if (!deliverBox(type)) return
    this.player.clearCarry()
    this.soundManager.play('deposit')
    this.sparkle(zone.x, zone.y - 20, zone.color)
    const updated = gameState.shift
    if (updated.completed) {
      this.soundManager.play('happy')
      gameBus.emit(EVENTS.TOAST, 'Carga concluída! Agora volte ao relógio de ponto.')
      this.dialogue.say('managerDone', { force: true, interrupt: true, priority: 30 })
    } else {
      gameBus.emit(
        EVENTS.TOAST,
        `Entrega registrada: ${updated.boxesDelivered}/${updated.boxesRequired}.`
      )
    }
    this.buildCrateStack()
    this.emitMission()
    this.refreshPrompt()
  }

  useClock() {
    const shift = gameState.shift
    if (!shift) return
    if (!shift.clockedIn) {
      if (!clockIn()) return
      setShiftStage('ceasa')
      this.soundManager.play('ui')
      this.sparkle(CLOCK.x, 640, 0xffd36e)
      gameBus.emit(EVENTS.TOAST, 'Entrada registrada. Procure seu encarregado.')
      this.dialogue.say('clockIn', { force: true, interrupt: true, priority: 24 })
      this.emitMission()
      return
    }
    if (!shift.completed) {
      this.soundManager.play('error')
      const remaining = shift.boxesRequired - shift.boxesDelivered
      gameBus.emit(EVENTS.TOAST, `Ainda faltam ${remaining} caixa(s) para concluir a tarefa.`)
      this.dialogue.say('clockBeforeTask', { interrupt: true, priority: 12 })
      return
    }
    if (shift.paid) {
      gameBus.emit(EVENTS.TOAST, 'Saída já registrada. O salário já foi pago.')
      this.dialogue.say('clockAlreadyIn', { interrupt: true, priority: 10 })
      return
    }
    const amount = clockOut()
    if (!amount) return
    this.soundManager.play('coin')
    this.sparkle(CLOCK.x, 620, 0xffe29a, 14)
    this.dialogue.say('ceasaDone', { force: true, interrupt: true, priority: 40 })
    gameBus.emit(EVENTS.SHIFT_PAID, { amount, balance: gameState.balance })
    gameBus.emit(EVENTS.TOAST, `Expediente concluído! Você recebeu $${amount}.`)
    this.player.setLocked(true)
    this.emitMission()
  }

  stealTomatoes() {
    if (this.busy) return
    if (this.player.isCarrying) {
      gameBus.emit(EVENTS.TOAST, 'Com a caixa na mão não dá pra roubar tomate, boi.')
      return
    }
    if (this.time.now < this.stealCooldownUntil) return
    const result = stealTomato()
    if (result.kicked) {
      this.getKickedOut()
      return
    }
    if (!result.ok) {
      gameBus.emit(EVENTS.TOAST, result.reason)
      return
    }
    this.stealCooldownUntil = this.time.now + 450
    this.soundManager.play('coin')
    this.sparkle(TOMATO_STASH.x, TOMATO_STASH.y - 40, 0xff8b83, 7)
    maybeSpeak(['workSuave', 'workCarta'], {
      chance: 0.5,
      cooldown: 10000,
      groupCooldown: 9000,
      volume: 0.8
    })
    const warning =
      result.stolen >= result.max
        ? ` (${result.stolen}/${result.max}) Cuidado: mais um roubo e você é mandado embora!`
        : ` (${result.stolen}/${result.max} no total)`
    gameBus.emit(EVENTS.TOAST, `Tomate roubado! +$${result.amount} no bolso.${warning}`)
    this.dialogue.say('stealTomato', { force: true, interrupt: true, priority: 13 })
    this.emitMission()
    this.refreshPrompt()
  }

  getKickedOut() {
    if (this.busy) return
    this.busy = true
    this.player.setLocked(true)
    this.soundManager.play('error')
    this.dialogue.clear()
    this.dialogue.say('kickedFromCeasa', { force: true, interrupt: true, priority: 60 })
    gameBus.emit(
      EVENTS.TOAST,
      'Você foi pego roubando tomate! Mandado embora... mas pode voltar depois.'
    )
    this.emitMission()
    this.time.delayedCall(3000, () => {
      if (!this.sys.isActive()) return
      this.cameras.main.fadeOut(420, 10, 7, 7)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENES.TRAVEL, {
          target: SCENES.BEDROOM,
          from: 'ceasa',
          area: 'bedroom'
        })
      })
    })
  }

  talkToManager() {
    const shift = gameState.shift
    if (!shift) return
    if (!shift.clockedIn) {
      this.dialogue.say('clockBeforeTask', { interrupt: true, priority: 12 })
      this.sayManagerRant()
      return
    }
    if (shift.paid) {
      this.dialogue.say('managerPaid', { interrupt: true, priority: 10 })
      this.sayManagerRant()
      return
    }
    if (shift.completed) {
      this.dialogue.say('managerDone', { interrupt: true, priority: 16 })
      this.sayManagerRant()
      return
    }
    if (!shift.taskAccepted) {
      acceptTask()
      setShiftStage('working')
      this.startWorkVoiceLoop()
      this.soundManager.play('ui')
      this.dialogue.say('managerTask', { force: true, interrupt: true, priority: 25 })
      this.sayManagerRant()
      gameBus.emit(
        EVENTS.TOAST,
        'Tarefa recebida: 8 caixas. Pegue no caminhão e entregue no setor certo.'
      )
      this.emitMission()
      return
    }
    this.dialogue.say('managerWorking', { force: true, interrupt: true, priority: 12 })
  }

  sayManagerRant() {
    this.dialogue.say('managerWorking', { priority: 5 })
    maybeSpeak(['workLula', 'workSuave', 'workCarta'], {
      chance: 0.7,
      cooldown: 9000,
      groupCooldown: 8000,
      volume: 0.85
    })
  }

  talkToCoworker(coworker) {
    this.soundManager.play('ui')
    this.dialogue.say(coworker.dialogue, { force: true, interrupt: true, priority: 11 })
    this.sparkle(coworker.x, coworker.y - 130, 0xffe6a8, 5)
    maybeSpeak(['workLula', 'workSuave', 'workCarta'], {
      chance: 0.7,
      cooldown: 9000,
      groupCooldown: 8000,
      volume: 0.85
    })
  }

  interactNearest() {
    if (this.busy) return
    if (!gameState.shift) return
    registerInteractionPress()
    if (
      gameState.shift?.clockedIn &&
      !gameState.shift.kicked &&
      !this.player.isCarrying &&
      this.isNear(TOMATO_STASH, TOMATO_STASH.radius)
    ) {
      return this.stealTomatoes()
    }
    const zone = this.nearestZone()
    if (this.player.isCarrying && zone) return this.useZone(zone)

    if (this.isNear(CLOCK)) return this.useClock()
    if (this.isNear(MANAGER)) return this.talkToManager()

    for (const coworker of this.coworkers) {
      if (this.isNear(coworker)) return this.talkToCoworker(coworker)
    }

    if (!this.player.isCarrying && this.isNear(TRUCK)) return this.pickupBox()

    if (this.isNear(TRUCK)) {
      const type = nextBoxType()
      gameBus.emit(
        EVENTS.TOAST,
        `Entregue a caixa de ${BOX_TYPES[type]?.label ?? 'mercadoria'} em ${ZONE_LABEL_BY_TYPE[type] ?? 'seu setor'}.`
      )
      return
    }

    if (zone) return this.useZone(zone)

    if (this.player.isCarrying) {
      const type = nextBoxType()
      gameBus.emit(
        EVENTS.TOAST,
        `Leve a caixa de ${BOX_TYPES[type]?.label ?? 'mercadoria'} até ${ZONE_LABEL_BY_TYPE[type] ?? 'o setor certo'}.`
      )
      return
    }

    this.tooFar()
  }

  tooFar() {
    this.soundManager.play('error')
    gameBus.emit(EVENTS.TOAST, 'Chegue mais perto para interagir.')
  }

  refreshPrompt() {
    let next = ''
    if (gameState.shift && !gameState.shift.paid && !gameState.shift.kicked) {
      const zone = this.nearestZone()
      if (
        gameState.shift?.clockedIn &&
        !this.player.isCarrying &&
        this.isNear(TOMATO_STASH, TOMATO_STASH.radius)
      ) {
        const stolen = Number(gameState.shift.tomatoesStolen) || 0
        next =
          stolen >= MAX_TOMATO_STEALS
            ? 'E — Roubar tomate (mais um e você é mandado embora!)'
            : `E — Roubar tomate (+$${TOMATO_STEAL_REWARD}) [${stolen}/${MAX_TOMATO_STEALS}]`
      } else if (this.player.isCarrying && zone) {
        next = `E — Entregar em ${zone.label}`
      } else if (this.isNear(CLOCK)) {
        next = gameState.shift.completed ? 'E — Bater saída' : 'E — Bater ponto'
      } else if (this.isNear(MANAGER)) {
        next = 'E — Falar com Seu Nilton'
      } else {
        const coworker = this.coworkers.find((item) => this.isNear(item))
        if (coworker) {
          next = `E — Conversar com ${coworker.name}`
        } else if (!this.player.isCarrying && this.isNear(TRUCK)) {
          next = 'E — Pegar caixa'
        } else if (this.player.isCarrying && this.isNear(TRUCK)) {
          next = 'Leve a caixa até o setor correto'
        } else if (zone) {
          next = `Setor ${zone.label}`
        }
      }
    }
    if (next === this.prompt) return
    this.prompt = next
    gameBus.emit(EVENTS.WORK_PROMPT, { text: next })
  }

  highlightNearest() {
    const managerActive = this.isNear(MANAGER)
    const nearestCoworker = this.coworkers.find((item) => this.isNear(item)) ?? null
    if (this.nearestNpc && this.nearestNpc !== (managerActive ? this.manager : nearestCoworker)) {
      this.nearestNpc.image.clearTint()
      this.nearestNpc = null
    }
    const active = managerActive ? this.manager : nearestCoworker
    if (active && this.nearestNpc !== active) {
      active.image.setTint(0xfff0b8)
      this.nearestNpc = active
    }
  }

  sparkle(x, y, color = 0xffd36e, count = 8) {
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Math.random() * 0.4
      const distance = 34 + Math.random() * 44
      const sparkle = this.add
        .image(x, y, 'sparkle')
        .setDisplaySize(12 + Math.random() * 8, 12 + Math.random() * 8)
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(900)
      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 20,
        alpha: { from: 0.9, to: 0 },
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 650 + Math.random() * 250,
        ease: 'Cubic.easeOut',
        onComplete: () => sparkle.destroy()
      })
    }
  }

  leaveWork(target = 'bedroom') {
    if (this.busy) return
    this.busy = true
    this.player?.setLocked(true)
    if (target === 'duck') {
      speak('duckTrip', { volume: 0.9 })
      this.soundManager.play('travel')
      gameBus.emit(EVENTS.TRAVEL_STATE, { phase: 'traveling', from: 'ceasa', target: 'duck' })
      this.cameras.main.fadeOut(420, 10, 7, 12)
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start(SCENES.TRAVEL, { target: SCENES.DUCK, from: 'ceasa', area: 'dance' })
      })
      return
    }
    this.soundManager.play('travel')
    gameBus.emit(EVENTS.TRAVEL_STATE, { phase: 'traveling', from: 'ceasa', target: 'bedroom' })
    this.cameras.main.fadeOut(420, 10, 8, 8)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.TRAVEL, { target: SCENES.BEDROOM, from: 'ceasa', area: 'bedroom' })
    })
  }

  update(time, delta) {
    this.player?.update(delta)
    this.refreshPrompt()
    this.highlightNearest()
  }

  shutdown() {
    gameBus.off(EVENTS.REQUEST_WORK_INTERACT, this.handleWorkInteract)
    gameBus.off(EVENTS.WORK_MOVE, this.handleMove)
    gameBus.off(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    gameBus.off(EVENTS.REQUEST_WORK_RETURN, this.handleWorkReturn)
    this.player?.destroy()
    this.dialogue?.destroy()
    this.player = null
    this.dialogue = null
    this.soundManager = null
    this.crateSprites = []
    if (import.meta.env.DEV && window.__mascot?.scene === this) delete window.__mascot
  }
}
