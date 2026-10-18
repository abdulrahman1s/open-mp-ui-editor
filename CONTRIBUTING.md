# Contributing

Pull requests are welcome: bug fixes, editor improvements, examples and documentation. For a larger change, open an issue first to discuss the approach.

Open an issue with a minimal exported JSON and exact open.mp/platform version for runtime bugs. Include the relevant component log without credentials or player data. Rendering issues benefit from a GTA screenshot plus resolution, native font, sx/sy and texture name.

Keep server behaviour in root `src/` Rust modules; all Rust structs/enums live in `src/structures/`. The C++ adapter owns only named engine bindings and bounded AMX transport. Keep changes testable through the same runtime interface callers use. Do not put gameplay/authentication rules in the editor or runtime.

Run the checks in the [development guide](docs/GUIDE.md#local-development-and-checks) before sending a pull request. Changes to native types need both x86 builds and the isolated integration suite. Changes to the export contract need browser/Rust interoperability tests and documentation; preserve version-1 defaults or introduce a new version for breaking changes. Never run test injection against live state. Never distribute the test-driver binary.

Use concise commits describing observable behaviour. Document rendering limits honestly. Preserve the bundled preview font/sprite/HUD assets. Do not commit credentials, databases, node_modules, target directories or downloaded server distributions. Contributions are under the project's MIT license; retain third-party notices.
