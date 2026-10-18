import React from "react";
import { Field, Pair, Group, ColorField } from "../components/Fields";
export function NativeProperties({ node, edit }) {
  let target = node;
  while (target.type === "transform" && target.rows.length === 1)
    target = target.rows[0];
  const e = target.element;
  const set = (key, value) =>
    edit((n) => {
      while (n.type === "transform" && n.rows.length === 1) n = n.rows[0];
      n.element[key] = value;
    }, "Change native " + key);
  return (
    <>
      <Group title="Native primitive">
        <Field label="Element ID" value={e.id} onChange={(v) => set("id", v)} />
        <small>Used for updates and OnUIClick in Pawn.</small>
        <Pair>
          {["x", "y", "w", "h"].map((k) => (
            <Field
              key={k}
              label={k.toUpperCase()}
              type="number"
              value={e[k]}
              onChange={(v) => set(k, v)}
            />
          ))}
        </Pair>
        <ColorField
          label="Color"
          value={e.color}
          onChange={(v) => set("color", v)}
        />
        {["text", "sprite"].includes(e.kind) && (
          <Field
            label={e.kind === "sprite" ? "Texture (library:texture)" : "Text"}
            value={e.text}
            onChange={(v) => set("text", v)}
          />
        )}
        {e.kind === "model" && (
          <Field
            label="Model ID"
            type="number"
            value={e.model}
            onChange={(v) => set("model", v)}
          />
        )}
        {e.kind === "text" && (
          <>
            <Field
              label="Font"
              value={String(e.font)}
              options={[
                ["0", "GTA script"],
                ["1", "GTA standard"],
                ["2", "GTA menu"],
                ["3", "GTA heading"],
              ]}
              onChange={(v) => set("font", Number(v))}
            />
            <Pair>
              {["sx", "sy", "outline"].map((k) => (
                <Field
                  key={k}
                  label={k}
                  type="number"
                  value={e[k]}
                  onChange={(v) => set(k, v)}
                />
              ))}
            </Pair>
          </>
        )}
      </Group>
      <Group title="Interaction">
        {["selectable", "enabled", "visible"].map((k) => (
          <Field
            key={k}
            label={k}
            type="checkbox"
            value={e[k]}
            onChange={(v) => set(k, v)}
          />
        ))}
      </Group>
    </>
  );
}
