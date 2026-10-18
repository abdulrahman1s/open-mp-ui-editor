import React from "react";
import { Minus, Plus, Focus, Scan } from "lucide-react";
import { useEditor } from "../EditorProvider";
import { Tool } from "./Tool";

export function PreviewZoom() {
  const { view, previewView, previewControls } = useEditor();
  const factor = previewView.factor;
  const choices = [
    ...new Set([
      0.1,
      0.25,
      0.5,
      0.75,
      1,
      1.25,
      1.5,
      2,
      3,
      4,
      6,
      8,
      ...(view.zoom === "fit" ? [] : [Number(view.zoom)]),
    ]),
  ].sort((a, b) => a - b);
  return (
    <div className="inline-controls preview-zoom" aria-label="Preview zoom">
      <span className="preview-zoom-label">Preview</span>
      <Tool
        icon={Minus}
        label="Zoom preview out"
        disabled={factor <= 0.1}
        onClick={() => previewControls.current?.zoomBy(1 / 1.25)}
      />
      <select
        id="zoom"
        aria-label="Preview zoom"
        title="100% = selected game resolution, one game pixel per display pixel. Ctrl / ⌘ + scroll to zoom; Space + drag to pan."
        value={view.zoom}
        onChange={(e) => previewControls.current?.setZoom(e.target.value)}
      >
        <option value="fit">
          Fit · {Math.round(previewView.fitFactor * 100)}%
        </option>
        {choices.map((zoom) => (
          <option key={zoom} value={String(zoom)}>
            {Math.round(zoom * 100)}%
          </option>
        ))}
      </select>
      <Tool
        icon={Plus}
        label="Zoom preview in"
        disabled={factor >= 8}
        onClick={() => previewControls.current?.zoomBy(1.25)}
      />
      <Tool
        icon={Scan}
        label="Fit UI in view"
        onClick={() => previewControls.current?.fitUI()}
      />
      <Tool
        icon={Focus}
        label="Fit canvas"
        onClick={() => previewControls.current?.setZoom("fit")}
      />
    </div>
  );
}
