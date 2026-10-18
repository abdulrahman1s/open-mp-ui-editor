import React from "react";
import { createRoot } from "react-dom/client";
import { EditorProvider } from "./editor/EditorProvider";
import { Workspace } from "./editor/Workspace";

createRoot(document.getElementById("editor-app")).render(
  <EditorProvider>
    <Workspace />
  </EditorProvider>,
);
