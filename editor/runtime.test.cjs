const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
require("./public-preview.js");
require("./defaults.js");
require("./sprites.js");
const M = require("./model.js"),
  S = require("./stylesheet.js"),
  E = require("./shared-export.js");
const Ajv = require("ajv/dist/2020");
const schema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../shared/ui.schema.json")),
);
const validate = new Ajv({ strict: false }).compile(schema);
test("every public example round trips through import, CSS, planner and export with native properties intact", () => {
  for (const file of fs.readdirSync(path.join(__dirname, "../examples"))) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../examples", file)),
      ),
      expected = E.validate(raw);
    assert.ok(validate(raw), JSON.stringify(validate.errors));
    const doc = E.importDefinition(raw);
    M.validate(doc);
    const compiled = S.parse(S.stringify(doc));
    const { definition } = E.exportScreen(compiled, raw.name);
    assert.deepEqual(definition, expected);
  }
});
test("flow layout buttons export stable IDs and actual native hit geometry", () => {
  const doc = {
    version: 1,
    screens: {
      Panel: {
        title: "Choose",
        width: 240,
        compact: true,
        placement: { kind: "at", x: 100, y: 100 },
        rows: [
          {
            type: "buttons",
            buttons: [
              {
                id: "accept",
                label: "Accept",
                action: "Submit",
                style: { background_color: "#001122FF", height: 24 },
              },
              { id: "cancel", label: "Cancel", action: "Back" },
            ],
          },
        ],
      },
    },
  };
  const { definition } = E.exportScreen(doc, "Panel");
  for (const key of ["accept", "cancel"])
    assert.equal(
      definition.elements.find((e) => e.id === key).selectable,
      true,
    );
  const copy = M.clone(doc);
  copy.screens.Panel.rows[0].buttons[1].id = "accept";
  assert.throws(() => E.exportScreen(copy, "Panel"), /Duplicate|duplicate/);
});
test("strict validator rejects unknown fields, bad geometry, duplicate IDs and unsupported native text", () => {
  const base = E.exportScreen(DEFAULT_UI, "Login").definition;
  for (const change of [
    (d) => (d.version = 2),
    (d) => (d.url = "http://bad"),
    (d) => d.elements.push(d.elements[0]),
    (d) => (d.elements[0].x = -1),
    (d) => (d.elements[0].w = NaN),
    (d) => (d.elements[0].color = "#fff"),
    (d) => (d.elements[0].script = "x"),
    (d) => (d.elements[0].enabled = "yes"),
    (d) => (d.elements[1].text = "~r~oops"),
    (d) => (d.elements[1].text = "é"),
    (d) => (d.elements[0].model = 65536),
  ]) {
    const d = M.clone(base);
    change(d);
    assert.throws(() => E.validate(d));
  }
});
test("native import preserves independent style, selection and visibility under group transforms", () => {
  const d = E.importDefinition({
    format: "open-mp-ui",
    version: 1,
    name: "Test",
    elements: [
      {
        id: "button",
        kind: "text",
        x: 20,
        y: 30,
        w: 80,
        h: 24,
        text: "Click",
        sx: 0.3,
        sy: 1.7,
        font: 2,
        outline: 2,
        visible: false,
        enabled: false,
        selectable: true,
      },
    ],
  });
  const row = d.screens.Test.rows[0];
  d.screens.Test.rows = [
    { type: "transform", x: 10, y: 5, scale_x: 1, scale_y: 1, rows: [row] },
  ];
  const e = E.exportScreen(d, "Test").definition.elements[0];
  assert.deepEqual(
    [e.id, e.x, e.y, e.visible, e.enabled, e.selectable, e.sx],
    ["button", 30, 35, false, false, true, 0.3],
  );
});
