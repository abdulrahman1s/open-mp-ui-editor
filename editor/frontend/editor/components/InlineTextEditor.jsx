import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useEditor } from "../EditorProvider";
import { T, defaults, same } from "../native.mjs";
import { VariableField } from "./VariableField";

export function InlineTextEditor({ viewport }) {
  const {
    document: doc,
    screenName,
    editing,
    preview,
    plan,
    store,
    view,
    canvas,
    finishText,
  } = useEditor();
  const target = T.begin(doc.screens[screenName], editing.path, {
    name: screenName,
    defaults: defaults.screens[screenName],
    preview,
  });
  const [value, setValue] = useState(target?.value || ""),
    [error, setError] = useState(""),
    [position, setPosition] = useState({}),
    ref = useRef(null),
    box = useRef(null);
  function finish(apply) {
    if (apply && target && value !== target.value) {
      const ok = store.edit(
        (s) => {
          T.begin(s, editing.path, {
            name: screenName,
            defaults: defaults.screens[screenName],
            preview,
          }).apply(value);
        },
        {
          label: target.kind === "button" ? "Edit button caption" : "Edit text",
        },
      );
      if (!ok) {
        setError(
          "Text could not be applied. Check its length and variable syntax.",
        );
        ref.current.focus();
        return false;
      }
    }
    store.closeText();
    return true;
  }
  useLayoutEffect(() => {
    if (!target) return;
    function positionEditor() {
      const vp = viewport.current.getBoundingClientRect(),
        r =
          editing.path === null
            ? {
                x: plan.x + (plan.padding + 5) * plan.scale,
                y: plan.y + plan.padding * plan.scale,
                w: plan.width - (plan.padding * 2 + 24) * plan.scale,
              }
            : plan.hits.find((h) => same(h.path, editing.path));
      if (!r) return;
      const width = Math.min(
        Math.max((r.w * vp.width) / 640, 210),
        vp.width - 12,
      );
      setPosition({
        left: Math.max(
          6,
          Math.min((r.x * vp.width) / 640, vp.width - width - 6),
        ),
        top: Math.max(
          0,
          Math.min(
            (r.y * vp.height) / Number(view.projection),
            vp.height - 100,
          ),
        ),
        width,
      });
      ref.current.style.height = "auto";
      ref.current.style.height =
        Math.min(180, Math.max(32, ref.current.scrollHeight)) + "px";
    }
    positionEditor();
    const observer = new ResizeObserver(positionEditor);
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [value, plan, view.projection]);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  useEffect(() => {
    finishText.current = finish;
    const outside = (e) => {
      if (
        !box.current?.contains(e.target) &&
        !e.target.closest("#text-completions")
      ) {
        if (!finish(true)) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
    };
    document.addEventListener("pointerdown", outside, true);
    return () => {
      finishText.current = null;
      document.removeEventListener("pointerdown", outside, true);
    };
  });
  if (!target) return null;
  return (
    <div
      ref={box}
      className="canvas-text-editor"
      role="group"
      aria-label="Edit text on canvas"
      style={position}
    >
      <VariableField
        inputRef={ref}
        value={value}
        onChange={(v) => {
          setValue(v);
          setError("");
        }}
        nativeUndo
        maxLength={target.limit}
        className="canvas-text-input"
        aria-label={
          target.kind === "button"
            ? "Edit button caption on canvas"
            : target.kind === "title"
              ? "Edit title on canvas"
              : "Edit text on canvas"
        }
        onKeyDown={(e) => {
          if (e.isComposing || e.defaultPrevented) return;
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            finish(false);
            canvas.current.focus();
          }
          if (
            e.key === "Enter" &&
            (e.ctrlKey || e.metaKey || (!target.multiline && !e.shiftKey))
          ) {
            e.preventDefault();
            e.stopPropagation();
            if (finish(true)) canvas.current.focus();
          }
        }}
      />
      {error && (
        <div className="canvas-text-error" role="alert">
          {error}
        </div>
      )}
      <div className="canvas-text-actions">
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            if (finish(true)) canvas.current.focus();
          }}
        >
          Done
        </button>
        <button
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            finish(false);
            canvas.current.focus();
          }}
        >
          Cancel
        </button>
        <span>Ctrl / ⌘ Enter applies · Esc cancels</span>
      </div>
    </div>
  );
}
