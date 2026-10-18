import { useEffect, useEffectEvent } from "react";
import { useEditor } from "../EditorProvider";
import { L } from "../native.mjs";

export function useHotkeys(save) {
  const editor = useEditor();
  const onKey = useEffectEvent((e) => {
    if (e.defaultPrevented || e.isComposing) return;
    const {
      store,
      selected,
      document: doc,
      screenName,
      cancelGesture,
    } = editor;
    const input = e.target.closest(
        "input,textarea,select,[contenteditable=true]",
      ),
      modifier = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase();
    if (modifier && key === "s") {
      e.preventDefault();
      save();
      return;
    }
    if (
      modifier &&
      !input &&
      !editor.editing &&
      ["+", "=", "-", "0", "1"].includes(key)
    ) {
      e.preventDefault();
      if (key === "0") editor.previewControls.current?.setZoom("fit");
      else if (key === "1") editor.previewControls.current?.setZoom("1");
      else
        editor.previewControls.current?.zoomBy(key === "-" ? 1 / 1.25 : 1.25);
      return;
    }
    if (e.key === "Escape" && cancelGesture.current?.()) {
      e.preventDefault();
      return;
    }
    if (modifier && ["z", "y"].includes(key)) {
      if (input && (!input.closest("#properties") || input.dataset.nativeUndo))
        return;
      e.preventDefault();
      input?.blur();
      if (cancelGesture.current?.()) return;
      store.restore(key === "y" || e.shiftKey ? "redo" : "undo");
      return;
    }
    if (input || editor.editing) return;
    if (modifier && ["g", "j"].includes(key)) {
      e.preventDefault();
      store.layer(key === "j" ? "duplicate" : e.shiftKey ? "ungroup" : "group");
      return;
    }
    if (!selected || L.state(doc.screens[screenName], selected).locked) return;
    if (["Delete", "Backspace"].includes(e.key)) {
      e.preventDefault();
      store.layer("delete");
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      store.layer("nudge", {
        x: e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0,
        y: e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0,
      });
    }
  });
  useEffect(() => {
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
