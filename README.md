# open.mp UI editor

Design UIs in your browser, export JSON, and use them in open.mp with Pawn callbacks.

**[Open the editor](https://abdulrahman1s.github.io/open-mp-ui-editor/)** · [Download](https://github.com/abdulrahman1s/open-mp-ui-editor/releases) · [Full guide](docs/GUIDE.md)

![Editor workspace](docs/editor.png)

- Visual editing with layers, drag/resize, undo/redo and local saves.
- Original GTA fonts, 449 sprite previews and HUD reference assets.
- Text, rectangles, sprites, model preview elements and clickable buttons.
- Independent per-player UI instances with dynamic text, color and bounds.
- Login, HUD, inventory, menu and button-panel [examples](examples/).

No account, editor installation or backend required.

## Get started

1. Download the [release](https://github.com/abdulrahman1s/open-mp-ui-editor/releases/latest) for your server OS.
2. Copy the `.so` or `.dll` into your server's `components/` directory. Keep the standard Pawn and TextDraws components enabled, then restart.
3. Copy `pawn/include/open_mp_ui_editor.inc` into your Pawn include directory.
4. Open the [editor](https://abdulrahman1s.github.io/open-mp-ui-editor/), design a screen and choose **Export runtime JSON**.
5. Save the export under `scriptfiles/ui/` and load it from Pawn.

For a working example, copy [login.json](examples/login.json) to `scriptfiles/ui/login.json`, then compile and run [quickstart.pwn](pawn/examples/quickstart.pwn). It opens the panel on connect and handles Sign in, Cancel and Escape.

With sampctl 1.16.0+ and an open.mp runtime configured, you can install the component and include together:

```sh
sampctl install component://abdulrahman1s/open-mp-ui-editor:v0.1.1
```

Use the `component://` prefix so the binary goes into `components/`. [Pawndex](https://packages.open.mp/packages) discovery is automatic from GitHub; listing is pending.

## Pawn API

Load a definition once, then create an instance for each player:

```pawn
new UI:ui = UI_Load("login.json");
new UIInstance:instance = UI_Show(playerid, ui);
UI_Select(playerid, instance);
```

Handle buttons by their editor IDs:

```pawn
public OnUIClick(playerid, UI:ui, UIInstance:instance, const elementId[])
{
    if (!strcmp(elementId, "login_button"))
        UI_SetText(playerid, instance, "status", "Button received by Pawn.");
    return 1;
}
```

Use `UI_Hide` / `UI_ShowInstance` to toggle an existing instance, `UI_Destroy` to release it, and `UI_Unload` to release a definition and its instances. Disconnects clean up player instances automatically. `UI_Show` creates a new instance each time. Check load/show results and use `UI_GetLastError` for failures.

See the [complete example](pawn/examples/quickstart.pwn), [API reference](docs/GUIDE.md#pawn-interface) and [include](pawn/include/open_mp_ui_editor.inc).

## Compatibility

Version **0.1.1** supports **32-bit Linux and Windows**, targeting open.mp **1.5.8.3079** and **1.6.7.3218**. Linux has real-server integration tests; Windows builds in CI. Linux releases require 32-bit glibc 2.39+ and GLIBCXX_3.4.21+.

Rendering uses native player textdraws on a **640 × 448** coordinate space. Text is single-line printable ASCII; buttons use native selection. There is no HTML/CSS renderer or native text input. Use open.mp dialogs for input. Model previews and final appearance need checking in a GTA client.

Limits: 128 primitives per definition, 8 instances and 256 owned primitives per player. Hidden instances retain resources. See [rendering limits](docs/GUIDE.md#rendering-limitations) and [tested coverage](docs/TESTING.md).

## Development

Requires Node.js 24+, Python 3.11+, Rust, CMake, Ninja and a C++17 compiler. Native builds need a matching 32-bit toolchain.

```sh
cd editor
npm ci
npm test
npm run build
cd ..
cargo test --locked
python3 scripts/site.py
python3 -m http.server 8877 --directory site
```

Open `http://localhost:8877/`. NixOS developers can use the locked flake:

```sh
nix develop ./nix
# Native Linux build shell:
nix develop ./nix#i686
```

[Build and test instructions](docs/GUIDE.md#local-development-and-checks) · [Architecture](docs/ARCHITECTURE.md) · [JSON format](docs/FORMAT.md) · [Troubleshooting](docs/GUIDE.md#troubleshooting-and-faq)

GitHub Actions tests and builds both platforms. Passing `main` builds deploy the editor to GitHub Pages; version tags publish release archives and checksums. [Deployment details](docs/GUIDE.md#ci-pages-and-releases).

## Contributing

**Pull requests are welcome!** Bug fixes, editor improvements, examples and documentation are all useful. See [CONTRIBUTING.md](CONTRIBUTING.md) for checks and guidelines. You can also [open an issue](https://github.com/abdulrahman1s/open-mp-ui-editor/issues) with bugs or suggestions.

Project code is [MIT licensed](LICENSE). GTA preview assets retain their original ownership; see [third-party notices](THIRD_PARTY_NOTICES.md). This is a community project, unaffiliated with Rockstar Games.
