import React from "react";
import { ArrowUp, ArrowDown, Copy, Trash2, Scan, Keyboard } from "lucide-react";
import { useEditor } from "../EditorProvider";
import { L, isButton } from "../native.mjs";
import { buttonTitle, rowTitle } from "../preview.mjs";
import { Field, Pair } from "../components/Fields";
import { Tool } from "../components/Tool";
import { ScreenProperties, Geometry } from "./GeometryProperties";
import { ButtonProperties } from "./ButtonProperties";
import { ContentProperties } from "./ContentProperties";
import { NativeProperties } from "./NativeProperties";
import { PreviewData } from "./PreviewData";
export function Inspector() {
  const {
    document: doc,
    screenName,
    selected,
    multi,
    preview,
    plan,
    state,
    store,
  } = useEditor();
  const screen = doc.screens[screenName],
    node = selected ? L.get(screen, selected) : null;
  const display =
    node?.type === "transform" && node.rows.length === 1 ? node.rows[0] : node;
  const kind =
    selected === null
      ? "Screen"
      : isButton(display)
        ? "Button"
        : {
            binding: "Live text",
            text: "Text",
            transform: "Group",
            sprite: "Shape",
            buttons: "Group",
            section: "Conditional",
            columns: "Columns",
            gap: "Spacing",
            rule: "Separator",
            preview: "Model",
          }[display?.type] || "Group";
  const locked = selected && L.state(screen, selected).locked;
  const edit = (recipe, label, mergeKey = label) =>
    store.edit((s, c) => recipe(selected ? L.get(s, selected) : s, s, c), {
      label,
      mergeKey,
    });
  const mutate = (recipe, label = "Edit " + kind.toLowerCase()) =>
    edit(recipe, label);
  return (
    <aside className="inspector panel" aria-label="Selected element properties">
      <div className="inspector-heading">
        <span>Properties</span>
        <span id="selection-kind">{kind}</span>
      </div>
      <div className="panel-header">
        <h2 id="inspector-title">
          {multi.length > 1
            ? multi.length + " layers selected"
            : selected === null
              ? "Screen container"
              : kind}
        </h2>
        <Scan size={15} />
      </div>
      <p id="inspector-description">
        {selected === null
          ? "Size the panel. Content and text reflow inside it."
          : "Double-click text on the canvas to edit it."}
      </p>
      <div id="properties" key={screenName + state + JSON.stringify(selected)}>
        <fieldset disabled={Boolean(locked)} className="property-fieldset">
          {multi.length > 1 ? (
            <small>Ctrl / ⌘ G groups the selected layers.</small>
          ) : selected === null ? (
            <ScreenProperties screen={screen} plan={plan} edit={edit} />
          ) : Array.isArray(node) ? (
            <small>New elements will be added to this group.</small>
          ) : (
            <>
              {node.type !== "native" && <Geometry node={node} edit={edit} />}
              {display?.type !== "native" &&
                !isButton(node) &&
                !Array.isArray(node) && (
                  <Field
                    label="Element ID"
                    value={display.id || ""}
                    onChange={(v) =>
                      edit((n) => {
                        (n.type === "transform" && n.rows.length === 1
                          ? n.rows[0]
                          : n
                        ).id = v;
                      }, "Change element ID")
                    }
                  />
                )}
              {display?.type === "native" ? (
                <NativeProperties node={node} edit={edit} />
              ) : isButton(node) ? (
                <ButtonProperties button={node} edit={edit} />
              ) : (
                <ContentProperties
                  node={node}
                  display={display}
                  mutate={mutate}
                />
              )}
            </>
          )}
        </fieldset>
        {node && !Array.isArray(node) && (
          <details className="layer-meta">
            <summary>Layer options</summary>
            <Field
              label="Layer name"
              value={
                node.name ||
                (isButton(node)
                  ? buttonTitle(screenName, preview, node, selected)
                  : rowTitle(node, preview))
              }
              disabled={Boolean(locked)}
              onChange={(v) =>
                edit(
                  (_, s) => L.metadata(s, selected, "name", v),
                  "Rename layer",
                )
              }
            />
            <Pair>
              <Field
                label="Visible"
                type="checkbox"
                value={!node.hidden}
                onChange={(v) =>
                  edit(
                    (_, s) => L.metadata(s, selected, "hidden", !v),
                    "Toggle layer visibility",
                    null,
                  )
                }
              />
              <Field
                label="Locked"
                type="checkbox"
                value={Boolean(node.locked)}
                onChange={(v) =>
                  edit(
                    (_, s) => L.metadata(s, selected, "locked", v),
                    "Toggle layer lock",
                    null,
                  )
                }
              />
            </Pair>
            {locked && !node.locked && (
              <small>Unlock the parent group to edit this layer.</small>
            )}
          </details>
        )}
      </div>
      {selected && !Array.isArray(node) && (
        <div id="row-actions" className="row-actions">
          <Tool
            id="up"
            icon={ArrowUp}
            label="Move layer up"
            disabled={multi.length !== 1 || !L.stepTarget(screen, selected, -1)}
            onClick={() => store.layer("step", -1)}
          />
          <Tool
            id="down"
            icon={ArrowDown}
            label="Move layer down"
            disabled={multi.length !== 1 || !L.stepTarget(screen, selected, 1)}
            onClick={() => store.layer("step", 1)}
          />
          <Tool
            id="duplicate"
            icon={Copy}
            label="Duplicate layer"
            disabled={Boolean(locked)}
            onClick={() => store.layer("duplicate")}
          />
          <Tool
            id="remove"
            icon={Trash2}
            label="Delete layer"
            className="danger"
            disabled={Boolean(locked)}
            onClick={() => store.layer("delete")}
          />
        </div>
      )}
      <PreviewData screen={screen} />
      <div className="inspector-footer">
        <Keyboard size={13} />
        <span>Arrow keys to nudge · Shift for 10 units</span>
      </div>
    </aside>
  );
}
