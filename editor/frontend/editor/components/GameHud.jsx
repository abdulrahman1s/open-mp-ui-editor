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
              <image
                key={name}
                data-hud={name}
                href={image}
                x={x}
                y={y}
                width={w}
                height={h}
                preserveAspectRatio="none"
              />
            ),
          )}
      </svg>
    </div>
  );
}
