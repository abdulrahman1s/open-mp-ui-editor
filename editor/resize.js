/* Container sizing changes native dimensions, never glyph or transform scales.
 * Both the controller and tests use begin(...).apply(...) with canvas units. */
(function (root) {
  'use strict';
  const at = (screen, path) => path.reduce((node, key) => node[key], screen.rows);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function begin(screen, path, plan, state = 'default') {
    if (path === null) {
      const padding = screen.compact ? 12 : 16, scale = screen.scale ?? 1;
      return { axes: 'x', apply({ width = plan.width, west = false }) {
        screen.width = clamp(width / scale - padding * 2, 1, 640);
        const actualWidth = (screen.width + padding * 2) * scale;
        screen.placement = { kind: 'at', x: plan.x + (west ? plan.width - actualWidth : 0), y: plan.y };
      } };
    }
    let target = at(screen, path), wrapper = null;
    const hit = plan.hits.find(h => equal(h.path, path));
    if (!hit || !target || Array.isArray(target)) return null;
    let sx = screen.scale ?? 1, sy = sx, availableWidth = screen.width, parentWidth = availableWidth;
    for (let i = 1; i <= path.length; i++) {
      const ancestor = at(screen, path.slice(0, i));
      if (ancestor?.type === 'transform') { sx *= ancestor.scale_x; sy *= ancestor.scale_y; if(i===path.length)parentWidth=availableWidth;availableWidth=ancestor.width??availableWidth; }
      if (ancestor?.type === 'columns' && ['left','right'].includes(path[i])) { const left=ancestor.left_width||(availableWidth-24)/2;availableWidth=path[i]==='left'?left:availableWidth-left-24; }
    }
    if (target.type === 'transform' && target.rows.length === 1) { wrapper = target; target = target.rows[0]; }
    if(target.type==='native') {
      const e=target.element,ox=e.x,oy=e.y,right=e.x+e.w,bottom=e.y+e.h;
      return {axes:'xy',apply({width=hit.w,height=hit.h,west=false,north=false}) {
        // Keep the opposite edge fixed and stay inside the native export bounds.
        e.w=clamp(width/sx,Math.min(1,right-ox),west?right:640-ox);
        e.h=clamp(height/sy,Math.min(1,bottom-oy),north?bottom:448-oy);
        e.x=west?right-e.w:ox;
        e.y=north?bottom-e.h:oy;
      }};
    }
    const button = Object.hasOwn(target, 'action');
    const kind = button ? 'button' : target.type;
    if(kind==='buttons'&&wrapper)availableWidth=parentWidth;
    if (!['button', 'sprite', 'buttons', 'binding', 'gap', 'text', 'rule'].includes(kind)) return null;
    const position = button ? (target.style || {}) : wrapper;
    const original = button ? UiDocument.buttonPosition(target,state) : position;
    const originalX = original?.x ?? 0, originalY = original?.y ?? 0;
    const px = wrapper ? sx / wrapper.scale_x : sx, py = wrapper ? sy / wrapper.scale_y : sy;
    if (button) { sx *= position.scale_x ?? 1; sy *= position.scale_y ?? 1; }
    const contentWidth = ['text', 'binding', 'rule', 'buttons'].includes(kind);
    const axes = kind === 'gap' ? 'y' : ['buttons', 'binding', 'text', 'rule'].includes(kind) ? 'x' : 'xy';
    return { axes, apply({ width = hit.w, height = hit.h, west = false, north = false }) {
      if (button) target.style = position;
      const minWidth = button ? Math.max(1, 2 * (target.style.padding_x ?? (screen.compact ? 5 : 0)) + 1, 2 * (target.style.border_width ?? 0) + 1) : 1;
      const minHeight = button ? Math.max(1, 2 * (target.style.padding_y ?? (screen.compact ? 2 : 0)) + 1, 2 * (target.style.border_width ?? 0) + 1) : 1;
      const w = clamp(width / sx, minWidth, ['sprite','buttons'].includes(kind) ? availableWidth : 640);
      const h = clamp(height / sy, minHeight, kind === 'sprite' ? 640 : 480);
      if (contentWidth) {
        if (!wrapper) {
          wrapper = {type:'transform',x:0,y:0,scale_x:1,scale_y:1,rows:[target]};
          const parent = path.length === 1 ? screen.rows : at(screen,path.slice(0,-1));
          parent[path.at(-1)] = wrapper;
        }
        wrapper.width = w;
        if (kind === 'buttons' && target.width != null) target.width = w;
        wrapper.x = originalX + (west ? (hit.w - w * sx) / px : 0);
      } else if (axes.includes('x')) target.width = w;
      if (axes.includes('y')) { if (button) target.style.height = h; else target.height = h; }
      if (position && !contentWidth) {
        const next={};
        if (axes.includes('x')) next.x = originalX + (west ? (hit.w - w * sx) / px : 0);
        if (axes.includes('y')) next.y = originalY + (north ? (hit.h - h * sy) / py : 0);
        if(button)UiDocument.setButtonPosition(target,state,next);else Object.assign(position,next);
      }
    } };
  }
  root.UiResize = { begin };
  if (typeof module !== 'undefined') module.exports = root.UiResize;
})(globalThis);
