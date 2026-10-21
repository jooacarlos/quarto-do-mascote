import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../constants.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import { getSoundManager } from '../systems/SoundManager.js'
import WorkPlayer from '../systems/WorkPlayer.js'
import { createCharacterAnimations } from '../animations.js'
import { ensureEffectTextures } from '../effects.js'
import { getResumeChapter, isGalleryUnlocked } from '../museumState.js'
import { addCoverImage, preloadMuseumAssets } from '../museum/utils.js'

export default class MuseumScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MUSEUM })
    this.markers = []
    this.moveTarget = null
    this.pendingMarker = null
    this.leaving = false
    this.currentPrompt = ''
  }

  init(data = {}) {
    this.from = data.from ?? 'facade'
    this.markers = []
    this.moveTarget = null
    this.pendingMarker = null
    this.leaving = false
    this.currentPrompt = ''
  }

  preload() {
    preloadMuseumAssets(this)
  }

  create() {
    this.cameras.main.setBackgroundColor('#061018')
    this.cameras.main.fadeIn(420, 2, 8, 12)

    ensureEffectTextures(this)
    createCharacterAnimations(this)

    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(false)
    this.soundManager.stopVoice()
    this.soundManager.stopStory()

    this.background = addCoverImage(this, 'museum-lobby', { zoom: 1.035 })
    this.add
      .rectangle(GAME_WIDTH / 2, 596, GAME_WIDTH, 248, 0x031018, 0.36)
      .setDepth(-9)
    this.add
      .rectangle(GAME_WIDTH / 2, 124, GAME_WIDTH, 248, 0x061a24, 0.16)
      .setDepth(-9)

    this.light = this.add
      .image(GAME_WIDTH / 2, 148, 'warm-glow')
      .setDisplaySize(980, 520)
      .setTint(0x9fe8ff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.11)
      .setDepth(-8)

    for (let index = 0; index < 16; index += 1) {
      const dust = this.add
        .image(
          Phaser.Math.Between(110, GAME_WIDTH - 110),
          Phaser.Math.Between(170, 620),
          'sparkle'
        )
        .setScale(Phaser.Math.FloatBetween(0.07, 0.18))
        .setTint(0xc6f4ff)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(Phaser.Math.FloatBetween(0.08, 0.24))
        .setDepth(-7)
      this.tweens.add({
        targets: dust,
        y: dust.y - Phaser.Math.Between(14, 34),
        alpha: { from: dust.alpha, to: 0.02 },
        duration: Phaser.Math.Between(4200, 7800),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 1800)
      })
    }

    const spawn =
      this.from === 'history'
        ? { x: 280, y: 650 }
        : this.from === 'gallery'
          ? { x: 1060, y: 650 }
          : { x: GAME_WIDTH / 2, y: 690 }

    this.player = new WorkPlayer(this, {
      x: spawn.x,
      y: spawn.y,
      height: 360,
      bounds: { left: 130, right: 1150, top: 540, bottom: 684 },
      obstacles: [],
      onInteract: () => this.interactNearest()
    })
    this.player.sprite.setDepth(spawn.y + 4)

    this.promptBackground = this.add
      .rectangle(GAME_WIDTH / 2, 514, 420, 36, 0x041219, 0.82)
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

    const historyMarker = this.createMarker({
      id: 'history',
      x: 220,
      y: 612,
      color: 0x8fe8ff,
      label: 'HISTORYBOARD',
      action: () => this.openHistoryBoard()
    })
    const careerMarker = this.createMarker({
      id: 'career',
      x: 850,
      y: 612,
      color: 0xb8a4ff,
      label: 'VIDA PROFISSIONAL',
      action: () => {
        gameBus.emit(EVENTS.TOAST, 'Este espaco ainda esta em preparacao.')
      }
    })
    const galleryMarker = this.createMarker({
      id: 'gallery',
      x: 1110,
      y: 612,
      color: 0xffcf8a,
      label: 'GALERIA DE AMIGOS',
      locked: !isGalleryUnlocked(),
      action: () => this.openGallery()
    })

    this.createDoorHotspot({
      x: 232,
      y: 392,
      width: 238,
      height: 276,
      color: 0x8fe8ff,
      marker: historyMarker
    })
    this.createDoorHotspot({
      x: 850,
      y: 392,
      width: 306,
      height: 276,
      color: 0xb8a4ff,
      marker: careerMarker
    })
    this.createDoorHotspot({
      x: 1116,
      y: 392,
      width: 238,
      height: 276,
      color: 0xffcf8a,
      marker: galleryMarker
    })

    this.handleToggleSound = () => {
      const enabled = this.soundManager.toggle()
      gameBus.emit(EVENTS.SOUND_STATE, enabled)
    }
    this.handleMuseumExit = () => this.exitToBedroom()

    gameBus.on(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    gameBus.on(EVENTS.REQUEST_MUSEUM_EXIT, this.handleMuseumExit)
    this.events.once('shutdown', this.shutdown, this)

    this.handleEscapeKey = (event) => {
      if (event.key === 'Escape') this.exitToBedroom()
    }
    window.addEventListener('keydown', this.handleEscapeKey)

    gameBus.emit(EVENTS.CHARACTER_STATE, 'idle')
    gameBus.emit(EVENTS.SOUND_STATE, !this.soundManager.muted)
    gameBus.emit(EVENTS.LOCATION, {
      scene: 'museum',
      area: 'museum-lobby',
      traveling: false
    })

    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        history: () => this.openHistoryBoard(),
        gallery: () => this.openGallery(),
        exit: () => this.exitToBedroom(),
        snapshot: () => ({
          scene: 'museum',
          x: this.player?.sprite?.x,
          y: this.player?.sprite?.y,
          prompt: this.currentPrompt,
          gallery: isGalleryUnlocked()
        })
      }
    }
  }

  createMarker({ id, x, y, color, label, locked = false, action }) {
    const marker = {
      id,
      x,
      y,
      label,
      locked,
      action
    }

    marker.glow = this.add
      .ellipse(x, y, 190, 54, color, 0.12)
      .setStrokeStyle(2, color, locked ? 0.3 : 0.68)
      .setDepth(y - 3)
    this.tweens.add({
      targets: marker.glow,
      alpha: { from: 0.35, to: 0.88 },
      scaleX: { from: 0.95, to: 1.05 },
      scaleY: { from: 0.95, to: 1.05 },
      duration: 1250,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    marker.label = this.add
      .text(x, y - 44, label, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: locked ? '#c5b9a8' : '#fff5e6',
        stroke: '#06151d',
        strokeThickness: 4,
        letterSpacing: 1
      })
      .setOrigin(0.5, 1)
      .setDepth(y + 12)
      .setAlpha(locked ? 0.55 : 0.95)

    marker.zone = this.add
      .zone(x, y, 230, 130)
      .setOrigin(0.5)
      .setDepth(y + 20)
      .setInteractive({ useHandCursor: true })
    marker.zone.on('pointerdown', () => {
      if (this.isNearMarker(marker)) {
        marker.action()
      } else {
        this.walkTo(x, Math.min(y + 20, 676), marker)
      }
    })

    this.markers.push(marker)
    return marker
  }

  createDoorHotspot({ x, y, width, height, color, marker }) {
    const outline = this.add
      .rectangle(x, y, width, height, 0xffffff, 0)
      .setStrokeStyle(2, color, 0)
      .setDepth(48)
    const zone = this.add
      .zone(x, y, width, height)
      .setDepth(49)
      .setInteractive({ useHandCursor: true })

    zone.on('pointerover', () => {
      outline.setStrokeStyle(2, color, 0.85)
    })
    zone.on('pointerout', () => {
      outline.setStrokeStyle(2, color, 0)
    })
    zone.on('pointerdown', () => {
      if (this.leaving) return
      if (this.isNearMarker(marker)) {
        marker.action()
      } else {
        this.walkTo(marker.x, Math.min(marker.y + 20, 676), marker)
      }
    })
    return { outline, zone }
  }

  walkTo(x, y, marker = null) {
    if (this.leaving) return
    this.moveTarget = {
      x: Phaser.Math.Clamp(x, 140, 1140),
      y: Phaser.Math.Clamp(y, 548, 678)
    }
    this.pendingMarker = marker
  }

  isNearMarker(marker, radius = 150) {
    if (!this.player) return false
    return this.player.distanceTo(marker.x, marker.y) <= radius
  }

  nearestMarker() {
    let nearest = null
    let best = Infinity
    for (const marker of this.markers) {
      const distance = this.player?.distanceTo(marker.x, marker.y) ?? Infinity
      if (distance < best && distance <= 150) {
        best = distance
        nearest = marker
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

  interactNearest() {
    if (this.leaving) return
    const marker = this.nearestMarker()
    if (!marker) {
      gameBus.emit(EVENTS.TOAST, 'Chegue mais perto de uma atracao do museu.')
      return
    }
    marker.action()
  }

  openHistoryBoard() {
    if (this.leaving) return
    this.leaving = true
    this.player?.setLocked(true)
    this.soundManager.stopStory()
    this.cameras.main.fadeOut(340, 3, 8, 12)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.HISTORY_BOARD, {
        from: 'museum',
        chapter: getResumeChapter()
      })
    })
  }

  openGallery() {
    if (this.leaving) return
    if (!isGalleryUnlocked()) {
      gameBus.emit(
        EVENTS.TOAST,
        'Conclua a HistoryBoard do Paineiras para desbloquear a Galeria de Amigos.'
      )
      return
    }
    this.leaving = true
    this.player?.setLocked(true)
    this.cameras.main.fadeOut(320, 3, 8, 12)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.MUSEUM_GALLERY, { from: 'museum' })
    })
  }

  exitToBedroom() {
    if (this.leaving) return
    this.leaving = true
    this.player?.setLocked(true)
    this.soundManager.stopStory()
    gameBus.emit(EVENTS.TRAVEL_STATE, {
      phase: 'leaving',
      from: 'museum',
      target: 'bedroom'
    })
    this.cameras.main.fadeOut(320, 8, 6, 10)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.BEDROOM, { from: 'museum' })
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
      this.pendingMarker = null
    }

    if (this.moveTarget) {
      const dx = this.moveTarget.x - this.player.sprite.x
      const dy = this.moveTarget.y - this.player.sprite.y
      const distance = Math.hypot(dx, dy)
      if (distance < 7) {
        this.player.setTouchVector({ x: 0, y: 0 })
        this.moveTarget = null
        const marker = this.pendingMarker
        this.pendingMarker = null
        if (marker && this.isNearMarker(marker)) marker.action()
      } else {
        this.player.setTouchVector({
          x: dx / distance,
          y: dy / distance
        })
      }
    } else {
      this.player.setTouchVector({ x: 0, y: 0 })
    }

    this.player.update(this.game.loop.delta)

    const nearest = this.nearestMarker()
    if (!nearest) {
      this.setPrompt('')
    } else if (nearest.locked) {
      this.setPrompt('E - Galeria bloqueada')
    } else if (nearest.id === 'history') {
      this.setPrompt('E - HistoryBoard do Paineiras')
    } else if (nearest.id === 'gallery') {
      this.setPrompt('E - Galeria de Amigos')
    } else {
      this.setPrompt('E - Vida Profissional')
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
    this.markers = []
    this.soundManager?.stopStory()
    this.soundManager?.setClubMode(false)
    this.soundManager = null
    if (import.meta.env.DEV && window.__mascot?.scene === this) {
      delete window.__mascot
    }
  }
}
