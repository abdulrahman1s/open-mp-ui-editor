import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createEditorStore, DRAFT } from "./store.mjs";
import { M } from "./native.mjs";
import { previewScreen } from "./preview.mjs";
import { viewportLayout } from "./viewport.mjs";
import { usePixelDensity } from "./hooks/usePixelDensity";

const Context = createContext(null);
export function EditorProvider({ children }) {
  const [store] = useState(() => createEditorStore());
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [view, setViewState] = useState(() => ({
    resolution: "1920,1080",
    zoom: "fit",
    grid: false,
    smart: true,
    gridSize: "10",
    resize: "resize",
    advanced: false,
    hud: false,
    hudOpacity: 100,
    hudMode: "menu",
    ...Object.fromEntries(
      Object.entries(store.prefs).map(([k, v]) => [
        {
          "client-scale": "projection",
          "smart-guides": "smart",
          "grid-size": "gridSize",
        }[k] || k,
        v,
      ]),
    ),
    // TextDraws use the client's 640 × 448 projection at every resolution.
    projection: "448",
  }));
  const setView = (patch) => setViewState((old) => ({ ...old, ...patch }));
  const [previewArea, setPreviewArea] = useState({ width: 1000, height: 600 });
  const density = usePixelDensity();
  const previewView = {
    ...viewportLayout(view.resolution, view.zoom, previewArea, density),
    density,
    areaWidth: previewArea.width,
    areaHeight: previewArea.height,
    setArea: setPreviewArea,
  };
  const canvas = useRef(null),
    finishText = useRef(null),
    cancelGesture = useRef(null),
    previewControls = useRef(null),
    exportPreview = useRef(null);
  const preview = useMemo(
    () => previewScreen(state.document, state.screenName, state.state),
    [state.document, state.screenName, state.state],
  );
  const result = useMemo(() => {
    try {
      return { plan: M.plan(preview), error: null };
    } catch (e) {
      return { plan: null, error: e.message };
    }
  }, [preview]);
  useEffect(() => {
    const onHide = () => {
      finishText.current?.(true);
      store.persist();
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [store]);
  useEffect(() => {
    try {
      localStorage.setItem(
        DRAFT + ".view",
        JSON.stringify({ ...view, screen: state.screenName }),
      );
    } catch {
      /* View preferences are optional. */
    }
  }, [view, state.screenName]);
  useEffect(() => {
    document.body.classList.toggle("advanced", view.advanced);
  }, [view.advanced]);
  useEffect(() => {
    if (!state.message) return;
    const timer = setTimeout(() => store.notify(""), 6500);
    return () => clearTimeout(timer);
  }, [state.message, store]);
  return (
    <Context.Provider
      value={{
        ...state,
        ...result,
        store,
        preview,
        view,
        setView,
        canvas,
        finishText,
        cancelGesture,
        previewView,
        previewControls,
        exportPreview,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useEditor = () => useContext(Context);
