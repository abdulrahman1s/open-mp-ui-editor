# Changelog

## 0.1.1

- Bundle the original GTA font atlases and glyph metrics with the public editor.
- Use the established WebGL renderer and restore cached sprite thumbnails/full previews.
- Restore the original HUD reference captures and asset verification tests.
- Include the assets in GitHub Pages staging and document client rendering limits.

## 0.1.0

- Retain the existing visual editor, layers, transforms, history, source tools and previews in a static browser application.
- Add versioned runtime JSON export/import and documented native schema.
- Add a Rust runtime with strict validation, bounded resources, script ownership and independent player instances.
- Add the official open.mp component adapter and Pawn click/cancel/update interface.
- Include five example UIs and a complete working Pawn integration example.
- Test browser exports against Rust and the real Linux x86 open.mp SDK/Pawn runtime.
- Build Linux/Windows x86 releases and deploy the editor through GitHub Pages.

Initial-release limits: 3D model preview placeholders, printable ASCII text, single focused instance per player and no general hover callbacks. Final GTA rendering/controls require client validation.
