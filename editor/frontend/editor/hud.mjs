// Measured HUD pixels in the supplied 3839 × 2159 client capture.
// Independent of the document's TextDraw coordinates and UI scale.
export const HUD = Object.freeze({
  width: 3839,
  height: 2159,
  radar: Object.freeze({ x: 176, y: 1581, w: 493, h: 482 }),
  player: Object.freeze({ x: 2989, y: 117, w: 278, h: 247 }),
  money: Object.freeze({ x: 2982, y: 375, w: 668, h: 100 }),
  health: Object.freeze({ x: 3277, y: 323, w: 371, h: 43 }),
});
export function hudOpacity(value = 100) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 100;
}
// Menu matches the second capture; gameplay matches the first capture.
export function hudLayout(width, height, mode = "menu") {
  const sx = width / HUD.width,
    sy = height / HUD.height;
  return (
    mode === "gameplay" ? ["radar", "player", "money", "health"] : ["health"]
  ).map((name) => {
    const box = HUD[name];
    // Preserve the radar's physical shape and lower-left anchor on other aspects.
    // The player HUD follows the client's screen projection from the capture.
    const scaleX = name === "radar" ? sy : sx;
    return {
      name,
      image: `textures/hud/reference-${name}.png`,
      x: box.x * scaleX,
      y: name === "radar" ? height - (HUD.height - box.y) * sy : box.y * sy,
      w: box.w * scaleX,
      h: box.h * sy,
    };
  });
}
