# Development

Application code lives in `src/syncforge`. `core` contains shared media, process,
and task utilities; `features` contains processing modes; `ui` implements the
desktop API and frontend bridge. `app.py` is the shared installed/source/frozen
entry point. `main.py` remains a compatibility launcher.

The frontend source is in `web/src`. Its components, module definitions, theme,
and fonts are separate. Vite builds into `src/syncforge/web/dist`, so the same
assets ship with both wheels and standalone executables. Generated files are
ignored by Git.

## Source setup

Install uv and Node.js, then run:

```sh
uv sync --locked
cd web
npm ci
npm run build
cd ..
uv run syncforge
```

`uv run python -m syncforge` and `uv run python main.py` launch the same app.
MKVToolNix and FFmpeg must be available on `PATH`; ffsubsync is a Python dependency.

## Verification

```sh
cd web
npm run lint
npm run build
npx playwright install --only-shell chromium
npm test
cd ..
uv run python -m unittest discover -s tests -v
```

Browser tests cover file/folder selection, dialogs, source ordering, sidebar
collapse/resize, and terminal scrolling. Python tests include single-file and
batch processing with small real media fixtures; install MKVToolNix and
FFmpeg to run these integration tests.

## Distributions

Build the frontend first, then:

```sh
uv run --group build python scripts/build.py
uv run --group build python tests/smoke_bundle.py dist/SyncForge.exe
uv build --wheel --out-dir build/packages
uv run python tests/smoke_package.py build/packages/syncforge-2.1-py3-none-any.whl
```

Use `dist/SyncForge` on Linux/macOS. PyInstaller belongs to the `build` dependency
group. The builder resolves paths from its own location, writes intermediates
under `build`, and places executables in `dist`.

Tag pushes build and browser-test the frontend once on Linux, then share it with
the three release builds. Python/media tests and frozen synchronizer checks run
on every platform. The Linux build also verifies the installed wheel, including
its frontend assets. Releases publish only after all builds pass.

Release versions and executable filenames must include at least a major and minor
number, for example `SyncForge-Linux-2.1`, `SyncForge-macOS-2.1`, and
`SyncForge-Windows-2.1.exe`. Patch versions keep their third component. The workflow
adds `.0` to a major-only tag such as `v2`; prefer decimal versions in future tags.

`CHANGELOG.md` contains only the current release's changes. Replace its contents
for the next release instead of appending the previous release history. Use a
heading such as `## 2.1 - Single File Selection`; the workflow prefixes it with `Ver`
for the release title. Previous notes remain available in Git history and releases.

Inter fonts are local and their license is included in `web/public/Inter-LICENSE.txt`.
