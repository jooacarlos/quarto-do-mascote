import Phaser from 'phaser'
import BedroomScene from './scenes/BedroomScene.js'
import DuckScene from './scenes/DuckScene.js'
import TravelScene from './scenes/TravelScene.js'
import StreetScene from './scenes/StreetScene.js'
import BusScene from './scenes/BusScene.js'
import CeasaFacadeScene from './scenes/CeasaFacadeScene.js'
import CeasaScene from './scenes/CeasaScene.js'
import { GAME_HEIGHT, GAME_WIDTH } from './constants.js'

export function createGame(parent) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#140d19',
    banner: false,
    render: {
      antialias: true,
      powerPreference: 'high-performance'
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT
    },
    scene: [BedroomScene, DuckScene, TravelScene, StreetScene, BusScene, CeasaFacadeScene, CeasaScene]
  })
}
