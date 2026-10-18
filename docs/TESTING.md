# Verification scope

- Node regression tests exercise inherited layer/model/resize/history/gesture/source/viewport interfaces.
- New export tests round-trip every example through JSON import, stylesheet compilation, planner and native export; validate schema and semantic errors; preserve IDs and interaction/style flags through transforms.
- `node scripts/export-examples.cjs` uses the actual browser export module. Rust tests load those files and allocate instances through the public runtime interface.
- Rust lifecycle tests use a recording engine adapter to test rollback, owner/player isolation, duplicate/malformed rejection, file confinement, resource caps, no-op updates, hidden/disabled/focus filtering, callback data and cleanup. They do not pretend to be an open.mp server.
- `scripts/integration.py` starts the real open.mp 1.5.8.3079 and 1.6.7.3218 Linux x86 servers in a disposable loopback directory. It compiles the public example/include and a dedicated verification script, creates two native NPC player objects, loads browser JSON, allocates/updates textdraws, selects, clicks, cancels, reenters from callbacks, disconnects and unloads.
- The integration build adds private `UITest_Click` / `UITest_Cancel` natives behind `UI_TEST_DRIVER`. They invoke the same SDK event handler production uses, after all real native allocation and lookup. Release builds exclude them. This verifies SDK/Pawn event transport and Rust click filtering, not network mouse packets or GTA controls.
- CI builds Linux and Windows x86 components; only Linux runs the real-server integration suite. Headless tests do not establish GTA glyph/rendering fidelity, hover appearance, client controls, network interpolation, populated-server throughput or Windows client compatibility. Test the final UI in-game.

Test output is saved in `artifacts/integration.log`. The runner bounds termination and reports a forced process stop separately from successful gameplay/resource cleanup. No test file, injected event, migration or failure touches a live server directory.
