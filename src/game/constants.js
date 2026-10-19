export const GAME_WIDTH = 1280
export const GAME_HEIGHT = 720
export const SCENES = {
  BEDROOM: 'BedroomScene',
  DUCK: 'DuckScene',
  TRAVEL: 'TravelScene',
  STREET: 'StreetScene',
  BUS: 'BusScene',
  CEASA_FACADE: 'CeasaFacadeScene',
  CEASA: 'CeasaScene'
}
export const SCENE_KEY = SCENES.BEDROOM
export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`

export const AREA_LABELS = {
  bedroom: 'Quarto',
  duck: 'Duck',
  dance: 'Pista',
  bar: 'Bar',
  vip: 'Camarote',
  street: 'Rua / Ponto',
  bus: 'Ônibus',
  'ceasa-facade': 'CEASA',
  ceasa: 'Galpão CEASA'
}
