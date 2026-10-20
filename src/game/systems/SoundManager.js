import { AUDIO_BASE, VOICE_LINES } from '../constants.js'

class SoundManager {
  constructor() {
    this.context = null
    this.master = null
    this.muted = false
    this.clubMode = false
    this.beatTimer = null
    this.beatStep = 0
    this.destroyed = false
    this.voiceAudio = null
    this.voiceKey = null
    this.handleVisibility = this.handleVisibility.bind(this)
    document.addEventListener('visibilitychange', this.handleVisibility)
  }

  ensureContext() {
    if (this.destroyed) return null
    if (this.context) {
      if (this.context.state === 'suspended' && !this.muted) {
        this.context.resume()
      }
      return this.context
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null

    this.context = new AudioContext()
    this.master = this.context.createGain()
    this.master.gain.value = this.muted ? 0 : 0.16
    this.master.connect(this.context.destination)
    return this.context
  }

  setMuted(muted) {
    this.muted = muted
    if (this.master) {
      this.master.gain.setValueAtTime(muted ? 0 : 0.16, this.context.currentTime)
    }
    if (muted) {
      this.stopBeat()
      this.stopVoice()
    } else if (this.clubMode) {
      this.startBeat()
    }
    return this.muted
  }

  toggle() {
    return !this.setMuted(!this.muted)
  }

  setClubMode(active) {
    this.clubMode = active
    if (active && !this.muted) {
      this.startBeat()
    } else {
      this.stopBeat()
    }
  }

  startBeat() {
    if (this.destroyed || this.muted || !this.clubMode || this.beatTimer) return
    const context = this.ensureContext()
    if (!context) return
    this.beatStep = 0
    this.beatTimer = setInterval(() => this.playBeat(), 520)
    this.playBeat()
  }

  stopBeat() {
    if (this.beatTimer) {
      clearInterval(this.beatTimer)
      this.beatTimer = null
    }
  }

  playBeat() {
    if (this.destroyed || this.muted || !this.clubMode) return
    const context = this.ensureContext()
    if (!context) return
    if (context.state === 'suspended') context.resume()
    const now = context.currentTime
    const step = this.beatStep % 8

    if (step % 4 === 0) {
      this.tone(58, now, 0.22, 'sine', 0.22)
    }
    if (step % 2 === 0) {
      this.tone(160, now + 0.02, 0.07, 'triangle', 0.05)
    }
    this.tone(1800 + (step % 2) * 400, now, 0.025, 'square', 0.018)

    const bass = [110, 110, 130.81, 110, 98, 98, 116.54, 130.81]
    this.tone(bass[step], now, 0.34, 'triangle', 0.06)
    if (step === 0 || step === 4) {
      this.tone(440, now + 0.18, 0.12, 'sine', 0.035)
      this.tone(554.37, now + 0.27, 0.12, 'sine', 0.03)
    }
    this.beatStep += 1
  }

  play(name) {
    if (this.muted) return
    const context = this.ensureContext()
    if (!context) return

    if (context.state === 'suspended') {
      context.resume()
    }

    const now = context.currentTime
    if (name === 'wave') {
      this.tone(523.25, now, 0.12, 'sine', 0.32)
      this.tone(783.99, now + 0.1, 0.14, 'triangle', 0.18)
      this.tone(659.25, now + 0.19, 0.16, 'sine', 0.22)
    } else if (name === 'lamp-on') {
      this.tone(740, now, 0.05, 'triangle', 0.28)
      this.tone(1108.73, now + 0.04, 0.08, 'sine', 0.18)
    } else if (name === 'lamp-off') {
      this.tone(330, now, 0.06, 'sine', 0.24)
      this.tone(220, now + 0.04, 0.09, 'triangle', 0.16)
    } else if (name === 'ui') {
      this.tone(660, now, 0.045, 'sine', 0.22)
    } else if (name === 'happy') {
      this.tone(523.25, now, 0.12, 'triangle', 0.24)
      this.tone(659.25, now + 0.1, 0.12, 'triangle', 0.22)
      this.tone(783.99, now + 0.2, 0.16, 'sine', 0.2)
      this.tone(1046.5, now + 0.31, 0.22, 'sine', 0.16)
    } else if (name === 'dance') {
      this.tone(196, now, 0.1, 'square', 0.12)
      this.tone(293.66, now + 0.08, 0.1, 'square', 0.1)
      this.tone(392, now + 0.16, 0.14, 'triangle', 0.12)
    } else if (name === 'clink') {
      this.tone(1318.51, now, 0.08, 'sine', 0.2)
      this.tone(1760, now + 0.05, 0.12, 'sine', 0.14)
    } else if (name === 'sip') {
      this.tone(240, now, 0.08, 'sine', 0.12)
      this.tone(220, now + 0.08, 0.1, 'sine', 0.1)
    } else if (name === 'cheer') {
      this.tone(523.25, now, 0.14, 'triangle', 0.22)
      this.tone(659.25, now + 0.1, 0.14, 'triangle', 0.2)
      this.tone(783.99, now + 0.2, 0.18, 'triangle', 0.18)
      this.tone(1046.5, now + 0.3, 0.24, 'sine', 0.16)
    } else if (name === 'whoosh' || name === 'travel') {
      this.tone(180, now, 0.32, 'sawtooth', 0.06)
      this.tone(90, now + 0.2, 0.36, 'sine', 0.08)
    } else if (name === 'pickup') {
      this.tone(220, now, 0.07, 'triangle', 0.18)
      this.tone(330, now + 0.06, 0.09, 'triangle', 0.14)
    } else if (name === 'deposit') {
      this.tone(130, now, 0.12, 'sine', 0.24)
      this.tone(196, now + 0.08, 0.16, 'triangle', 0.15)
    } else if (name === 'coin') {
      this.tone(880, now, 0.07, 'sine', 0.2)
      this.tone(1318.51, now + 0.06, 0.12, 'sine', 0.18)
      this.tone(1760, now + 0.14, 0.16, 'sine', 0.12)
    } else if (name === 'error') {
      this.tone(196, now, 0.12, 'square', 0.1)
      this.tone(146.83, now + 0.1, 0.16, 'square', 0.08)
    } else if (name === 'door') {
      this.tone(110, now, 0.3, 'sawtooth', 0.05)
      this.tone(220, now + 0.16, 0.18, 'triangle', 0.08)
    }
  }

  playVoice(key, options = {}) {
    if (this.destroyed || this.muted) return false
    const file = VOICE_LINES[key]
    if (!file) return false
    if (options.restart !== false) this.stopVoice()
    const audio = new Audio(`${AUDIO_BASE}${file}`)
    audio.volume = Math.max(0, Math.min(1, Number(options.volume ?? 0.9) || 0.9))
    this.voiceAudio = audio
    this.voiceKey = key
    audio.addEventListener(
      'ended',
      () => {
        if (this.voiceAudio === audio) {
          this.voiceAudio = null
          this.voiceKey = null
        }
      },
      { once: true }
    )
    const promise = audio.play()
    if (promise?.catch) promise.catch(() => {})
    return true
  }

  stopVoice() {
    if (!this.voiceAudio) return
    try {
      this.voiceAudio.pause()
      this.voiceAudio.currentTime = 0
    } catch {
      // áudio indisponível
    }
    this.voiceAudio = null
    this.voiceKey = null
  }

  isVoicePlaying() {
    return Boolean(this.voiceAudio && !this.voiceAudio.paused)
  }

  tone(frequency, startTime, duration, type, volume) {
    if (!this.context || !this.master) return
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startTime)
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
    oscillator.connect(gain)
    gain.connect(this.master)
    oscillator.start(startTime)
    oscillator.stop(startTime + duration + 0.03)
  }

  handleVisibility() {
    if (document.visibilityState === 'hidden') {
      this.stopBeat()
      this.stopVoice()
      if (this.context) this.context.suspend()
      return
    }
    if (this.context && !this.muted) {
      this.context.resume()
      if (this.clubMode) this.startBeat()
    }
  }

  destroy() {
    this.destroyed = true
    this.stopBeat()
    this.stopVoice()
    document.removeEventListener('visibilitychange', this.handleVisibility)
    if (this.context) {
      this.context.close()
      this.context = null
      this.master = null
    }
  }
}

let instance = null

export function getSoundManager() {
  if (!instance) instance = new SoundManager()
  return instance
}

export function disposeSoundManager() {
  if (!instance) return
  instance.destroy()
  instance = null
}
