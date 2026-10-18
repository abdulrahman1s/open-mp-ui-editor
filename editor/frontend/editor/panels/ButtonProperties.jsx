import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { useEditor } from "../EditorProvider";
import { M, vocabulary, same, parentScale } from "../native.mjs";
import { actionTitle, captionValues } from "../preview.mjs";
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
export function ButtonProperties({ button: b, edit }) {
  const {
    document: doc,
    screenName,
    selected,
    preview,
    plan,
    store,
  } = useEditor();
  const screen = doc.screens[screenName],
    [tab, setTab] = useState("Design"),
    sample = preview.samples?._styles?.[M.key(b.action)] || {};
  const style = (key, value) =>
    edit((n) => {
      n.style ||= {};
      n.style[key] = value;
    }, "Change " + key);
  const numeric = (label, key, fallback) => (
    <Field
      label={label}
      value={b.style?.[key] ?? fallback}
      type="number"
      onChange={(v) => style(key, v)}
    />
  );
  const color = (label, key, fallback) => (
    <ColorField
      label={label}
      value={b.style?.[key] || fallback}
      onChange={(v) => style(key, v)}
    />
  );
  const choices = [
    ["original", actionTitle(b.action)],
    [JSON.stringify({ kind: "none" }), "No action"],
    ...M.interactionChoices(preview).map((c) => [
      JSON.stringify(c.target),
      actionTitle(c.button.action) + " · " + c.label,
    ]),
  ];
  const click = b.on_click ? JSON.stringify(b.on_click) : "original";
  if (!choices.some(([v]) => v === click))
    choices.push([click, "Current game action"]);
  const action =
    typeof b.action === "string" ? b.action : Object.keys(b.action)[0];
  return (
    <>
      <Tabs value={tab} onValueChange={setTab} className="property-tabs">
        <TabsList className="w-full">
          {["Design", "Typography"].map((t) => (
            <TabsTrigger key={t} value={t} className="flex-1 text-xs">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <section className="property-section" hidden={tab !== "Design"}>
        <Group title="Content">
          <TextField
            label="Caption"
            value={M.captionTemplate(screenName, b)}
            onChange={(v) =>
              edit((n) => {
                n.label = v;
              }, "Change caption")
            }
          />
          <div className="template-preview">
            {M.formatText(
              M.captionTemplate(screenName, b),
              captionValues(preview, b, selected),
            )}
          </div>
          <small>Values in {"{{…}}"} update automatically in game.</small>
        </Group>
        <Group title="Interaction">
          <Field
            label="Element ID"
            value={b.id || ""}
            help="Unique ID received by OnUIClick. Use letters, numbers, _, . or -."
            onChange={(v) =>
              edit((n) => {
                n.id = v;
              }, "Change element ID")
            }
          />
          <Field
            label="On click"
            value={click}
            options={choices}
            onChange={(v) =>
              edit(
                (n) => {
                  if (v === "original") delete n.on_click;
                  else n.on_click = JSON.parse(v);
                },
                "Change button action",
                null,
              )
            }
          />
        </Group>
        <Disclosure title="Container & padding">
          <Field
            label="Width behavior"
            value={b.width == null ? "auto" : "fixed"}
            options={[
              ["auto", "Fill available space"],
              ["fixed", "Fixed width"],
            ]}
            onChange={(v) =>
              edit(
                (n, s) => {
                  if (v === "auto") delete n.width;
                  else {
                    const hit = plan.hits.find((h) => same(h.path, selected));
                    n.width = hit
                      ? hit.w /
                        (parentScale(s, selected).sx * (n.style?.scale_x ?? 1))
                      : 90;
                  }
                },
                "Change button width behavior",
                null,
              )
            }
          />
          <Pair>
            {numeric("Padding X", "padding_x", screen.compact ? 5 : 0)}
            {numeric("Padding Y", "padding_y", screen.compact ? 2 : 0)}
          </Pair>
        </Disclosure>
        <Disclosure title="Fill & border">
          <Field
            label="Show background"
            type="checkbox"
            value={b.background ?? sample.background ?? true}
            onChange={(v) =>
              edit(
                (n) => {
                  n.background = v;
                },
                "Toggle button background",
                null,
              )
            }
          />
          {color("Fill color", "background_color", "#1C2528D9")}
          {numeric("Border width", "border_width", 0)}
          {color("Border color", "border_color", M.ACCENT)}
        </Disclosure>
        <button
          onClick={() =>
            edit(
              (n) => {
                delete n.style;
                delete n.width;
                delete n.primary;
                delete n.background;
              },
              "Reset button appearance",
              null,
            )
          }
        >
          Reset appearance
        </button>
      </section>
      <section className="property-section" hidden={tab !== "Typography"}>
        <Group
          title="Font"
          description="These controls change the letters only."
        >
          <Field
            label="Font family"
            value={String(b.style?.font ?? ((b.body ?? sample.body) ? 1 : 2))}
            options={[
              ["0", "GTA bank"],
              ["1", "GTA standard"],
              ["2", "GTA menu"],
              ["3", "GTA heading"],
            ]}
            onChange={(v) => style("font", Number(v))}
          />
          <ScaleField
            label="Font size (%)"
            value={
              (b.style?.text_scale_y ?? (screen.compact ? 1 : 1.3)) /
              (screen.compact ? 1 : 1.3)
            }
            onChange={(v) =>
              edit((n) => {
                n.style ||= {};
                n.style.text_scale_x = (screen.compact ? 0.2 : 0.26) * v;
                n.style.text_scale_y = (screen.compact ? 1 : 1.3) * v;
              }, "Change font size")
            }
          />
          <Advanced>
            <Pair>
              {numeric(
                "Glyph width",
                "text_scale_x",
                screen.compact ? 0.2 : 0.26,
              )}
              {numeric(
                "Glyph height",
                "text_scale_y",
                screen.compact ? 1 : 1.3,
              )}
            </Pair>
          </Advanced>
          {numeric("Outline", "outline", 1)}
          {color("Text color", "text_color", b.primary ? M.ACCENT : M.TEXT)}
        </Group>
        <Disclosure title="Text position">
          <Pair>
            {numeric("Offset X", "text_x", 0)}
            {numeric("Offset Y", "text_y", 0)}
          </Pair>
        </Disclosure>
      </section>
      <Advanced>
        <Group title="Layer scale">
          <Pair>
            <ScaleField
              label="Scale X (%)"
              value={b.style?.scale_x ?? 1}
              onChange={(v) => style("scale_x", v)}
            />
            <ScaleField
              label="Scale Y (%)"
              value={b.style?.scale_y ?? 1}
              onChange={(v) => style("scale_y", v)}
            />
          </Pair>
        </Group>
        <Field
          label="Primary state"
          type="checkbox"
          value={Boolean(b.primary)}
          onChange={(v) =>
            edit(
              (n) => {
                n.primary = v;
              },
              "Change primary state",
              null,
            )
          }
        />
        <Field
          label="Game action"
          disabled={b.slot != null}
          value={action}
          options={Object.keys(vocabulary.actions).map((n) => [n, n])}
          onChange={(v) =>
            edit(
              (n) => {
                const types = vocabulary.actions[v];
                n.action = types.length
                  ? {
                      [v]:
                        types.length === 1
                          ? types[0] === "Screen"
                            ? "Services"
                            : types[0] === "String"
                              ? ""
                              : types[0] === "bool"
                                ? false
                                : 0
                          : types.map((t) =>
                              t === "bool" ? false : t === "String" ? "" : 0,
                            ),
                    }
                  : v;
              },
              "Change game action",
              null,
            )
          }
        />
        {b.slot != null ? (
          <small>
            Live list control {b.slot + 1}. The game supplies its action.
          </small>
        ) : (
          typeof b.action !== "string" && (
            <Field
              label="Action arguments (JSON)"
              value={JSON.stringify(b.action[action])}
              onChange={(v) => {
                try {
                  const parsed = JSON.parse(v);
                  edit((n) => {
                    n.action[action] = parsed;
                  }, "Change action arguments");
                } catch {
                  store.notify("Enter valid JSON action arguments.");
                }
              }}
            />
          )
        )}
      </Advanced>
    </>
  );
}
