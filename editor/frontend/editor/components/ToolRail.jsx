import React, { useState } from "react";
import {
  MousePointer2,
  Plus,
  Image as ImageIcon,
  Type,
  Square,
  RectangleHorizontal,
  Columns2,
  Minus,
  Space,
  Box,
  SlidersHorizontal,
  BookOpen,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Tool } from "./Tool";
import { useEditor } from "../EditorProvider";
export function ToolRail({ openSprites }) {
  const { store, view, setView, canvas } = useEditor();
  const [addType, setAddType] = useState("text");
  function add(type) {
    if (type === "sprite") openSprites();
    else store.add(type);
  }
  return (
    <aside className="tool-rail panel" aria-label="Add elements and tools">
      <div className="rail-title">Tools</div>
      <Tool
        icon={MousePointer2}
        label="Select and move a layer"
        className="rail-tool active"
        onClick={() => canvas.current?.focus()}
      >
        Move
      </Tool>
      <div className="rail-divider" />
      <div className="rail-title">Add</div>
      {[
        ["text", "Text", Type],
        ["buttons", "Button", RectangleHorizontal],
        ["rectangle", "Rectangle", Square],
        ["sprite", "Sprite", ImageIcon],
        ["columns", "Columns", Columns2],
        ["rule", "Separator", Minus],
        ["gap", "Spacing", Space],
        ["preview", "GTA model", Box],
      ].map(([type, label, Icon]) => (
        <Tool
          key={type}
          icon={Icon}
          label={"Add " + label.toLowerCase()}
          className="rail-tool"
          onClick={() => add(type)}
        >
          {label}
        </Tool>
      ))}
      <details className="more-tools">
        <summary>More tools</summary>
        <div className="add-row">
          <label htmlFor="row-type">Insert element</label>
          <div className="inline-controls">
            <select
              id="row-type"
              value={addType}
              onChange={(e) => setAddType(e.target.value)}
            >
              {[
                ["text", "Text"],
                ["buttons", "Button"],
                ["rectangle", "Rectangle"],
                ["sprite", "Sprite / icon"],
                ["columns", "Two columns"],
                ["binding", "Live text"],
                ["section", "Conditional group"],
                ["rule", "Separator"],
                ["gap", "Spacing"],
                ["preview", "GTA model"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              aria-label="Add element"
              onClick={() => add(addType)}
            >
              <Plus size={15} />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="browse-sprites"
            onClick={() => openSprites()}
          >
            <ImageIcon size={14} />
            Sprite library
          </Button>
        </div>
      </details>
      <div className="sidebar-footer">
        <label className="check">
          <input
            id="advanced"
            type="checkbox"
            checked={view.advanced}
            onChange={(e) => setView({ advanced: e.target.checked })}
          />
          <SlidersHorizontal size={13} />
          Advanced controls
        </label>
        <a
          href="https://github.com/abdulrahman1s/open-mp-ui-editor#using-the-editor"
          target="_blank"
          rel="noopener"
        >
          <BookOpen size={13} />
          Editor guide
        </a>
      </div>
    </aside>
  );
}
