import React, { useEffect, useRef, useState } from "react";
import { useEditor } from "./EditorProvider";
import { M, sprites } from "./native.mjs";
import { Field, Pair } from "./components/Fields";

function Modal({ id, title, close, children, className }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog ref={ref} id={id} className={className} onCancel={close}>
      <div className="panel-header">
        <h2>{title}</h2>
        <button aria-label={"Close " + title.toLowerCase()} onClick={close}>
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function NewDesign({ close }) {
  const { store } = useEditor(),
    [title, setTitle] = useState("New screen"),
    [template, setTemplate] = useState("blank");
  function create(e) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    const document = M.clone(store.getSnapshot().document);
    let base = text.replace(/[^A-Za-z0-9]/g, "") || "CustomScreen";
    if (!/^[A-Za-z]/.test(base)) base = "Screen" + base;
    let name = base,
      count = 2;
    while (Object.hasOwn(document.screens, name)) name = base + count++;
    const rows =
      template === "blank"
        ? []
        : template === "columns"
          ? [
              {
                type: "columns",
                left_width: 0,
                left: [{ type: "text", text: "Left column", color: M.TEXT }],
                right: [{ type: "text", text: "Right column", color: M.TEXT }],
              },
            ]
          : [{ type: "text", text: "Start here.", color: M.TEXT }];
    document.screens[name] = {
      title: text,
      width: template === "columns" ? 300 : 220,
      compact: true,
      placement: { kind: "center" },
      rows,
      samples: {},
    };
    store.replace(document, { label: "Create " + text });
    store.navigate(name);
    close();
  }
  return (
    <Modal
      id="new-design"
      title="Create a new UI"
      close={close}
      className="new-design"
    >
      <form onSubmit={create}>
        <p>Start a named design for a new server feature.</p>
        <Field
          label="Design name"
          value={title}
          onChange={setTitle}
          autoFocus
          required
          maxLength={48}
        />
        <Field
          label="Starting layout"
          value={template}
          onChange={setTemplate}
          options={[
            ["blank", "Blank canvas"],
            ["compact", "Compact menu"],
            ["columns", "Two-column menu"],
          ]}
        />
        <p className="dialog-note">
          Export runtime JSON and handle button IDs in OnUIClick.
        </p>
        <div className="dialog-actions">
          <button type="button" onClick={close}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Create UI
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function SpriteBrowser({ close }) {
  const { document: doc, screenName, store } = useEditor(),
    [query, setQuery] = useState(""),
    [library, setLibrary] = useState(""),
    [limit, setLimit] = useState(60),
    [chosen, setChosen] = useState(null),
    [width, setWidth] = useState(32),
    [height, setHeight] = useState(32);
  const names = Object.keys(sprites),
    matches = names.filter(
      (n) =>
        (!library || n.startsWith(library + ":")) &&
        n.toLowerCase().includes(query.toLowerCase().trim()),
    );
  function add() {
    if (
      !chosen ||
      width < 1 ||
      width > doc.screens[screenName].width ||
      height < 1 ||
      height > 390
    ) {
      store.notify("Choose a sprite and dimensions that fit the panel.");
      return;
    }
    store.insert({
      type: "sprite",
      texture: chosen,
      width,
      height,
      color: "#FFFFFFFF",
    });
    close();
  }
  return (
    <Modal
      id="sprite-browser"
      title="GTA sprite library"
      close={close}
      className="sprite-browser"
    >
      <p>Explore native TextDraw textures before adding one.</p>
      <div className="sprite-filters">
        <input
          type="search"
          aria-label="Search sprites"
          placeholder="Search textures, icons, weapons…"
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setLimit(60);
          }}
        />
        <select
          aria-label="Library"
          value={library}
          onChange={(e) => {
            setLibrary(e.target.value);
            setLimit(60);
          }}
        >
          <option value="">All libraries</option>
          {[...new Set(names.map((n) => n.split(":")[0]))].sort().map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="sprite-body">
        <div>
          <p>{matches.length} sprites</p>
          <div className="sprite-grid">
            {matches.slice(0, limit).map((name) => (
              <button
                key={name}
                className={"sprite-card" + (name === chosen ? " selected" : "")}
                title={name}
                onClick={() => setChosen(name)}
              >
                <img src={sprites[name].image} alt="" loading="lazy" />
                <span>{name.split(":")[1]}</span>
              </button>
            ))}
          </div>
          {limit < matches.length && (
            <button onClick={() => setLimit((n) => n + 60)}>Show more</button>
          )}
        </div>
        <aside className="sprite-detail">
          <div className="sprite-large">
            {chosen && <img src={sprites[chosen].image} alt={chosen} />}
          </div>
          <h3>{chosen || "Choose a sprite"}</h3>
          <p>
            {chosen &&
              (sprites[chosen].uncached
                ? "Preview needs an internet connection"
                : "Cached for offline use")}
          </p>
          <Pair>
            <Field
              label="Width"
              type="number"
              min={1}
              max={500}
              value={width}
              onChange={setWidth}
            />
            <Field
              label="Height"
              type="number"
              min={1}
              max={390}
              value={height}
              onChange={setHeight}
            />
          </Pair>
          <button className="primary" disabled={!chosen} onClick={add}>
            Add sprite
          </button>
          <small>Uses the same library:texture name in game.</small>
        </aside>
      </div>
    </Modal>
  );
}
