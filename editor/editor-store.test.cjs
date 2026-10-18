const { test } = require("node:test");
const assert = require("node:assert/strict");
require("./tests/fixtures/actions.js");
require("./tests/fixtures/defaults.js");
require("./tests/fixtures/variables.js");
require("./tests/fixtures/states.js");
require("./model.js");
require("./layers.js");
require("./history.js");
require("./resize.js");
require("./guides.js");
require("./canvas-text.js");
const modules = Promise.all([
  import("./frontend/editor/store.mjs"),
  import("./frontend/editor/gesture.mjs"),
  import("./frontend/editor/preview.mjs"),
  import("./frontend/editor/layer-tree.mjs"),
]);
function memory() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("React store edits are immutable, validated, grouped and restored with selection", async () => {
  const [{ createEditorStore }] = await modules,
    store = createEditorStore({ storage: memory() });
  store.select([0]);
  const before = store.getSnapshot().document;
  store.edit(
    (s) => {
      s.rows[0].text = "A";
    },
    { label: "Edit text", mergeKey: "text" },
  );
  store.edit(
    (s) => {
      s.rows[0].text = "AB";
    },
    { label: "Edit text", mergeKey: "text" },
  );
  assert.equal(before.screens.Auth.rows[0].text, "San Andreas Life");
  assert.equal(store.timeline.entries.length, 2);
  store.restore("undo");
  assert.equal(
    store.getSnapshot().document.screens.Auth.rows[0].text,
    "San Andreas Life",
  );
  assert.deepEqual(store.getSnapshot().selected, [0]);
  store.restore("redo");
  assert.equal(store.getSnapshot().document.screens.Auth.rows[0].text, "AB");
  assert.equal(
    store.edit((s) => {
      s.width = -5;
    }),
    false,
  );
  assert.equal(store.getSnapshot().document.screens.Auth.width, 220);
});
test("canvas gestures commit once, cancel cleanly, and isolate button positions by state", async () => {
  const [{ createEditorStore }, { beginGesture }, { previewScreen }] =
      await modules,
    store = createEditorStore({ storage: memory() });
  store.select([5, "buttons", 0]);
  const before = store.getSnapshot().committedValue,
    plan = UiDocument.plan(previewScreen(store.getSnapshot().document, "Auth"));
  const options = {
    plan,
    view: { resize: "resize", projection: "448", smart: false, grid: false },
    point: { x: 0, y: 0 },
    viewportWidth: 1280,
  };
  const cancelled = beginGesture(store, options);
  cancelled.move({ x: 10, y: 5 });
  assert.equal(store.getSnapshot().committedValue, before);
  assert.equal(store.timeline.entries.length, 1);
  cancelled.cancel();
  assert.equal(JSON.stringify(store.getSnapshot().document), before);
  const move = beginGesture(store, options);
  move.move({ x: 10, y: 5 });
  move.move({ x: 20, y: 10 });
  move.finish();
  assert.equal(store.timeline.entries.length, 2);
  const b = store.getSnapshot().document.screens.Auth.rows[5].buttons[0];
  assert.deepEqual(UiDocument.buttonPosition(b, "default"), { x: 20, y: 10 });
  assert.deepEqual(UiDocument.buttonPosition(b, "Register"), { x: 0, y: 0 });
  store.restore("undo");
  assert.equal(store.getSnapshot().committedValue, before);
  store.restore("redo");
  assert.deepEqual(
    UiDocument.buttonPosition(
      store.getSnapshot().document.screens.Auth.rows[5].buttons[0],
      "default",
    ),
    { x: 20, y: 10 },
  );
});
test("west resize keeps the opposite edge and fonts; a click creates no history", async () => {
  const [{ createEditorStore }, { beginGesture }, { previewScreen }] =
      await modules,
    store = createEditorStore({ storage: memory() });
  store.select([5, "buttons", 0]);
  const before = store.getSnapshot().committedValue,
    plan = UiDocument.plan(previewScreen(store.getSnapshot().document, "Auth"));
  const hit = plan.hits.find(
      (h) => JSON.stringify(h.path) === '[5,"buttons",0]',
    ),
    text = plan.shapes.find(
      (s) => s.kind === "text" && s.text.toLowerCase().includes("remember"),
    );
  const options = {
    plan,
    view: { resize: "resize", projection: "448", smart: false, grid: false },
    point: { x: hit.x, y: hit.y },
    viewportWidth: 1280,
    handle: "w",
  };
  const click = beginGesture(store, options);
  click.finish();
  assert.equal(store.getSnapshot().committedValue, before);
  assert.equal(store.timeline.entries.length, 1);
  const resize = beginGesture(store, options);
  resize.move({ x: hit.x + 20, y: hit.y });
  resize.finish();
  const after = UiDocument.plan(
      previewScreen(store.getSnapshot().document, "Auth"),
    ),
    actual = after.hits.find(
      (h) => JSON.stringify(h.path) === '[5,"buttons",0]',
    );
  assert.ok(Math.abs(actual.x + actual.w - hit.x - hit.w) < 0.001);
  assert.equal(actual.w, hit.w - 20);
  const letters = after.shapes.find(
    (s) => s.kind === "text" && s.text.toLowerCase().includes("remember"),
  );
  assert.deepEqual([letters.sx, letters.sy], [text.sx, text.sy]);
});
test("draft/history recovery, individual button layers and live materialization share the store interface", async () => {
  const [{ createEditorStore }, , { previewScreen }, { layerTree }] =
      await modules,
    storage = memory(),
    store = createEditorStore({ storage });
  store.add("text");
  store.persist();
  const recovered = createEditorStore({ storage });
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.timeline.entries.length, 2);
  recovered.restore("undo");
  assert.deepEqual(recovered.getSnapshot().document, DEFAULT_UI);
  const preview = previewScreen(DEFAULT_UI, "Clothing");
  const entries = layerTree(DEFAULT_UI.screens.Clothing, preview, "Clothing");
  assert.ok(entries.some((e) => e.value.action === "Equip"));
  assert.ok(!entries.some((e) => e.value.type === "buttons"));
  store.navigate("Radio");
  const binding = [0, "rows", 6];
  const path = store.materialize(
    binding,
    { RadioChoice: "https://example.com" },
    0,
  );
  const count = store.timeline.entries.length;
  assert.deepEqual(
    store.materialize(binding, { RadioChoice: "https://example.com" }, 0),
    path,
  );
  assert.equal(store.timeline.entries.length, count);
});
