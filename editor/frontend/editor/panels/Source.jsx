import React, { useEffect, useState } from "react";
import { S } from "../native.mjs";
import { useEditor } from "../EditorProvider";

export function Source() {
  const { document: doc, store } = useEditor(),
    [text, setText] = useState(() => S.stringify(doc)),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setText(S.stringify(doc));
  }, [doc, dirty]);
  function apply() {
    try {
      const next = S.parse(text, S.samples(store.getSnapshot().document));
      store.replace(next, { label: "Apply stylesheet" });
      setDirty(false);
    } catch (e) {
      store.notify(e.message);
    }
  }
  return (
    <details className="source">
      <summary>Stylesheet{dirty ? " · unapplied changes" : ""}</summary>
      <label htmlFor="source-json">Editable UI stylesheet</label>
      <textarea
        id="source-json"
        spellCheck={false}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
      />
      <button id="apply-json" onClick={apply}>
        Apply CSS
      </button>
      {dirty && (
        <button
          onClick={() => {
            setText(S.stringify(doc));
            setDirty(false);
          }}
        >
          Discard source changes
        </button>
      )}
    </details>
  );
}
