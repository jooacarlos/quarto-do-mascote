import { STORY_CHAPTERS } from './museum.js'

export const MUSEUM_SAVE_KEY = 'mbranco.museum.save.v1'

function freshState() {
  return {
    version: 1,
    lastChapter: 0,
    visitedChapters: [],
    galleryUnlocked: false,
    completedAt: null
  }
}

function normalizeChapter(index) {
  const value = Number(index)
  if (!Number.isFinite(value)) return 0
  return Math.min(STORY_CHAPTERS.length - 1, Math.max(0, Math.floor(value)))
}

function loadMuseumState() {
  const base = freshState()
  try {
    const raw = localStorage.getItem(MUSEUM_SAVE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return base
    const visited = Array.isArray(parsed.visitedChapters)
      ? [...new Set(parsed.visitedChapters.map(String))]
      : []
    return {
      ...base,
      lastChapter: normalizeChapter(parsed.lastChapter),
      visitedChapters: visited,
      galleryUnlocked: Boolean(parsed.galleryUnlocked),
      completedAt: Number(parsed.completedAt) || null
    }
  } catch {
    return base
  }
}

function persist(state) {
  try {
    localStorage.setItem(MUSEUM_SAVE_KEY, JSON.stringify(state))
  } catch {
    // O museu continua funcionando em memoria quando o localStorage nao esta disponivel.
  }
}

export function getMuseumState() {
  return loadMuseumState()
}

export function getMuseumProgress() {
  const state = loadMuseumState()
  return {
    ...state,
    total: STORY_CHAPTERS.length,
    viewed: state.visitedChapters.length
  }
}

export function getResumeChapter() {
  const state = loadMuseumState()
  if (state.galleryUnlocked) return 0
  return normalizeChapter(state.lastChapter)
}

export function saveChapter(index) {
  const state = loadMuseumState()
  const chapter = STORY_CHAPTERS[normalizeChapter(index)]
  if (!chapter) return state
  state.lastChapter = normalizeChapter(index)
  if (!state.visitedChapters.includes(chapter.id)) state.visitedChapters.push(chapter.id)
  persist(state)
  return state
}

export function completeStory() {
  const state = loadMuseumState()
  state.lastChapter = STORY_CHAPTERS.length - 1
  for (const chapter of STORY_CHAPTERS) {
    if (!state.visitedChapters.includes(chapter.id)) state.visitedChapters.push(chapter.id)
  }
  state.galleryUnlocked = true
  state.completedAt = state.completedAt ?? Date.now()
  persist(state)
  return state
}

export function isGalleryUnlocked() {
  return Boolean(loadMuseumState().galleryUnlocked)
}

export function isStoryComplete() {
  const state = loadMuseumState()
  return Boolean(state.galleryUnlocked || state.completedAt)
}

export function resetMuseumProgress() {
  localStorage.removeItem(MUSEUM_SAVE_KEY)
}
