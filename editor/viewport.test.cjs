const { test } = require("node:test");
const assert = require("node:assert/strict");
require("./tests/fixtures/actions.js");
require("./tests/fixtures/defaults.js");
require("./game-fonts.js");
require("./webgl.js");
const viewport = import("./frontend/editor/viewport.mjs");

test("preview zoom preserves client aspect ratios and never edits the UI document", async () => {
  const { viewportLayout, zoomToBounds, aspectLabel } = await viewport;
  const source = JSON.stringify(DEFAULT_UI),
    area = { width: 1200, height: 740 };
  for (const resolution of ["1920,1080", "1280,960", "2560,1440", "640,480"]) {
    for (const zoom of ["fit", "0.25", "1", "2", "8"]) {
      const frame = viewportLayout(resolution, zoom, area);
      assert.ok(
        Math.abs(
          frame.displayWidth / frame.displayHeight - frame.width / frame.height,
        ) < 1e-10,
      );
      if (zoom !== "fit")
        assert.equal(frame.displayWidth, frame.width * Number(zoom));
    }
  }
  assert.equal(aspectLabel("1920,1080"), "1920 × 1080 · 16:9");
  assert.equal(aspectLabel("1280,960"), "1280 × 960 · 4:3");
  const zoom = zoomToBounds({ w: 276, h: 260 }, "1920,1080", area);
  assert.ok(((276 * 1920) / 640) * zoom <= area.width - 100 + 1e-6);
  assert.ok(((260 * 1080) / 448) * zoom <= area.height - 100 + 1e-6);
  assert.equal(JSON.stringify(DEFAULT_UI), source);
});
test("preview raster follows physical display pixels and scales proportionally within GPU limits", async () => {
  const { rasterSize } = await viewport;
  assert.deepEqual(rasterSize(960, 540, 2), { width: 1920, height: 1080 });
  assert.deepEqual(rasterSize(1920, 1080, 2), { width: 3840, height: 2160 });
  const huge = rasterSize(15360, 8640, 3, 4096);
  assert.ok(huge.width <= 4096 && huge.height <= 4096);
  assert.ok(huge.width * huge.height <= 16_777_216);
  assert.ok(Math.abs(huge.width / huge.height - 16 / 9) < 0.001);
});

test("100% matches the selected game resolution at every browser and display density", async () => {
  const { viewportLayout, rasterSize } = await viewport;
  for (const resolution of ["1920,1080", "1280,960", "2560,1440"]) {
    const [width, height] = resolution.split(",").map(Number);
    for (const density of [1, 1.25, 1.6, 2, 3]) {
      for (const factor of [0.5, 1, 2]) {
        const frame = viewportLayout(
          resolution,
          String(factor),
          { width: 1200, height: 740 },
          density,
        );
        const raster = rasterSize(
          frame.displayWidth,
          frame.displayHeight,
          density,
        );
        assert.equal(frame.displayWidth * density, width * factor);
        // The largest 2x 1440p case stays within the renderer's pixel budget.
        assert.deepEqual(raster, {
          width: width * factor,
          height: height * factor,
        });
      }
    }
  }
});

function graphics() {
  const calls = { vertices: [], viewport: [], mipmaps: 0, filters: [] };
  const gl = new Proxy(
    {
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      createTexture: () => ({}),
      getAttribLocation: () => 0,
      getUniformLocation: (_, key) => key,
      viewport: (...values) => calls.viewport.push(values),
      bufferData: (_, values) => calls.vertices.push([...values]),
      generateMipmap: () => calls.mipmaps++,
      texParameteri: (...values) => calls.filters.push(values),
    },
    {
      get(target, key) {
        return key in target
          ? target[key]
          : String(key).toUpperCase() === key
            ? key
            : () => {};
      },
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => gl,
    toDataURL() {
      return `${this.width}x${this.height}`;
    },
  };
  return { renderer: new GameRenderer(canvas), canvas, calls };
}
test("high DPI rendering preserves font and native box geometry; PNG export restores the view", async () => {
  const previousImage = globalThis.Image;
  globalThis.Image = class {
    width = 512;
    height = 512;
    set src(_) {
      queueMicrotask(() => this.onload());
    }
  };
  try {
    const { renderer, calls, canvas } = graphics();
    await renderer.load(GAME_FONTS);
    assert.equal(calls.mipmaps, 2);
    assert.ok(
      calls.filters.some(
        ([, parameter, value]) =>
          parameter === "TEXTURE_MIN_FILTER" &&
          value === "LINEAR_MIPMAP_LINEAR",
      ),
    );
    const plan = {
      shapes: [
        { kind: "native_box", x: 100, y: 90, w: 90, sy: 1, color: "#FFFFFFFF" },
        {
          kind: "text",
          x: 105,
          y: 92,
          font: 1,
          sx: 0.2,
          sy: 1,
          outline: 1,
          text: "Radio",
          color: "#E1E1C5FF",
        },
      ],
    };
    renderer.draw(plan, 1920, 1080, 448);
    const native = calls.vertices.slice();
    calls.vertices.length = 0;
    renderer.draw(plan, 1920, 1080, 448, { width: 3840, height: 2160 });
    assert.deepEqual(calls.vertices, native);
    assert.deepEqual([canvas.width, canvas.height], [3840, 2160]);
    assert.equal(renderer.capture(), "1920x1080");
    assert.deepEqual([canvas.width, canvas.height], [3840, 2160]);
    assert.deepEqual(calls.viewport.at(-1), [0, 0, 3840, 2160]);
  } finally {
    globalThis.Image = previousImage;
  }
});
