const ANIMATIONS = {
  'mb-walk': {
    frames: ['mb-walk-0', 'mb-walk-1', 'mb-walk-2', 'mb-walk-3'],
    frameRate: 7,
    repeat: -1
  },
  'mb-dance': {
    frames: [
      'mb-dance-0',
      'mb-dance-1',
      'mb-dance-2',
      'mb-dance-3',
      'mb-dance-4',
      'mb-dance-5',
      'mb-dance-6',
      'mb-dance-7'
    ],
    frameRate: 5,
    repeat: -1,
    repeatDelay: 120
  },
  'mb-happy': {
    frames: ['mb-happy-0', 'mb-happy-1', 'mb-happy-2', 'mb-happy-1'],
    frameRate: 5,
    repeat: 1
  },
  'mb-talk': {
    frames: ['mb-talk-0', 'mb-talk-1', 'mb-talk-2', 'mb-talk-3'],
    frameRate: 3,
    repeat: -1
  },
  'mb-drink': {
    frames: [
      'mb-drink-0',
      'mb-drink-1',
      'mb-drink-2',
      'mb-drink-3',
      'mb-drink-4',
      'mb-drink-5',
      'mb-drink-6'
    ],
    frameRate: 3,
    repeat: 0
  },
  'bartender-idle': {
    frames: ['bartender-0', 'bartender-1'],
    frameRate: 2,
    repeat: -1,
    repeatDelay: 220
  }
}

export const CHARACTER_ANIMATIONS = Object.keys(ANIMATIONS)

export function createCharacterAnimations(scene) {
  for (const [key, definition] of Object.entries(ANIMATIONS)) {
    if (scene.anims.exists(key)) continue
    scene.anims.create({
      key,
      frames: definition.frames.map((frame) => ({ key: frame })),
      frameRate: definition.frameRate,
      repeat: definition.repeat
    })
  }
}
