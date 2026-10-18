import React from "react";
import { useEditor } from "../EditorProvider";
import { M, T, defaults, sprites, ensureTransform } from "../native.mjs";
import { buttonTitle } from "../preview.mjs";
import {
  Field,
  TextField,
  Group,
  Disclosure,
  Pair,
  Advanced,
  ScaleField,
  ColorField,
} from "../components/Fields";
export function ContentProperties({ node, display: r, mutate }) {
  const { screenName, selected, preview, store } = useEditor();
  const child = (n) =>
    n.type === "transform" && n.rows.length === 1 ? n.rows[0] : n;
  const change = (key, value) =>
    mutate((n) => {
      child(n)[key] = value;
    }, "Change " + key);
  const textLike =
    r?.type === "text" ||
    (r?.type === "binding" &&
      !(preview.samples?.[r.key] || []).some((row) =>
        ["buttons", "columns"].includes(row.type),
      ));
  return (
    <>
      {r?.type === "text" && (
        <Group title="Content">
          <TextField
            label="Text"
            value={r.text}
            onChange={(v) => change("text", v)}
          />
        </Group>
      )}
      {r?.type === "binding" && (
        <Group
          title="Live text"
          description="Edit the wording. Variable tokens update from the game."
        >
          <TextField
            label="Text template"
            value={T.template(defaults.screens[screenName], r)}
            onChange={(v) => change("text", v)}
          />
          <Disclosure title="Live preview">
            <div className="template-preview">
              {M.formatText(
                T.template(defaults.screens[screenName], r),
                preview.samples?._variables || {},
              ).replaceAll(
                "{text}",
                preview.samples?.[r.key]?.find((row) => row.type === "text")
                  ?.text || "",
              )}
            </div>
          </Disclosure>
        </Group>
      )}
      {textLike && (
        <Group title="Typography">
          <ScaleField
            label="Font size (%)"
            value={node.type === "transform" ? node.scale_y : 1}
            onChange={(v) =>
              mutate((_, s) => {
                const n = ensureTransform(s, selected);
                n.scale_x *= v / n.scale_y;
                n.scale_y = v;
              })
            }
          />
          <ColorField
            label="Text color"
            value={r.color || M.TEXT}
            onChange={(v) => change("color", v)}
          />
          <small>
            Container width wraps text without stretching the letters.
          </small>
        </Group>
      )}
      {r?.type === "sprite" && (
        <>
          <Pair>
            <Field
              label="Width"
              type="number"
              value={r.width}
              onChange={(v) => change("width", v)}
            />
            <Field
              label="Height"
              type="number"
              value={r.height}
              onChange={(v) => change("height", v)}
            />
          </Pair>
          <ColorField
            label="Fill & opacity"
            value={r.color || "#FFFFFFFF"}
            onChange={(v) => change("color", v)}
          />
          {!["LD_SPAC:white", "LD_SPAC:black"].includes(r.texture) && (
            <Field
              label="Icon"
              value={r.texture}
              options={Object.keys(sprites).map((n) => [n, n])}
              onChange={(v) => change("texture", v)}
            />
          )}
          <Advanced>
            <Field
              label="Texture name"
              value={r.texture}
              onChange={(v) => change("texture", v)}
            />
          </Advanced>
        </>
      )}
      {r?.type === "gap" && (
        <Field
          label="Height"
          type="number"
          value={r.height}
          onChange={(v) => change("height", v)}
        />
      )}
      {r?.type === "preview" && (
        <Field
          label="GTA model"
          type="number"
          value={r.model}
          onChange={(v) => change("model", v)}
        />
      )}
      {r?.type === "columns" && (
        <Field
          label="Left column width (0 = equal)"
          type="number"
          value={r.left_width}
          onChange={(v) => change("left_width", v)}
        />
      )}
      {r?.type === "buttons" && (
        <Group title="Buttons">
          {r.buttons.map((b, i) => (
            <button
              key={i}
              className="button-choice"
              onClick={() =>
                store.select([
                  ...selected,
                  ...(node.type === "transform" ? ["rows", 0] : []),
                  "buttons",
                  i,
                ])
              }
            >
              {buttonTitle(screenName, preview, b)}
            </button>
          ))}
          <button
            disabled={r.buttons.length >= 8}
            onClick={() =>
              mutate((n) =>
                child(n).buttons.push({ label: "Back", action: "Back" }),
              )
            }
          >
            Add button
          </button>
        </Group>
      )}
      <Advanced>
        {["binding", "section"].includes(r?.type) && (
          <Field
            label="Live binding"
            value={r.key}
            onChange={(v) => change("key", v)}
          />
        )}
        {r?.type === "binding" &&
          ["primary", "background"].map((key) => (
            <Field
              key={key}
              label={key}
              value={r[key] == null ? "inherit" : String(r[key])}
              options={[
                ["inherit", "Keep original"],
                ["true", "Yes"],
                ["false", "No"],
              ]}
              onChange={(v) =>
                mutate((n) => {
                  if (v === "inherit") delete child(n)[key];
                  else child(n)[key] = v === "true";
                })
              }
            />
          ))}
      </Advanced>
      {node.type === "transform" && (
        <Advanced>
          <Pair>
            {["x", "y"].map((axis) => (
              <ScaleField
                key={axis}
                label={"Scale " + axis.toUpperCase() + " (%)"}
                value={node["scale_" + axis]}
                onChange={(v) =>
                  mutate((n) => {
                    n["scale_" + axis] = v;
                  })
                }
              />
            ))}
          </Pair>
          <button
            onClick={() =>
              mutate((n) => {
                n.x = 0;
                n.y = 0;
                n.scale_x = 1;
                n.scale_y = 1;
                delete n.width;
              })
            }
          >
            Reset position & size
          </button>
        </Advanced>
      )}
    </>
  );
}
