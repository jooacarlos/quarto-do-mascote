<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import GameCanvas from './components/GameCanvas.vue'
import { EVENTS } from './game/events.js'
import { gameBus } from './game/bus.js'
import { AREA_LABELS } from './game/constants.js'
import { DRINKS, GUESTS, buyDrink, gameState, inviteGuest } from './game/state.js'

const ready = ref(false)
const characterState = ref('idle')
const soundOn = ref(true)
const toast = ref('')
const dialogue = ref(null)
const world = ref({ scene: 'bedroom', area: 'bedroom', traveling: false })
const areaTransition = ref(false)
const travelDirection = ref(null)
const workState = ref(null)
const workPrompt = ref('')
const shopMode = ref(null)
const payment = ref(null)
const activeTouches = new Set()
let toastTimer = null
let dialogueTimer = null

const areas = [
  { id: 'dance', label: 'Pista' },
  { id: 'bar', label: 'Bar' },
  { id: 'vip', label: 'Camarote' }
]

const unsubscribers = [
  gameBus.on(EVENTS.READY, () => {
    ready.value = true
  }),
  gameBus.on(EVENTS.CHARACTER_STATE, (state) => {
    characterState.value = state
  }),
  gameBus.on(EVENTS.SOUND_STATE, (enabled) => {
    soundOn.value = enabled
  }),
  gameBus.on(EVENTS.TOAST, (message) => {
    showToast(message)
  }),
  gameBus.on(EVENTS.DIALOGUE, (payload) => {
    dialogue.value = payload
    if (dialogueTimer) clearTimeout(dialogueTimer)
    dialogueTimer = setTimeout(() => {
      dialogue.value = null
      dialogueTimer = null
    }, payload.duration + 350)
  }),
  gameBus.on(EVENTS.DIALOGUE_CLEAR, () => {
    if (dialogueTimer) clearTimeout(dialogueTimer)
    dialogueTimer = null
    dialogue.value = null
  }),
  gameBus.on(EVENTS.LOCATION, (location) => {
    world.value = {
      scene: location.scene ?? world.value.scene,
      area: location.area ?? world.value.area,
      traveling: false
    }
    if (location.scene !== 'work') {
      workState.value = null
    }
    workPrompt.value = ''
    toast.value = ''
    areaTransition.value = false
    travelDirection.value = null
  }),
  gameBus.on(EVENTS.TRAVEL_STATE, (payload) => {
    if (payload.phase === 'leaving' || payload.phase === 'traveling') {
      const targetScene =
        payload.target === 'bedroom'
          ? 'bedroom'
          : payload.target === 'duck'
            ? 'duck'
            : 'work'
      const targetArea =
        targetScene === 'bedroom'
          ? 'bedroom'
          : targetScene === 'duck'
            ? world.value.area === 'bedroom'
              ? 'dance'
              : world.value.area
            : payload.from === 'ceasa'
              ? 'ceasa'
              : 'street'
      world.value = {
        scene: targetScene,
        area: targetArea,
        traveling: true
      }
      travelDirection.value =
        payload.target === 'bedroom'
          ? 'to-bedroom'
          : payload.target === 'duck'
            ? 'to-duck'
            : 'to-work'
      areaTransition.value = true
      closeShop()
    }
  }),
  gameBus.on(EVENTS.AREA_STATE, (payload) => {
    areaTransition.value = Boolean(payload.transitioning)
    if (payload.area) {
      world.value = { ...world.value, area: payload.area, traveling: false }
    }
  }),
  gameBus.on(EVENTS.WORK_STATE, (payload) => {
    workState.value = payload
  }),
  gameBus.on(EVENTS.WORK_PROMPT, (payload) => {
    workPrompt.value = payload?.text ?? ''
  }),
  gameBus.on(EVENTS.SHIFT_PAID, (payload) => {
    payment.value = payload
    closeShop()
  }),
  gameBus.on(EVENTS.OPEN_DRINK_MENU, () => {
    shopMode.value = 'drinks'
  }),
  gameBus.on(EVENTS.OPEN_GUEST_MENU, () => {
    shopMode.value = 'guests'
  })
]

const isDuck = computed(() => world.value.scene === 'duck')
const isWork = computed(() => world.value.scene === 'work')
const isHome = computed(() => world.value.scene === 'bedroom')
const areaLabel = computed(() => AREA_LABELS[world.value.area] ?? 'Duck')
const portraitTitle = computed(() =>
  isDuck.value ? 'Duck Nightclub' : isWork.value ? 'CEASA' : 'Quarto do Mascote'
)
const portraitKicker = computed(() =>
  isDuck.value ? 'balada virtual' : isWork.value ? 'trabalho virtual' : 'mascote virtual'
)
const isActive = computed(
  () => characterState.value !== 'idle' || world.value.traveling || areaTransition.value
)

const statusText = computed(() => {
  if (!ready.value) return 'Preparando o quarto...'
  if (world.value.traveling) {
    if (travelDirection.value === 'to-bedroom') return 'Voltando para o quarto...'
    if (travelDirection.value === 'to-work') return 'Indo para o trabalho...'
    return 'Indo para a Duck...'
  }
  if (areaTransition.value) return 'Mudando de área...'

  if (isWork.value) {
    return workState.value?.title ?? 'Trabalhando no CEASA'
  }

  if (isDuck.value) {
    if (characterState.value === 'dancing') return 'Dançando na Duck'
    if (characterState.value === 'drinking') return 'Tomando um gin no bar'
    if (characterState.value === 'walking') return 'Circulando pela Duck'
    if (characterState.value === 'talking') return 'Conversando na Duck'
    if (characterState.value === 'happy') return 'Curtindo a Duck'
    if (world.value.area === 'bar') return 'No bar da Duck'
    if (world.value.area === 'vip') return 'No camarote da Duck'
    return 'Na pista da Duck'
  }

  if (characterState.value === 'walking') return 'Chegando em casa...'
  if (characterState.value === 'talking') return 'Conversando no quarto'
  if (characterState.value === 'waving') return 'Acenando para você'
  if (characterState.value === 'happy') return 'Animado para a balada'
  return 'Relaxando no quarto'
})

const hintText = computed(() => {
  if (world.value.traveling) return 'Preparando a próxima parada...'
  if (isWork.value) {
    if (workPrompt.value) return workPrompt.value
    return workState.value?.detail ?? 'WASD, setas ou o direcional para andar.'
  }
  if (isDuck.value) {
    if (world.value.area === 'bar') return 'Abra o menu do bar para comprar uma bebida'
    if (world.value.area === 'vip') {
      return `${gameState.guests.length} convidado(s) no camarote. Convide mais ou brinde.`
    }
    return 'Toque na pista, no DJ, no globo ou nos NPCs'
  }
  if (gameState.fired) return 'Você foi demitido do CEASA. Voltar para o Taco Bell.'
  return 'Toque no personagem, no abajur, na cama ou na janela'
})

const contextAction = computed(() => {
  if (!isDuck.value || world.value.traveling || areaTransition.value) return null
  if (world.value.area === 'dance') {
    return {
      id: 'dance',
      label: characterState.value === 'dancing' ? 'Parar' : 'Dançar',
      icon: 'music'
    }
  }
  if (world.value.area === 'bar') {
    return { id: 'bar', label: 'Menu do bar', icon: 'glass' }
  }
  if (world.value.area === 'vip') {
    return { id: 'vip', label: 'Convidar', icon: 'sparkle' }
  }
  return null
})

const actionBusy = computed(() =>
  ['walking', 'drinking', 'happy'].includes(characterState.value)
)

const travelDisabled = computed(
  () => !ready.value || world.value.traveling || areaTransition.value || actionBusy.value
)

const talkDisabled = computed(
  () =>
    travelDisabled.value || ['talking', 'waving', 'dancing'].includes(characterState.value)
)

const waveDisabled = computed(
  () => travelDisabled.value || ['talking', 'waving'].includes(characterState.value)
)

const clubDisabled = computed(
  () =>
    !ready.value ||
    world.value.traveling ||
    areaTransition.value ||
    ['walking', 'drinking'].includes(characterState.value)
)

const workDisabled = computed(
  () =>
    !ready.value ||
    isWork.value ||
    isDuck.value ||
    world.value.traveling ||
    areaTransition.value ||
    gameState.fired
)

const contextDisabled = computed(() => {
  if (!contextAction.value || travelDisabled.value) return true
  if (characterState.value === 'dancing' && contextAction.value.id !== 'dance') return true
  return false
})

const workControlsVisible = computed(
  () => isWork.value && workState.value?.controls !== false && !world.value.traveling
)

const progressPercent = computed(() => {
  const progress = workState.value?.progress
  if (!progress?.required) return 0
  return Math.min(100, Math.round((progress.delivered / progress.required) * 100))
})

const shopTitle = computed(() => (shopMode.value === 'drinks' ? 'Bar da Duck' : 'Camarote da Duck'))
const shopKicker = computed(() =>
  shopMode.value === 'drinks' ? 'BEBIDAS VIRTUAIS' : 'CONVIDADOS VIRTUAIS'
)
const shopEntries = computed(() => (shopMode.value === 'drinks' ? DRINKS : GUESTS))

function showToast(message) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
    toastTimer = null
  }, 2400)
}

function requestWave() {
  if (!ready.value || isDuck.value || isWork.value) return
  gameBus.emit(EVENTS.REQUEST_WAVE)
}

function requestClub() {
  if (clubDisabled.value || isDuck.value || isWork.value) return
  gameBus.emit(EVENTS.REQUEST_CLUB)
}

function requestWork() {
  if (workDisabled.value) return
  closeShop()
  gameBus.emit(EVENTS.REQUEST_WORK)
}

function requestReturn() {
  if (travelDisabled.value || !isDuck.value) return
  gameBus.emit(EVENTS.REQUEST_RETURN)
}

function requestArea(area) {
  if (travelDisabled.value || !isDuck.value || area === world.value.area) return
  closeShop()
  gameBus.emit(EVENTS.REQUEST_AREA, area)
}

function requestInteract() {
  if (travelDisabled.value || !contextAction.value) return
  gameBus.emit(EVENTS.REQUEST_INTERACT, contextAction.value.id)
}

function requestTalk() {
  if (!ready.value || world.value.traveling || areaTransition.value) return
  gameBus.emit(EVENTS.REQUEST_TALK)
}

function requestWorkInteract() {
  if (!isWork.value || world.value.traveling) return
  gameBus.emit(EVENTS.REQUEST_WORK_INTERACT)
}

function toggleSound() {
  if (!ready.value) return
  gameBus.emit(EVENTS.TOGGLE_SOUND)
}

function emitTouchMove() {
  const x =
    (activeTouches.has('right') ? 1 : 0) - (activeTouches.has('left') ? 1 : 0)
  const y =
    (activeTouches.has('down') ? 1 : 0) - (activeTouches.has('up') ? 1 : 0)
  gameBus.emit(EVENTS.WORK_MOVE, { x, y })
}

function pressMove(direction, event) {
  event.preventDefault()
  activeTouches.add(direction)
  try {
    event.currentTarget.setPointerCapture?.(event.pointerId)
  } catch {
    // captura indisponível em alguns navegadores
  }
  emitTouchMove()
}

function releaseMove(direction, event) {
  event?.preventDefault?.()
  activeTouches.delete(direction)
  emitTouchMove()
}

function clearTouches() {
  if (activeTouches.size === 0) return
  activeTouches.clear()
  emitTouchMove()
}

function closeShop() {
  shopMode.value = null
}

function buySelectedDrink(drink) {
  const result = buyDrink(drink.id)
  if (!result.ok) {
    showToast(result.reason)
    return
  }
  showToast(`${result.drink.name} comprado por $${result.drink.price}.`)
  closeShop()
  gameBus.emit(EVENTS.DUCK_DRINK_BOUGHT, { drink: result.drink })
}

function inviteSelectedGuest(guest) {
  const result = inviteGuest(guest.id)
  if (!result.ok) {
    showToast(result.reason)
    return
  }
  showToast(`${result.guest.name} foi convidado por ${result.guest.price}.`)
  closeShop()
  gameBus.emit(EVENTS.DUCK_GUEST_INVITED, { guest: result.guest })
}

function isGuestInvited(id) {
  return gameState.guests.includes(id)
}

function leaveWork(target) {
  payment.value = null
  gameBus.emit(EVENTS.REQUEST_WORK_RETURN, target)
}

watch(
  () => [world.value.scene, world.value.area],
  () => {
    closeShop()
  }
)

onBeforeUnmount(() => {
  clearTouches()
  for (const unsubscribe of unsubscribers) unsubscribe()
  if (toastTimer) clearTimeout(toastTimer)
  if (dialogueTimer) clearTimeout(dialogueTimer)
})
</script>

<template>
  <main class="app-shell">
    <h1 class="sr-only">Quarto do Mascote e balada Duck, jogo de mascote virtual 2D</h1>

    <header class="portrait-intro" aria-hidden="true">
      <span class="portrait-kicker">{{ portraitKicker }}</span>
      <span class="portrait-title">{{ portraitTitle }}</span>
    </header>

    <section class="game-frame" :class="{ 'is-duck': isDuck, 'is-work': isWork, 'has-dialogue': dialogue }" aria-label="Aventura do mascote">
      <GameCanvas />

      <div class="hud">
        <div class="status-pill" role="status" aria-live="polite">
          <span class="status-dot" :class="{ active: isActive }"></span>
          <span>{{ statusText }}</span>
        </div>

        <div v-if="world.area !== 'bus'" class="venue-badge" aria-hidden="true">
          <span class="venue-kicker">{{ isDuck ? 'Duck Nightclub' : isWork ? 'CEASA' : 'mascote virtual' }}</span>
          <span class="venue-name">{{ isDuck || isWork ? areaLabel : 'Quarto do Mascote' }}</span>
        </div>

        <div class="wallet-chip" aria-label="Saldo virtual">
          <span>Saldo</span>
          <strong>$ {{ gameState.balance }}</strong>
        </div>

        <button
          class="icon-button sound-button"
          type="button"
          :aria-label="soundOn ? 'Desligar som' : 'Ligar som'"
          :aria-pressed="!soundOn"
          :title="soundOn ? 'Desligar som' : 'Ligar som'"
          :disabled="!ready"
          @click="toggleSound"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9.2h3.6L13 5.4v13.2l-5.4-3.8H4z" fill="currentColor" />
            <template v-if="soundOn">
              <path
                d="M16 8.4c1.3 1.6 1.3 5.6 0 7.2M18.4 6.2c2.4 2.8 2.4 8.8 0 11.6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
            </template>
            <path
              v-else
              d="M16.1 9.3l4.5 5.4m0-5.4l-4.5 5.4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>

        <Transition name="dialogue">
          <div v-if="dialogue" class="dialogue-bubble" role="status" aria-live="polite">
            <div class="dialogue-head">
              <span class="dialogue-speaker">{{ dialogue.speaker }}</span>
              <span class="dialogue-meta">00 do Paineiras</span>
            </div>
            <p>{{ dialogue.text }}</p>
            <span class="dialogue-tail" aria-hidden="true"></span>
          </div>
        </Transition>

        <Transition name="fade">
          <aside v-if="isWork && workState" class="work-panel" aria-live="polite">
            <span class="work-kicker">CEASA • EXPEDIENTE</span>
            <strong>{{ workState.title }}</strong>
            <p>{{ workState.objective }}</p>
            <div v-if="workState.progress" class="work-progress">
              <div class="work-progress-head">
                <span>Caixas entregues</span>
                <b>{{ workState.progress.delivered }}/{{ workState.progress.required }}</b>
              </div>
              <span class="work-progress-track">
                <span :style="{ width: progressPercent + '%' }"></span>
              </span>
            </div>
            <small>{{ workState.detail }}</small>
          </aside>
        </Transition>

        <div v-if="isWork && workPrompt" class="work-prompt">{{ workPrompt }}</div>

        <div v-if="!world.traveling" class="action-bar">
          <template v-if="isHome">
            <button
              class="action-button work-button"
              type="button"
              :disabled="workDisabled"
              :title="gameState.fired ? 'Você foi demitido do CEASA' : undefined"
              @click="requestWork"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 8.5h16v11H4zM9 8.5V6.2A1.2 1.2 0 0 1 10.2 5h3.6A1.2 1.2 0 0 1 15 6.2v2.3M4 12h16M10 12v2h4v-2"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>{{ gameState.fired ? 'Demitido' : 'Ir Trabalhar' }}</span>
            </button>

            <button
              class="action-button ghost"
              type="button"
              :disabled="waveDisabled"
              @click="requestWave"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M8.2 12.6V6.4a1.4 1.4 0 0 1 2.8 0v5.2m0-1.7a1.4 1.4 0 0 1 2.8 0v2.1m0-1.3a1.4 1.4 0 0 1 2.8 0v4.2c0 3.4-2.4 5.8-5.7 5.8h-.6c-1.6 0-2.8-.7-3.7-1.9l-2.2-3.1a1.5 1.5 0 0 1 2.3-1.9l1.5 1.8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Acenar</span>
            </button>

            <button
              class="action-button ghost"
              type="button"
              :disabled="talkDisabled"
              @click="requestTalk"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 5.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8.2L6.6 20v-3.5H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round"
                />
                <circle cx="8.5" cy="11" r="1" fill="currentColor" />
                <circle cx="12" cy="11" r="1" fill="currentColor" />
                <circle cx="15.5" cy="11" r="1" fill="currentColor" />
              </svg>
              <span>Conversar</span>
            </button>

            <button
              class="action-button primary club-button"
              type="button"
              :disabled="clubDisabled"
              @click="requestClub"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="11" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6" />
                <path
                  d="M12 2.5v2.2M12 17.3v2.2M3.5 11h2.2M16.3 11h2.2M5.8 4.8l1.6 1.6M16.6 15.6l1.6 1.6M18.2 4.8l-1.6 1.6M7.4 15.6l-1.6 1.6"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
                <path d="M7 20.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
              </svg>
              <span>Balada</span>
            </button>
          </template>

          <template v-else-if="isDuck">
            <button
              class="action-button ghost"
              type="button"
              :disabled="travelDisabled"
              @click="requestReturn"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 11.4 12 4l8 7.4M6.5 10v9h11v-9M10 19v-5h4v5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span>Quarto</span>
            </button>

            <button
              v-if="contextAction"
              class="action-button primary"
              type="button"
              :disabled="contextDisabled"
              @click="requestInteract"
            >
              <svg v-if="contextAction.icon === 'music'" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M9.5 17.2V6.4l8-1.8v10.7M9.5 17.2a2.6 2.6 0 1 1-2.6-2.6 2.6 2.6 0 0 1 2.6 2.6Zm8-2a2.6 2.6 0 1 1-2.6-2.6 2.6 2.6 0 0 1 2.6 2.6Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <svg v-else-if="contextAction.icon === 'glass'" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4.5 4.5h15l-5.4 7.2v5.4h3.3M11.1 11.7 5.7 4.5M14.1 17.1H7.8"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 3.2c.7 4.5 3.1 6.9 7.6 7.6-4.5.7-6.9 3.1-7.6 7.6-.7-4.5-3.1-6.9-7.6-7.6 4.5-.7 6.9-3.1 7.6-7.6Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linejoin="round"
                />
              </svg>
              <span>{{ contextAction.label }}</span>
            </button>

            <button
              class="action-button ghost"
              type="button"
              :disabled="talkDisabled"
              @click="requestTalk"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 5.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-8.2L6.6 20v-3.5H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linejoin="round"
                />
                <circle cx="9" cy="11" r="1" fill="currentColor" />
                <circle cx="15" cy="11" r="1" fill="currentColor" />
              </svg>
              <span>Conversar</span>
            </button>
          </template>
        </div>

        <nav v-if="isDuck && !world.traveling" class="area-nav" aria-label="Áreas da Duck">
          <button
            v-for="area in areas"
            :key="area.id"
            type="button"
            :class="{ active: world.area === area.id }"
            :aria-current="world.area === area.id ? 'true' : undefined"
            :disabled="travelDisabled"
            @click="requestArea(area.id)"
          >
            {{ area.label }}
          </button>
        </nav>

        <p class="hint">{{ hintText }}</p>

        <div v-if="workControlsVisible" class="work-controls" aria-label="Controles de movimento">
          <div class="dpad">
            <button
              class="dpad-button up"
              type="button"
              aria-label="Andar para cima"
              @pointerdown="pressMove('up', $event)"
              @pointerup="releaseMove('up', $event)"
              @pointercancel="releaseMove('up', $event)"
              @pointerleave="releaseMove('up', $event)"
            >▲</button>
            <button
              class="dpad-button left"
              type="button"
              aria-label="Andar para a esquerda"
              @pointerdown="pressMove('left', $event)"
              @pointerup="releaseMove('left', $event)"
              @pointercancel="releaseMove('left', $event)"
              @pointerleave="releaseMove('left', $event)"
            >◀</button>
            <span class="dpad-center" aria-hidden="true"></span>
            <button
              class="dpad-button right"
              type="button"
              aria-label="Andar para a direita"
              @pointerdown="pressMove('right', $event)"
              @pointerup="releaseMove('right', $event)"
              @pointercancel="releaseMove('right', $event)"
              @pointerleave="releaseMove('right', $event)"
            >▶</button>
            <button
              class="dpad-button down"
              type="button"
              aria-label="Andar para baixo"
              @pointerdown="pressMove('down', $event)"
              @pointerup="releaseMove('down', $event)"
              @pointercancel="releaseMove('down', $event)"
              @pointerleave="releaseMove('down', $event)"
            >▼</button>
          </div>
          <button
            class="work-action"
            type="button"
            @click="requestWorkInteract"
          >
            Interagir
          </button>
        </div>

        <Transition name="toast">
          <div v-if="toast" class="toast" role="status" aria-live="polite">{{ toast }}</div>
        </Transition>

        <Transition name="fade">
          <div v-if="!ready" class="loading-screen">
            <span class="loading-spinner" aria-hidden="true"></span>
            <span>Arrumando o quarto...</span>
          </div>
        </Transition>
      </div>

      <Transition name="modal">
        <div v-if="shopMode" class="modal-backdrop" @click.self="closeShop">
          <section class="modal-card shop-card" role="dialog" aria-modal="true" :aria-label="shopTitle">
            <header class="modal-head">
              <div>
                <span class="modal-kicker">{{ shopKicker }}</span>
                <h2>{{ shopTitle }}</h2>
              </div>
              <button class="modal-close" type="button" aria-label="Fechar" @click="closeShop">×</button>
            </header>
            <p class="shop-balance">Saldo disponível: <strong>$ {{ gameState.balance }}</strong><span v-if="shopMode === 'guests'" class="guest-count"> • {{ gameState.guests.length }} no camarote</span></p>
            <ul class="shop-list">
              <li v-for="item in shopEntries" :key="item.id" :class="{ unaffordable: gameState.balance < item.price }">
                <div class="shop-item-copy">
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.detail }}</span>
                </div>
                <div class="shop-item-action">
                  <span class="shop-price">$ {{ item.price }}</span>
                  <button
                    v-if="shopMode === 'drinks'"
                    class="modal-action"
                    type="button"
                    @click="buySelectedDrink(item)"
                  >
                    Comprar
                  </button>
                  <button
                    v-else
                    class="modal-action"
                    type="button"
                    :disabled="isGuestInvited(item.id)"
                    @click="inviteSelectedGuest(item)"
                  >
                    {{ isGuestInvited(item.id) ? 'No camarote' : 'Convidar' }}
                  </button>
                </div>
              </li>
            </ul>
            <p class="shop-note">Dinheiro virtual do jogo. Nenhuma cobrança real é feita.</p>
          </section>
        </div>
      </Transition>

      <Transition name="modal">
        <div v-if="payment" class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Pagamento do expediente">
          <section class="modal-card payment-card">
            <span class="modal-kicker">CEASA • PAGAMENTO</span>
            <h2>Expediente concluído!</h2>
            <p>Você recebeu <strong class="payment-amount">$ {{ payment.amount }}</strong> pelo turno.</p>
            <p class="shop-balance">Saldo atual: <strong>$ {{ gameState.balance }}</strong></p>
            <div class="modal-actions">
              <button class="modal-action ghost" type="button" @click="leaveWork('bedroom')">Voltar pra casa</button>
              <button class="modal-action primary" type="button" @click="leaveWork('duck')">Ir pra Duck</button>
            </div>
          </section>
        </div>
      </Transition>
    </section>

    <p class="portrait-tip">{{ hintText }}</p>
  </main>
</template>
