import { M, same } from "./native.mjs";
import { buttonTitle, rowTitle } from "./preview.mjs";

export function layerTree(
  screen,
  preview,
  name,
  { advanced = false, selected = null, collapsed = new Set() } = {},
) {
  const entries = [],
    samples = preview.samples || {};
  const entry = (value, path, depth, extra = {}) =>
    entries.push({
      value,
      path,
      depth,
      label: Object.hasOwn(value, "action")
        ? buttonTitle(name, preview, value, path)
        : Array.isArray(value)
          ? "Group"
          : rowTitle(value, preview),
      ...extra,
    });
  function walk(rows, path = [], depth = 0) {
    rows.forEach((row, i) => {
      const p = [...path, i];
      if (!advanced) {
        if (row.type === "gap") return;
        if (
          row.type === "binding" &&
          !Object.hasOwn(samples, row.key) &&
          !same(p, selected)
        )
          return;
        if (row.type === "section") {
          if (Object.hasOwn(samples, row.key))
            walk(row.rows, [...p, "rows"], depth);
          return;
        }
        if (
          row.type === "buttons" &&
          row.buttons.every((b) =>
            (samples._hidden_actions || []).some(
              (a) => M.key(a) === M.key(b.action),
            ),
          )
        )
          return;
        if (row.type === "buttons") {
          row.buttons.forEach((b, j) => entry(b, [...p, "buttons", j], depth));
          return;
        }
        if (
          row.type === "transform" &&
          row.rows.length === 1 &&
          ["buttons", "binding"].includes(row.rows[0].type) &&
          !(
            row.rows[0].type === "binding" &&
            (samples[row.rows[0].key] || []).every((r) => r.type === "text")
          )
        ) {
          walk(row.rows, [...p, "rows"], depth);
          return;
        }
      }
      const liveButtons =
        row.type === "binding" &&
        (samples[row.key] || []).some((r) =>
          ["buttons", "columns"].includes(r.type),
        );
      if (advanced || !liveButtons) entry(row, p, depth);
      if (collapsed.has(JSON.stringify(p))) return;
      if (row.type === "columns")
        for (const side of ["left", "right"]) {
          entry(row[side], [...p, side], depth + 1, {
            branch: true,
            label: side === "left" ? "Left column" : "Right column",
          });
          walk(row[side], [...p, side], depth + 2);
        }
      if (row.type === "section") walk(row.rows, [...p, "rows"], depth + 1);
      if (
        row.type === "transform" &&
        (row.rows.length > 1 ||
          advanced ||
          row.rows.some(
            (r) =>
              ["buttons", "columns"].includes(r.type) ||
              (r.type === "binding" &&
                (samples[r.key] || []).some((s) =>
                  ["buttons", "columns"].includes(s.type),
                )),
          ))
      )
        walk(row.rows, [...p, "rows"], depth + 1);
      if (row.type === "buttons")
        row.buttons.forEach((b, j) =>
          entry(b, [...p, "buttons", j], depth + 1),
        );
      if (row.type === "binding") {
        let slot = 0;
        function controls(rows) {
          for (const r of rows || []) {
            for (const b of r.buttons || []) {
              const currentSlot = slot++,
                index = (row.controls || []).findIndex((c) =>
                  c.slot != null
                    ? c.slot === currentSlot
                    : M.key(c.action) === M.key(b.action),
                );
              const value =
                index < 0
                  ? b
                  : {
                      ...row.controls[index],
                      label: row.controls[index].label.replaceAll(
                        "{label}",
                        b.label,
                      ),
                    };
              entry(
                value,
                index < 0 ? p : [...p, "controls", index],
                depth + (advanced ? 1 : 0),
                {
                  live: { binding: p, action: b.action, slot: currentSlot },
                  pending: index < 0,
                },
              );
            }
            if (r.left) controls([...r.left, ...r.right]);
            if (r.rows) controls(r.rows);
          }
        }
        controls(samples[row.key]);
      }
    });
  }
  walk(screen.rows);
  return entries;
}
