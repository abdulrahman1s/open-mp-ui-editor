import React from "react";
import { PanelTop, FolderOpen, Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Tool } from "./Tool";
import { useEditor } from "../EditorProvider";
export function Header({ files }) {
  const { store } = useEditor();
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-mark">
          <PanelTop size={20} />
        </span>
        <div>
          <strong>open.mp UI editor</strong>
          <span>Native TextDraw studio</span>
        </div>
        <span className="document-name">UI project</span>
      </div>
      <div className="file-actions">
        <span id="save-state" role="status">
          Draft &amp; history saved
        </span>
        <a
          className="button"
          href="https://github.com/abdulrahman1s/open-mp-ui-editor#readme"
          target="_blank"
          rel="noreferrer"
        >
          Guide
        </a>
        <label className="live-toggle" hidden={globalThis.OPEN_MP_EDITOR}>
          <input
            id="auto-live"
            type="checkbox"
            disabled={!files.connection.connected}
            checked={files.connection.enabled}
            onChange={(e) => files.toggle(e.target.checked)}
          />
          <span id="live-status">{files.connection.status}</span>
        </label>
        <Tool
          id="open"
          icon={FolderOpen}
          label="Open UI project or runtime JSON"
          onClick={files.open}
        >
          Open
        </Tool>
        <Button id="save" variant="outline" size="sm" onClick={files.save}>
          Save
        </Button>
        <Button id="download" size="sm" onClick={files.exportRuntime}>
          <Download size={14} />
          Export runtime JSON
        </Button>
        <input
          ref={files.fileInput}
          id="file"
          type="file"
          accept=".css,text/css,.json,application/json"
          hidden
          onChange={async (e) => {
            try {
              if (e.target.files[0]) await files.openFile(e.target.files[0]);
            } catch (error) {
              store.notify(error.message);
            } finally {
              e.target.value = "";
            }
          }}
        />
      </div>
    </header>
  );
}
