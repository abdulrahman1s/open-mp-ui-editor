// Original procedural preview, without embedded game fonts or texture bitmaps.
globalThis.OPEN_MP_EDITOR = true;
globalThis.UI_VOCABULARY = {
  actions: { Submit: [], Back: [], Close: [] },
  screens: [],
};
globalThis.UI_VARIABLES = [];
globalThis.UI_PREVIEW_STATES = {};
(function (root) {
  class PublicRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.gl = canvas.getContext("2d", { alpha: true });
      this.ready = false;
    }
    async load() {
      this.ready = true;
    }
    draw(plan, width = 1920, height = 1080, baseHeight = 448, raster = null) {
      this.lastDraw = [plan, width, height, baseHeight, raster];
      const c = this.canvas,
        g = this.gl;
      c.width = raster?.width ?? width;
      c.height = raster?.height ?? height;
      g.setTransform(c.width / 640, 0, 0, c.height / baseHeight, 0, 0);
      g.clearRect(0, 0, 640, baseHeight);
      for (const s of plan.shapes) {
        if (s.native?.visible === false) continue;
        g.fillStyle = s.color || "#FFFFFFFF";
        if (s.kind === "text") {
          g.save();
          g.translate(s.x, s.y);
          g.scale(s.sx * 4, s.sy);
          g.font = `${s.font === 3 ? "bold " : ""}10px Arial, sans-serif`;
          g.textBaseline = "top";
          if (s.outline) {
            g.strokeStyle = "#000";
            g.lineWidth = s.outline / 2;
            g.strokeText(s.text, 0, 0);
          }
          g.fillText(s.text, 0, 0);
          g.restore();
        } else if (
          s.kind === "rect" ||
          s.kind === "native_box" ||
          (s.kind === "sprite" &&
            ["LD_SPAC:white", "LD_SPAC:black"].includes(s.texture))
        ) {
          if (s.texture === "LD_SPAC:black")
            g.fillStyle = "#000000" + s.color.slice(-2);
          g.fillRect(s.x, s.y, s.w, s.h ?? 9 * s.sy);
        } else {
          g.fillStyle = "#46596566";
          g.fillRect(s.x, s.y, s.w, s.h);
          g.strokeStyle = "#9CABBA";
          g.strokeRect(s.x, s.y, s.w, s.h);
          g.fillStyle = "#DFE8F0";
          g.font = "6px Arial";
          g.fillText(
            s.kind === "model" ? `Model ${s.model}` : s.texture,
            s.x + 2,
            s.y + 2,
            s.w - 4,
          );
        }
      }
    }
    capture() {
      if (!this.lastDraw) throw Error("Preview is not ready.");
      const last = this.lastDraw;
      try {
        this.draw(...last.slice(0, 4));
        return this.canvas.toDataURL("image/png");
      } finally {
        this.draw(...last);
      }
    }
  }
  root.GameRenderer = PublicRenderer;
})(globalThis);
