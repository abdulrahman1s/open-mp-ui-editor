import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  M,
  L,
  R,
  T,
  fonts,
  sprites,
  Renderer,
  defaults,
  same,
} from "./native.mjs";
import { useEditor } from "./EditorProvider";
import { previewScreen } from "./preview.mjs";
import { beginGesture } from "./gesture.mjs";
import { InlineTextEditor } from "./components/InlineTextEditor";
import { usePreviewNavigation } from "./hooks/usePreviewNavigation";
import { rasterSize } from "./viewport.mjs";
import { GameHud } from "./components/GameHud";

for (const name of ["font1", "font2"])
  if (sprites["fonts:" + name] && fonts?.textures[name])
    sprites["fonts:" + name].image = fonts.textures[name];
export function Canvas({ background }) {
  const {
    document: doc,
    screenName,
    state,
    selected,
    multi,
    editing,
    plan,
    error,
    preview,
    store,
    view,
    canvas,
    cancelGesture,
    previewView: frame,
    exportPreview,
  } = useEditor();
  const space = useRef(null),
    viewport = useRef(null),
    renderer = useRef(null),
    gesture = useRef(null);
  const [ready, setReady] = useState(false),
    [renderError, setRenderError] = useState(""),
    [lines, setLines] = useState([]),
    [gridStyle, setGridStyle] = useState({});
  const { width, height, displayWidth, displayHeight } = frame,
    projection = M.viewport(Number(view.projection));
  const navigation = usePreviewNavigation(space, viewport);
  const screen = doc.screens[screenName],
    locked = selected && L.state(screen, selected).locked;
  const hit =
      plan &&
      (selected === null
        ? { x: plan.x, y: plan.y, w: plan.width, h: plan.height }
        : plan.hits.find((h) => same(h.path, selected))),
    resize =
      plan && view.resize === "resize"
        ? R.begin(screen, selected, plan, state)
        : null;
  function finish(cancel = false) {
    if (!gesture.current) return false;
    const current = gesture.current;
    gesture.current = null;
    setLines([]);
    if (cancel) current.cancel();
    else current.finish();
    return true;
  }
  useEffect(() => {
    let alive = true;
    try {
      renderer.current = new Renderer(canvas.current);
      renderer.current
        .load(fonts)
        .then(() => {
          if (alive) setReady(true);
        })
        .catch((e) => {
          if (alive) setRenderError(e.message);
        });
    } catch (e) {
      setRenderError(e.message);
    }
    return () => {
      alive = false;
    };
  }, [canvas]);
  useEffect(() => {
    if (ready && plan) {
      try {
        const maxDimension = Math.min(
          8192,
          globalThis.OPEN_MP_EDITOR
            ? 8192
            : renderer.current.gl.getParameter(
                renderer.current.gl.MAX_RENDERBUFFER_SIZE,
              ),
        );
        const raster = rasterSize(
          displayWidth,
          displayHeight,
          navigation.density,
          maxDimension,
        );
        renderer.current.draw(
          plan,
          width,
          height,
          Number(view.projection),
          raster,
        );
      } catch (e) {
        setRenderError(e.message);
      }
    }
  }, [
    ready,
    plan,
    width,
    height,
    view.projection,
    displayWidth,
    displayHeight,
    navigation.density,
  ]);
  useEffect(() => {
    exportPreview.current = () => renderer.current.capture();
    return () => {
      exportPreview.current = null;
    };
  }, [exportPreview]);
  useLayoutEffect(() => {
    if (!view.grid) return;
    const box = viewport.current.getBoundingClientRect(),
      origin = space.current.getBoundingClientRect(),
      step = Number(view.gridSize);
    setGridStyle({
      // Measure content rather than the previous overlay, so zooming back out
      // also shrinks the scroll area instead of preserving an oversized grid.
      width: Math.max(
        space.current.clientWidth,
        view.zoom === "fit"
          ? viewport.current.offsetLeft + viewport.current.offsetWidth + 20
          : displayWidth + frame.areaWidth + 40,
      ),
      height: Math.max(
        space.current.clientHeight,
        view.zoom === "fit"
          ? viewport.current.offsetTop + viewport.current.offsetHeight + 20
          : displayHeight + frame.areaHeight + 40,
      ),
      backgroundSize: `${(step * box.width) / 640}px ${(step * box.height) / Number(view.projection)}px`,
      backgroundPosition: `${box.left - origin.left + space.current.scrollLeft}px ${box.top - origin.top + space.current.scrollTop}px`,
    });
  }, [
    view.grid,
    view.gridSize,
    view.projection,
    view.zoom,
    displayWidth,
    displayHeight,
    frame.top,
    frame.areaWidth,
    frame.areaHeight,
  ]);
  useEffect(() => {
    const onUp = () => finish(),
      onCancel = () => finish(true);
    cancelGesture.current = onCancel;
    document.addEventListener("pointerup", onUp);
    window.addEventListener("blur", onUp);
    return () => {
      document.removeEventListener("pointerup", onUp);
      window.removeEventListener("blur", onUp);
      cancelGesture.current = null;
      if (gesture.current) gesture.current.cancel();
    };
  }, []);
  const point = (e) => {
    const box = canvas.current.getBoundingClientRect();
    return projection.toUnits(
      e.clientX - box.left,
      e.clientY - box.top,
      box.width,
      box.height,
    );
  };
  function begin(e, handle = null) {
    const current = store.getSnapshot(),
      currentPreview = previewScreen(
        current.document,
        current.screenName,
        current.state,
      );
    gesture.current = beginGesture(store, {
      plan: M.plan(currentPreview),
      view,
      point: point(e),
      handle,
      viewportWidth: canvas.current.getBoundingClientRect().width,
    });
    if (gesture.current) canvas.current.setPointerCapture(e.pointerId);
  }
  function candidates(pt) {
    return [...plan.hits]
      .reverse()
      .filter(
        (h) =>
          h.path &&
          !L.state(screen, h.path).locked &&
          pt.x >= h.x &&
          pt.x <= h.x + h.w &&
          pt.y >= h.y &&
          pt.y <= h.y + h.h,
      );
  }
  function selectHit(hit, event = {}) {
    return store.select(
      hit.control
        ? store.materialize(
            hit.control.binding,
            hit.control.action,
            hit.control.slot,
          )
        : hit.path,
      event,
      view.advanced,
    );
  }
  function pointerDown(e) {
    if (navigation.startPan(e)) return;
    if (!plan || e.button !== 0) return;
    canvas.current.focus();
    const pt = point(e),
      header =
        pt.x >= plan.x &&
        pt.x <= plan.x + plan.width &&
        pt.y >= plan.y &&
        pt.y < plan.y + (plan.padding + plan.heading) * plan.scale;
    if (header) {
      store.select(null);
      begin(e);
      return;
    }
    const internalFlow = (path) => {
      let value = L.get(screen, path);
      if (value?.type === "transform" && value.rows.length === 1)
        value = value.rows[0];
      return (
        value?.type === "buttons" ||
        (value?.type === "binding" &&
          (preview.samples?.[value.key] || []).some((r) =>
            ["buttons", "columns"].includes(r.type),
          ))
      );
    };
    const hits = candidates(pt).filter(
        (h) => view.advanced || h.button || !internalFlow(h.path),
      ),
      hit = hits.find((h) => h.button) || hits[0];
    if (hit) {
      selectHit(hit, e);
      if (!(e.ctrlKey || e.metaKey || e.shiftKey)) begin(e);
    } else store.select(null);
  }
  function doubleClick(e) {
    if (!plan) return;
    finish();
    const pt = point(e),
      header =
        pt.x >= plan.x &&
        pt.x < plan.x + plan.width - 24 * plan.scale &&
        pt.y >= plan.y &&
        pt.y < plan.y + (plan.padding + plan.heading) * plan.scale;
    if (header) {
      store.select(null);
      store.editText(null);
      return;
    }
    const hits = candidates(pt),
      hit =
        hits.find((h) => h.button) ||
        hits.find((h) =>
          T.begin(screen, h.path, {
            name: screenName,
            defaults: defaults.screens[screenName],
            preview,
          }),
        );
    if (!hit) return;
    const path = selectHit(hit);
    store.editText(path);
  }
  return (
    <>
      <div
        ref={space}
        className={"canvas-space" + (view.grid ? " show-grid" : "")}
      >
        {view.grid && (
          <div
            id="grid-overlay"
            className="grid-overlay"
            style={gridStyle}
            aria-hidden="true"
          />
        )}
        <div
          className="preview-pasteboard"
          style={
            view.zoom === "fit"
              ? undefined
              : {
                  width: displayWidth + frame.areaWidth,
                  height: displayHeight + frame.areaHeight,
                }
          }
        >
          <div
            ref={viewport}
            id="viewport"
            className="viewport"
            style={{
              width: displayWidth,
              maxWidth: "none",
              aspectRatio: `${width}/${height}`,
              marginTop: view.zoom === "fit" ? frame.top : frame.areaHeight / 2,
              marginLeft: view.zoom === "fit" ? undefined : frame.areaWidth / 2,
              marginRight: view.zoom === "fit" ? undefined : 0,
              backgroundImage: background ? `url("${background}")` : undefined,
              backgroundSize: "100% 100%",
            }}
          >
            <div
              className="world-placeholder"
              hidden={Boolean(background)}
              aria-hidden="true"
            />
            <GameHud />
            <canvas
              id="preview"
              ref={canvas}
              tabIndex={0}
              aria-label="GTA TextDraw preview"
              style={{ cursor: navigation.cursor }}
              onPointerDown={pointerDown}
              onDoubleClick={doubleClick}
              onPointerMove={(e) => {
                if (navigation.movePan(e)) return;
                if (gesture.current)
                  setLines(gesture.current.move(point(e), e));
              }}
              onPointerUp={() => {
                if (!navigation.endPan()) finish();
              }}
              onPointerCancel={() => {
                navigation.endPan();
                finish(true);
              }}
            />
            <div id="alignment-guides" aria-hidden="true">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className={"alignment-guide " + line.axis}
                  style={
                    line.axis === "x"
                      ? {
                          left: (line.position / 640) * 100 + "%",
                          top:
                            (Math.max(0, line.start) /
                              Number(view.projection)) *
                              100 +
                            "%",
                          height:
                            ((Math.min(Number(view.projection), line.end) -
                              Math.max(0, line.start)) /
                              Number(view.projection)) *
                              100 +
                            "%",
                        }
                      : {
                          top:
                            (line.position / Number(view.projection)) * 100 +
                            "%",
                          left: (Math.max(0, line.start) / 640) * 100 + "%",
                          width:
                            ((Math.min(640, line.end) -
                              Math.max(0, line.start)) /
                              640) *
                              100 +
                            "%",
                        }
                  }
                />
              ))}
            </div>
            {hit && !editing && (
              <div
                id="selection"
                style={projection.css(hit)}
                data-size={`${Number(hit.w.toFixed(1))} × ${Number(hit.h.toFixed(1))}`}
              >
                {["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => (
                  <button
                    key={handle}
                    className="resize-handle"
                    data-handle={handle}
                    aria-label={"Resize " + handle}
                    title={
                      view.resize === "resize"
                        ? "Resize container; text size stays unchanged"
                        : "Scale container and text"
                    }
                    disabled={
                      Boolean(locked) ||
                      multi.length > 1 ||
                      (view.resize === "resize" &&
                        (!resize ||
                          (/[ew]/.test(handle) && !resize.axes.includes("x")) ||
                          (/[ns]/.test(handle) && !resize.axes.includes("y"))))
                    }
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      begin(e, handle);
                    }}
                  />
                ))}
              </div>
            )}
            <div id="model-markers">
              {plan?.shapes
                .filter((s) => s.kind === "model")
                .map((s, i) => (
                  <div
                    key={i}
                    className="model-marker"
                    style={projection.css(s)}
                  >
                    GTA model {s.model}
                    <br />
                    Client preview required
                  </div>
                ))}
            </div>
            {(renderError || error) && (
              <div id="render-error" role="alert">
                {renderError || error}
              </div>
            )}
            {editing && (
              <InlineTextEditor key={editing.id} viewport={viewport} />
            )}
          </div>
        </div>
      </div>
      <div className="canvas-caption">
        <span id="geometry">
          {error ||
            (plan
              ? `${Math.round(plan.width)} × ${Math.round(plan.height)} panel · ${plan.widgets} / 64 widgets`
              : "Loading GTA fonts…")}
        </span>
        <span id="canvas-hint">
          {editing
            ? "Editing text · Ctrl / ⌘ Enter applies · Esc cancels"
            : locked
              ? "Locked layer · Unlock in Layers"
              : "Drag to move · Double-click text to edit · Alt disables snapping"}
        </span>
      </div>
    </>
  );
}
