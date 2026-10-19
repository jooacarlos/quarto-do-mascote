import { DIALOGUES } from '../dialogues.js'
import { EVENTS } from '../events.js'
import { gameBus } from '../bus.js'

export default class DialogueSystem {
  constructor(scene, options = {}) {
    this.scene = scene
    this.onShow = options.onShow
    this.queue = []
    this.active = null
    this.timer = null
    this.history = new Set()
    this.lastShown = new Map()
    this.destroyed = false
    this.scene.events.once('shutdown', this.destroy, this)
  }

  say(id, options = {}) {
    const entry = DIALOGUES[id]
    if (!entry || this.destroyed) return false

    if (!options.force) {
      if (entry.repeat === 'once' && this.history.has(id)) return false
      const last = this.lastShown.get(id)
      if (entry.cooldown && last != null && this.scene.time.now - last < entry.cooldown) return false
    }

    const item = { id, entry, priority: options.priority ?? entry.priority ?? 5, force: options.force }
    if (options.interrupt && (this.active || this.queue.length > 0)) {
      this.cancelCurrent()
      this.queue = this.queue.filter((queued) => queued.priority > item.priority)
      this.show(item)
    } else if (this.active && item.priority > this.active.priority) {
      this.cancelCurrent()
      this.queue = this.queue.filter((queued) => queued.priority > item.priority)
      this.show(item)
    } else if (!this.active && this.queue.length === 0 && item.priority >= 30) {
      this.queue = []
      this.show(item)
    } else {
      this.queue.push(item)
      this.pump()
    }
    return true
  }

  sequence(ids, options = {}) {
    ids.forEach((id, index) => {
      this.say(id, {
        ...options,
        interrupt: index === 0 ? options.interrupt : false
      })
    })
  }

  pump() {
    if (this.destroyed || this.active || this.queue.length === 0) return
    const item = this.queue.shift()
    if (!item.force) {
      if (item.entry.repeat === 'once' && this.history.has(item.id)) {
        this.pump()
        return
      }
      const last = this.lastShown.get(item.id)
      if (item.entry.cooldown && last != null && this.scene.time.now - last < item.entry.cooldown) {
        this.pump()
        return
      }
    }
    this.show(item)
  }

  show(item) {
    this.active = item
    this.history.add(item.id)
    this.lastShown.set(item.id, this.scene.time.now)
    const duration = Math.round(item.entry.duration * 1.2)
    gameBus.emit(EVENTS.DIALOGUE, {
      id: item.id,
      speaker: item.entry.speaker,
      text: item.entry.text,
      duration
    })
    item.displayDuration = duration
    this.onShow?.(item)
    this.timer = this.scene.time.delayedCall(duration, () => {
      this.timer = null
      this.active = null
      this.pump()
    })
  }

  cancelCurrent() {
    if (this.timer) {
      this.timer.remove(false)
      this.timer = null
    }
    this.active = null
  }

  clear() {
    this.cancelCurrent()
    this.queue = []
    gameBus.emit(EVENTS.DIALOGUE_CLEAR)
  }

  destroy() {
    this.destroyed = true
    this.cancelCurrent()
    this.queue = []
    gameBus.emit(EVENTS.DIALOGUE_CLEAR)
    this.scene.events.off('shutdown', this.destroy, this)
  }
}
