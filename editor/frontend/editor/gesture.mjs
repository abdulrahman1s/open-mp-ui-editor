import {
  M,
  L,
  R,
  G,
  isButton,
  same,
  ensureTransform,
  parentScale,
} from "./native.mjs";

// A gesture owns its mutable working copy. Preview frames never enter history;
// finish adds one transaction and cancel restores the exact starting document.
export function beginGesture(
  store,
  { plan, view, point, handle = null, viewportWidth },
) {
  const snapshot = store.getSnapshot(),
    path = snapshot.selected,
    state = snapshot.state,
    name = snapshot.screenName;
  const originalScreen = snapshot.document.screens[name];
  if (
    path &&
    (L.state(originalScreen, path).locked || snapshot.multi.length > 1)
  )
    return null;
  const transaction = store.gesture(),
    screen = transaction.document.screens[name];
  const node = path ? L.get(screen, path) : null,
    button = isButton(node);
  if (node) {
    if (button) node.style ||= {};
    else if (!handle || view.resize === "scale") ensureTransform(screen, path);
  }
  const hit = path
    ? plan.hits.find((h) => same(h.path, path))
    : { x: plan.x, y: plan.y, w: plan.width, h: plan.height };
  if (!hit) {
    transaction.cancel();
    return null;
  }
  const resize =
    handle && view.resize === "resize"
      ? R.begin(screen, path, plan, state)
      : null;
  if (handle && view.resize === "resize" && !resize) {
    transaction.cancel();
    return null;
  }
  const original = node
    ? M.clone(
        button
          ? { ...node.style, ...M.buttonPosition(node, state) }
          : L.get(screen, path),
      )
    : null;
  const parents = path ? parentScale(screen, path) : { sx: 1, sy: 1 },
    initialScale = screen.scale ?? 1,
    projectionHeight = Number(view.projection);
  let moved = false;
  function magnetic(dx, dy, event) {
    if (event.shiftKey) {
      if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
      else dx = 0;
    }
    if (event.altKey || !view.smart) return { dx, dy, lines: [] };
    const targets = [
      { x: 0, y: 0, w: 640, h: projectionHeight, centerOnly: true },
    ];
    if (path !== null) {
      targets.push({ x: plan.x, y: plan.y, w: plan.width, h: plan.height });
      const related = (other) =>
        !other ||
        same(
          path.slice(0, Math.min(path.length, other.length)),
          other.slice(0, Math.min(path.length, other.length)),
        );
      const slot = node?.slot ?? hit.control?.slot,
        binding = path.slice(0, path.lastIndexOf("controls")),
        seen = new Set();
      for (const target of plan.hits) {
        const sameBinding =
            target.control && button && same(target.control.binding, binding),
          key = JSON.stringify([target.path, target.control?.slot]);
        if (
          (sameBinding ? target.control.slot === slot : related(target.path)) ||
          seen.has(key)
        )
          continue;
        seen.add(key);
        targets.push(target);
      }
    }
    const snap = G.snap(
      { x: hit.x + dx, y: hit.y + dy, w: hit.w, h: hit.h },
      targets,
      {
        threshold: (6 * 640) / viewportWidth,
        x: !event.shiftKey || Math.abs(dx) >= Math.abs(dy),
        y: !event.shiftKey || Math.abs(dy) > Math.abs(dx),
      },
    );
    return { dx: dx + snap.dx, dy: dy + snap.dy, lines: snap.lines };
  }
  return {
    move(pt, event = {}) {
      const dx = pt.x - point.x,
        dy = pt.y - point.y;
      if (Math.abs(dx) + Math.abs(dy) < 0.5 && !moved) return [];
      moved = true;
      const snap = view.grid && !event.altKey ? Number(view.gridSize) : 0.1,
        round = (v) => Number((Math.round(v / snap) * snap).toFixed(3));
      let lines = [];
      if (!handle) {
        const move = magnetic(
          round(hit.x + dx) - hit.x,
          round(hit.y + dy) - hit.y,
          event,
        );
        lines = move.lines;
        if (path === null)
          screen.placement = {
            kind: "at",
            x: Math.max(0, Math.min(640 - hit.w, plan.x + move.dx)),
            y: Math.max(
              0,
              Math.min(projectionHeight - hit.h, plan.y + move.dy),
            ),
          };
        else {
          const position = {
            x: (original.x ?? 0) + move.dx / parents.sx,
            y: (original.y ?? 0) + move.dy / parents.sy,
          };
          if (button) M.setButtonPosition(node, state, position);
          else Object.assign(L.get(screen, path), position);
        }
      } else {
        const west = handle.includes("w"),
          east = handle.includes("e"),
          north = handle.includes("n"),
          south = handle.includes("s");
        let width = hit.w + (east ? dx : west ? -dx : 0),
          height = hit.h + (south ? dy : north ? -dy : 0);
        if (resize) {
          if (event.shiftKey && resize.axes === "xy") {
            const ratio =
              (west || east) && !(north || south)
                ? width / hit.w
                : (north || south) && !(west || east)
                  ? height / hit.h
                  : Math.abs(width / hit.w - 1) > Math.abs(height / hit.h - 1)
                    ? width / hit.w
                    : height / hit.h;
            width = hit.w * ratio;
            height = hit.h * ratio;
          }
          if (!event.shiftKey) {
            width = east
              ? round(hit.x + width) - hit.x
              : west
                ? hit.x + hit.w - round(hit.x + hit.w - width)
                : width;
            height = south
              ? round(hit.y + height) - hit.y
              : north
                ? hit.y + hit.h - round(hit.y + hit.h - height)
                : height;
          }
          resize.apply({ width, height, west, north });
        } else {
          let rx = width / hit.w,
            ry = height / hit.h;
          if (event.shiftKey || path === null) {
            const ratio =
              (west || east) && !(north || south)
                ? rx
                : (north || south) && !(west || east)
                  ? ry
                  : Math.abs(rx - 1) > Math.abs(ry - 1)
                    ? rx
                    : ry;
            rx = ratio;
            ry = ratio;
          }
          if (path === null) {
            screen.scale = Math.max(0.1, Math.min(4, initialScale * rx));
            const ratio = screen.scale / initialScale;
            screen.placement = {
              kind: "at",
              x: round(plan.x + (west ? hit.w * (1 - ratio) : 0)),
              y: round(plan.y + (north ? hit.h * (1 - ratio) : 0)),
            };
          } else {
            const target = button ? node.style : L.get(screen, path);
            target.scale_x =
              Math.round(
                Math.max(0.1, Math.min(4, (original.scale_x ?? 1) * rx)) * 1000,
              ) / 1000;
            target.scale_y =
              Math.round(
                Math.max(0.1, Math.min(4, (original.scale_y ?? 1) * ry)) * 1000,
              ) / 1000;
            const position = {
              x: round(
                (original.x ?? 0) +
                  (west
                    ? (hit.w * (1 - target.scale_x / (original.scale_x ?? 1))) /
                      parents.sx
                    : 0),
              ),
              y: round(
                (original.y ?? 0) +
                  (north
                    ? (hit.h * (1 - target.scale_y / (original.scale_y ?? 1))) /
                      parents.sy
                    : 0),
              ),
            };
            if (button) M.setButtonPosition(node, state, position);
            else Object.assign(target, position);
          }
        }
      }
      transaction.preview();
      return lines;
    },
    finish() {
      if (moved) transaction.finish(handle ? "Resize layer" : "Move layer");
      else transaction.cancel();
    },
    cancel() {
      transaction.cancel();
    },
  };
}
