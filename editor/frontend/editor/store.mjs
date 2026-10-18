import {
  M,
  L,
  H,
  defaults,
  isButton,
  same,
  ensureTransform,
} from "./native.mjs";
import { previewScreen } from "./preview.mjs";

export const DRAFT = "open-mp.ui-editor.v1";
export function createEditorStore({ document = defaults, storage } = {}) {
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage;
    } catch {
      storage = null;
    }
  }
  const read = (key) => {
    try {
      return JSON.parse(storage?.getItem(key) || "null");
    } catch {
      return null;
    }
  };
  let recovered = false;
  try {
    const draft = read(DRAFT);
    if (draft) {
      document = M.validate(draft);
      recovered = true;
    }
  } catch {
    /* Invalid drafts never replace defaults. */
  }
  const prefs = read(DRAFT + ".view") || {};
  let value = {
    document: M.clone(document),
    committedValue: JSON.stringify(document),
    screenName: document.screens[prefs.screen]
      ? prefs.screen
      : Object.keys(document.screens)[0],
    state: "default",
    selected: null,
    multi: [],
    version: 0,
    message: "",
    editing: null,
  };
  const context = () => ({
    screenName: value.screenName,
    state: value.state,
    selected: value.selected,
    multiSelection: value.multi,
  });
  const timeline = H.create(
    { value: JSON.stringify(value.document), context: context() },
    { limit: 100, saved: read(DRAFT + ".history") },
  );
  const listeners = new Set();
  let committed = JSON.stringify(value.document),
    persistTimer;
  const publish = (patch) => {
    value = { ...value, ...patch, version: value.version + 1 };
    for (const listener of listeners) listener();
  };
  function persist() {
    clearTimeout(persistTimer);
    try {
      storage?.setItem(DRAFT, committed);
      storage?.setItem(DRAFT + ".history", JSON.stringify(timeline.snapshot()));
    } catch {
      /* A full browser quota must not lose the open document. */
    }
  }
  function commit(next, nextContext = context(), entry = {}) {
    M.validate(next);
    const json = JSON.stringify(next);
    if (json !== committed) timeline.commit(json, nextContext, entry);
    committed = json;
    publish({
      document: next,
      committedValue: committed,
      ...{
        screenName: nextContext.screenName,
        state: nextContext.state,
        selected: nextContext.selected,
        multi: nextContext.multiSelection || [],
      },
    });
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persist, 200);
  }
  const store = {
    recovered,
    prefs,
    timeline,
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    persist,
    notify(message) {
      publish({ message });
    },
    breakGroup() {
      timeline.breakGroup();
    },
    edit(recipe, { label = "Edit layer", mergeKey = null } = {}) {
      timeline.capture(context());
      const next = M.clone(value.document),
        nextContext = M.clone(context());
      try {
        recipe(next.screens[value.screenName], nextContext, next);
        commit(next, nextContext, { label, mergeKey });
        return true;
      } catch (error) {
        store.notify(error.message);
        return false;
      }
    },
    // Pointer gestures publish a preview, then commit once or restore atomically.
    gesture() {
      timeline.capture(context());
      timeline.breakGroup();
      const before = value.document,
        startContext = M.clone(context()),
        working = M.clone(before);
      let closed = false;
      return {
        document: working,
        context: M.clone(startContext),
        preview() {
          if (closed) return;
          try {
            // Source and inspector consumers require valid documents, even
            // during a drag. Keep the last valid frame if a limit is exceeded.
            M.validate(working);
            publish({ document: M.clone(working) });
          } catch (error) {
            if (value.message !== error.message) store.notify(error.message);
          }
        },
        finish(label) {
          if (closed) return;
          closed = true;
          try {
            commit(working, context(), { label });
          } catch (e) {
            publish({
              document: before,
              selected: startContext.selected,
              multi: startContext.multiSelection,
            });
            store.notify(e.message);
          }
        },
        cancel() {
          if (closed) return;
          closed = true;
          publish({
            document: before,
            selected: startContext.selected,
            multi: startContext.multiSelection,
          });
        },
      };
    },
    select(path, event = {}, advanced = false) {
      if (path && !advanced) {
        const node = L.get(value.document.screens[value.screenName], path);
        if (node?.type === "buttons" && node.buttons.length === 1)
          path = [...path, "buttons", 0];
        else if (
          node?.type === "transform" &&
          node.rows.length === 1 &&
          node.rows[0].type === "buttons" &&
          node.rows[0].buttons.length === 1
        )
          path = [...path, "rows", 0, "buttons", 0];
      }
      let multi = path ? [path] : [];
      if (path && (event.ctrlKey || event.metaKey)) {
        multi = value.multi.some((p) => same(p, path))
          ? value.multi.filter((p) => !same(p, path))
          : [...value.multi, path];
        path = multi.at(-1) || null;
      } else if (
        path &&
        event.shiftKey &&
        value.selected &&
        same(path.slice(0, -1), value.selected.slice(0, -1)) &&
        Number.isInteger(path.at(-1))
      ) {
        const a = Math.min(path.at(-1), value.selected.at(-1)),
          b = Math.max(path.at(-1), value.selected.at(-1));
        multi = Array.from({ length: b - a + 1 }, (_, i) => [
          ...path.slice(0, -1),
          a + i,
        ]);
      }
      publish({ selected: path, multi });
      timeline.capture(context());
      timeline.breakGroup();
      return path;
    },
    materialize(path, action, slot) {
      const binding = L.get(value.document.screens[value.screenName], path),
        index =
          binding.controls?.findIndex((b) =>
            b.slot != null
              ? b.slot === slot
              : M.key(b.action) === M.key(action),
          ) ?? -1;
      if (index >= 0) return [...path, "controls", index];
      let nextPath;
      store.edit(
        (screen) => {
          const row = L.get(screen, path);
          row.controls ||= [];
          nextPath = [...path, "controls", row.controls.length];
          row.controls.push({
            action: M.clone(action),
            slot,
            label: "{label}",
          });
        },
        { label: "Customize live button" },
      );
      return nextPath;
    },
    navigate(screenName, state = "default") {
      publish({ screenName, state, selected: null, multi: [], editing: null });
      timeline.capture(context());
      timeline.breakGroup();
    },
    restore(index) {
      const entry =
        index === "undo"
          ? timeline.undo()
          : index === "redo"
            ? timeline.redo()
            : timeline.jump(index);
      if (!entry) return;
      committed = entry.value;
      const document = JSON.parse(committed),
        c = entry.context;
      let selected = c.selected;
      try {
        if (selected && !L.get(document.screens[c.screenName], selected))
          selected = null;
      } catch {
        selected = null;
      }
      publish({
        document,
        committedValue: committed,
        screenName: c.screenName,
        state: c.state,
        selected,
        multi: selected ? c.multiSelection || [selected] : [],
        editing: null,
      });
      persist();
    },
    replace(document, { reset = false, label = "Open stylesheet" } = {}) {
      M.validate(document);
      const name = document.screens[value.screenName]
        ? value.screenName
        : Object.keys(document.screens)[0];
      if (reset)
        timeline.reset(JSON.stringify(document), {
          screenName: name,
          state: "default",
          selected: null,
          multiSelection: [],
        });
      commit(
        document,
        {
          screenName: name,
          state: "default",
          selected: null,
          multiSelection: [],
        },
        { label },
      );
    },
    editText(path) {
      publish({ editing: { path, id: Date.now() } });
      timeline.breakGroup();
    },
    closeText() {
      publish({ editing: null });
    },
    layer(operation, argument) {
      store.edit(
        (screen, c) => {
          L.checkUnlocked(screen, value.multi);
          if (operation === "delete") {
            L.remove(screen, value.multi);
            c.selected = null;
            c.multiSelection = [];
          }
          if (operation === "duplicate") {
            c.multiSelection = L.duplicateAll(screen, value.multi);
            c.selected = c.multiSelection.at(-1);
          }
          if (operation === "step") {
            c.selected =
              L.step(screen, value.selected, argument) || value.selected;
            c.multiSelection = [c.selected];
          }
          if (operation === "group") {
            const paths = groupTargets(screen, value.multi);
            if (!paths) return;
            c.selected = L.group(screen, paths);
            c.multiSelection = [c.selected];
          }
          if (operation === "ungroup") {
            L.ungroup(screen, value.selected);
            c.selected = null;
            c.multiSelection = [];
          }
          if (operation === "nudge") {
            const node = L.get(screen, value.selected),
              target = isButton(node)
                ? M.buttonPosition(node, value.state)
                : ensureTransform(screen, value.selected);
            const pos = {
              x: (target.x ?? 0) + argument.x,
              y: (target.y ?? 0) + argument.y,
            };
            if (isButton(node)) M.setButtonPosition(node, value.state, pos);
            else Object.assign(target, pos);
          }
        },
        {
          label: {
            delete: "Delete layers",
            duplicate: "Duplicate layers",
            group: "Group layers",
            ungroup: "Ungroup layers",
            step: "Reorder layer",
            nudge: "Nudge layer",
          }[operation],
          mergeKey:
            operation === "nudge"
              ? "nudge:" +
                value.screenName +
                value.state +
                JSON.stringify(value.selected)
              : null,
        },
      );
    },
    insert(row) {
      if (
        value.document.screens[value.screenName].native &&
        row.type === "sprite"
      ) {
        const used = JSON.stringify(value.document);
        let i = 1;
        while (used.includes('"sprite' + i + '"')) i++;
        row = {
          type: "native",
          element: {
            id: "sprite" + i,
            kind: "sprite",
            x: 40,
            y: 40,
            w: row.width,
            h: row.height,
            text: row.texture,
            color: row.color,
            font: 1,
            sx: 0.2,
            sy: 1,
            outline: 0,
            selectable: false,
            enabled: true,
            visible: true,
            model: 0,
          },
        };
      }
      store.edit(
        (screen, c) => {
          if (value.selected && L.state(screen, value.selected).locked)
            throw Error("Unlock the layer before adding elements here.");
          let path = [],
            index = screen.rows.length;
          if (value.selected) {
            let p = value.selected;
            while (
              isButton(L.get(screen, p)) ||
              ["buttons", "controls"].includes(p.at(-1))
            )
              p = p.slice(0, -1);
            const node = L.get(screen, p);
            if (Array.isArray(node)) {
              path = p;
              index = node.length;
            } else {
              path = p.slice(0, -1);
              index = p.at(-1) + 1;
            }
          }
          L.get(screen, path).splice(index, 0, row);
          c.selected =
            row.type === "buttons"
              ? [...path, index, "buttons", 0]
              : [...path, index];
          c.multiSelection = [c.selected];
        },
        { label: row.type === "buttons" ? "Add button" : `Add ${row.type}` },
      );
    },
    add(type) {
      if (
        value.document.screens[value.screenName].native &&
        ["text", "buttons", "rectangle", "preview"].includes(type)
      ) {
        const kind =
          type === "rectangle" || type === "buttons"
            ? "rect"
            : type === "preview"
              ? "model"
              : "text";
        const used = JSON.stringify(value.document);
        let i = 1;
        while (used.includes('"item' + i + '"')) i++;
        store.insert({
          type: "native",
          element: {
            id: "item" + i,
            kind,
            x: 40,
            y: 40,
            w: 120,
            h: 20,
            text: kind === "text" ? "New text" : "",
            color: "#FFFFFFFF",
            font: 1,
            sx: 0.2,
            sy: 1,
            outline: 0,
            selectable: type === "buttons",
            enabled: true,
            visible: true,
            model: 562,
          },
        });
        return;
      }
      const offered = M.interactionChoices(
        previewScreen(value.document, value.screenName, value.state),
      ).find((c) => c.button.enabled !== false);
      const row =
        type === "buttons"
          ? {
              type,
              buttons: [
                {
                  label: "Button",
                  action: offered?.button.action || "Back",
                  ...(offered ? { on_click: offered.target } : {}),
                },
              ],
            }
          : type === "rectangle"
            ? {
                type: "sprite",
                texture: "LD_SPAC:white",
                width: 80,
                height: 40,
                color: M.ACCENT,
              }
            : {
                text: { type, text: "New text", color: M.TEXT },
                columns: { type, left: [], right: [], left_width: 0 },
                binding: { type, key: "status" },
                section: { type, key: "status", rows: [] },
                rule: { type },
                gap: { type, height: 8 },
                preview: { type, model: 562 },
              }[type];
      if (row) store.insert(row);
    },
  };
  return store;
}
export function groupTargets(screen, paths) {
  const result = [];
  for (const path of paths) {
    let target = L.owner(screen, path);
    if (!target) return null;
    if (isButton(L.get(screen, target))) {
      const parent = target.slice(0, -1),
        buttons = L.get(screen, parent);
      if (!buttons.every((_, i) => paths.some((p) => same(p, [...parent, i]))))
        return null;
      target = L.owner(screen, target.slice(0, -2));
    }
    if (!result.some((p) => same(p, target))) result.push(target);
  }
  return result.length &&
    result.every(
      (p) =>
        Number.isInteger(p.at(-1)) &&
        same(p.slice(0, -1), result[0].slice(0, -1)),
    )
    ? result
    : null;
}
