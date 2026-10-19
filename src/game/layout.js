export const LAYOUT = {
  room: { x: 640, y: 360, height: 720 },
  window: { x: 300, y: 150, height: 260, depth: 5 },
  frameAbstract: { x: 900, y: 155, height: 170, depth: 6 },
  frameLandscape: { x: 1022, y: 162, height: 140, depth: 6 },
  rug: { x: 690, y: 652, width: 460, depth: 20 },
  bed: { x: 245, baseY: 690, width: 500, depth: 690 },
  bedside: { x: 540, baseY: 650, width: 175, depth: 650 },
  lamp: { x: 540, baseY: 460, height: 210, depth: 651 },
  desk: { x: 1070, baseY: 700, width: 450, depth: 700 },
  plant: { x: 1262, baseY: 718, height: 135, depth: 718 },
  character: {
    x: 700,
    y: 712,
    height: 440,
    depth: 712,
    shadowY: 702,
    shadowWidth: 185,
    shadowHeight: 36
  }
}

export const LAMP_EFFECTS = {
  glow: { x: 540, y: 348, width: 390, height: 390, alpha: 0.3, depth: 649 },
  pool: { x: 540, y: 650, width: 330, height: 130, alpha: 0.18, depth: 648 }
}
