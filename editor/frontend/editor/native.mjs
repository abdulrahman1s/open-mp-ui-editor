// The game-compatible model and renderer are also used by Node verification.
// Keep their browser adapter explicit; React never reimplements native layout.
export const M = globalThis.UiDocument;
export const L = globalThis.UiLayers;
export const H = globalThis.UiHistory;
export const R = globalThis.UiResize;
export const G = globalThis.UiGuides;
export const S = globalThis.UiStylesheet;
export const T = globalThis.UiCanvasText;
export const V = globalThis.UiTextVariables;
export const defaults = globalThis.DEFAULT_UI;
export const variables = globalThis.UI_VARIABLES || [];
export const states = globalThis.UI_PREVIEW_STATES || {};
export const vocabulary = globalThis.UI_VOCABULARY;
export const screenNames = globalThis.UI_SCREEN_NAMES || {};
export const sprites = globalThis.GAME_SPRITES || {};
export const fonts = globalThis.GAME_FONTS;
export const Renderer = globalThis.GameRenderer;
export const isButton = (value) => value && Object.hasOwn(value, "action");
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export function ensureTransform(screen, path) {
  const value = L.get(screen, path);
  if (value.type !== "transform")
    L.get(screen, path.slice(0, -1))[path.at(-1)] = {
      type: "transform",
      x: 0,
      y: 0,
      scale_x: 1,
      scale_y: 1,
      rows: [value],
    };
  return L.get(screen, path);
}
export function parentScale(screen, path) {
  let sx = screen.scale ?? 1,
    sy = sx;
  for (let i = 1; i < path.length; i++) {
    const node = L.get(screen, path.slice(0, i));
    if (node?.type === "transform") {
      sx *= node.scale_x;
      sy *= node.scale_y;
    }
  }
  return { sx, sy };
}
