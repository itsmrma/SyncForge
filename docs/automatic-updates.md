# Automatic updates

The GUI supports signed updates in these release packages:

| Platform | Package | Applying an update |
|---|---|---|
| Windows x64 | Per-user NSIS installer | NSIS installs in passive mode and reopens the app |
| macOS Intel / Apple Silicon | Universal `SyncForge.app` | Replace the app bundle and restart with Tauri |
| Linux x64 | AppImage | Replace the AppImage file and restart with Tauri |

Windows portable executables, standalone Linux binaries, development builds, and the
standalone CLI remain manual downloads. Only Windows has an installer. NSIS writes
`syncforge-installed` beside `SyncForge.exe` and removes it on uninstall. A macOS
executable must run from an `.app/Contents/MacOS` bundle, and Linux must run from an
AppImage (using Tauri's `APPIMAGE` environment information). Do not move a Windows
portable executable into an installed directory.

The app checks GitHub Releases' `latest.json` at startup and every four hours while
running when **Automatically download updates** is enabled. Manual checks also
download available updates. Rust verifies the signature before retaining a download
in memory. Closing Settings keeps the download; exiting discards it, and a later
launch downloads it again. **Restart to install** is explicit and shares the media
task admission lock, preventing overlap or races with newly started media tasks.
Failed downloads/installation can be retried. macOS/Linux restart only after a
successful replacement; failures leave the application open with an error.

## Platform notes

macOS uses `signingIdentity: "-"` (ad-hoc signing). The release workflow compiles
without bundling, then explicitly merges the architecture-specific `syncforge-cli`
binaries with `lipo`. Tauri merges the GUI automatically, but does not merge additional
Cargo binaries. Both must exist in the universal output directory before `tauri bundle`
signs the complete app and produces its updater `.app.tar.gz` and signature. Packaging
verifies the code signature and both Mach-O architectures in both binaries, then copies
that exact archive and signature. Never modify/re-sign the bundle after generating it.
This does not require an Apple Developer account. The app is not Apple-notarized:
Gatekeeper may require manual approval, and automatic updates do not remove that
restriction. Keep the app in a normal application folder, not on a read-only disk.
Tools should live beside the `.app`, outside the bundle that updates replace.

Linux AppImage users should keep the file in a writable directory and make it
executable (`chmod +x SyncForge-Linux-<version>-x86_64.AppImage`). The updater preserves
permissions and Tauri relaunches the AppImage rather than its mounted inner binary.
Media tools beside the AppImage, including `tools/` and `bin/`, are discovered.
External tools have AppImage library directories removed from `LD_LIBRARY_PATH`,
preserving the user's other library paths and any original path provided by the runtime.
The initial AppImage download replaces the standalone binary workflow once; later
updates use Settings. AppImage builds use Ubuntu 22.04 as the compatibility baseline.

## Signing setup

The public updater key is committed in `src-tauri/tauri.conf.json`, shared by all
platforms. These configured GitHub Actions secrets sign every update package:

- `TAURI_SIGNING_PRIVATE_KEY`: full private key contents.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: password for that key.

Keep an offline backup of the private key and password. Losing the key breaks the
trust chain for installed versions. Never commit either secret. Public-key rotation
requires a migration plan. Updater signatures are distinct from Apple Developer ID,
Apple notarization, and Windows Authenticode.

## Publishing

Merge the version bump, tag the merged commit (`git tag -a v3.5.3 -m "v3.5.3: Cross-platform automatic updates"`),
and push `main` and the tag. For `workflow_dispatch`, select the release tag. The
selected tag must match the application version. Do not publish an unmerged PR.

All build jobs upload signed packages. Only after they all complete does the release
job generate a single `latest.json` from the combined assets. Missing/empty bundles
or signatures fail publishing. The manifest contains `windows-x86_64`,
`darwin-aarch64`, `darwin-x86_64`, and `linux-x86_64`; the two macOS entries reference
the same universal archive. URLs point to version-specific assets, and signatures
are the exact `.sig` contents. Do not remove the current release's update assets.
GitHub's `/releases/latest` excludes prereleases.

## Native smoke tests

Use two published signed versions on each OS. Verify startup/manual download,
closing/reopening Settings, restart and version change, offline retry, and media
task lockout. Windows portable and standalone Linux binaries must only offer the
Releases link. On macOS test Gatekeeper and bundle replacement on Intel and Apple
Silicon; on Linux test writable and read-only AppImage locations, executable-bit
preservation, restart, and media tools beside the file. These native runs are
separate from browser mocks and compilation; cross-platform publishing must not be
described as end-to-end verified solely from Windows-host tests.
