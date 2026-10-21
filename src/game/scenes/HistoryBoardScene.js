import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, SCENES } from '../constants.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'
import { getSoundManager } from '../systems/SoundManager.js'
import { STORY_CHAPTERS } from '../museum.js'
import {
  completeStory,
  getResumeChapter,
  isStoryComplete,
  saveChapter
} from '../museumState.js'
import { addButton, addCinemaScrims, preloadMuseumAssets } from '../museum/utils.js'

const CHAPTER_COUNT = STORY_CHAPTERS.length

function pad(value) {
  return String(value).padStart(2, '0')
}

function formatTime(value) {
  const total = Math.max(0, Math.round(Number(value) || 0))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function clampChapter(index) {
  const value = Number(index)
  if (!Number.isFinite(value)) return 0
  return Math.min(CHAPTER_COUNT - 1, Math.max(0, Math.floor(value)))
}

export default class HistoryBoardScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.HISTORY_BOARD })
    this.index = 0
    this.playing = false
    this.finished = false
    this.leaving = false
    this.crossfadeTimer = null
    this.audioFallbackTimer = null
    this.fallbackStartedAt = null
    this.fallbackPausedAt = null
    this.progressWidth = 560
  }

  init(data = {}) {
    this.from = data.from ?? 'museum'
    this.index = clampChapter(data.chapter ?? getResumeChapter())
    this.playing = false
    this.finished = false
    this.leaving = false
    this.crossfadeTimer = null
    this.audioFallbackTimer = null
    this.fallbackStartedAt = null
    this.fallbackPausedAt = null
  }

  preload() {
    preloadMuseumAssets(this)
  }

  create() {
    this.cameras.main.setBackgroundColor('#02070b')
    this.cameras.main.fadeIn(360, 2, 7, 11)

    this.soundManager = getSoundManager()
    this.soundManager.setClubMode(false)
    this.soundManager.stopVoice()
    this.soundManager.stopStory()

    this.imageA = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'museum-lobby')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-10)
      .setScale(1.03)
    this.imageB = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'museum-lobby')
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-9)
      .setScale(1.03)
      .setAlpha(0)

    addCinemaScrims(this, 10)

    this.add
      .text(54, 34, 'HISTORYBOARD  •  PAINEIRAS', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#8fe8ff',
        letterSpacing: 4
      })
      .setDepth(20)

    this.chapterTitle = this.add
      .text(54, 62, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#fff5e4',
        stroke: '#07161d',
        strokeThickness: 4
      })
      .setDepth(20)

    this.chapterCounter = this.add
      .text(GAME_WIDTH - 112, 66, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#b9edf8',
        letterSpacing: 2
      })
      .setOrigin(1, 0.5)
      .setDepth(20)

    this.add
      .text(GAME_WIDTH - 112, 94, 'ESPAÇO: PAUSAR  •  SETAS: NAVEGAR  •  ESC: SAIR', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#a9e8f5',
        letterSpacing: 1
      })
      .setOrigin(1, 0.5)
      .setAlpha(0.62)
      .setDepth(20)

    this.progressTrack = this.add
      .rectangle(560, 676, this.progressWidth, 6, 0xffffff, 0.18)
      .setOrigin(0, 0.5)
      .setDepth(30)
    this.progressFill = this.add
      .rectangle(560, 676, this.progressWidth, 6, 0x8fe8ff, 0.94)
      .setOrigin(0, 0.5)
      .setDepth(31)
      .setScale(0, 1)

    this.chapterTimeText = this.add
      .text(1136, 676, '0:00 / 0:00', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#c8edf5'
      })
      .setOrigin(0, 0.5)
      .setDepth(31)

    this.prevButton = addButton(this, {
      x: 200,
      y: 676,
      width: 96,
      height: 38,
      label: 'ANTERIOR',
      fontSize: 11,
      onClick: () => this.previousChapter()
    })
    this.playButton = addButton(this, {
      x: 320,
      y: 676,
      width: 116,
      height: 38,
      label: 'PAUSAR',
      fontSize: 11,
      primary: true,
      onClick: () => this.togglePlay()
    })
    this.nextButton = addButton(this, {
      x: 450,
      y: 676,
      width: 112,
      height: 38,
      label: 'PROXIMO',
      fontSize: 11,
      onClick: () => this.nextChapter()
    })
    this.closeButton = addButton(this, {
      x: 1110,
      y: 38,
      width: 46,
      height: 38,
      label: 'X',
      fontSize: 15,
      onClick: () => this.exitToMuseum()
    })

    this.finishContainer = this.add.container(0, 0).setDepth(3000).setVisible(false)
    const finishBackdrop = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02060a, 0.86)
      .setInteractive()
    const finishKicker = this.add
      .text(GAME_WIDTH / 2, 248, 'HISTORYBOARD  •  PAINEIRAS', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#8fe8ff',
        letterSpacing: 5
      })
      .setOrigin(0.5)
    const finishTitle = this.add
      .text(GAME_WIDTH / 2, 314, 'FIM DA HISTORYBOARD', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#fff4dc',
        stroke: '#08212b',
        strokeThickness: 6
      })
      .setOrigin(0.5)
    const finishCopy = this.add
      .text(
        GAME_WIDTH / 2,
        374,
        'A Galeria de Amigos foi desbloqueada no museu.',
        {
          fontFamily: 'Segoe UI, sans-serif',
          fontSize: '20px',
          fontStyle: 'bold',
          color: '#d8f5ff'
        }
      )
      .setOrigin(0.5)
    const finishReplay = addButton(this, {
      x: GAME_WIDTH / 2 - 132,
      y: 474,
      width: 236,
      height: 48,
      label: 'REVER DO INICIO',
      onClick: () => this.replay()
    })
    const finishReturn = addButton(this, {
      x: GAME_WIDTH / 2 + 132,
      y: 474,
      width: 236,
      height: 48,
      label: 'VOLTAR AO MUSEU',
      primary: true,
      onClick: () => this.exitToMuseum()
    })
    this.finishContainer.add([
      finishBackdrop,
      finishKicker,
      finishTitle,
      finishCopy,
      finishReplay.background,
      finishReplay.text,
      finishReturn.background,
      finishReturn.text
    ])

    this.handleToggleSound = () => {
      const enabled = this.soundManager.toggle()
      gameBus.emit(EVENTS.SOUND_STATE, enabled)
    }
    this.handleMuseumExit = () => this.exitToMuseum()

    gameBus.on(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    gameBus.on(EVENTS.REQUEST_MUSEUM_EXIT, this.handleMuseumExit)
    this.events.once('shutdown', this.shutdown, this)

    this.input.keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.ESC
    ])
    this.input.keyboard.on('keydown-SPACE', this.togglePlay, this)
    this.input.keyboard.on('keydown-RIGHT', this.nextChapter, this)
    this.input.keyboard.on('keydown-LEFT', this.previousChapter, this)
    this.handleEscapeKey = (event) => {
      if (event.key === 'Escape') this.exitToMuseum()
    }
    window.addEventListener('keydown', this.handleEscapeKey)

    gameBus.emit(EVENTS.LOCATION, {
      scene: 'museum',
      area: 'museum-history',
      traveling: false
    })
    gameBus.emit(EVENTS.CHARACTER_STATE, 'idle')
    gameBus.emit(EVENTS.SOUND_STATE, !this.soundManager.muted)

    if (import.meta.env.DEV) {
      window.__mascot = {
        scene: this,
        next: () => this.nextChapter(),
        previous: () => this.previousChapter(),
        pause: () => this.setPaused(true),
        play: () => this.setPaused(false),
        finish: () => this.finish(),
        snapshot: () => ({
          scene: 'history',
          index: this.index,
          playing: this.playing,
          finished: this.finished
        })
      }
    }

    this.showChapter(this.index, { initial: true })
  }

  showChapter(index, options = {}) {
    if (index > CHAPTER_COUNT - 1) {
      this.finish()
      return
    }
    const nextIndex = clampChapter(index)

    this.finished = false
    this.finishContainer.setVisible(false)
    this.index = nextIndex
    saveChapter(this.index)
    const chapter = STORY_CHAPTERS[this.index]
    if (!chapter) {
      this.finish()
      return
    }

    this.soundManager.stopStory()
    this.crossfadeTimer?.remove(false)
    this.crossfadeTimer = null
    this.clearFallback()

    this.chapterTitle.setText(chapter.title)
    this.chapterCounter.setText(`${pad(this.index + 1)} / ${pad(CHAPTER_COUNT)}`)
    this.chapterTimeText.setText(`0:00 / ${formatTime(chapter.duration)}`)
    this.progressFill.setScale(0, 1)

    this.tweens.killTweensOf(this.imageA)
    this.tweens.killTweensOf(this.imageB)
    this.imageA
      .setTexture(chapter.images[0])
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      .setScale(1.03)
      .setAlpha(1)
    this.imageB
      .setTexture(chapter.images[1] ?? chapter.images[0])
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setPosition(GAME_WIDTH / 2, GAME_HEIGHT / 2)
      .setScale(1.03)
      .setAlpha(0)

    const duration = Math.max(6, chapter.duration + 2)
    this.tweens.add({
      targets: this.imageA,
      scale: 1.1,
      x: GAME_WIDTH / 2 + 14,
      duration: duration * 1000,
      ease: 'Sine.easeOut'
    })

    if (chapter.images.length > 1) {
      this.tweens.add({
        targets: this.imageB,
        scale: 1.1,
        x: GAME_WIDTH / 2 - 12,
        duration: duration * 1000,
        ease: 'Sine.easeOut'
      })
      this.crossfadeTimer = this.time.delayedCall(chapter.duration * 500, () => {
        if (!this.sys.isActive() || this.finished) return
        this.tweens.add({
          targets: this.imageB,
          alpha: 1,
          duration: 900,
          ease: 'Sine.easeInOut'
        })
      })
    }

    this.setPlaying(true)
    this.playAudio(chapter, options.initial === true)
  }

  playAudio(chapter, initial = false) {
    const started = this.soundManager.playStory(chapter.audio, {
      duration: chapter.duration,
      volume: 0.95,
      onTime: (time, duration) => {
        if (this.finished) return
        this.updateProgress(time, duration || chapter.duration)
      },
      onEnded: () => {
        if (this.finished || this.leaving) return
        this.clearFallback()
        this.handleChapterEnded()
      },
      onError: () => {
        if (this.finished || this.leaving) return
        this.startFallback(chapter, initial)
      }
    })

    if (!started) this.startFallback(chapter, initial)
  }

  startFallback(chapter, initial = false) {
    if (this.audioFallbackTimer || this.finished) return
    this.chapterTimeText.setText(`0:00 / ${formatTime(chapter.duration)}`)
    this.fallbackStartedAt = this.time.now
    this.fallbackPausedAt = null
    this.audioFallbackTimer = this.time.delayedCall(chapter.duration * 1000, () => {
      this.audioFallbackTimer = null
      if (this.finished || this.leaving) return
      this.handleChapterEnded()
    })
    if (initial) this.audioFallbackTimer.paused = !this.playing
  }

  clearFallback() {
    this.audioFallbackTimer?.remove(false)
    this.audioFallbackTimer = null
    this.fallbackStartedAt = null
    this.fallbackPausedAt = null
  }

  update(time) {
    if (
      this.playing &&
      !this.finished &&
      this.audioFallbackTimer &&
      this.fallbackStartedAt != null
    ) {
      const chapter = STORY_CHAPTERS[this.index]
      const elapsed = (time - this.fallbackStartedAt) / 1000
      this.updateProgress(Math.min(elapsed, chapter.duration), chapter.duration)
    }
  }

  updateProgress(time, duration) {
    if (this.finished) return
    const safeDuration = Math.max(0.1, Number(duration) || STORY_CHAPTERS[this.index].duration)
    const ratio = Phaser.Math.Clamp((Number(time) || 0) / safeDuration, 0, 1)
    this.progressFill.setScale(ratio, 1)
    this.chapterTimeText.setText(`${formatTime(time)} / ${formatTime(safeDuration)}`)
  }

  handleChapterEnded() {
    if (this.finished || this.leaving) return
    if (this.index >= CHAPTER_COUNT - 1) {
      this.finish()
      return
    }
    this.showChapter(this.index + 1)
  }

  nextChapter() {
    if (this.finished || this.leaving) return
    if (this.index >= CHAPTER_COUNT - 1) {
      this.finish()
      return
    }
    this.showChapter(this.index + 1)
  }

  previousChapter() {
    if (this.finished || this.leaving) return
    if (this.index <= 0) {
      this.showChapter(0)
      return
    }
    this.showChapter(this.index - 1)
  }

  setPlaying(value) {
    this.playing = Boolean(value)
    this.playButton.setLabel(this.playing ? 'PAUSAR' : 'PLAY')
  }

  setPaused(paused) {
    if (this.finished || this.leaving) return
    if (paused && this.playing) {
      this.soundManager.pauseStory()
      if (this.audioFallbackTimer) {
        this.audioFallbackTimer.paused = true
        this.fallbackPausedAt = this.time.now
      }
      this.setPlaying(false)
      return
    }
    if (!paused && !this.playing) {
      const resumed = this.soundManager.resumeStory()
      if (resumed) {
        if (this.audioFallbackTimer && this.fallbackPausedAt != null) {
          this.fallbackStartedAt += this.time.now - this.fallbackPausedAt
          this.fallbackPausedAt = null
          this.audioFallbackTimer.paused = false
        }
        this.setPlaying(true)
      } else {
        this.showChapter(this.index)
      }
    }
  }

  togglePlay() {
    this.setPaused(this.playing)
  }

  finish() {
    if (this.finished) return
    this.finished = true
    this.playing = false
    this.clearFallback()
    this.soundManager.stopStory()
    this.crossfadeTimer?.remove(false)
    this.crossfadeTimer = null
    completeStory()
    this.finishContainer.setVisible(true).setAlpha(0)
    this.tweens.add({
      targets: this.finishContainer,
      alpha: 1,
      duration: 320,
      ease: 'Sine.easeOut'
    })
    this.playButton.setLabel('PLAY')
    gameBus.emit(EVENTS.TOAST, 'Galeria de Amigos desbloqueada!')
    if (isStoryComplete()) {
      gameBus.emit(EVENTS.LOCATION, {
        scene: 'museum',
        area: 'museum-history',
        traveling: false
      })
    }
  }

  replay() {
    if (this.leaving) return
    this.finished = false
    this.finishContainer.setVisible(false)
    this.showChapter(0)
  }

  exitToMuseum() {
    if (this.leaving) return
    this.leaving = true
    this.clearFallback()
    this.soundManager.stopStory()
    this.cameras.main.fadeOut(320, 3, 8, 12)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start(SCENES.MUSEUM, {
        from: 'history',
        chapter: this.index
      })
    })
  }

  shutdown() {
    gameBus.off(EVENTS.TOGGLE_SOUND, this.handleToggleSound)
    gameBus.off(EVENTS.REQUEST_MUSEUM_EXIT, this.handleMuseumExit)
    this.input.keyboard.off('keydown-SPACE', this.togglePlay, this)
    this.input.keyboard.off('keydown-RIGHT', this.nextChapter, this)
    this.input.keyboard.off('keydown-LEFT', this.previousChapter, this)
    window.removeEventListener('keydown', this.handleEscapeKey)
    this.handleEscapeKey = null
    this.crossfadeTimer?.remove(false)
    this.clearFallback()
    this.soundManager?.stopStory()
    this.soundManager?.setClubMode(false)
    this.soundManager = null
    if (import.meta.env.DEV && window.__mascot?.scene === this) {
      delete window.__mascot
    }
  }
}
