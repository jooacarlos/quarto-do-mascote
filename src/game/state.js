import { reactive } from 'vue'

export const SAVE_KEY = 'mbranco.ceasa.save.v1'
export const SALARY = 150
export const BOXES_REQUIRED = 8
export const BOX_REWARD_HINT = 'Descarregue 8 caixas do caminhão e leve cada uma ao setor indicado.'
export const TOMATO_STEAL_REWARD = 6
export const MAX_TOMATO_STEALS = 3

export const BOX_TYPES = {
  tomato: { label: 'Tomates', zone: 'tomatoes', texture: 'ceasa-crate-tomato' },
  lettuce: { label: 'Alfaces', zone: 'greens', texture: 'ceasa-crate-lettuce' },
  banana: { label: 'Bananas', zone: 'fruits', texture: 'ceasa-crate-banana' }
}

export const BOX_QUEUE = [
  'tomato',
  'lettuce',
  'tomato',
  'banana',
  'lettuce',
  'tomato',
  'banana',
  'lettuce'
]

export const DRINKS = [
  { id: 'gin', name: 'Gin tônica', price: 28, detail: 'O clássico do 00 do Paineiras' },
  { id: 'caipirinha', name: 'Caipirinha', price: 22, detail: 'Limão, gelo e coragem' },
  { id: 'beer', name: 'Cerveja gelada', price: 14, detail: 'Pra começar a noite' },
  { id: 'water', name: 'Água com gás', price: 6, detail: 'Pra não esquecer do trabalho' }
]

export const GUESTS = [
  { id: 'bia', name: 'Bia', price: 30, texture: 'npc-1', detail: 'Ama a pista e um gin' },
  { id: 'joao', name: 'João caga grosso', price: 35, texture: 'npc-2', detail: 'Chega já pedindo música' },
  { id: 'miguel', name: 'Miguel bigode', price: 40, texture: 'npc-3', detail: 'Só entra se for no camarote' }
]

function freshState() {
  return {
    version: 1,
    balance: 0,
    completedShifts: 0,
    paidShiftIds: [],
    purchases: [],
    guests: [],
    fired: false,
    shift: null
  }
}

function normalizeShift(shift) {
  if (!shift || typeof shift !== 'object' || !shift.id) return null
  const required = Math.max(1, Number(shift.boxesRequired) || BOXES_REQUIRED)
  return {
    id: String(shift.id),
    boxesRequired: required,
    boxesDelivered: Math.min(required, Math.max(0, Number(shift.boxesDelivered) || 0)),
    boxQueue: Array.isArray(shift.boxQueue) ? shift.boxQueue : BOX_QUEUE.slice(0, required),
    clockedIn: Boolean(shift.clockedIn),
    clockedOut: Boolean(shift.clockedOut),
    taskAccepted: Boolean(shift.taskAccepted),
    completed: Boolean(shift.completed),
    paid: Boolean(shift.paid),
    fired: Boolean(shift.fired),
    tomatoesStolen: Math.max(0, Number(shift.tomatoesStolen) || 0),
    stage: typeof shift.stage === 'string' ? shift.stage : 'commute',
    startedAt: Number(shift.startedAt) || Date.now(),
    paidAt: Number(shift.paidAt) || null
  }
}

function loadState() {
  const base = freshState()
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return base
    const shift = normalizeShift(parsed.shift)
    return {
      ...base,
      balance: Math.max(0, Number(parsed.balance) || 0),
      completedShifts: Math.max(0, Number(parsed.completedShifts) || 0),
      paidShiftIds: Array.isArray(parsed.paidShiftIds) ? parsed.paidShiftIds.map(String) : [],
      purchases: Array.isArray(parsed.purchases) ? parsed.purchases.slice(-40) : [],
      guests: Array.isArray(parsed.guests) ? [...new Set(parsed.guests.map(String))] : [],
      fired: Boolean(parsed.fired),
      shift
    }
  } catch {
    return base
  }
}

export const gameState = reactive(loadState())

export function saveState() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(gameState))
  } catch {
    // localStorage indisponível: o jogo continua apenas em memória.
  }
}

export function hasActiveShift() {
  return Boolean(
    gameState.shift && !gameState.shift.paid && !gameState.shift.fired && !gameState.fired
  )
}

export function beginShift() {
  if (gameState.fired) return null
  if (hasActiveShift()) return gameState.shift
  const id = `shift-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  gameState.shift = {
    id,
    boxesRequired: BOXES_REQUIRED,
    boxesDelivered: 0,
    boxQueue: BOX_QUEUE.slice(0, BOXES_REQUIRED),
    clockedIn: false,
    clockedOut: false,
    taskAccepted: false,
    completed: false,
    paid: false,
    fired: false,
    tomatoesStolen: 0,
    stage: 'commute',
    startedAt: Date.now(),
    paidAt: null
  }
  saveState()
  return gameState.shift
}

export function setShiftStage(stage) {
  if (!gameState.shift) return
  if (gameState.shift.stage === stage) return
  gameState.shift.stage = stage
  saveState()
}

export function clockIn() {
  const shift = gameState.shift
  if (!shift || shift.clockedIn || shift.paid) return false
  shift.clockedIn = true
  shift.stage = 'ceasa'
  saveState()
  return true
}

export function acceptTask() {
  const shift = gameState.shift
  if (!shift || !shift.clockedIn || shift.taskAccepted) return false
  shift.taskAccepted = true
  shift.stage = 'working'
  saveState()
  return true
}

export function nextBoxType() {
  const shift = gameState.shift
  if (!shift || shift.boxesDelivered >= shift.boxesRequired) return null
  return shift.boxQueue[shift.boxesDelivered] ?? null
}

export function deliverBox(type) {
  const shift = gameState.shift
  if (!shift || shift.paid || shift.completed || !shift.taskAccepted) return false
  if (type !== nextBoxType()) return false
  shift.boxesDelivered += 1
  shift.completed = shift.boxesDelivered >= shift.boxesRequired
  shift.stage = shift.completed ? 'clock_out' : 'working'
  saveState()
  return true
}

export function clockOut() {
  const shift = gameState.shift
  if (!shift || shift.fired || !shift.completed || shift.paid) return false
  if (!shift.clockedIn || !shift.taskAccepted) return false
  shift.clockedOut = true
  shift.paid = true
  shift.paidAt = Date.now()
  shift.stage = 'completed'
  gameState.balance += SALARY
  gameState.completedShifts += 1
  if (!gameState.paidShiftIds.includes(shift.id)) gameState.paidShiftIds.push(shift.id)
  saveState()
  return SALARY
}

export function abandonShift() {
  const shift = gameState.shift
  if (!shift || shift.paid || shift.clockedIn) return false
  gameState.shift = null
  saveState()
  return true
}

export function canBuy(price) {
  return Number.isFinite(price) && price >= 0 && gameState.balance >= price
}

export function stealTomato() {
  const shift = gameState.shift
  if (gameState.fired) {
    return { ok: false, fired: true, reason: 'Voltar para o Taco Bell! Você foi demitido.' }
  }
  if (!shift || !shift.clockedIn || shift.paid || shift.fired) {
    return { ok: false, reason: 'Só dá pra roubar tomate durante o expediente.' }
  }

  const stolen = Math.max(0, Number(shift.tomatoesStolen) || 0)
  if (stolen >= MAX_TOMATO_STEALS) {
    shift.tomatoesStolen = stolen + 1
    shift.fired = true
    shift.stage = 'fired'
    gameState.fired = true
    saveState()
    return {
      ok: false,
      fired: true,
      reason: 'Voltar para o Taco Bell! Você foi demitido.'
    }
  }

  shift.tomatoesStolen = stolen + 1
  gameState.balance += TOMATO_STEAL_REWARD
  saveState()
  return {
    ok: true,
    amount: TOMATO_STEAL_REWARD,
    balance: gameState.balance,
    stolen: shift.tomatoesStolen,
    max: MAX_TOMATO_STEALS
  }
}

export function isFired() {
  return Boolean(gameState.fired)
}

export function buyDrink(drinkId) {
  const drink = DRINKS.find((item) => item.id === drinkId)
  if (!drink || !canBuy(drink.price)) return { ok: false, reason: 'Saldo insuficiente.' }
  gameState.balance -= drink.price
  gameState.purchases.push({ id: drink.id, name: drink.name, price: drink.price, at: Date.now() })
  if (gameState.purchases.length > 40) gameState.purchases.shift()
  saveState()
  return { ok: true, drink }
}

export function inviteGuest(guestId) {
  const guest = GUESTS.find((item) => item.id === guestId)
  if (!guest) return { ok: false, reason: 'Convidado não encontrado.' }
  if (gameState.guests.includes(guest.id)) return { ok: false, reason: `${guest.name} já está no camarote.` }
  if (!canBuy(guest.price)) return { ok: false, reason: 'Saldo insuficiente.' }
  gameState.balance -= guest.price
  gameState.guests.push(guest.id)
  saveState()
  return { ok: true, guest }
}

export function walletLabel() {
  return `$ ${gameState.balance}`
}

export function shiftSummary() {
  const shift = gameState.shift
  if (!shift) return null
  return {
    ...shift,
    remaining: Math.max(0, shift.boxesRequired - shift.boxesDelivered)
  }
}
