import React from "react";
import { MousePointer2, Undo2, Redo2, Plus, Monitor } from "lucide-react";
import { Tool } from "./Tool";
import { useEditor } from "../EditorProvider";
import { screenNames, states, vocabulary } from "../native.mjs";
import { PreviewZoom } from "./PreviewZoom";
import { aspectLabel } from "../viewport.mjs";
import { HudControls } from "./HudControls";
export function StageControls({ createDesign, customResolution }) {
  const {
    document: doc,
    screenName,
    state,
    store,
    view,
    setView,
    finishText,
    cancelGesture,
  } = useEditor();
  const existing =
    vocabulary.screens.includes(screenName) || screenName === "Confirmation";
  function navigate(name, nextState = "default") {
    if (finishText.current && !finishText.current(true)) return;
    cancelGesture.current?.();
    store.navigate(name, nextState);
  }
  return (
    <>
      {" "}
      <div className="screen-picker document-controls">
        <div className="panel-header">
          <h1>Document</h1>
          <Tool
            icon={Plus}
            label="Create a new screen"
            onClick={() => createDesign()}
          />
        </div>
        <label className="sr-only" htmlFor="screens">
          Screen
        </label>
        <select
          id="screens"
          value={screenName}
          onChange={(e) => navigate(e.target.value)}
        >
          {Object.keys(doc.screens).map((name) => (
            <option key={name} value={name}>
              {screenNames[name] || name}
            </option>
          ))}
        </select>
        <div className="workflow">
          <button
            className={existing ? "active" : ""}
            onClick={() =>
              navigate(
                vocabulary.screens.includes(screenName) ? screenName : "Auth",
              )
            }
          >
            Game screen
          </button>
          <button
            className={!existing ? "active" : ""}
            onClick={() => createDesign()}
          >
            New design
          </button>
        </div>
        <p className="mode-help">
          {existing
            ? "Edit a game screen. Save ui.css to apply."
            : "New design · connect it to a server feature."}
        </p>
        <label htmlFor="preview-state">State</label>
        <select
          id="preview-state"
          value={state}
          onChange={(e) => navigate(screenName, e.target.value)}
        >
          <option value="default">Default</option>
          {Object.keys(states[screenName] || {}).map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </div>
      <div className="stage-toolbar">
        <div className="inline-controls">
          <span className="tool-indicator">
            <MousePointer2 size={15} />
          </span>
          <span className="toolbar-divider" />
          <Tool
            id="undo"
            icon={Undo2}
            label={
              store.timeline.undoLabel
                ? "Undo " + store.timeline.undoLabel
                : "Undo"
            }
            disabled={!store.timeline.undoLabel}
            onClick={() => {
              if (!cancelGesture.current?.()) store.restore("undo");
            }}
          />
          <Tool
            id="redo"
            icon={Redo2}
            label={
              store.timeline.redoLabel
                ? "Redo " + store.timeline.redoLabel
                : "Redo"
            }
            disabled={!store.timeline.redoLabel}
            onClick={() => store.restore("redo")}
          />
          <span id="history-status" role="status">
            {store.timeline.undoLabel || "No edits yet"}
          </span>
          <span className="toolbar-divider" />
          <select
            id="resize-mode"
            aria-label="Handle behavior"
            value={view.resize}
            onChange={(e) => setView({ resize: e.target.value })}
          >
            <option value="resize">Resize layer</option>
            <option value="scale">Scale layer & text</option>
          </select>
        </div>
        <div className="inline-controls">
          <label className="check">
            <input
              id="smart-guides"
              type="checkbox"
              checked={view.smart}
              onChange={(e) => setView({ smart: e.target.checked })}
            />
            Smart guides
          </label>
          <label className="check">
            <input
              id="grid"
              type="checkbox"
              checked={view.grid}
              onChange={(e) => setView({ grid: e.target.checked })}
            />
            Grid
          </label>
          {view.grid && (
            <select
              id="grid-size"
              aria-label="Grid spacing"
              value={view.gridSize}
              onChange={(e) => setView({ gridSize: e.target.value })}
            >
              {["2", "5", "10", "20"].map((n) => (
                <option key={n} value={n}>
                  {n} units
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="view-options">
        <div className="inline-controls">
          <Monitor size={14} />
          <select
            id="resolution"
            aria-label="Viewport"
            value={view.resolution}
            onChange={(e) => setView({ resolution: e.target.value })}
          >
            {[
              ...new Set(
                [
                  "1280,960",
                  "1920,1080",
                  "2560,1440",
                  "640,480",
                  view.resolution,
                  customResolution,
                ].filter(Boolean),
              ),
            ].map((r) => (
              <option key={r} value={r}>
                {aspectLabel(r)}
              </option>
            ))}
          </select>
        </div>
        <div className="inline-controls preview-display-controls">
          <HudControls />
          <PreviewZoom />
        </div>
      </div>
    </>
  );
}
