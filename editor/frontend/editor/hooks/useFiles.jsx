import { useEffect, useRef, useState } from "react";
import { M, S } from "../native.mjs";
import { useEditor } from "../EditorProvider";
import { previewScreen } from "../preview.mjs";

export function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
const stable = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
export function useFiles() {
  const editor = useEditor(),
    { store, finishText } = editor;
  const [connection, setConnection] = useState({
    connected: false,
    enabled: false,
    status: "Connecting…",
  });
  const current = useRef(null),
    revision = useRef(null),
    busy = useRef(false),
    queued = useRef(false),
    handle = useRef(null),
    fileInput = useRef(null);
  current.current = { connection };
  useEffect(() => {
    let alive = true;
    if (globalThis.OPEN_MP_EDITOR) {
      setConnection({
        connected: false,
        enabled: false,
        status: "Browser only",
      });
      return;
    }
    const opening = JSON.stringify(store.getSnapshot().document);
    (async () => {
      try {
        const response = await fetch("/api/ui", { cache: "no-store" });
        if (!response.ok) throw Error("Offline");
        const data = await response.json();
        M.validate(data.document);
        if (!alive) return;
        revision.current = data.revision;
        const now = store.getSnapshot().document,
          same = stable(now) === stable(data.document);
        const paused =
          (store.recovered || JSON.stringify(now) !== opening) && !same;
        if (!same && !paused) store.replace(data.document, { reset: true });
        setConnection({
          connected: true,
          enabled: !paused,
          status: paused ? "Draft · live paused" : "Live sync",
        });
        if (paused)
          store.notify(
            "Your draft differs from ui.css. Enable Live to apply it, or open the current stylesheet.",
          );
      } catch {
        if (alive)
          setConnection({
            connected: false,
            enabled: false,
            status: "Offline",
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [store]);
  async function sync() {
    const { connection } = current.current;
    if (!connection.connected || !connection.enabled) return;
    const snapshot = store.getSnapshot(),
      doc = JSON.parse(snapshot.committedValue);
    const plan = M.plan(
      previewScreen(doc, snapshot.screenName, snapshot.state),
    );
    if (plan.issues.some((s) => /outside|exceeds|too narrow/.test(s))) {
      setConnection((c) => ({ ...c, status: "Fix layout to sync" }));
      return;
    }
    if (busy.current) {
      queued.current = true;
      return;
    }
    busy.current = true;
    setConnection((c) => ({ ...c, status: "Saving…" }));
    try {
      M.validate(doc);
      const response = await fetch("/api/ui", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SAL-Editor": "1",
          "If-Match": revision.current,
        },
        body: JSON.stringify(doc),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Could not save live.");
      revision.current = data.revision;
      setConnection((c) => ({
        ...c,
        status: c.enabled ? "Live sync" : "Live paused",
      }));
    } catch (e) {
      setConnection((c) => ({
        ...c,
        enabled: false,
        status: "Live sync paused",
      }));
      current.current = {
        connection: { ...current.current.connection, enabled: false },
      };
      store.notify(e.message);
    } finally {
      busy.current = false;
      if (queued.current) {
        queued.current = false;
        await sync();
      }
    }
  }
  // Only committed snapshots schedule writes; dragging never publishes to disk.
  const committed = editor.committedValue;
  useEffect(() => {
    if (!connection.enabled) return;
    const timer = setTimeout(sync, 450);
    return () => clearTimeout(timer);
  }, [committed, connection.enabled]);
  async function save() {
    if (finishText.current && !finishText.current(true)) return;
    try {
      // Read the store after committing an inline edit, not the preceding render.
      const text = JSON.stringify(store.getSnapshot().document, null, 2);
      if (current.current.connection.enabled) {
        await sync();
        return;
      }
      if (!window.showSaveFilePicker) {
        download("ui.project.json", text, "application/json");
        return;
      }
      handle.current ||= await window.showSaveFilePicker({
        suggestedName: "ui.project.json",
        types: [
          {
            description: "Editable UI project",
            accept: { "application/json": [".json"] },
          },
        ],
      });
      const stream = await handle.current.createWritable();
      await stream.write(text);
      await stream.close();
      store.notify("Project saved. Export runtime JSON to load it in open.mp.");
    } catch (e) {
      if (e.name !== "AbortError") store.notify(e.message);
    }
  }
  async function openFile(file) {
    if (finishText.current && !finishText.current(true)) return;
    if (file.size > 1024 * 1024) throw Error("Stylesheet exceeds 1 MiB.");
    const text = await file.text();
    const parsed = text.trimStart().startsWith("{") ? JSON.parse(text) : null;
    const next =
      parsed?.format === "open-mp-ui"
        ? globalThis.OpenMpExport.importDefinition(parsed)
        : parsed
          ? M.validate(parsed)
          : S.parse(text, S.samples(store.getSnapshot().document));
    store.replace(next, { label: "Open " + file.name });
    handle.current = null;
    store.notify(`Opened ${file.name}. Previous work remains in Undo.`);
  }
  async function open() {
    if (!window.showOpenFilePicker) {
      fileInput.current.click();
      return;
    }
    try {
      const [next] = await window.showOpenFilePicker({
        types: [
          {
            description: "UI stylesheet or legacy JSON",
            accept: { "text/css": [".css"], "application/json": [".json"] },
          },
        ],
        multiple: false,
      });
      const file = await next.getFile();
      await openFile(file);
      if (file.name.endsWith(".css")) handle.current = next;
    } catch (e) {
      if (e.name !== "AbortError") store.notify(e.message);
    }
  }
  function toggle(enabled) {
    setConnection((c) => ({
      ...c,
      enabled,
      status: enabled ? "Live sync" : "Live paused",
    }));
  }
  return {
    connection,
    toggle,
    save,
    open,
    fileInput,
    openFile,
    exportRuntime() {
      if (finishText.current && !finishText.current(true)) return;
      try {
        const snapshot = store.getSnapshot();
        const result = globalThis.OpenMpExport.exportScreen(
          snapshot.document,
          snapshot.screenName,
          snapshot.state,
        );
        download(
          snapshot.screenName + ".json",
          JSON.stringify(result.definition, null, 2),
          "application/json",
        );
        store.notify(
          result.warnings.join(" ") ||
            "Runtime JSON exported. Copy it to scriptfiles/ui/.",
        );
      } catch (e) {
        store.notify(e.message);
      }
    },
    exportCss() {
      if (finishText.current && !finishText.current(true)) return;
      download("ui.css", S.stringify(store.getSnapshot().document), "text/css");
    },
  };
}
