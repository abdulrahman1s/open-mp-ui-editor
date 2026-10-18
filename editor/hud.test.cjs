const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { inflateSync } = require("node:zlib");
const hud = import("./frontend/editor/hud.mjs");
function png(name) {
  const file = readFileSync(`${__dirname}/textures/hud/reference-${name}.png`);
  const width = file.readUInt32BE(16), height = file.readUInt32BE(20);
  let at = 8, chunks = [];
  while (at + 12 <= file.length) {
    const length = file.readUInt32BE(at);
    if (file.toString("ascii", at + 4, at + 8) === "IDAT") chunks.push(file.subarray(at + 8, at + 8 + length));
    at += length + 12;
  }
  const pixels = inflateSync(Buffer.concat(chunks));
  return { width, height, pixel(x, y) { return [...pixels.subarray(y * (width * 4 + 1) + 1 + x * 4, y * (width * 4 + 1) + 5 + x * 4)]; } };
}
test("HUD matches the supplied client capture at its original resolution", async () => {
  const { HUD, hudLayout } = await hud;
  const layout = hudLayout(3839, 2159, "gameplay");
  assert.equal(layout.length, 4);
  for (const { name, x, y, w, h } of layout) assert.deepEqual({ x, y, w, h }, HUD[name]);
  // Independent measurements: health above the menu; radar near lower-left.
  assert.deepEqual(layout.find(s => s.name === "health"), {
    name: "health", image: "textures/hud/reference-health.png", x: 3277, y: 323, w: 371, h: 43,
  });
  assert.equal(layout.find(s => s.name === "radar").x, 176);
});
test("menu capture shows only health and both modes keep identical health placement", async () => {
  const { hudLayout } = await hud;
  for (const [w, h] of [[3839, 2159], [1920, 1080], [640, 480], [3440, 1440]]) {
    const menu = hudLayout(w, h), play = hudLayout(w, h, "gameplay");
    assert.deepEqual(menu.map(s => s.name), ["health"]);
    assert.deepEqual(menu[0], play.find(s => s.name === "health"));
    const radar = play.find(s => s.name === "radar");
    assert.ok(Math.abs(radar.w / radar.h - 493 / 482) < 1e-10);
    assert.ok(Math.abs((h - radar.y - radar.h) / h - 96 / 2159) < 1e-10);
  }
});
test("reference assets contain transparent backgrounds and captured HUD colors", async () => {
  const { HUD } = await hud;
  for (const name of ["radar", "player", "money", "health"]) {
    const asset = png(name);
    assert.equal(asset.width, HUD[name].w);
    assert.equal(asset.height, HUD[name].h);
    if (name !== "health") assert.equal(asset.pixel(0, 0)[3], 0);
  }
  assert.deepEqual(png("health").pixel(100, 20), [190, 36, 41, 255]);
  assert.deepEqual(png("money").pixel(100, 50), [61, 106, 51, 255]);
});
test("HUD opacity defaults to the reference appearance and supports zero", async () => {
  const { hudOpacity } = await hud;
  assert.equal(hudOpacity(), 100);
  assert.equal(hudOpacity(0), 0);
  assert.equal(hudOpacity("50"), 50);
  assert.equal(hudOpacity(1000), 100);
  assert.equal(hudOpacity(-20), 0);
  assert.equal(hudOpacity("oops"), 100);
});
