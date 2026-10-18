// View geometry is independent of document geometry. Zoom and pixel density
// never change native coordinates, font sizes, state offsets or history.
export const clampZoom = (value) => Math.max(0.1, Math.min(8, value));

export function viewportLayout(resolution, zoom, area, density = 1) {
  const [width, height] = resolution.split(",").map(Number);
  const fitWidth = Math.min(
    width / density,
    Math.max(100, area.width - 44),
    (Math.max(100, area.height - 44) * width) / height,
  );
  const factor =
    zoom === "fit"
      ? (fitWidth * density) / width
      : clampZoom(Number(zoom) || 1);
  // 100% means one game pixel per physical display pixel. Browser CSS pixels
  // vary with OS scaling and browser zoom, so they cannot define the baseline.
  const displayWidth = (width * factor) / density,
    displayHeight = (height * factor) / density;
  return {
    width,
    height,
    factor,
    fitFactor: (fitWidth * density) / width,
    displayWidth,
    displayHeight,
    top:
      zoom === "fit" ? Math.max(0, (area.height - 44 - displayHeight) / 2) : 0,
  };
}

export function rasterSize(
  width,
  height,
  density = 1,
  maxDimension = 8192,
  maxPixels = 16_777_216,
) {
  const w = Math.max(1, width * density),
    h = Math.max(1, height * density);
  const factor = Math.min(
    1,
    maxDimension / w,
    maxDimension / h,
    Math.sqrt(maxPixels / (w * h)),
  );
  return {
    width: Math.max(1, Math.round(w * factor)),
    height: Math.max(1, Math.round(h * factor)),
  };
}

export function zoomToBounds(
  bounds,
  resolution,
  area,
  projectionHeight = 448,
  density = 1,
) {
  const [width, height] = resolution.split(",").map(Number);
  return clampZoom(
    Math.min(
      (area.width - 100) / ((bounds.w * width) / 640 / density),
      (area.height - 100) / ((bounds.h * height) / projectionHeight / density),
    ),
  );
}

export function aspectLabel(resolution) {
  const [w, h] = resolution.split(",").map(Number);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const divisor = gcd(w, h);
  return `${w} × ${h} · ${w / divisor}:${h / divisor}`;
}
