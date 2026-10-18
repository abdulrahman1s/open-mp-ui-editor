/* Native format seam: the existing planner remains the only layout compiler. */
(function (root) {
  "use strict";
  const id = (value) =>
    typeof value === "string" && /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(value);
  const defaults = {
    text: "",
    color: "#FFFFFFFF",
    font: 1,
    sx: 0.2,
    sy: 1,
    outline: 0,
    selectable: false,
    enabled: true,
    visible: true,
    model: 0,
  };
  const fields = ["id", "kind", "x", "y", "w", "h", ...Object.keys(defaults)];
  function validate(value) {
    const fail = (message) => {
      throw Error(message);
    };
    if (!value || typeof value !== "object" || Array.isArray(value))
      fail("Expected a runtime UI object.");
    for (const key of Object.keys(value))
      if (!["format", "version", "name", "elements"].includes(key))
        fail("Unknown UI property: " + key);
    if (value.format !== "open-mp-ui" || value.version !== 1)
      fail("Expected open-mp-ui version 1.");
    if (!id(value.name))
      fail(
        "UI name must start with a letter and use up to 64 letters, digits, _, . or -.",
      );
    if (new TextEncoder().encode(JSON.stringify(value)).length > 256 * 1024)
      fail("UI exceeds 256 KiB.");
    if (
      !Array.isArray(value.elements) ||
      !value.elements.length ||
      value.elements.length > 128
    )
      fail("Use 1–128 native primitives.");
    const seen = new Set();
    const elements = value.elements.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        fail("Invalid primitive.");
      for (const key of Object.keys(raw))
        if (!fields.includes(key)) fail("Unknown element property: " + key);
      const e = { ...defaults, ...raw };
      if (!id(e.id) || seen.has(e.id))
        fail("Invalid or duplicate element ID: " + e.id);
      seen.add(e.id);
      if (!["text", "rect", "sprite", "model"].includes(e.kind))
        fail("Unsupported primitive: " + e.kind);
      if (
        !["x", "y", "w", "h", "sx", "sy"].every(
          (k) => typeof e[k] === "number" && Number.isFinite(e[k]),
        ) ||
        e.x < 0 ||
        e.y < 0 ||
        e.w <= 0 ||
        e.h <= 0 ||
        e.x + e.w > 640.01 ||
        e.y + e.h > 448.01
      )
        fail(e.id + ": bounds must fit 640 × 448.");
      if (typeof e.color !== "string" || !/^#[\da-f]{8}$/i.test(e.color))
        fail(e.id + ": color must be #RRGGBBAA.");
      if (
        !Number.isInteger(e.font) ||
        e.font < 0 ||
        e.font > 3 ||
        e.sx < 0.01 ||
        e.sx > 4 ||
        e.sy < 0.01 ||
        e.sy > 10 ||
        !Number.isInteger(e.outline) ||
        e.outline < 0 ||
        e.outline > 8
      )
        fail(e.id + ": invalid typography.");
      if (
        typeof e.text !== "string" ||
        e.text.length > 512 ||
        /[^\x20-\x7e]/.test(e.text)
      )
        fail(
          e.id +
            ": use at most 512 printable ASCII characters; split lines into elements.",
        );
      if (e.kind === "text" && (!e.text || /[~%{}]/.test(e.text)))
        fail(e.id + ": text must be nonempty plain text without ~ % { }.");
      if (
        e.kind === "sprite" &&
        (!/^[A-Za-z0-9_]+:[A-Za-z0-9_]+$/.test(e.text) || e.text.length > 96)
      )
        fail(e.id + ": sprite must use library:texture.");
      for (const k of ["selectable", "enabled", "visible"])
        if (typeof e[k] !== "boolean") fail(e.id + ": invalid " + k);
      if (
        !Number.isInteger(e.model) ||
        e.model < 0 ||
        e.model > 65535 ||
        (e.kind === "model" && e.model > 20000)
      )
        fail(e.id + ": invalid model.");
      return e;
    });
    return { ...value, elements };
  }
  const at = (screen, path) => path?.reduce((n, k) => n?.[k], screen.rows);
  function exportScreen(document, name, state = "default") {
    root.UiDocument.validate(document);
    const screen = root.UiDocument.clone(document.screens[name]);
    if (!screen) throw Error("Select a screen to export.");
    screen.samples ||= {};
    screen.samples._variables = {
      ...screen.samples._variables,
      "ui.state": state,
    };
    const plan = root.UiDocument.plan(screen),
      warnings = [];
    const errors = plan.issues.filter(
      (s) => /too narrow|exceeds|outside/.test(s) && !/64-widget/.test(s),
    );
    if (errors.length) throw Error(errors.join(" "));
    if (!screen.native)
      warnings.push(
        "Current screen/state exported. Live values are frozen to samples; update text from Pawn.",
      );
    warnings.push(
      "Preview uses GTA fonts and cached sprites. Verify final rendering and 3D models in-game.",
    );
    const elements = [],
      count = new Map();
    const nextId = (base) => {
      const n = count.get(base) || 0;
      count.set(base, n + 1);
      return n ? `${base}.part${n}` : base;
    };
    for (const [index, s] of plan.shapes.entries()) {
      const node = at(screen, s.path),
        base = s.native?.id || node?.id || "element" + index;
      let e = {
        ...defaults,
        id: nextId(base),
        kind: s.kind,
        x: s.x,
        y: s.y,
        w:
          s.w ??
          Math.min(640 - s.x, Math.max(1, (s.text?.length || 1) * s.sx * 24)),
        h: s.h ?? Math.max(1, 10 * (s.sy || 1)),
        color: s.color || "#FFFFFFFF",
      };
      if (s.kind === "text")
        Object.assign(e, {
          text: s.text || " ",
          font: s.font,
          sx: s.sx,
          sy: s.sy,
          outline: s.outline,
        });
      if (s.kind === "sprite") e.text = s.texture;
      if (s.kind === "model") e.model = s.model;
      if (s.kind === "native_box")
        Object.assign(e, { kind: "rect", h: 9 * s.sy });
      if (s.native) {
        const properties = { ...s.native };
        delete properties.x;
        delete properties.y;
        delete properties.w;
        delete properties.h;
        e = {
          ...e,
          ...properties,
          id: s.native.id,
          x: s.x,
          y: s.y,
          w: s.w,
          h: s.h,
        };
        if (s.kind === "text") Object.assign(e, { sx: s.sx, sy: s.sy });
      }
      elements.push(e);
    }
    // Native sprites give exact rectangular click bounds without textdraw-ID boilerplate.
    const clicked = new Set();
    for (const h of plan.hits.filter((h) => h.button)) {
      const b = at(screen, h.path);
      const button = b?.action ? b : null;
      if (!button)
        throw Error("Materialize live binding controls before export.");
      if (button.on_click?.kind === "none" || button.hidden) continue;
      const key =
        button.id ||
        (/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(button.action)
          ? button.action
          : null);
      if (!key) throw Error("Assign a unique Element ID to every button.");
      if (clicked.has(key))
        throw Error("Duplicate interactive Element ID: " + key);
      clicked.add(key);
      // Put hit primitives below captions, so hover tint cannot obscure the label.
      const background = elements.find(
        (e) => e.id === key && e.kind === "rect",
      );
      if (background)
        Object.assign(background, {
          selectable: true,
          enabled: button.enabled !== false,
          w: h.w,
          h: h.h,
          x: h.x,
          y: h.y,
        });
      else {
        if (elements.some((e) => e.id === key))
          for (const e of elements) if (e.id === key) e.id = key + ".caption";
        const target = {
          ...defaults,
          id: key,
          kind: "rect",
          x: h.x,
          y: h.y,
          w: h.w,
          h: h.h,
          color: "#FFFFFF00",
          selectable: true,
          enabled: button.enabled !== false,
        };
        const caption = elements.findIndex((e) => e.id === key + ".caption");
        elements.splice(caption < 0 ? elements.length : caption, 0, target);
      }
    }
    return {
      definition: validate({
        format: "open-mp-ui",
        version: 1,
        name,
        elements,
      }),
      warnings: [...new Set([...warnings, ...plan.issues])],
    };
  }
  function importDefinition(value) {
    const d = validate(value);
    return root.UiDocument.validate({
      version: 1,
      screens: {
        [d.name]: {
          title: d.name,
          width: 640,
          compact: true,
          native: true,
          placement: { kind: "at", x: 0, y: 0 },
          rows: d.elements.map((e) => ({ type: "native", element: e })),
        },
      },
    });
  }
  root.OpenMpExport = { validate, exportScreen, importDefinition };
  if (typeof module !== "undefined") module.exports = root.OpenMpExport;
})(globalThis);
