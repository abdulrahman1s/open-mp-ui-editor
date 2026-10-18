import React from "react";
import { useEditor } from "../EditorProvider";
import { hudOpacity } from "../hud.mjs";

export function HudControls() {
  const { view, setView } = useEditor();
  const opacity = hudOpacity(view.hudOpacity);
  return (
    <div className="hud-controls">
      <label
        className="check"
        title="Show the game HUD from the reference captures behind your design"
      >
        <input
          type="checkbox"
          checked={Boolean(view.hud)}
          onChange={(e) => setView({ hud: e.target.checked })}
        />
        Game HUD
      </label>
      {view.hud && (
        <>
          <select
            aria-label="Game HUD mode"
            value={view.hudMode || "menu"}
            onChange={(e) => setView({ hudMode: e.target.value })}
            title="Match the HUD visible while a menu is open or during gameplay"
          >
            <option value="menu">Menu open</option>
            <option value="gameplay">Gameplay</option>
          </select>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={opacity}
            aria-label="Game HUD opacity"
            onChange={(e) => setView({ hudOpacity: Number(e.target.value) })}
          />
          <output aria-label="HUD opacity">{opacity}%</output>
        </>
      )}
    </div>
  );
}
