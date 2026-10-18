import React from "react";
import { useEditor } from "../EditorProvider";
import { hudLayout, hudOpacity } from "../hud.mjs";

export function GameHud() {
  const { view, previewView: frame } = useEditor();
  return (
    <div
      className="game-hud"
      hidden={!view.hud}
      style={{ opacity: hudOpacity(view.hudOpacity) / 100 }}
      aria-hidden="true"
    >
      <svg
        viewBox={`0 0 ${frame.width} ${frame.height}`}
        preserveAspectRatio="none"
      >
        {view.hud &&
          hudLayout(frame.width, frame.height, view.hudMode).map(
            ({ name, image, x, y, w, h }) => (
              <g key={name} opacity="0.7">
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={name === "health" ? "#a52632" : "#405966"}
                  stroke="#d2dbe0"
                />
                <text
                  x={x + 5}
                  y={y + h / 2}
                  fontSize={Math.max(8, h / 4)}
                  fill="white"
                >
                  {name}
                </text>
              </g>
            ),
          )}
      </svg>
    </div>
  );
}
