import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createUpdateManifest } from './create-update-manifest.mjs';

async function releaseAssets(t) {
  const directory = await mkdtemp(path.join(tmpdir(), 'syncforge-manifest-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { version } = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url)));
  const files = [
    `SyncForge-Windows-${version}-setup.exe`,
    `SyncForge-macOS-${version}.tar.gz`,
    `SyncForge-Linux-${version}-x86_64.AppImage`,
  ];
  for (const file of files) {
    await writeFile(path.join(directory, file), 'test update bundle');
    await writeFile(path.join(directory, `${file}.sig`), `signature-for-${file}\n`);
  }
  return { directory, version, files };
}

test('manifest includes Windows, universal macOS, and Linux with matching signatures', async t => {
  const { directory, version, files } = await releaseAssets(t);
  const manifest = await createUpdateManifest(directory, 'itsmrma/SyncForge', `v${version}`);
  assert.deepEqual(Object.keys(manifest.platforms).sort(), ['darwin-aarch64', 'darwin-x86_64', 'linux-x86_64', 'windows-x86_64']);
  for (const [target, file] of [
    ['windows-x86_64', files[0]], ['darwin-aarch64', files[1]],
    ['darwin-x86_64', files[1]], ['linux-x86_64', files[2]],
  ]) {
    assert.equal(manifest.platforms[target].url, `https://github.com/itsmrma/SyncForge/releases/download/v${version}/${file}`);
    assert.equal(manifest.platforms[target].signature, `signature-for-${file}`);
  }
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'latest.json'))), manifest);
});

test('manifest rejects a wrong release tag or invalid repository', async t => {
  const { directory, version } = await releaseAssets(t);
  await assert.rejects(createUpdateManifest(directory, 'itsmrma/SyncForge', 'main'), /Release tag/);
  await assert.rejects(createUpdateManifest(directory, 'invalid/repo/extra', `v${version}`), /Invalid release repository/);
});

for (const index of [0, 1, 2]) {
  for (const failure of ['missing bundle', 'empty bundle', 'missing signature', 'empty signature']) {
    test(`manifest fails closed for ${failure} on bundle ${index}`, async t => {
      const { directory, version, files } = await releaseAssets(t);
      const file = path.join(directory, files[index]);
      if (failure === 'missing bundle') await rm(file);
      if (failure === 'empty bundle') await writeFile(file, '');
      if (failure === 'missing signature') await rm(`${file}.sig`);
      if (failure === 'empty signature') await writeFile(`${file}.sig`, '');
      await assert.rejects(createUpdateManifest(directory, 'itsmrma/SyncForge', `v${version}`));
      await assert.rejects(readFile(path.join(directory, 'latest.json')), { code: 'ENOENT' });
    });
  }
}
