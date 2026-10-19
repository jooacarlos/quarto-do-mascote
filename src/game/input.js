export function isCanvasPointer(scene, pointer) {
  const target = pointer?.event?.target
  if (!target) return true
  return target === scene.game.canvas || target?.tagName === 'CANVAS'
}
