<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import GameCanvas from './components/GameCanvas.vue'
import { EVENTS } from './game/events.js'
import { gameBus } from './game/bus.js'
import { AREA_LABELS } from './game/constants.js'

const ready = ref(false)
const characterState = ref('idle')
const soundOn = ref(true)
const toast = ref('')
const dialogue = ref(null)
const world = ref({ scene: 'bedroom', area: 'bedroom', traveling: false })
const areaTransition = ref(false)
const travelDirection = ref(null)
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
    toast.value = message
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.value = ''
      toastTimer = null
    }, 2400)
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
    areaTransition.value = false
    travelDirection.value = null
  }),
  gameBus.on(EVENTS.TRAVEL_STATE, (payload) => {
    if (payload.phase === 'leaving' || payload.phase === 'traveling') {
      const targetScene =
        payload.target === 'bedroom' ? 'bedroom' : payload.target === 'duck' ? 'duck' : world.value.scene
      world.value = {
        scene: targetScene,
        area:
          targetScene === 'bedroom'
            ? 'bedroom'
            : world.value.area === 'bedroom'
              ? 'dance'
              : world.value.area,
        traveling: true
      }
      travelDirection.value = payload.target === 'bedroom' ? 'to-bedroom' : 'to-duck'
      areaTransition.value = true
    }
  }),
  gameBus.on(EVENTS.AREA_STATE, (payload) => {
    areaTransition.value = Boolean(payload.transitioning)
    if (payload.area) {
      world.value = { ...world.value, area: payload.area, traveling: false }
    }
  })
]

const isDuck = computed(() => world.value.scene === 'duck')
const areaLabel = computed(() => AREA_LABELS[world.value.area] ?? 'Duck')
const portraitTitle = computed(() => (isDuck.value ? 'Duck Nightclub' : 'Quarto do Mascote'))
const portraitKicker = computed(() => (isDuck.value ? 'balada virtual' : 'mascote virtual'))
const isActive = computed(
  () =>
    characterState.value !== 'idle' ||
    world.value.traveling ||
    areaTransition.value
)

const statusText = computed(() => {
  if (!ready.value) return 'Preparando o quarto...'
  if (world.value.traveling) {
    return travelDirection.value === 'to-bedroom' ? 'Voltando para o quarto...' : 'Indo para a Duck...'
  }
  if (areaTransition.value) return 'Mudando de área...'

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
  if (isDuck.value) {
    if (world.value.area === 'bar') return 'Toque no gin para pedir uma bebida'
    if (world.value.area === 'vip') return 'Toque no camarote para brindar'
    return 'Toque na pista, no DJ, no globo ou nos NPCs'
  }
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
    return { id: 'bar', label: 'Pedir gin', icon: 'glass' }
  }
  if (world.value.area === 'vip') {
    return { id: 'vip', label: 'Brindar', icon: 'sparkle' }
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

const contextDisabled = computed(() => {
  if (!contextAction.value || travelDisabled.value) return true
  if (characterState.value === 'dancing' && contextAction.value.id !== 'dance') return true
  return false
})

function requestWave() {
  if (!ready.value || isDuck.value) return
  gameBus.emit(EVENTS.REQUEST_WAVE)
}

function requestClub() {
  if (clubDisabled.value || isDuck.value) return
  gameBus.emit(EVENTS.REQUEST_CLUB)
}

function requestReturn() {
  if (travelDisabled.value || !isDuck.value) return
  gameBus.emit(EVENTS.REQUEST_RETURN)
}

function requestArea(area) {
  if (travelDisabled.value || !isDuck.value || area === world.value.area) return
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

function toggleSound() {
  if (!ready.value) return
  gameBus.emit(EVENTS.TOGGLE_SOUND)
}

onBeforeUnmount(() => {
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

    <section class="game-frame" :class="{ 'is-duck': isDuck }" aria-label="Aventura do mascote">
      <GameCanvas />

      <div class="hud">
        <div class="status-pill" role="status" aria-live="polite">
          <span class="status-dot" :class="{ active: isActive }"></span>
          <span>{{ statusText }}</span>
        </div>

        <div class="venue-badge" aria-hidden="true">
          <span class="venue-kicker">{{ isDuck ? 'Duck Nightclub' : 'mascote virtual' }}</span>
          <span class="venue-name">{{ isDuck ? areaLabel : 'Quarto do Mascote' }}</span>
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

        <div v-if="!world.traveling" class="action-bar">
          <template v-if="!isDuck">
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

          <template v-else>
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
    </section>

    <p class="portrait-tip">{{ hintText }}</p>
  </main>
</template>
