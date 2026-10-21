import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../constants.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import { getSoundManager } from '../systems/SoundManager.js'
import WorkPlayer from '../systems/WorkPlayer.js'
import { createCharacterAnimations } from '../animations.js'
import { addSoftShadow, ensureEffectTextures } from '../effects.js'
import { isGalleryUnlocked } from '../museumState.js'
import { addButton, addCoverImage, preloadMuseumAssets } from '../museum/utils.js'

const STATUES = [
  {
    id: 'branco',
    title: 'Branco',
    subtitle: '00 do Paineiras',
    texture: 'statue-branco',
    height: 244
  },
  {
    id: 'miguel',
    title: 'Miguel Bigode',
    subtitle: 'Amigo do condomínio',
    texture: 'statue-miguel',
    height: 236
  },
  {
    id: 'vitinho',
    title: 'Vitinho',
    subtitle: 'Amigo do condomínio',
    texture: 'statue-vitinho',
    height: 236
  },
  {
    id: 'manu',
    title: 'Manu',
    subtitle: 'Amiga do condomínio',
    texture: 'statue-manu',
    height: 226
  },
  {
    id: 'levi',
    title: 'Levi',
    subtitle: 'Amigo do condomínio',
    texture: 'statue-levi',
    height: 232
  }
]

const ARTWORKS = [
  { id: 'neon', title: 'Corredor do Museu', image: 'gallery-1' },
  { id: 'hall', title: 'Galeria Principal', image: 'museum-gallery-hall' },
  { id: 'atrium', title: 'Salão Central', image: 'museum-gallery-atrium' }
]

export default class MuseumGalleryScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MUSEUM_GALLERY })
    this.targets = []
    this.moveTarget = null
    this.pendingTarget = null
    this.leaving = false
    this.viewerOpen = false
    this.currentPrompt = ''
  }

  init(data = {}) {
    this.from = data.from ?? 'museum'
    this.targets = []
    this.moveTarget = null
    this.pendingTarget = null
    this.leaving = false
    this.viewerOpen = false
    this.currentPrompt = ''
  }

  preload() {
    preloadMuseumAssets(this)
  }

  create() {
    this.cameras.main.setBackgroundColor('#061018')
    this.cameras.main.fadeIn(360, 3, 8, 12)
    ensureEffectTextures(this)
    createCharacterAnimations(this)

    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(false)
    this.soundManager.stopVoice()
    this.soundManager.stopStory()

    if (!isGalleryUnlocked()) {
      this.scene.start(SCENES.MUSEUM, { from: 'gallery' })
      return
    }

    this.background = addCoverImage(this, 'museum-gallery-hall', { zoom: 1.035 })
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x031018, 0.2)
      .setDepth(-9)
    this.light = this.add
      .image(GAME_WIDTH / 2, 140, 'warm-glow')
      .setDisplaySize(1000, 480)
      .setTint(0xd8f7ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.12)
      .setDepth(-8)

    for (let index = 0; index < 14; index += 1) {
      const dust = this.add
        .image(
          Phaser.Math.Between(120, GAME_WIDTH - 120),
          Phaser.Math.Between(170, 600),
          'sparkle'
        )
        .setScale(Phaser.Math.FloatBetween(0.07, 0.17))
        .setTint(0xd8f7ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(Phaser.Math.FloatBetween(0.07, 0.2))
        .setDepth(-7)
      this.tweens.add({
        targets: dust,
        y: dust.y - Phaser.Math.Between(12, 30),
        alpha: { from: dust.alpha, to: 0.02 },
        duration: Phaser.Math.Between(4200, 7600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1600)
      })
    }

    this.add
      .rectangle(GAME_WIDTH / 2, 92, 560, 60, 0x04141d, 0.88)
      .setStrokeStyle(1, 0x8fe8ff, 0.35)
      .setDepth(10)
    this.add
      .text(GAME_WIDTH / 2, 79, 'GALERIA DE AMIGOS', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#fff4dc',
        stroke: '#07161d',
        strokeThickness: 4,
        letterSpacing: 2
      })
      .setOrigin(0.5)
      .setDepth(11)
    this.add
      .text(GAME_WIDTH / 2, 112, 'ESTÁTUAS E MEMÓRIAS DO PAINEIRAS', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#a9e8f5',
        letterSpacing: 3
      })
      .setOrigin(0.5)
      .setAlpha(0.78)
      .setDepth(11)

    STATUES.forEach((statue, index) => {
      this.createStatue(statue, 170 + index * 235, 582)
    })
    ARTWORKS.forEach((artwork, index) => {
      this.createArtwork(artwork, 320 + index * 320, 202)
    })

    this.player = new WorkPlayer(this, {
      x: GAME_WIDTH / 2,
      y: 690,
      height: 360,
      bounds: { left: 130, right: 1150, top: 540, bottom: 684 },
      obstacles: [],
      onInteract: () => this.interactNearest()
    })
    this.player.sprite.setDepth(690)

    this.promptBackground = this.add
      .rectangle(GAME_WIDTH / 2, 514, 420, 36, 0x041219, 0.84)
      .setStrokeStyle(1, 0x8fe8ff, 0.4)
      .setDepth(1500)
      .setVisible(false)
    this.promptText = this.add
      .text(GAME_WIDTH / 2, 514, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#e6fbff',
        letterSpacing: 1
      })
      .setOrigin(0.5)
      .setDepth(1501)
      .setVisible(false)

    this.add
      .text(GAME_WIDTH - 24, GAME_HEIGHT - 16, 'WASD / SETAS  •  TOQUE NO CHÃO  •  E PARA INTERAGIR', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#d8f7ff',
        letterSpacing: 1
      })
      .setOrigin(1, 1)
      .setAlpha(0.55)
      .setDepth(1400)

    this.floorZone = this.add
      .zone(GAME_WIDTH / 2, 578, GAME_WIDTH, 162)
      .setOrigin(0.5, 0)
      .setDepth(-1)
      .setInteractive()
    this.floorZone.on('pointerdown', (pointer) => {
      this.walkTo(pointer.worldX, pointer.worldY)
    })

    this.buildViewer()

    this.handleToggleSound = () => {
      const enabled = this.soundManager.toggle()
      gameBus.emit(EVENTS.SOUND_STATE, enabled)
    }
    this.handleMuseumExit = () => this.exitToMuseum()
    this.handleEscapeKey = (event) => {
      if (event.key === 'Escape') this.handleEscape()
    }

    gameBus.on(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    gameBus.on(EVENTS.REQUEST_MUSEUM_EXIT, this.handleMuseumExit)
    window.addEventListener('keydown', this.handleEscapeKey)
    this.events.once('shutdown', this.shutdown, this)

    gameBus.emit(EVENTS.CHARACTER_STATE, 'idle')
    gameBus.emit(EVENTS.SOUND_STATE, !this.soundManager.muted)
    gameBus.emit(EVENTS.LOCATION, {
      scene: 'museum',
      area: 'museum-gallery',
      traveling: false
    })

    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        open: (id) => {
          const statue = STATUES.find((item) => item.id === id)
          const artwork = ARTWORKS.find((item) => item.id === id)
          if (statue) this.showStatue(statue)
          if (artwork) this.showArtwork(artwork)
        },
        close: () => this.closeViewer(),
        exit: () => this.exitToMuseum(),
        snapshot: () => ({
          scene: 'gallery',
          x: this.player?.sprite?.x,
          y: this.player?.sprite?.y,
          prompt: this.currentPrompt,
          viewerOpen: this.viewerOpen
        })
      }
    }
  }

  createStatue(statue, x, baseY) {
    const glow = this.add
      .image(x, baseY - 178, 'warm-glow')
      .setDisplaySize(210, 300)
      .setTint(0x8fe8ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.1)
      .setDepth(1)
    this.tweens.add({
      targets: glow,
      alpha: 0.22,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: x * 0.8
    })

    const base = this.add
      .rectangle(x, baseY + 2, 126, 16, 0x071b23, 0.9)
      .setStrokeStyle(1, 0x8fe8ff, 0.25)
      .setDepth(baseY + 3)
    const column = this.add
      .rectangle(x, baseY - 14, 86, 28, 0x0d313c, 0.95)
      .setStrokeStyle(1, 0x8fe8ff, 0.3)
      .setDepth(baseY + 2)
    const top = this.add
      .ellipse(x, baseY - 30, 106, 20, 0x1c5b6c, 0.95)
      .setStrokeStyle(1, 0x8fe8ff, 0.5)
      .setDepth(baseY + 4)
    addSoftShadow(this, x, baseY - 28, 150, 28, 0.32, baseY + 1)

    const image = this.add
      .image(x, baseY - 32, statue.texture)
      .setOrigin(0.5, 1)
      .setDepth(baseY + 5)
      .setInteractive({ useHandCursor: true })
    const source = this.textures.get(statue.texture).getSourceImage()
    const width = (statue.height * source.width) / source.height
    image.setDisplaySize(width, statue.height)

    const plaque = this.add
      .text(x, baseY + 20, statue.title, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fff2d6',
        stroke: '#041018',
        strokeThickness: 4,
        letterSpacing: 1
      })
      .setOrigin(0.5, 0)
      .setDepth(baseY + 6)
      .setInteractive({ useHandCursor: true })

    const target = {
      kind: 'statue',
      id: statue.id,
      x,
      y: 612,
      label: `Ver estátua de ${statue.title}`,
      statue
    }
    this.targets.push(target)

    const imageScaleX = image.scaleX
    const imageScaleY = image.scaleY
    const hover = (active) => {
      this.tweens.add({
        targets: image,
        scaleX: imageScaleX * (active ? 1.035 : 1),
        scaleY: imageScaleY * (active ? 1.035 : 1),
        duration: 120,
        ease: 'Sine.easeOut',
        overwrite: true
      })
    }
    const activate = () => {
      if (this.isNearTarget(target)) {
        this.showStatue(statue)
      } else {
        this.walkTo(target.x, target.y, target)
      }
    }
    image.on('pointerover', () => hover(true))
    image.on('pointerout', () => hover(false))
    image.on('pointerdown', activate)
    plaque.on('pointerdown', activate)
  }

  createArtwork(artwork, x, y) {
    const glow = this.add
      .image(x, y, 'warm-glow')
      .setDisplaySize(330, 220)
      .setTint(0xffcf8a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.08)
      .setDepth(1)

    const frame = this.add
      .rectangle(x, y, 244, 148, 0x061018, 0.9)
      .setStrokeStyle(2, 0xffd38a, 0.55)
      .setDepth(2)
    const image = this.add
      .image(x, y - 2, artwork.image)
      .setDisplaySize(220, 124)
      .setDepth(3)
      .setInteractive({ useHandCursor: true })
    const captionBack = this.add
      .rectangle(x, y + 52, 220, 22, 0x031018, 0.78)
      .setDepth(4)
    const label = this.add
      .text(x, y + 52, artwork.title, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fff0cc'
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setInteractive({ useHandCursor: true })

    const target = {
      kind: 'artwork',
      id: artwork.id,
      x,
      y: 612,
      label: `Ver quadro ${artwork.title}`,
      artwork
    }
    this.targets.push(target)

    const activate = () => {
      if (this.isNearTarget(target)) {
        this.showArtwork(artwork)
      } else {
        this.walkTo(target.x, target.y, target)
      }
    }
    image.on('pointerdown', activate)
    label.on('pointerdown', activate)
    image.on('pointerover', () => frame.setStrokeStyle(2, 0xffe4b0, 0.95))
    image.on('pointerout', () => frame.setStrokeStyle(2, 0xffd38a, 0.55))
  }

  buildViewer() {
    this.viewer = this.add.container(0, 0).setDepth(5000).setVisible(false)
    const backdrop = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x010508, 0.92)
      .setInteractive()
    backdrop.on('pointerdown', () => this.closeViewer())
    this.viewerImage = this.add.image(GAME_WIDTH / 2, 326, 'gallery-1')
    this.viewerTitle = this.add
      .text(GAME_WIDTH / 2, 632, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '28px',
        fontStyle: 'bold',
        color: '#fff4df'
      })
      .setOrigin(0.5)
    this.viewerSubtitle = this.add
      .text(GAME_WIDTH / 2, 668, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#a9e8f5',
        letterSpacing: 2
      })
      .setOrigin(0.5)
    this.viewerClose = addButton(this, {
      x: 1110,
      y: 44,
      width: 46,
      height: 38,
      label: 'X',
      fontSize: 15,
      onClick: () => this.closeViewer()
    })
    this.viewer.add([
      backdrop,
      this.viewerImage,
      this.viewerTitle,
      this.viewerSubtitle,
      this.viewerClose.background,
      this.viewerClose.text
    ])
  }

  showStatue(statue) {
    const source = this.textures.get(statue.texture).getSourceImage()
    const height = Math.min(500, GAME_HEIGHT - 190)
    const width = (height * source.width) / source.height
    this.viewerImage.setTexture(statue.texture).setDisplaySize(width, height)
    this.viewerTitle.setText(statue.title)
    this.viewerSubtitle.setText(`${statue.subtitle}  •  ACERVO DO MUSEU`)
    this.openViewer()
  }

  showArtwork(artwork) {
    const source = this.textures.get(artwork.image).getSourceImage()
    const width = Math.min(960, GAME_WIDTH - 120)
    const height = (width * source.height) / source.width
    this.viewerImage.setTexture(artwork.image).setDisplaySize(width, height)
    this.viewerTitle.setText(artwork.title)
    this.viewerSubtitle.setText('CENÁRIO DO ACERVO DO MUSEU')
    this.openViewer()
  }

  openViewer() {
    this.viewerOpen = true
    this.viewer.setVisible(true).setAlpha(0)
    this.tweens.add({
      targets: this.viewer,
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut'
    })
  }

  closeViewer() {
    if (!this.viewerOpen) return
    this.viewerOpen = false
    this.tweens.add({
      targets: this.viewer,
      alpha: 0,
      duration: 180,
      ease: 'Sine.easeIn',
      onComplete: () => this.viewer.setVisible(false)
    })
  }

  isNearTarget(target, radius = 150) {
    if (!this.player) return false
    return this.player.distanceTo(target.x, target.y) <= radius
  }

  nearestTarget() {
    let nearest = null
    let best = Infinity
    for (const target of this.targets) {
      const distance = this.player?.distanceTo(target.x, target.y) ?? Infinity
      if (distance < best && distance <= 150) {
        best = distance
        nearest = target
      }
    }
    return nearest
  }

  setPrompt(text) {
    if (text === this.currentPrompt) return
    this.currentPrompt = text
    if (!text) {
      this.promptBackground.setVisible(false)
      this.promptText.setVisible(false)
      return
    }
    this.promptText.setText(text)
    this.promptBackground
      .setDisplaySize(Math.max(320, this.promptText.width + 44), 36)
      .setVisible(true)
    this.promptText.setVisible(true)
  }

  walkTo(x, y, target = null) {
    if (this.leaving) return
    this.moveTarget = {
      x: Phaser.Math.Clamp(x, 140, 1140),
      y: Phaser.Math.Clamp(y, 548, 678)
    }
    this.pendingTarget = target
  }

  interactNearest() {
    if (this.leaving) return
    const target = this.nearestTarget()
    if (!target) {
      gameBus.emit(EVENTS.TOAST, 'Chegue mais perto de uma estátua ou quadro.')
      return
    }
    if (target.kind === 'statue') this.showStatue(target.statue)
    if (target.kind === 'artwork') this.showArtwork(target.artwork)
  }

  handleEscape() {
    const now = this.time.now
    if (now - (this.lastEscapeAt ?? 0) < 250) return
    this.lastEscapeAt = now
    if (this.viewerOpen) {
      this.closeViewer()
      return
    }
    this.exitToMuseum()
  }

  exitToMuseum() {
    if (this.leaving) return
    this.leaving = true
    this.player?.setLocked(true)
    this.soundManager.stopStory()
    this.cameras.main.fadeOut(320, 3, 8, 12)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.MUSEUM, { from: 'gallery' })
    })
  }

  update() {
    if (!this.player || this.leaving) return

    const keyboardMoving =
      this.player.cursors.left.isDown ||
      this.player.cursors.right.isDown ||
      this.player.cursors.up.isDown ||
      this.player.cursors.down.isDown ||
      this.player.keys.left.isDown ||
      this.player.keys.right.isDown ||
      this.player.keys.up.isDown ||
      this.player.keys.down.isDown

    if (keyboardMoving) {
      this.moveTarget = null
      this.pendingTarget = null
    }

    if (this.moveTarget) {
      const dx = this.moveTarget.x - this.player.sprite.x
      const dy = this.moveTarget.y - this.player.sprite.y
      const distance = Math.hypot(dx, dy)
      if (distance < 7) {
        this.player.setTouchVector({ x: 0, y: 0 })
        this.moveTarget = null
        const target = this.pendingTarget
        this.pendingTarget = null
        if (target && this.isNearTarget(target)) {
          if (target.kind === 'statue') this.showStatue(target.statue)
          if (target.kind === 'artwork') this.showArtwork(target.artwork)
        }
      } else {
        this.player.setTouchVector({ x: dx / distance, y: dy / distance })
      }
    } else {
      this.player.setTouchVector({ x: 0, y: 0 })
    }

    this.player.update(this.game.loop.delta)

    const nearest = this.nearestTarget()
    if (!nearest) {
      this.setPrompt('')
    } else {
      this.setPrompt(`E - ${nearest.label}`)
    }

    const offset = (this.player.sprite.x - GAME_WIDTH / 2) / GAME_WIDTH
    this.background.x = GAME_WIDTH / 2 - offset * 16
    this.light.x = GAME_WIDTH / 2 - offset * 26
  }

  shutdown() {
    gameBus.off(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    gameBus.off(EVENTS.REQUEST_MUSEUM_EXIT, this.handleMuseumExit)
    window.removeEventListener('keydown', this.handleEscapeKey)
    this.handleEscapeKey = null
    this.player?.destroy()
    this.player = null
    this.targets = []
    this.soundManager?.stopStory()
    this.soundManager?.setClubMode(false)
    this.soundManager = null
    if (import.meta.env.DEV && window.__mascot?.scene === this) {
      delete window.__mascot
    }
  }
}
