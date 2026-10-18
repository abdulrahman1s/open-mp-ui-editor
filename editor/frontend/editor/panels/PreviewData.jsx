import React, { useState, useEffect } from "react";
import { useEditor } from "../EditorProvider";
export function PreviewData({ screen }) {
  const { store } = useEditor(),
    [text, setText] = useState(JSON.stringify(screen.samples || {}, null, 2));
  useEffect(
    () => setText(JSON.stringify(screen.samples || {}, null, 2)),
    [screen.samples],
  );
  return (
    <details className="fixtures">
      <summary>Preview data</summary>
      <p>Sample values for this preview.</p>
      <label htmlFor="fixtures">Bindings and visible states</label>
      <textarea
        id="fixtures"
        spellCheck={false}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={() => {
          try {
            const data = JSON.parse(text);
            if (!data || typeof data !== "object" || Array.isArray(data))
              throw Error("Preview data must be an object.");
            store.edit(
              (s) => {
                s.samples = data;
              },
              { label: "Change preview data" },
            );
          } catch (e) {
            store.notify(e.message);
          }
        }}
      >
        Apply preview data
      </button>
    </details>
  );
}
