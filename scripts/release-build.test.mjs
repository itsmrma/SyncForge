import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Exercise the actual workflow's orchestration with small artifact-producing tool doubles.
// Native Mach-O compilation/signing remains the macOS runner's responsibility.
test('macOS release stages both universal binaries before Tauri bundles the app', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'syncforge-release-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const workflow = await readFile(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8');
  const step = workflow.split('    - name: Build Tauri application and standalone syncforge-cli')[1]?.split('\n    - name:')[0];
  const run = step?.split('      run: |')[1]?.trimEnd().split('\n').slice(1)
    .map(line => line.slice(8)).join('\n').replaceAll('${{ runner.os }}', 'macOS');
  assert.ok(run, 'Release build step must expose a Bash run block');

  const harness = `
set -euo pipefail
bundle_app() {
  mkdir -p target/universal-apple-darwin/release/bundle/macos/SyncForge.app/Contents/MacOS
  for binary in SyncForge syncforge-cli; do
    cp "target/universal-apple-darwin/release/$binary" "target/universal-apple-darwin/release/bundle/macos/SyncForge.app/Contents/MacOS/$binary"
  done
}
npx() {
  if [[ "$*" == *"tauri build"* ]]; then
    for arch in aarch64 x86_64; do
      mkdir -p "target/$arch-apple-darwin/release"
      printf '%s\\n' "$arch" > "target/$arch-apple-darwin/release/syncforge-cli"
    done
    mkdir -p target/universal-apple-darwin/release
    printf 'universal GUI\\n' > target/universal-apple-darwin/release/SyncForge
    if [[ "$*" != *"--no-bundle"* ]]; then bundle_app; fi
  elif [[ "$*" == *"tauri bundle"* ]]; then
    bundle_app
  else
    echo "Unexpected npx invocation: $*" >&2; return 1
  fi
}
lipo() {
  local inputs=() output=''
  while (( $# )); do
    case "$1" in
      -create) shift ;;
      -output) output="$2"; shift 2 ;;
      *) inputs+=("$1"); shift ;;
    esac
  done
  test -n "$output"
  cat "\${inputs[@]}" > "$output"
}
cargo() {
  mkdir -p target/release
  printf 'standalone headless CLI\\n' > target/release/syncforge-cli
}
`;
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  const result = spawnSync(bash, ['--noprofile', '--norc', '-c', `${harness}\n${run}`], {
    cwd: directory,
    env: { ...process.env, TAURI_SIGNING_PRIVATE_KEY: 'test-signing-key' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const bundledCli = await readFile(path.join(directory, 'target/universal-apple-darwin/release/bundle/macos/SyncForge.app/Contents/MacOS/syncforge-cli'), 'utf8');
  assert.equal(bundledCli, 'aarch64\nx86_64\n');
  assert.equal(await readFile(path.join(directory, 'target/release/syncforge-cli'), 'utf8'), 'standalone headless CLI\n');
});
