import Phaser from 'phaser'
import { ASSET_BASE, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../constants.js'
import { ASSETS } from '../assets.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import CharacterController from '../systems/CharacterController.js'
import DialogueSystem from '../systems/DialogueSystem.js'
import { getSoundManager } from '../systems/SoundManager.js'
import { createCharacterAnimations } from '../animations.js'
import { addGlow, addSoftShadow, ensureEffectTextures } from '../effects.js'
import { isCanvasPointer } from '../input.js'
import { GUESTS, gameState } from '../state.js'

const BACKGROUNDS = {
  dance: 'duck-dancefloor',
  bar: 'duck-bar',
  vip: 'duck-vip'
}

const ANCHORS = {
  dance: { x: 640, y: 700 },
  bar: { x: 470, y: 700 },
  vip: { x: 760, y: 700 }
}

const AREA_LINES = {
  dance: 'dance',
  bar: 'bar',
  vip: 'vip'
}

const TALK_LINES = {
  dance: 'talkDance',
  bar: 'talkBar',
  vip: 'talkVip'
}

const CHARACTER_HEIGHT = 500

export default class DuckScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.DUCK })
    this.area = 'dance'
    this.busy = false
    this.traveling = false
    this.danceActive = false
  }

  init(data = {}) {
    this.area = ANCHORS[data.area] ? data.area : 'dance'
    this.arrivedFromBedroom = data.from === 'bedroom'
    this.busy = false
    this.traveling = false
    this.danceActive = false
  }

  preload() {
    this.load.setPath(ASSET_BASE)
    for (const asset of ASSETS) {
      if (!this.textures.exists(asset.key)) {
        this.load.image(asset.key, asset.file)
      }
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#07040c')
    ensureEffectTextures(this)
    createCharacterAnimations(this)

    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(true)

    this.bg = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, BACKGROUNDS[this.area])
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-10)

    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x07030d, 0.12)
      .setDepth(1)

    this.buildCharacter()
    this.buildDanceArea()
    this.buildBarArea()
    this.buildVipArea()
    this.refreshGuests()
    this.setArea(this.area, { instant: true })
    this.placeCharacter(this.area, true)

    this.dialogue = new DialogueSystem(this, {
      onShow: (item) => this.handleDialogueShow(item)
    })

    this.handleRequestArea = (area) => this.switchArea(area)
    this.handleRequestInteract = (action) => this.interact(action)
    this.handleRequestTalk = () => this.talk()
    this.handleRequestReturn = () => this.returnHome()
    this.handleDrinkBought = (payload) => this.serveDrink(payload)
    this.handleGuestInvited = (payload) => this.receiveGuest(payload)
    this.handleToggleSound = () => {
      const enabled = this.soundManager.toggle()
      gameBus.emit(EVENTS.SOUND_STATE, enabled)
      if (enabled) this.soundManager.play('ui')
    }

    gameBus.on(EVENTS.REQUEST_AREA, this.handleRequestArea)
    gameBus.on(EVENTS.REQUEST_INTERACT, this.handleRequestInteract)
    gameBus.on(EVENTS.REQUEST_TALK, this.handleRequestTalk)
    gameBus.on(EVENTS.REQUEST_RETURN, this.handleRequestReturn)
    gameBus.on(EVENTS.DUCK_DRINK_BOUGHT, this.handleDrinkBought)
    gameBus.on(EVENTS.DUCK_GUEST_INVITED, this.handleGuestInvited)
    gameBus.on(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    this.events.once('shutdown', this.shutdown, this)

    gameBus.emit(EVENTS.CHARACTER_STATE, 'idle')
    gameBus.emit(EVENTS.SOUND_STATE, !this.soundManager.muted)
    gameBus.emit(EVENTS.LOCATION, { scene: 'duck', area: this.area, traveling: false })

    this.cameras.main.fadeIn(520, 5, 2, 8)
    this.time.delayedCall(80, () => gameBus.emit(EVENTS.READY))
    this.time.delayedCall(620, () => {
      if (this.arrivedFromBedroom) {
        this.dialogue.say('arriveClub', { priority: 26 })
      } else {
        this.dialogue.say(AREA_LINES[this.area])
      }
    })

    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        area: (area) => this.switchArea(area),
        dance: () => this.interact('dance'),
        drink: () => this.interact('bar'),
        vip: () => this.interact('vip'),
        talk: () => this.talk(),
        returnHome: () => this.returnHome(),
        snapshot: () => ({
          scene: 'duck',
          area: this.area,
          character: this.characters.state,
          dancing: this.danceActive,
          busy: this.busy,
          traveling: this.traveling,
          sound: !this.soundManager.muted
        })
      }
    }
  }

  update() {
    if (!this.charShadow || !this.characters) return
    const sprite = this.characters.sprite
    this.charShadow.setPosition(sprite.x, sprite.y - 2)
    this.charShadow.setDepth(sprite.depth - 1)
  }

  buildCharacter() {
    const anchor = ANCHORS[this.area]
    this.charShadow = addSoftShadow(this, anchor.x, anchor.y - 2, 190, 34, 0.34, 698)

    const sprite = this.add
      .sprite(anchor.x, anchor.y, 'char-idle')
      .setOrigin(0.5, 1)
      .setDepth(ANCHORS.dance.y)
      .setDisplaySize(CHARACTER_HEIGHT * 0.75, CHARACTER_HEIGHT)

    sprite.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(112, 42, 376, 748),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    })
    sprite.on('pointerdown', (pointer) => {
      if (!isCanvasPointer(this, pointer)) return
      this.handleCharacterClick()
    })

    this.characters = new CharacterController(this, sprite, {
      baseY: anchor.y,
      blinkEnabled: false,
      onStateChange: (state) => {
        if (state !== 'dancing') this.danceActive = false
        gameBus.emit(EVENTS.CHARACTER_STATE, state)
      }
    })
  }

  buildDanceArea() {
    this.danceObjects = []

    const chain = this.add.graphics()
    chain.lineStyle(3, 0x9aa6cc, 0.55)
    chain.lineBetween(640, 0, 640, 144)
    chain.setDepth(440)
    this.danceObjects.push(chain)

    const ballGlow = addGlow(this, 640, 220, 300, 300, 0xff4fd8, 0.2, 430)
    this.danceObjects.push(ballGlow)
    this.tweens.add({
      targets: ballGlow,
      alpha: 0.34,
      duration: 1800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.discoBall = this.add
      .image(640, 220, 'disco-ball')
      .setDisplaySize(176, 176)
      .setDepth(450)
      .setInteractive({ useHandCursor: true })
    this.discoBall.on('pointerdown', (pointer) => {
      if (!isCanvasPointer(this, pointer)) return
      this.interact('dance')
    })
    this.danceObjects.push(this.discoBall)

    this.tweens.add({
      targets: this.discoBall,
      scaleX: 0.88,
      duration: 2300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    for (let i = 0; i < 7; i += 1) {
      const angle = (Math.PI * 2 * i) / 7
      const sparkle = this.add
        .image(640 + Math.cos(angle) * 118, 220 + Math.sin(angle) * 100, 'sparkle')
        .setDisplaySize(28, 28)
        .setTint(i % 2 === 0 ? 0xff9bea : 0x8fe6ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0)
        .setDepth(460)
      this.danceObjects.push(sparkle)
      this.tweens.add({
        targets: sparkle,
        alpha: { from: 0, to: 0.9 },
        scaleX: { from: 0.5, to: 1.15 },
        scaleY: { from: 0.5, to: 1.15 },
        duration: 900 + i * 90,
        delay: i * 320,
        yoyo: true,
        repeat: -1,
        repeatDelay: 500,
        ease: 'Sine.easeInOut'
      })
    }

    const floorGlow = addGlow(this, 640, 625, 680, 280, 0xff3fd4, 0.13, 610)
    this.danceObjects.push(floorGlow)
    this.tweens.add({
      targets: floorGlow,
      alpha: 0.23,
      duration: 1250,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    const ring = this.add
      .ellipse(640, 682, 420, 86, 0xff4fd8, 0)
      .setStrokeStyle(2, 0xff9bea, 0.46)
      .setDepth(620)
    this.danceObjects.push(ring)
    this.tweens.add({
      targets: ring,
      scaleX: { from: 0.92, to: 1.06 },
      scaleY: { from: 0.92, to: 1.06 },
      alpha: { from: 0.65, to: 0.2 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    const floorLabel = this.add
      .text(640, 596, 'TOQUE NA PISTA PARA DANÇAR', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffd9f6',
        letterSpacing: 2
      })
      .setOrigin(0.5)
      .setAlpha(0.72)
      .setDepth(630)
    this.danceObjects.push(floorLabel)

    this.floorZone = this.add
      .zone(640, 648, 900, 300)
      .setOrigin(0.5)
      .setDepth(630)
      .setInteractive({ useHandCursor: true })
    this.floorZone.on('pointerdown', (pointer) => {
      if (!isCanvasPointer(this, pointer)) return
      this.interact('dance')
    })

    const djGlow = addGlow(this, 1160, 450, 300, 180, 0x9d7bff, 0.1, 420)
    this.danceObjects.push(djGlow)
    this.tweens.add({
      targets: djGlow,
      alpha: 0.22,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    const djLabel = this.add
      .text(1160, 432, 'DJ', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#e9d8ff',
        letterSpacing: 3
      })
      .setOrigin(0.5)
      .setAlpha(0.62)
      .setDepth(425)
    this.danceObjects.push(djLabel)

    this.djZone = this.add
      .zone(1160, 452, 200, 170)
      .setOrigin(0.5)
      .setDepth(426)
      .setInteractive({ useHandCursor: true })
    this.djZone.on('pointerdown', (pointer) => {
      if (!isCanvasPointer(this, pointer)) return
      this.pulseLights()
    })

    this.addNpc('npc-1', 255, 666, 372, 665, this.danceObjects, 0, 'npcBia')
    this.addNpc('npc-2', 930, 652, 362, 651, this.danceObjects, 1, 'npcJoao')
  }

  buildBarArea() {
    this.barObjects = []

    const haze = addGlow(this, 880, 560, 620, 280, 0x6ff4ff, 0.08, 540)
    this.barObjects.push(haze)

    const markerGlow = addGlow(this, 940, 486, 250, 160, 0x6ff4ff, 0.2, 545)
    this.barObjects.push(markerGlow)
    this.tweens.add({
      targets: markerGlow,
      alpha: 0.34,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.bartender = this.add
      .sprite(770, 520, 'bartender-0')
      .setOrigin(0.5, 1)
      .setDepth(520)
      .setDisplaySize(310 * 0.647, 310)
      .setInteractive({ useHandCursor: true })
    this.bartender.play('bartender-idle')
    this.bartender.on('pointerdown', (pointer) => {
      if (!isCanvasPointer(this, pointer)) return
      this.handleNpcClick('npcMatheus', this.bartender)
    })
    this.barObjects.push(this.bartender)
    const bartenderGlow = addGlow(this, 770, 430, 250, 180, 0xffb36a, 0.12, 500)
    this.barObjects.push(bartenderGlow)

    const ring = this.add
      .ellipse(940, 486, 170, 58, 0x6ff4ff, 0)
      .setStrokeStyle(2, 0x9ffbff, 0.48)
      .setDepth(546)
    this.barObjects.push(ring)

    const label = this.add
      .text(940, 454, 'GIN', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#d7fbff',
        letterSpacing: 3
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#34d8e8', 12, true, true)
      .setDepth(550)
    this.barObjects.push(label)

    this.barZone = this.add
      .zone(940, 492, 300, 190)
      .setOrigin(0.5)
      .setDepth(548)
      .setInteractive({ useHandCursor: true })
    this.barZone.on('pointerdown', (pointer) => {
      if (!isCanvasPointer(this, pointer)) return
      this.interact('bar')
    })
  }

  buildVipArea() {
    this.vipObjects = []

    const haze = addGlow(this, 620, 500, 760, 420, 0xffc478, 0.1, 480)
    this.vipObjects.push(haze)

    this.addNpc('npc-3', 950, 684, 372, 682, this.vipObjects, 2, 'npcMiguel')

    const markerGlow = addGlow(this, 430, 610, 220, 160, 0xffd08a, 0.22, 600)
    this.vipObjects.push(markerGlow)
    this.tweens.add({
      targets: markerGlow,
      alpha: 0.38,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    const ring = this.add
      .ellipse(430, 610, 150, 54, 0xffc478, 0)
      .setStrokeStyle(2, 0xffe1ab, 0.5)
      .setDepth(602)
    this.vipObjects.push(ring)

    const label = this.add
      .text(430, 576, 'CAMAROTE', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffe9c9',
        letterSpacing: 2
      })
      .setOrigin(0.5)
      .setShadow(0, 0, '#e7a85c', 12, true, true)
      .setDepth(605)
    this.vipObjects.push(label)

    const sparkle = this.add
      .image(492, 566, 'sparkle')
      .setDisplaySize(22, 22)
      .setTint(0xffe2a8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.5)
      .setDepth(606)
    this.vipObjects.push(sparkle)
    this.tweens.add({
      targets: sparkle,
      alpha: { from: 0.2, to: 0.95 },
      scaleX: { from: 0.6, to: 1.2 },
      scaleY: { from: 0.6, to: 1.2 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.vipZone = this.add
      .zone(430, 610, 280, 220)
      .setOrigin(0.5)
      .setDepth(604)
      .setInteractive({ useHandCursor: true })
    this.vipZone.on('pointerdown', (pointer) => {
      if (!isCanvasPointer(this, pointer)) return
      this.interact('vip')
    })
  }

  addNpc(key, x, y, height, depth, list, phase, dialogueId) {
    const shadow = addSoftShadow(this, x, y - 2, height * 0.4, 26, 0.26, depth - 1)
    list.push(shadow)
    const image = this.add
      .image(x, y, key)
      .setOrigin(0.5, 1)
      .setDepth(depth)
    const source = this.textures.get(key).getSourceImage()
    image.setDisplaySize((height * source.width) / source.height, height)
    image.setInteractive({ useHandCursor: true })
    image.on('pointerdown', (pointer) => {
      if (!isCanvasPointer(this, pointer)) return
      this.handleNpcClick(dialogueId, image)
    })
    list.push(image)

    this.tweens.add({
      targets: image,
      y: y - 3,
      angle: phase === 0 ? 1.4 : -1.4,
      duration: 1500 + phase * 180,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })
    return image
  }

  handleNpcClick(dialogueId, image) {
    if (
      !image?.visible ||
      this.busy ||
      this.traveling ||
      this.characters?.isBusy() ||
      this.characters?.state === 'dancing' ||
      !dialogueId
    )
      return
    this.soundManager.play('ui')
    this.dialogue.say(dialogueId, { interrupt: true, priority: 13 })
    const baseX = image.scaleX
    const baseY = image.scaleY
    this.tweens.add({
      targets: image,
      scaleX: baseX * 1.05,
      scaleY: baseY * 1.05,
      duration: 140,
      yoyo: true,
      ease: 'Sine.easeOut'
    })
    this.sparkleBurst(image.x, image.y - image.displayHeight * 0.6, 4, 0xffd6a0)
  }

  pulseLights() {
    if (
      this.area !== 'dance' ||
      this.busy ||
      this.traveling ||
      this.characters?.isBusy() ||
      this.characters?.state === 'dancing'
    )
      return
    this.soundManager.play('dance')
    this.soundManager.setClubMode(true)
    this.dialogue.say('dj', { interrupt: true, priority: 14 })
    this.sparkleBurst(640, 440, 12, 0xb8a0ff)
    gameBus.emit(EVENTS.TOAST, 'Solta o som, DJ!')
  }

  sparkleBurst(x, y, count = 8, tint = 0xffbdf2) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4
      const distance = 38 + Math.random() * 48
      const sparkle = this.add
        .image(x, y, 'sparkle')
        .setDisplaySize(14 + Math.random() * 10, 14 + Math.random() * 10)
        .setTint(tint)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(720)
      this.tweens.add({
        targets: sparkle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance - 24,
        angle: Phaser.Math.Between(-120, 120),
        alpha: { from: 0.9, to: 0 },
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 700 + Math.random() * 350,
        ease: 'Cubic.easeOut',
        onComplete: () => sparkle.destroy()
      })
    }
  }

  setArea(area, options = {}) {
    this.area = area
    if (this.bg) {
      this.bg.setTexture(BACKGROUNDS[area])
      this.bg.setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    }
    this.setObjectsVisible(this.danceObjects, area === 'dance')
    this.setObjectsVisible(this.barObjects, area === 'bar')
    this.setObjectsVisible(this.vipObjects, area === 'vip')
    if (this.floorZone?.input) this.floorZone.input.enabled = area === 'dance'
    if (this.djZone?.input) this.djZone.input.enabled = area === 'dance'
    if (this.barZone?.input) this.barZone.input.enabled = area === 'bar'
    if (this.vipZone?.input) this.vipZone.input.enabled = area === 'vip'
  }

  setObjectsVisible(objects, visible) {
    if (!objects) return
    for (const object of objects) {
      object.setVisible(visible)
    }
  }

  placeCharacter(area, announce = false) {
    const anchor = ANCHORS[area] ?? ANCHORS.dance
    this.characters.setPosition(anchor.x, anchor.y)
    this.characters.faceRight()
    if (announce) {
      this.charShadow.setPosition(anchor.x, anchor.y - 2)
    }
  }

  switchArea(area) {
    if (!ANCHORS[area] || area === this.area) return
    if (this.busy || this.traveling || this.characters?.isBusy()) return
    this.busy = true
    this.danceActive = false
    this.characters.idle()
    this.soundManager.play('ui')
    gameBus.emit(EVENTS.AREA_STATE, { scene: 'duck', area, transitioning: true })
    this.cameras.main.fadeOut(240, 7, 3, 12)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.setArea(area)
      this.placeCharacter(area)
      this.cameras.main.fadeIn(280, 7, 3, 12)
      gameBus.emit(EVENTS.LOCATION, { scene: 'duck', area, traveling: false })
      gameBus.emit(EVENTS.AREA_STATE, { scene: 'duck', area, transitioning: false })
      this.dialogue.say(AREA_LINES[area], { interrupt: true, priority: 16 })
      this.time.delayedCall(260, () => {
        this.busy = false
      })
    })
  }

  handleDialogueShow(item) {
    if (item.entry.gesture !== 'talk' || this.traveling) return
    if (!['idle', 'blinking', 'waving', 'talking'].includes(this.characters?.state)) return
    this.characters.talk(Math.min(item.displayDuration ?? item.entry.duration, 5200))
  }

  handleCharacterClick() {
    if (this.busy || this.traveling) return
    if (this.area === 'dance') {
      this.interact('dance')
    } else {
      this.talk()
    }
  }

  interact(action) {
    if (this.busy || this.traveling) return
    if (action === 'dance') this.toggleDance()
    else if (action === 'bar') this.orderDrink()
    else if (action === 'vip') this.enjoyVip()
  }

  toggleDance() {
    if (this.area !== 'dance' || this.busy || this.traveling || this.characters.isBusy()) return
    if (this.danceActive || this.characters.state === 'dancing') {
      this.characters.stopDance()
      this.danceActive = false
      this.soundManager.play('ui')
      this.dialogue.say('danceStop', { interrupt: true, priority: 14 })
      return
    }
    if (this.characters.state === 'talking') this.characters.idle()
    this.characters.dance()
    this.danceActive = true
    this.soundManager.play('dance')
    this.soundManager.setClubMode(true)
    this.dialogue.say('dance', { interrupt: true, priority: 16 })
    this.sparkleBurst(640, 430, 10, 0xff8ce6)
    gameBus.emit(EVENTS.TOAST, 'Dançando na Duck')
  }

  orderDrink() {
    if (this.area !== 'bar' || this.busy || this.traveling || this.characters.isBusy()) return
    if (this.characters.state === 'dancing') {
      this.characters.stopDance()
      this.danceActive = false
    }
    if (this.characters.state === 'talking') this.characters.idle()
    this.soundManager.play('ui')
    this.dialogue.say('bar', { interrupt: true, priority: 14 })
    gameBus.emit(EVENTS.OPEN_DRINK_MENU)
  }

  serveDrink(payload) {
    if (this.area !== 'bar' || this.traveling) return
    if (this.characters?.state === 'talking') this.characters.idle()
    if (this.characters?.state === 'dancing') this.characters.stopDance()
    const drinkName = payload?.drink?.name ?? 'Gin tônica'
    const targetX = 540
    const perform = () => {
      if (this.area !== 'bar' || this.traveling || this.characters.isBusy()) return
      this.characters.drink(() => {
        this.danceActive = false
      })
      this.soundManager.play('clink')
      this.time.delayedCall(560, () => this.soundManager.play('sip'))
      this.dialogue.say('gin', { force: true, interrupt: true, priority: 20 })
      this.sparkleBurst(this.characters.sprite.x + 26, this.characters.sprite.y - 270, 5, 0xffb3d9)
      gameBus.emit(EVENTS.TOAST, `${drinkName} na mão`)
    }
    if (Math.abs(this.characters.sprite.x - targetX) > 26) {
      this.characters.walkTo(targetX, ANCHORS.bar.y, 1000, { onComplete: perform })
    } else {
      perform()
    }
  }

  enjoyVip() {
    if (this.area !== 'vip' || this.busy || this.traveling || this.characters.isBusy()) return
    if (this.characters.state === 'dancing') {
      this.characters.stopDance()
      this.danceActive = false
    }
    if (this.characters.state === 'talking') this.characters.idle()
    this.soundManager.play('ui')
    this.dialogue.say('vip', { interrupt: true, priority: 14 })
    gameBus.emit(EVENTS.OPEN_GUEST_MENU)
  }

  receiveGuest(payload) {
    this.refreshGuests()
    if (this.area !== 'vip' || this.traveling) return
    const guest = payload?.guest
    if (!guest) return
    this.soundManager.play('cheer')
    this.characters.happy(1800)
    this.dialogue.say('vip', { force: true, interrupt: true, priority: 20 })
    gameBus.emit(EVENTS.TOAST, `${guest.name} entrou no camarote!`)
    this.sparkleBurst(680, 500, 12, 0xffe0a3)
  }

  refreshGuests() {
    for (const guest of this.invitedGuests ?? []) {
      guest.destroy()
    }
    this.invitedGuests = []
    if (!this.vipObjects) return
    const positions = [620, 710, 800]
    gameState.guests.forEach((id, index) => {
      const guest = GUESTS.find((item) => item.id === id)
      if (!guest || index > 2) return
      const x = positions[index]
      const y = 686
      const image = this.add
        .image(x, y, guest.texture)
        .setOrigin(0.5, 1)
        .setDepth(y)
      const source = this.textures.get(guest.texture).getSourceImage()
      image.setDisplaySize((320 * source.width) / source.height, 320)
      image.setVisible(this.area === 'vip')
      this.tweens.add({
        targets: image,
        y: y - 3,
        angle: index % 2 === 0 ? 1.2 : -1.2,
        duration: 1600 + index * 180,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      })
      this.vipObjects.push(image)
      this.invitedGuests.push(image)
    })
  }
  talk() {
    if (this.busy || this.traveling || this.characters.isBusy()) return
    if (this.characters.state === 'dancing') {
      this.characters.stopDance()
      this.danceActive = false
    }
    this.soundManager.play('ui')
    const shown = this.dialogue.say(TALK_LINES[this.area], {
      force: true,
      interrupt: true,
      priority: 8
    })
    if (shown) this.characters.talk(4200)
  }

  returnHome() {
    if (this.busy || this.traveling || this.characters.isBusy()) return
    this.busy = true
    this.traveling = true
    this.danceActive = false
    this.characters.idle()
    gameBus.emit(EVENTS.TRAVEL_STATE, { phase: 'leaving', from: 'duck', target: 'bedroom' })
    gameBus.emit(EVENTS.TOAST, 'Voltando para o quarto...')
    this.dialogue.say('returnHome', { force: true, interrupt: true, priority: 50 })
    this.soundManager.play('happy')
    this.characters.happy(1800)

    this.time.delayedCall(900, () => {
      if (!this.sys.isActive()) return
      this.characters.walkTo(1200, 700, 1500, {
        onComplete: () => {
          this.cameras.main.fadeOut(520, 6, 2, 10)
          this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start(SCENES.TRAVEL, {
              target: SCENES.BEDROOM,
              from: 'duck',
              area: 'bedroom'
            })
          })
        }
      })
    })
  }

  shutdown() {
    gameBus.off(EVENTS.REQUEST_AREA, this.handleRequestArea)
    gameBus.off(EVENTS.REQUEST_INTERACT, this.handleRequestInteract)
    gameBus.off(EVENTS.REQUEST_TALK, this.handleRequestTalk)
    gameBus.off(EVENTS.REQUEST_RETURN, this.handleRequestReturn)
    gameBus.off(EVENTS.DUCK_DRINK_BOUGHT, this.handleDrinkBought)
    gameBus.off(EVENTS.DUCK_GUEST_INVITED, this.handleGuestInvited)
    gameBus.off(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    this.characters?.destroy()
    this.dialogue?.destroy()
    this.soundManager?.setClubMode(false)
    this.characters = null
    this.dialogue = null
    this.soundManager = null
    if (import.meta.env.DEV && window.__mascot?.scene === this) {
      delete window.__mascot
    }
  }
}
