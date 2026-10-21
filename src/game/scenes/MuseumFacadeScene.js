import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../constants.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import { getSoundManager } from '../systems/SoundManager.js'
import { ensureEffectTextures } from '../effects.js'
import { addButton, addCoverImage, preloadMuseumAssets } from '../museum/utils.js'

export default class MuseumFacadeScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MUSEUM_FACADE })
    this.leaving = false
  }

  init(data = {}) {
    this.from = data.from ?? 'bedroom'
    this.leaving = false
  }

  preload() {
    preloadMuseumAssets(this)
  }

  create() {
    ensureEffectTextures(this)
    this.cameras.main.setBackgroundColor('#061018')
    this.cameras.main.fadeIn(360, 3, 8, 12)

    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(false)
    this.soundManager.stopVoice()
    this.soundManager.stopStory()

    const background = addCoverImage(this, 'museum-exterior', { zoom: 1.04 })
    this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x031018, 0.3)
      .setDepth(-9)
    this.add
      .rectangle(250, GAME_HEIGHT / 2, 500, GAME_HEIGHT, 0x04121a, 0.62)
      .setDepth(-8)
    this.add
      .rectangle(1040, GAME_HEIGHT / 2, 480, GAME_HEIGHT, 0x04121a, 0.18)
      .setDepth(-8)

    this.enterZone = this.add
      .zone(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-7)
      .setInteractive({ useHandCursor: true })
    this.enterZone.on('pointerdown', () => this.enterMuseum())

    this.add
      .text(76, 156, 'MUSEU DO BRANCO', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#8fe8ff',
        letterSpacing: 8
      })
      .setOrigin(0, 0.5)
      .setDepth(10)

    this.add
      .text(72, 206, 'PAINEIRAS', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '66px',
        fontStyle: 'bold',
        color: '#fff4df',
        stroke: '#0a2630',
        strokeThickness: 6,
        letterSpacing: 2
      })
      .setOrigin(0, 0.5)
      .setDepth(10)
      .setShadow(0, 0, '#5bd9ff', 24, true, true)

    this.add
      .text(76, 282, 'A história do 00 do Paineiras', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#dff8ff'
      })
      .setOrigin(0, 0.5)
      .setAlpha(0.9)
      .setDepth(10)

    this.add
      .text(
        76,
        334,
        'HistoryBoard, memórias do condomínio\ne a Galeria de Amigos.',
        {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '15px',
          color: '#b8e9f3',
          lineSpacing: 6
        }
      )
      .setOrigin(0, 0.5)
      .setAlpha(0.78)
      .setDepth(10)

    this.enterButton = addButton(this, {
      x: 196,
      y: 474,
      width: 260,
      height: 50,
      label: 'ENTRAR NO MUSEU',
      primary: true,
      onClick: () => this.enterMuseum()
    })
    this.exitButton = addButton(this, {
      x: 196,
      y: 538,
      width: 260,
      height: 46,
      label: 'VOLTAR AO QUARTO',
      onClick: () => this.exitToBedroom()
    })

    this.add
      .text(1180, 676, 'CLIQUE NA FACHADA OU USE ENTRAR', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#a9e8f5',
        letterSpacing: 2
      })
      .setOrigin(1, 0.5)
      .setAlpha(0.6)
      .setDepth(10)

    this.tweens.add({
      targets: background,
      scale: background.scale * 1.025,
      duration: 8000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    })

    this.handleToggleSound = () => {
      const enabled = this.soundManager.toggle()
      gameBus.emit(EVENTS.SOUND_STATE, enabled)
    }
    this.handleMuseumExit = () => this.exitToBedroom()

    gameBus.on(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    gameBus.on(EVENTS.REQUEST_MUSEUM_EXIT, this.handleMuseumExit)
    this.events.once('shutdown', this.shutdown, this)

    this.input.keyboard.on('keydown-ENTER', this.enterMuseum, this)
    this.input.keyboard.on('keydown-SPACE', this.enterMuseum, this)
    this.input.keyboard.on('keydown-E', this.enterMuseum, this)
    this.handleEscapeKey = (event) => {
      if (event.key === 'Escape') this.exitToBedroom()
    }
    window.addEventListener('keydown', this.handleEscapeKey)

    gameBus.emit(EVENTS.CHARACTER_STATE, 'idle')
    gameBus.emit(EVENTS.SOUND_STATE, !this.soundManager.muted)
    gameBus.emit(EVENTS.LOCATION, {
      scene: 'museum',
      area: 'museum-facade',
      traveling: false
    })

    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        enter: () => this.enterMuseum(),
        exit: () => this.exitToBedroom(),
        snapshot: () => ({ scene: 'museum-facade', leaving: this.leaving })
      }
    }
  }

  enterMuseum() {
    if (this.leaving) return
    this.leaving = true
    this.enterButton.setEnabled(false)
    this.exitButton.setEnabled(false)
    this.cameras.main.fadeOut(360, 4, 10, 14)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.MUSEUM, { from: 'facade' })
    })
  }

  exitToBedroom() {
    if (this.leaving) return
    this.leaving = true
    this.enterButton.setEnabled(false)
    this.exitButton.setEnabled(false)
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

  shutdown() {
    gameBus.off(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    gameBus.off(EVENTS.REQUEST_MUSEUM_EXIT, this.handleMuseumExit)
    this.input.keyboard.off('keydown-ENTER', this.enterMuseum, this)
    this.input.keyboard.off('keydown-SPACE', this.enterMuseum, this)
    this.input.keyboard.off('keydown-E', this.enterMuseum, this)
    window.removeEventListener('keydown', this.handleEscapeKey)
    this.handleEscapeKey = null
    this.soundManager?.stopStory()
    this.soundManager?.setClubMode(false)
    this.soundManager = null
    if (import.meta.env.DEV && window.__mascot?.scene === this) {
      delete window.__mascot
    }
  }
}
