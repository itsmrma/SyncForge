# Windows installer updates

Windows releases contain a per-user NSIS installer, a portable GUI executable, and
the standalone CLI. Only the installed GUI opts into automatic updates. NSIS writes
`syncforge-installed` beside `SyncForge.exe`; uninstall removes the marker. Moving a
portable executable into an installed directory is not a supported portable setup.
Development builds never install updates. Linux and macOS packaging stays unchanged.

The app checks the GitHub Releases `latest.json` endpoint at startup and every four
hours while running when **Automatically download updates** is enabled. Manual
checks also download an available update. The Rust updater verifies its signature
before retaining it in memory. Closing Settings keeps the downloaded update; exiting
the application discards it and a later launch downloads it again. Installation
requires an explicit **Restart to install** action and shares the media task admission
lock, so it cannot interrupt a running task or race with a newly started task.
The Tauri Windows updater starts NSIS in passive mode, exits, and NSIS relaunches the app.

## Signing setup

The public updater key is committed in `src-tauri/tauri.windows.conf.json`. The
corresponding private key and password must be stored in these GitHub Actions secrets:

- `TAURI_SIGNING_PRIVATE_KEY`: full private key contents.
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: password for that key.

These secrets are configured for this repository. Keep an offline backup of the
private key and password; losing the key breaks the update trust chain for installed
versions. Never commit either secret. Changing only the public key prevents existing
installations from trusting new updates; key rotation requires a migration plan.
Updater signatures authenticate downloads; they are separate from Windows Authenticode
signing, so Windows SmartScreen may still warn for a new installer.

## Publishing

Merge the version bump, then tag that merged commit (`git tag -a v3.5.3 -m "v3.5.3: Windows installer and automatic updates"`)
and push `main` and the tag. The release workflow validates that the selected tag
matches the application version. For `workflow_dispatch`, select the release tag.
This PR prepares the release; it does not publish an unmerged branch as a release.

The Windows build creates a signed NSIS installer, copies its `.sig` unchanged, and
generates `latest.json` with a `windows-x86_64` platform entry and a version-specific
GitHub download URL. Release assets are published only after all platform builds
complete. Do not delete the installer or manifest of the latest release. Prereleases
are excluded by GitHub's `/releases/latest` endpoint.

## Native smoke test

Install a signed build on Windows, then publish a higher version signed with the
same key. Verify automatic and manual download, close/reopen Settings, restart and
version change, and failure recovery with the network offline. Run a media task while
an update is ready and confirm Restart to install is disabled and the backend rejects
installation. Verify the portable build only offers the Releases link. This needs two
published signed versions and is separate from browser mocks and Rust compilation.
