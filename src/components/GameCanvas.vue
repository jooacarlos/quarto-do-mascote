<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { createGame } from '../game/config.js'
import { disposeSoundManager } from '../game/systems/SoundManager.js'

const host = ref(null)
let game = null

onMounted(() => {
  if (!host.value || game) return
  game = createGame(host.value)
})

onBeforeUnmount(() => {
  if (game) {
    game.destroy(true)
    game = null
  }
  disposeSoundManager()
})
</script>

<template>
  <div ref="host" class="canvas-host"></div>
</template>

<style scoped>
.canvas-host {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none;
}

.canvas-host :deep(canvas) {
  display: block;
}
</style>
