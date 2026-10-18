import React, { useState, useEffect, useRef } from "react";
import { Download, Image as ImageIcon, Trash2 } from "lucide-react";
import { TooltipProvider } from "../components/ui/tooltip";
import { useEditor } from "./EditorProvider";
import { useFiles } from "./hooks/useFiles";
import { useHotkeys } from "./hooks/useHotkeys";
import { Header } from "./components/Header";
import { ToolRail } from "./components/ToolRail";
import { StageControls } from "./components/StageControls";
import { Tool } from "./components/Tool";
import { Canvas } from "./Canvas";
import { Inspector } from "./panels/Inspector";
import { Layers } from "./panels/Layers";
import { Source } from "./panels/Source";
import { NewDesign, SpriteBrowser } from "./Dialogs";
import { DRAFT } from "./store.mjs";
export function Workspace() {
  const { screenName, plan, store, setView, exportPreview, message } =
    useEditor();
  const files = useFiles();
  useHotkeys(files.save);
  const [dialog, setDialog] = useState(null),
    [background, setBackground] = useState(null),
    [customResolution, setCustomResolution] = useState(null);
  const dock = useRef(null),
    backgroundRef = useRef(null);
  const [layersHeight, setLayersHeight] = useState(() => {
    try {
      return Number(localStorage.getItem(DRAFT + ".dock")) || 270;
    } catch {
      return 270;
    }
  });
  function resizeDock(height) {
    const next = Math.max(
      160,
      Math.min(dock.current.clientHeight - 180, height),
    );
    setLayersHeight(next);
    try {
      localStorage.setItem(DRAFT + ".dock", String(next));
    } catch {
      /* Optional preference. */
    }
  }
  useEffect(
    () => () => {
      if (background) URL.revokeObjectURL(background);
    },
    [background],
  );
  async function addScreenshot(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      store.notify("Choose an image smaller than 20 MiB.");
      return;
    }
    const url = URL.createObjectURL(file),
      image = new Image();
    image.onload = () => {
      setBackground(url);
      const resolution = `${image.naturalWidth},${image.naturalHeight}`;
      setCustomResolution(resolution);
      setView({ resolution });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      store.notify("Could not read this screenshot.");
    };
    image.src = url;
  }
  return (
    <TooltipProvider delayDuration={350}>
      <Header files={files} />
      <main className="workspace">
        <ToolRail openSprites={() => setDialog("sprites")} />
        <section className="stage-area" aria-label="UI preview">
          <StageControls
            createDesign={() => setDialog("new")}
            customResolution={customResolution}
          />
          <Canvas background={background} />
          <div className="preview-tools">
            <label className="button" htmlFor="background">
              <ImageIcon size={14} />
              Add screenshot
              <input
                ref={backgroundRef}
                id="background"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => addScreenshot(e.target.files[0])}
              />
            </label>
            <Tool
              icon={Trash2}
              label="Remove screenshot"
              disabled={!background}
              onClick={() => {
                setBackground(null);
                backgroundRef.current.value = "";
              }}
            />
            <Tool
              icon={Download}
              label="Download transparent preview PNG"
              onClick={() => {
                try {
                  const a = document.createElement("a");
                  a.href = exportPreview.current();
                  a.download = `${screenName}-ui-preview.png`;
                  a.click();
                } catch (e) {
                  store.notify(e.message);
                }
              }}
            >
              PNG
            </Tool>
            <details
              id="issues-box"
              className={plan?.issues.length ? "has-issues" : ""}
            >
              <summary>
                {plan?.issues.length
                  ? `${plan.issues.length} layout checks to review`
                  : "Layout checks passed"}
              </summary>
              <ul>
                {plan?.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </details>
          </div>
          <p className="parity-note">
            Browser fonts approximate native GTA fonts. Sprite and model
            previews need a game client. Export the current screen and state;
            live-value samples become static text.
          </p>
          <Source />
        </section>
        <aside
          ref={dock}
          className="right-dock"
          aria-label="Properties and layers"
          style={{ "--layers-height": layersHeight + "px" }}
        >
          <Inspector />
          <div
            id="dock-divider"
            role="separator"
            aria-label="Resize properties and layers"
            aria-orientation="horizontal"
            aria-valuenow={layersHeight}
            tabIndex={0}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                resizeDock(
                  dock.current.clientHeight -
                    (e.clientY - dock.current.getBoundingClientRect().top),
                );
            }}
            onPointerUp={(e) =>
              e.currentTarget.releasePointerCapture(e.pointerId)
            }
            onKeyDown={(e) => {
              if (["ArrowUp", "ArrowDown"].includes(e.key)) {
                e.preventDefault();
                resizeDock(layersHeight + (e.key === "ArrowUp" ? 20 : -20));
              }
            }}
          />
          <Layers key={screenName} />
        </aside>
      </main>
      {message && (
        <div id="toast" role="status">
          {message}
        </div>
      )}
      {dialog === "new" && <NewDesign close={() => setDialog(null)} />}{" "}
      {dialog === "sprites" && <SpriteBrowser close={() => setDialog(null)} />}
    </TooltipProvider>
  );
}
