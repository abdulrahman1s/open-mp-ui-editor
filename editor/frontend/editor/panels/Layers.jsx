import React, { useRef, useState } from "react";
import {
  Layers as LayersIcon,
  History,
  Group,
  Ungroup,
  Copy,
  Trash2,
  PanelTop,
  Eye,
  EyeOff,
  LockKeyhole,
  LockKeyholeOpen,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { Button } from "../../components/ui/button";
import { useEditor } from "../EditorProvider";
import { L, same, isButton } from "../native.mjs";
import { groupTargets } from "../store.mjs";
import { layerTree } from "../layer-tree.mjs";
import { Tool } from "../components/Tool";

export function Layers() {
  const {
    document: doc,
    screenName,
    preview,
    selected,
    multi,
    view,
    store,
  } = useEditor();
  const screen = doc.screens[screenName],
    [tab, setTab] = useState("layers"),
    [collapsed, setCollapsed] = useState(new Set()),
    dragged = useRef(null);
  const locked = multi.some((p) => L.state(screen, p).locked),
    editable =
      multi.length > 0 &&
      !locked &&
      multi.every(
        (p) => Number.isInteger(p.at(-1)) && !Array.isArray(L.get(screen, p)),
      );
  const target = multi.length === 1 ? L.get(screen, multi[0]) : null;
  const canUngroup =
    !locked &&
    target?.type === "transform" &&
    target.x === 0 &&
    target.y === 0 &&
    target.scale_x === 1 &&
    target.scale_y === 1 &&
    target.width == null &&
    !target.hidden;
  const entries = layerTree(screen, preview, screenName, {
    advanced: view.advanced,
    selected,
    collapsed,
  });
  return (
    <section className="outline panel" aria-label="Layers and history">
      <div className="layer-header">
        <Tabs value={tab} onValueChange={setTab} className="layer-navigation">
          <TabsList className="w-full">
            <TabsTrigger
              id="layers-tab"
              value="layers"
              className="flex-1 text-xs"
            >
              <LayersIcon size={13} />
              Layers
            </TabsTrigger>
            <TabsTrigger
              id="history-tab"
              value="history"
              className="flex-1 text-xs"
            >
              <History size={13} />
              History
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "layers" && (
          <div id="layer-toolbar" className="layer-toolbar">
            <div className="layer-tools">
              <Tool
                icon={Group}
                label="Group selected layers (Ctrl / ⌘ G)"
                disabled={!editable || !groupTargets(screen, multi)}
                onClick={() => store.layer("group")}
              />
              <Tool
                icon={Ungroup}
                label="Ungroup selected layer"
                disabled={!canUngroup}
                onClick={() => store.layer("ungroup")}
              />
              <Tool
                icon={Copy}
                label="Duplicate selected layers"
                disabled={!editable}
                onClick={() => store.layer("duplicate")}
              />
              <Tool
                icon={Trash2}
                label="Delete selected layers"
                disabled={!editable}
                onClick={() => store.layer("delete")}
              />
            </div>
          </div>
        )}
      </div>
      {tab === "layers" ? (
        <>
          <Button
            id="select-panel"
            variant="ghost"
            size="sm"
            className={"panel-layer" + (selected === null ? " active" : "")}
            onClick={() => store.select(null)}
          >
            <PanelTop size={14} />
            Screen container<span className="layer-badge">Panel</span>
          </Button>
          <div
            id="tree"
            role="tabpanel"
            aria-labelledby="layers-tab"
            className="tree"
            aria-label="Layout layers"
          >
            {entries.map((entry) => (
              <Layer
                key={
                  JSON.stringify(entry.path) + ":" + (entry.live?.slot ?? "")
                }
                entry={entry}
                collapsed={collapsed}
                setCollapsed={setCollapsed}
                dragged={dragged}
              />
            ))}
          </div>
        </>
      ) : (
        <section
          id="history-pane"
          role="tabpanel"
          aria-labelledby="history-tab"
        >
          <p className="history-help">
            Click to restore a step. History survives refresh.
          </p>
          <div id="history-list">
            {store.timeline.entries.map((step) => (
              <button
                key={step.index}
                className={
                  "history-step" +
                  (step.current ? " current" : "") +
                  (step.future ? " future" : "")
                }
                aria-current={step.current ? "step" : undefined}
                onClick={() => store.restore(step.index)}
              >
                {step.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
function Layer({ entry, collapsed, setCollapsed, dragged }) {
  const { document: doc, screenName, multi, view, store } = useEditor();
  const { value, path, label, depth, branch, live, pending } = entry,
    screen = doc.screens[screenName],
    state = L.state(screen, path),
    key = JSON.stringify(path);
  const [rename, setRename] = useState(null),
    [drop, setDrop] = useState(false),
    cancelled = useRef(false);
  const group =
      (value?.type === "transform" && value.rows.length > 1) ||
      ["section", "columns"].includes(value?.type),
    active = !pending && multi.some((p) => same(p, path));
  const display =
    value?.type === "transform" && value.rows.length === 1
      ? value.rows[0]
      : value;
  const kind = group
    ? "▱"
    : isButton(display)
      ? "▭"
      : display?.type === "sprite"
        ? "▧"
        : display?.type === "binding"
          ? "{}"
          : display?.type === "rule"
            ? "—"
            : "T";
  const editPath = () =>
    pending ? store.materialize(live.binding, live.action, live.slot) : path;
  const choose = (e) =>
    store.select(
      live ? store.materialize(live.binding, live.action, live.slot) : path,
      e,
      view.advanced,
    );
  function saveName() {
    if (cancelled.current || rename === null) return;
    const name = rename.trim() || label,
      target = editPath();
    setRename(null);
    store.edit((s) => L.metadata(s, target, "name", name), {
      label: "Rename layer",
    });
  }
  return (
    <div
      className={
        "layer-row" +
        (active ? " active" : "") +
        (state.hidden ? " layer-hidden" : "") +
        (state.locked ? " layer-locked" : "") +
        (drop ? " drop-target" : "")
      }
      data-path={key}
      data-pending={pending || undefined}
      draggable={
        !branch &&
        !state.locked &&
        !live &&
        !pending &&
        value.slot == null &&
        rename === null
      }
      onDragStart={(e) => {
        if (e.target.closest(".layer-control")) {
          e.preventDefault();
          return;
        }
        dragged.current = path;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", key);
      }}
      onDragOver={(e) => {
        if (dragged.current && !state.locked && !live) {
          e.preventDefault();
          setDrop(true);
        }
      }}
      onDragLeave={() => setDrop(false)}
      onDragEnd={() => {
        dragged.current = null;
        setDrop(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDrop(false);
        const from = dragged.current;
        dragged.current = null;
        if (!from) return;
        store.edit(
          (s, c) => {
            c.selected = L.move(
              s,
              from,
              path,
              e.altKey && value?.type === "transform",
            );
            c.multiSelection = [c.selected];
          },
          { label: "Reorder layer" },
        );
      }}
    >
      {group && (
        <button
          className="layer-control fold-layer"
          aria-label={(collapsed.has(key) ? "Expand " : "Collapse ") + label}
          onClick={() =>
            setCollapsed((old) => {
              const next = new Set(old);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            })
          }
        >
          {collapsed.has(key) ? "›" : "⌄"}
        </button>
      )}
      {rename !== null ? (
        <input
          className="layer-rename"
          aria-label="Layer name"
          autoFocus
          value={rename}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setRename(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              saveName();
            }
            if (e.key === "Escape") {
              cancelled.current = true;
              setRename(null);
            }
          }}
        />
      ) : (
        <button
          type="button"
          title={label}
          className="layer-select"
          aria-pressed={active}
          style={{ paddingLeft: 6 + depth * 12 }}
          onClick={choose}
          onDoubleClick={() => {
            if (!branch && !state.locked) {
              cancelled.current = false;
              setRename(value.name || label);
            }
          }}
        >
          <span className="kind">{branch ? "›" : kind}</span>
          <span className="layer-name">{label}</span>
        </button>
      )}
      {!branch &&
        [
          ["hidden", value.hidden],
          ["locked", value.locked],
        ].map(([flag, on]) => {
          const Icon =
            flag === "hidden"
              ? on
                ? EyeOff
                : Eye
              : on
                ? LockKeyhole
                : LockKeyholeOpen;
          return (
            <button
              key={flag}
              className={
                "layer-control " +
                (flag === "hidden" ? "visibility-control" : "lock-control") +
                (on ? " on" : "")
              }
              aria-label={
                (flag === "hidden"
                  ? on
                    ? "Show "
                    : "Hide "
                  : on
                    ? "Unlock "
                    : "Lock ") + label
              }
              aria-pressed={Boolean(on)}
              onClick={() => {
                const target = editPath();
                store.edit(
                  (s, c) => {
                    L.metadata(s, target, flag, !on);
                    c.selected = target;
                    c.multiSelection = [target];
                  },
                  {
                    label:
                      flag === "hidden"
                        ? "Toggle layer visibility"
                        : "Toggle layer lock",
                  },
                );
              }}
            >
              <Icon size={13} />
            </button>
          );
        })}
    </div>
  );
}
