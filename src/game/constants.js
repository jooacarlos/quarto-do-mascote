export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720
export const SCENES = {
  BEDROOM: 'BedroomScene',
  DUCK: 'DuckScene',
  TRAVEL: 'TravelScene',
  STREET: 'StreetScene',
  BUS: 'BusScene',
  CEASA_FACADE: 'CeasaFacadeScene',
  CEASA: 'CeasaScene',
  MUSEUM_FACADE: 'MuseumFacadeScene',
  MUSEUM: 'MuseumScene',
  HISTORY_BOARD: 'HistoryBoardScene',
  MUSEUM_GALLERY: 'MuseumGalleryScene'
}
export const SCENE_KEY = SCENES.BEDROOM
export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`
export const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/`

export const VOICE_LINES = {
  duckTrip: 'eu-vou-pra-duck.mp3',
  duckArrive: 'oi-levi.mp3',
  duckFiot: 'voce-e-fiot.mp3',
  duckBoi: 'boi.mp3',
  workLula: 'se-o-lula-ganhar.mp3',
  workSuave: 'suave.mp3',
  workCarta: 'solta-carta.mp3',
  stop: 'para.mp3'
}

export const AREA_LABELS = {
  bedroom: 'Quarto',
  duck: 'Duck',
  dance: 'Pista',
  bar: 'Bar',
  vip: 'Camarote',
  street: 'Rua / Ponto',
  bus: 'Ônibus',
  'ceasa-facade': 'CEASA',
  ceasa: 'Galp�o CEASA',
  museum: 'Museu do Branco',
  'museum-facade': 'Entrada do Museu',
  'museum-lobby': 'Paineiras',
  'museum-gallery': 'Galeria de Amigos',
  'museum-history': 'HistoryBoard'
}
