import React from "react";
import { useEditor } from "../EditorProvider";
import { M, L, R, same, isButton, ensureTransform } from "../native.mjs";
import {
  Field,
  TextField,
  Group,
  Pair,
  Advanced,
  ScaleField,
} from "../components/Fields";
export function ScreenProperties({ screen, plan, edit }) {
  if (screen.native)
    return (
      <Group title="Native canvas">
        <p>
          640 × 448 native coordinates. Select a layer to edit its position,
          size, text, styling and interaction ID.
        </p>
      </Group>
    );
  return (
    <>
      <Group title="Content">
        <TextField
          label="Title"
          multiline={false}
          value={screen.title}
          onChange={(v) =>
            edit((s) => {
              s.title = v;
            }, "Change title")
          }
        />
      </Group>
      <Group title="Layout">
        <Field
          label="Content width"
          type="number"
          value={screen.width}
          onChange={(v) =>
            edit((s) => {
              s.width = v;
            }, "Change panel width")
          }
          help={
            "Side padding adds " +
            (screen.compact ? 24 : 32) +
            " units. Height follows content."
          }
        />
        <Field
          label="Spacing"
          value={screen.compact ? "compact" : "standard"}
          options={[
            ["compact", "Compact"],
            ["standard", "Comfortable"],
          ]}
          onChange={(v) =>
            edit((s) => {
              s.compact = v === "compact";
            }, "Change spacing")
          }
        />
      </Group>
      <Group title="Placement">
        <Field
          label="Position"
          value={screen.placement.kind}
          options={[
            ["center", "Centered"],
            ["top", "Top"],
            ["at", "Custom position"],
          ]}
          onChange={(v) =>
            edit((s) => {
              s.placement =
                v === "at"
                  ? { kind: v, x: plan?.x || 0, y: plan?.y || 0 }
                  : { kind: v };
            }, "Change panel placement")
          }
        />
        {screen.placement.kind === "at" && (
          <Pair>
            {["x", "y"].map((axis) => (
              <Field
                key={axis}
                label={axis.toUpperCase()}
                type="number"
                value={screen.placement[axis]}
                onChange={(v) =>
                  edit((s) => {
                    s.placement[axis] = v;
                  }, "Change panel " + axis)
                }
              />
            ))}
          </Pair>
        )}
      </Group>
      <Advanced>
        <ScaleField
          label="UI scale (%)"
          value={screen.scale ?? 1}
          onChange={(v) =>
            edit((s) => {
              s.scale = v;
            }, "Scale panel")
          }
        />
      </Advanced>
    </>
  );
}
export function Geometry({ node, edit }) {
  const { selected, document: doc, screenName, state, plan } = useEditor();
  const screen = doc.screens[screenName],
    hit = plan?.hits.find((h) => same(h.path, selected));
  if (!hit) return null;
  const button = isButton(node),
    coords = button
      ? M.buttonPosition(node, state)
      : node.type === "transform"
        ? node
        : { x: 0, y: 0 },
    resize = R.begin(screen, selected, plan, state);
  return (
    <Group title="Position & size">
      <Pair geometry>
        {["x", "y"].map((axis) => (
          <Field
            key={axis}
            label={axis.toUpperCase()}
            type="number"
            value={coords[axis] ?? 0}
            onChange={(v) =>
              edit((n, s) => {
                if (button) M.setButtonPosition(n, state, { [axis]: v });
                else ensureTransform(s, selected)[axis] = v;
              }, "Change layer " + axis)
            }
          />
        ))}
        {[
          ["w", "x", "width"],
          ["h", "y", "height"],
        ].map(([key, axis, dimension]) => (
          <Field
            key={key}
            label={key.toUpperCase()}
            type="number"
            min={1}
            value={Number(hit[key].toFixed(2))}
            disabled={!resize?.axes.includes(axis)}
            title={
              axis === "y" && !resize?.axes.includes(axis)
                ? "Height follows text wrapping and content"
                : undefined
            }
            onChange={(v) =>
              edit(
                (_, s) =>
                  R.begin(s, selected, plan, state)?.apply({ [dimension]: v }),
                "Change layer " + dimension,
              )
            }
          />
        ))}
      </Pair>
      {button ? (
        <small>
          Position: {state === "default" ? "Default" : state} state only
        </small>
      ) : resize?.axes === "x" ? (
        <small>Width wraps the text. Drag either side handle.</small>
      ) : null}
    </Group>
  );
}
