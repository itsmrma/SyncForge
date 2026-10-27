import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createUpdateManifest } from './create-update-manifest.mjs';

test('manifest points to the signed installer and excludes portable/other platforms', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'syncforge-manifest-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { version } = JSON.parse(await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url)));
  const name = `SyncForge-Windows-${version}-setup.exe`;
  await writeFile(path.join(directory, name), 'test installer');
  await writeFile(path.join(directory, `${name}.sig`), 'test-signature\n');
  const manifest = await createUpdateManifest(directory, 'itsmrma/SyncForge', `v${version}`);
  assert.deepEqual(Object.keys(manifest.platforms), ['windows-x86_64']);
  assert.equal(manifest.platforms['windows-x86_64'].url, `https://github.com/itsmrma/SyncForge/releases/download/v${version}/${name}`);
  assert.equal(manifest.platforms['windows-x86_64'].signature, 'test-signature');
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'latest.json'))), manifest);
  await assert.rejects(createUpdateManifest(directory, 'itsmrma/SyncForge', 'main'), /Release tag/);
  await writeFile(path.join(directory, `${name}.sig`), '');
  await assert.rejects(createUpdateManifest(directory, 'itsmrma/SyncForge', `v${version}`), /signature is empty/);
  await writeFile(path.join(directory, name), '');
  await assert.rejects(createUpdateManifest(directory, 'itsmrma/SyncForge', `v${version}`), /installer is empty/);
});
