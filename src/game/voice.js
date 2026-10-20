import { getSoundManager } from './systems/SoundManager.js'

const lastPlayed = new Map()
let lastGroupAt = 0
let pressTimes = []
let lastStopAt = 0

export function speak(key, options = {}) {
  return getSoundManager().playVoice(key, options)
}

export function stopVoice() {
  getSoundManager().stopVoice()
}

export function isVoicePlaying() {
  return getSoundManager().isVoicePlaying()
}

export function maybeSpeak(keys, options = {}) {
  if (!Array.isArray(keys) || keys.length === 0) return false
  const chance = options.chance ?? 0.55
  const cooldown = options.cooldown ?? 8000
  const groupCooldown = options.groupCooldown ?? 6000
  const now = Date.now()
  if (now - lastGroupAt < groupCooldown) return false
  if (Math.random() > chance) return false
  const key = keys[Math.floor(Math.random() * keys.length)]
  if (now - (lastPlayed.get(key) ?? 0) < cooldown) return false
  lastPlayed.set(key, now)
  lastGroupAt = now
  return speak(key, options)
}

export function registerInteractionPress() {
  const now = Date.now()
  pressTimes = pressTimes.filter((time) => now - time < 3200)
  pressTimes.push(now)
  if (pressTimes.length >= 6 && now - lastStopAt > 6000) {
    lastStopAt = now
    pressTimes = []
    speak('stop')
    return true
  }
  return false
}
