import { M, L, variables, states, screenNames } from "./native.mjs";

export function previewScreen(document, name, state = "default") {
  const screen = M.clone(document.screens[name]),
    patch = states[name]?.[state];
  const values = Object.fromEntries(
    variables
      .filter((v) => v.screens === "*" || v.screens.split(",").includes(name))
      .map((v) => [v.key, v.sample]),
  );
  Object.assign(values, {
    "player.cash": 500,
    "player.bank": 1200,
    "ui.title": screen.title.replaceAll(
      "{title}",
      screen.samples?._title || "Live title",
    ),
    "ui.status": "",
  });
  if (name === "Auth")
    for (const key of ["player.cash", "player.bank", "player.skin"])
      delete values[key];
  if (name === "Radio" && !patch?.choice_name)
    for (const key of Object.keys(values))
      if (key.startsWith("station.")) delete values[key];
  if (patch?.outfit_name === null)
    for (const key of Object.keys(values))
      if (key.startsWith("outfit.")) delete values[key];
  screen.samples ||= {};
  screen.samples._variables = { ...values, ...screen.samples._variables };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value === null) delete screen.samples[key];
    else if (["_labels", "_styles", "_variables"].includes(key))
      screen.samples[key] = { ...screen.samples[key], ...value };
    else screen.samples[key] = value;
  }
  if (patch?.status?.length && !patch._variables?.["ui.status"])
    screen.samples._variables["ui.status"] = patch.status
      .filter((r) => r.type === "text")
      .map((r) => r.text)
      .join("\n");
  screen.samples._variables["ui.state"] = state;
  return screen;
}
export function captionValues(preview, button, path) {
  const values = { ...preview.samples?._variables };
  if (button) {
    let original = preview.samples?._labels?.[M.key(button.action)];
    const controls = path?.lastIndexOf("controls") ?? -1;
    if (controls >= 0) {
      const binding = L.get(preview, path.slice(0, controls));
      original =
        M.interactionChoices(preview).find(
          (c) =>
            c.target.kind === "binding" &&
            c.target.key === binding.key &&
            (button.slot != null
              ? c.target.slot === button.slot
              : M.key(c.button.action) === M.key(button.action)),
        )?.button.label || original;
    }
    values["button.caption"] =
      original ||
      (!button.label.includes("{") ? button.label : M.key(button.action));
  }
  return values;
}
export function buttonTitle(name, preview, button, path) {
  return (
    button.name ||
    M.formatText(
      M.captionTemplate(name, button),
      captionValues(preview, button, path),
    ).replaceAll(
      "{label}",
      captionValues(preview, button, path)["button.caption"],
    ) ||
    M.key(button.action)
  );
}
export function rowTitle(row, preview) {
  if (row.name) return row.name;
  switch (row.type) {
    case "native":
      return row.element.id;
    case "text":
      return row.text || "Empty text";
    case "binding": {
      const sample = preview.samples?.[row.key];
      return sample?.[0]
        ? rowTitle(sample[0], preview)
        : row.key.replaceAll("_", " ");
    }
    case "section":
      return `When ${row.key}`;
    case "buttons":
      return "Group";
    case "transform":
      return row.rows.length === 1 ? rowTitle(row.rows[0], preview) : "Group";
    case "columns":
      return "Two columns";
    case "gap":
      return `${row.height} units of spacing`;
    case "preview":
      return `GTA model ${row.model}`;
    case "sprite":
      return row.texture;
    default:
      return "Separator";
  }
}
export function actionTitle(action) {
  const name = typeof action === "string" ? action : Object.keys(action)[0],
    arg = typeof action === "string" ? null : action[name];
  const names = {
    Submit: "Submit form",
    Password: "Edit password",
    ConfirmPassword: "Confirm password",
    Remember: "Toggle remembered login",
    Back: "Go back",
    Close: "Close screen",
    Quit: "Quit server",
    RadioChoice: "Play station",
    RadioFavoriteUrl: "Toggle station favorite",
    RadioFavorite: "Toggle selected station favorite",
    RadioPlay: "Play selected station",
    RadioOff: "Turn radio off",
    ClothingCategory: "Change outfit category",
    Outfit: "Browse outfits",
    Equip: "Equip / buy outfit",
  };
  if (name === "Open") return "Open " + (screenNames[arg] || arg);
  return (
    (names[name] || name.replace(/([a-z])([A-Z])/g, "$1 $2")) +
    (arg == null || ["RadioChoice", "RadioFavoriteUrl"].includes(name)
      ? ""
      : ` (${Array.isArray(arg) ? arg.join(", ") : arg})`)
  );
}
