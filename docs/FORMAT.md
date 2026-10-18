# Native UI format v1

The authoritative structural schema is [shared/ui.schema.json](../shared/ui.schema.json). The editor and Rust runtime additionally validate geometry sums, unique IDs, file size and native text constraints. Schema validation alone does not prove GTA rendering parity.

```json
{
  "format": "open-mp-ui",
  "version": 1,
  "name": "ButtonPanel",
  "elements": [
    {"id":"accept", "kind":"rect", "x":100, "y":100, "w":120, "h":24,
     "color":"#367DA2FF", "selectable":true},
    {"id":"accept.label", "kind":"text", "x":108, "y":105, "w":104, "h":14,
     "text":"Accept", "sx":0.2, "sy":1.1, "font":1}
  ]
}
```

Elements render in array order. Kinds: `text`, `rect`, `sprite`, `model`. Required element fields: `id`, `kind`, `x`, `y`, `w`, `h`. Root fields are all required. Unknown properties are errors; the Rust parser also rejects duplicate JSON object fields.

| Property | Default / constraint |
| --- | --- |
| `id`, root `name` | Start with ASCII letter, then ASCII letters/digits/`_.-`; 1..64 bytes. IDs unique within a definition. |
| `x`, `y`, `w`, `h` | Finite native units; x/y ≥ 0, w/h > 0, x+w ≤ 640.01, y+h ≤ 448.01 (0.01 float tolerance). |
| `text` | `""`; printable ASCII, 0..512 bytes. Text primitives require nonempty text without `~%{}`; sprites require `library:texture`, at most 96 bytes. |
| `color` | `"#FFFFFFFF"`; exactly `#RRGGBBAA`. |
| `font` | `1`; integer 0..3. Used by text. |
| `sx`, `sy` | `0.2`, `1`; 0.01..4, 0.01..10 native glyph scales. |
| `outline` | `0`; integer 0..8. |
| `selectable` | `false`; participates in native selection. |
| `enabled`, `visible` | `true`; dispatch and rendering flags. |
| `model` | `0`; unsigned 16-bit; model kind restricts this to 0..20000. Actual model availability depends on the game. |

There is no executable content, network fetch, font embedding or expression evaluation. Rectangles use `LD_SPAC:white`; sprites use native texture names; model previews use rotation (0,0,0) and zoom 1. Text uses left alignment, proportional spacing, zero shadow, black outline/background color, no native text box, and TextSize `(x+w,h)`. Rect/sprite/model TextSize uses `(w,h)`.

Files are UTF-8 JSON ≤256 KiB, with 1..128 primitives. Runtime paths are confined to `scriptfiles/ui/`. Missing optional properties receive the same defaults in the browser and Rust. A breaking format change gets a new integer version; unknown future versions are rejected with an error. Version 1 remains the compatibility target for this release.

Editable project JSON uses the inherited `{version:1,screens:{...}}` structure and is a distinct format. Project files preserve flow layout, transforms and samples. Runtime JSON is flattened to primitives; importing it preserves primitive IDs, bounds and styles, without recovering discarded flow semantics. Save the project before exporting. Conditional/live samples and selected state are frozen during export. Dynamic state is supplied by Pawn updates.
