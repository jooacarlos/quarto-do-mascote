import { AUDIO_BASE } from './constants.js'

export const STORY_AUDIO_BASE = `${AUDIO_BASE}museum/`

export const MUSEUM_ASSETS = [
  { key: 'museum-exterior', file: 'museum/exterior.webp' },
  { key: 'museum-lobby', file: 'museum/lobby.webp' },
  { key: 'museum-paineiras', file: 'museum/paineiras.webp' },
  { key: 'museum-gallery-hall', file: 'museum/gallery-hall.webp' },
  { key: 'museum-gallery-atrium', file: 'museum/gallery-atrium.webp' },
  { key: 'statue-branco', file: 'char-idle.webp' },
  { key: 'statue-miguel', file: 'museum/statue-miguel.webp' },
  { key: 'statue-vitinho', file: 'museum/statue-vitinho.webp' },
  { key: 'statue-manu', file: 'museum/statue-manu.webp' },
  { key: 'statue-levi', file: 'museum/statue-levi.webp' },
  { key: 'story-chegando', file: 'museum/story-chegando.webp' },
  { key: 'story-explorando', file: 'museum/story-explorando.webp' },
  { key: 'story-miguel', file: 'museum/story-miguel.webp' },
  { key: 'story-vitinho', file: 'museum/story-vitinho.webp' },
  { key: 'story-vitinho-2', file: 'museum/story-vitinho-2.webp' },
  { key: 'story-levi', file: 'museum/story-levi.webp' },
  { key: 'story-manu', file: 'museum/story-manu.webp' },
  { key: 'story-manu-2', file: 'museum/story-manu-2.webp' },
  { key: 'story-revelacao', file: 'museum/story-revelacao.webp' },
  { key: 'story-growing', file: 'museum/story-growing.webp' },
  { key: 'story-heroico', file: 'museum/story-heroico.webp' },
  { key: 'gallery-1', file: 'museum/gallery-1.webp' },
]

export const STORY_CHAPTERS = [
  {
    id: 'introducao',
    title: 'Entrada do museu',
    images: ['museum-lobby'],
    audio: '01-intro.mp3',
    duration: 5.76
  },
  {
    id: 'antes',
    title: 'Como era antes',
    images: ['museum-paineiras'],
    audio: '02-antes.mp3',
    duration: 18.816
  },
  {
    id: 'chegada',
    title: 'Chegada ao Paineiras',
    images: ['story-chegando'],
    audio: '03-chegando.mp3',
    duration: 8.904
  },
  {
    id: 'explorando',
    title: 'Explorando o condomínio',
    images: ['story-explorando'],
    audio: '04-explorando.mp3',
    duration: 8.904
  },
  {
    id: 'miguel',
    title: 'Miguel Bigode',
    images: ['story-miguel'],
    audio: '05-miguel.mp3',
    duration: 10.032
  },
  {
    id: 'vitinho',
    title: 'Vitinho',
    images: ['story-vitinho', 'story-vitinho-2'],
    audio: '06-vitinho.mp3',
    duration: 11.712
  },
  {
    id: 'levi',
    title: 'Levi',
    images: ['story-levi'],
    audio: '07-levi.mp3',
    duration: 12.216
  },
  {
    id: 'manu',
    title: 'Manu',
    images: ['story-manu', 'story-manu-2'],
    audio: '08-manu.mp3',
    duration: 11.184
  },
  {
    id: 'revelacao',
    title: 'A revelação do Bigode',
    images: ['story-revelacao'],
    audio: '09-revelacao.mp3',
    duration: 10.704
  },
  {
    id: 'final',
    title: '00 do Paineiras',
    images: ['story-growing', 'story-heroico'],
    audio: '10-final.mp3',
    duration: 11.76
  }
]

