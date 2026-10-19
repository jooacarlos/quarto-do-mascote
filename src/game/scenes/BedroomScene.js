import Phaser from 'phaser'
import { ASSET_BASE, GAME_HEIGHT, SCENES } from '../constants.js'
import { ASSETS } from '../assets.js'
import { LAMP_EFFECTS, LAYOUT } from '../layout.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import CharacterController from '../systems/CharacterController.js'
import InteractiveRegistry from '../systems/InteractiveRegistry.js'
import DialogueSystem from '../systems/DialogueSystem.js'
import { getSoundManager } from '../systems/SoundManager.js'
import { createCharacterAnimations } from '../animations.js'
import { addSoftShadow, ensureEffectTextures } from '../effects.js'
import { isCanvasPointer } from '../input.js'

let introPlayed = false

export default class BedroomScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BEDROOM })
    this.lampOn = true
    this.busy = false
    this.traveling = false
  }

  init(data = {}) {
    this.arrivedFromDuck = data.from === 'duck'
    this.busy = false
    this.traveling = false
  }

  preload() {
    this.load.setPath(ASSET_BASE)
    for (const asset of ASSETS) {
      this.load.image(asset.key, asset.file)
    }
  }

  create() {
    this.lampOn = true
    this.cameras.main.setBackgroundColor('#2a211c')
    ensureEffectTextures(this)
    createCharacterAnimations(this)
    this.buildRoom()
    this.buildFurniture()
    this.buildLamp()
    this.buildCharacter()

    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(false)
    this.dialogue = new DialogueSystem(this, {
      onShow: (item) => this.handleDialogueShow(item)
    })
    this.interactives = new InteractiveRegistry(this)

    this.interactives.add(this.lamp, {
      hoverScale: 1.035,
      onClick: () => this.toggleLamp()
    })
    this.interactives.add(this.window, {
      hoverScale: 1.008,
      onClick: () => this.triggerWindow()
    })
    this.interactives.add(this.bed, {
      hoverScale: 1.008,
      onClick: () => this.triggerBed()
    })

    this.handleRequestWave = () => this.triggerWave()
    this.handleRequestClub = () => this.travelToDuck()
    this.handleRequestTalk = () => this.triggerTalk()
    this.handleRequestInteract = (action) => {
      if (action === 'bed') this.triggerBed()
      if (action === 'window') this.triggerWindow()
    }
    this.handleToggleSound = () => {
      const enabled = this.soundManager.toggle()
      gameBus.emit(EVENTS.SOUND_STATE, enabled)
      if (enabled) this.soundManager.play('ui')
    }

    gameBus.on(EVENTS.REQUEST_WAVE, this.handleRequestWave)
    gameBus.on(EVENTS.REQUEST_CLUB, this.handleRequestClub)
    gameBus.on(EVENTS.REQUEST_TALK, this.handleRequestTalk)
    gameBus.on(EVENTS.REQUEST_INTERACT, this.handleRequestInteract)
    gameBus.on(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    this.events.once('shutdown', this.shutdown, this)

    gameBus.emit(EVENTS.CHARACTER_STATE, 'idle')
    gameBus.emit(EVENTS.SOUND_STATE, !this.soundManager.muted)
    gameBus.emit(EVENTS.LOCATION, { scene: 'bedroom', area: 'bedroom', traveling: false })

    this.cameras.main.fadeIn(420, 18, 12, 9)
    this.time.delayedCall(80, () => gameBus.emit(EVENTS.READY))
    this.handleArrival()

    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        wave: () => this.triggerWave(),
        club: () => this.travelToDuck(),
        talk: () => this.triggerTalk(),
        bed: () => this.triggerBed(),
        blink: () => this.characters.blinkNow(),
        lamp: () => this.toggleLamp(),
        snapshot: () => ({
          scene: 'bedroom',
          character: this.characters.state,
          lamp: this.lampOn,
          sound: !this.soundManager.muted,
          busy: this.busy,
          traveling: this.traveling
        })
      }
    }
  }

  handleArrival() {
    if (this.arrivedFromDuck) {
      this.characters.setPosition(1120, LAYOUT.character.y)
      this.characters.faceLeft()
      this.characters.walkTo(LAYOUT.character.x, LAYOUT.character.y, 1600, {
        onComplete: () => {
          this.characters.faceRight()
          this.dialogue.say('backHome', { priority: 25 })
        }
      })
      return
    }

    if (!introPlayed) {
      introPlayed = true
      this.time.delayedCall(760, () => {
        this.dialogue.sequence(['greet', 'today', 'plans'])
      })
    }
  }

  createImage(key, options) {
    const source = this.textures.get(key).getSourceImage()
    const aspect = source.width / source.height
    const image = this.add
      .image(options.x, options.y, key)
      .setOrigin(options.originX ?? 0.5, options.originY ?? 0.5)
      .setDepth(options.depth ?? 0)

    if (options.width != null && options.height != null) {
      image.setDisplaySize(options.width, options.height)
    } else if (options.width != null) {
      image.setDisplaySize(options.width, options.width / aspect)
    } else if (options.height != null) {
      image.setDisplaySize(options.height * aspect, options.height)
    }

    return image
  }

  addSoftShadow(x, y, width, height, alpha, depth) {
    return addSoftShadow(this, x, y, width, height, alpha, depth)
  }

  buildRoom() {
    const room = this.createImage('room', {
      ...LAYOUT.room,
      originY: 0.5,
      depth: 0
    })
    const aspect = room.width / room.height
    room.setDisplaySize(GAME_HEIGHT * aspect, GAME_HEIGHT)

    this.window = this.createImage('window', { ...LAYOUT.window, originY: 0.5 })
    this.createImage('decor-frame-abstract', { ...LAYOUT.frameAbstract, originY: 0.5 })
    this.createImage('decor-frame-landscape', { ...LAYOUT.frameLandscape, originY: 0.5 })
    this.createImage('decor-rug', {
      ...LAYOUT.rug,
      originY: 0.5
    })
  }

  addFurniture(key, layout, shadow = {}) {
    const image = this.createImage(key, {
      ...layout,
      y: layout.baseY,
      originY: 1
    })
    if (shadow !== false) {
      const width = shadow.width ?? layout.width * 0.82
      const height = shadow.height ?? Math.max(20, width * 0.11)
      this.addSoftShadow(
        layout.x,
        layout.baseY - 3,
        width,
        height,
        shadow.alpha ?? 0.25,
        layout.depth - 1
      )
    }
    return image
  }

  buildFurniture() {
    this.bed = this.addFurniture('bed', LAYOUT.bed, { width: 430, height: 48, alpha: 0.24 })
    this.addFurniture('bedside-table', LAYOUT.bedside, { width: 155, height: 24, alpha: 0.22 })
    this.addFurniture('desk', LAYOUT.desk, { width: 400, height: 48, alpha: 0.24 })
    this.addFurniture('decor-plant', LAYOUT.plant, { width: 72, height: 15, alpha: 0.18 })
  }

  buildLamp() {
    this.lamp = this.createImage('lamp', {
      ...LAYOUT.lamp,
      y: LAYOUT.lamp.baseY,
      originY: 1
    })

    this.addSoftShadow(LAYOUT.lamp.x, LAYOUT.lamp.baseY - 2, 105, 22, 0.2, LAYOUT.lamp.depth - 1)

    this.lampGlow = this.add
      .image(LAMP_EFFECTS.glow.x, LAMP_EFFECTS.glow.y, 'warm-glow')
      .setDisplaySize(LAMP_EFFECTS.glow.width, LAMP_EFFECTS.glow.height)
      .setTint(0xffc478)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(LAMP_EFFECTS.glow.alpha)
      .setDepth(LAMP_EFFECTS.glow.depth)

    this.lampPool = this.add
      .image(LAMP_EFFECTS.pool.x, LAMP_EFFECTS.pool.y, 'warm-glow')
      .setDisplaySize(LAMP_EFFECTS.pool.width, LAMP_EFFECTS.pool.height)
      .setTint(0xffc478)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(LAMP_EFFECTS.pool.alpha)
      .setDepth(LAMP_EFFECTS.pool.depth)
  }

  buildCharacter() {
    const layout = LAYOUT.character
    this.addSoftShadow(
      layout.x,
      layout.shadowY,
      layout.shadowWidth,
      layout.shadowHeight,
      0.3,
      layout.depth - 1
    )

    const sprite = this.add
      .sprite(layout.x, layout.y, 'char-idle')
      .setOrigin(0.5, 1)
      .setDepth(layout.depth)
      .setDisplaySize(470 * 0.75, 470)

    sprite.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(112, 42, 376, 748),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    })
    sprite.on('pointerdown', (pointer) => {
      if (!isCanvasPointer(this, pointer)) return
      this.triggerWave()
    })

    this.characters = new CharacterController(this, sprite, {
      baseY: layout.y,
      blinkEnabled: true,
      onStateChange: (state) => gameBus.emit(EVENTS.CHARACTER_STATE, state)
    })
  }

  triggerWave() {
    if (!this.characters || this.busy || this.traveling) return
    const started = this.characters.wave()
    if (!started) return
    this.soundManager?.play('wave')
    gameBus.emit(EVENTS.TOAST, 'Oi! Tudo bem?')
    this.dialogue?.say('wave')
  }

  handleDialogueShow(item) {
    if (item.entry.gesture !== 'talk') return
    if (this.busy || this.traveling) return
    if (!['idle', 'blinking', 'waving', 'talking'].includes(this.characters?.state)) return
    this.characters.talk(Math.min(item.displayDuration ?? item.entry.duration, 5200))
  }

  triggerBed() {
    if (this.busy || this.traveling || this.characters?.isBusy()) return
    this.soundManager?.play('ui')
    this.characters?.talk(3800)
    this.dialogue?.say('bed', { interrupt: true })
  }

  triggerWindow() {
    if (this.busy || this.traveling || this.characters?.isBusy()) return
    this.soundManager?.play('ui')
    this.dialogue?.say('window', { force: true, interrupt: true })
  }

  triggerTalk() {
    if (this.busy || this.traveling || this.characters?.isBusy()) return
    this.soundManager?.play('ui')
    this.characters?.talk(4200)
    this.dialogue?.sequence(['greet', 'today', 'plans'], {
      force: true,
      interrupt: true,
      priority: 9
    })
    gameBus.emit(EVENTS.TOAST, 'Mbranco puxando assunto')
  }

  travelToDuck() {
    if (this.busy || this.traveling || this.characters?.state === 'walking') return
    this.busy = true
    this.traveling = true
    this.characters?.idle()
    gameBus.emit(EVENTS.TRAVEL_STATE, { phase: 'leaving', from: 'bedroom', target: 'duck' })
    gameBus.emit(EVENTS.TOAST, 'Indo para a Duck...')
    this.dialogue?.say('club', { force: true, interrupt: true, priority: 50 })
    this.soundManager?.play('happy')
    this.characters?.happy(1800)

    this.time.delayedCall(1000, () => {
      if (!this.sys.isActive()) return
      this.characters?.walkTo(1210, LAYOUT.character.y, 1500, {
        onComplete: () => {
          this.cameras.main.fadeOut(520, 12, 6, 18)
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start(SCENES.TRAVEL, {
              target: SCENES.DUCK,
              from: 'bedroom',
              area: 'dance'
            })
          })
        }
      })
    })
  }

  toggleLamp() {
    if (this.traveling) return
    this.lampOn = !this.lampOn
    if (this.lampOn) {
      this.lamp.clearTint()
    } else {
      this.lamp.setTint(0x6d6157)
    }

    this.tweens.add({
      targets: this.lampGlow,
      alpha: this.lampOn ? LAMP_EFFECTS.glow.alpha : 0,
      duration: 260,
      ease: 'Sine.easeInOut',
      overwrite: true
    })
    this.tweens.add({
      targets: this.lampPool,
      alpha: this.lampOn ? LAMP_EFFECTS.pool.alpha : 0,
      duration: 260,
      ease: 'Sine.easeInOut',
      overwrite: true
    })

    this.soundManager?.play(this.lampOn ? 'lamp-on' : 'lamp-off')
    gameBus.emit(EVENTS.TOAST, this.lampOn ? 'Luz acesa' : 'Luz apagada')
  }

  shutdown() {
    gameBus.off(EVENTS.REQUEST_WAVE, this.handleRequestWave)
    gameBus.off(EVENTS.REQUEST_CLUB, this.handleRequestClub)
    gameBus.off(EVENTS.REQUEST_TALK, this.handleRequestTalk)
    gameBus.off(EVENTS.REQUEST_INTERACT, this.handleRequestInteract)
    gameBus.off(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    this.interactives?.destroy()
    this.characters?.destroy()
    this.dialogue?.destroy()
    this.soundManager?.setClubMode(false)
    this.interactives = null
    this.characters = null
    this.dialogue = null
    this.soundManager = null
    if (import.meta.env.DEV && window.__mascot?.scene === this) {
      delete window.__mascot
    }
  }
}
