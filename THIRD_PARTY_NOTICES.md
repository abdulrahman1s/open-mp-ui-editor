# Third-party notices

- The editor evolves the San Andreas Life Interface studio source supplied for this project. Its layout/store/layer/gesture/stylesheet code is retained with regression fixtures. Extracted GTA font atlases, sprite bitmaps and HUD screenshots are excluded.
- Local shadcn/ui sources retain their MIT notice in `editor/frontend/components/ui/LICENSE`.
- React, Radix UI, lucide-react, class-variance-authority, clsx, tailwind-merge, Tailwind CSS and esbuild are installed from the locked npm dependency graph under their upstream licenses. Generated editor bundles preserve legal comments. Ajv and Prettier are development dependencies.
- The official open.mp SDK is fetched by CMake from pinned pawn-template commit `28ca281e00a5650d116b8e7a903eba0868586d3a`, which pins SDK commit `1e38f14f3bbaabbda41cb2ae9ab920b588c3f3bb` and compiler headers. SDK MIT notices, compiler header licensing and bundled glm/robin-hood/span-lite/string-view-lite notices remain in those upstream sources. [SDK](https://github.com/openmultiplayer/open.mp-sdk), [compiler](https://github.com/openmultiplayer/compiler).
- serde and serde_json use their upstream MIT/Apache-2.0 dual license. Cargo.lock pins dependencies.
- The open.mp server distribution used for integration tests is downloaded only for isolated verification and is not bundled in project releases. open.mp is licensed separately under MPL-2.0.

No claim of ownership is made over GTA, Rockstar trademarks, game texture names or open.mp. This project does not ship game files.

Full runtime dependency license notices are in `LICENSES/` and included in binary archives.
