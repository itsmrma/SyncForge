import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createUpdateManifest(directory, repository, tag) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { version } = JSON.parse(await readFile(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  if (tag !== `v${version}`) throw new Error(`Release tag must be v${version}`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid release repository');
  const installer = `SyncForge-Windows-${version}-setup.exe`;
  if (!(await stat(path.join(directory, installer))).size) throw new Error('Windows installer is empty');
  const signature = (await readFile(path.join(directory, `${installer}.sig`), 'utf8')).trim();
  if (!signature) throw new Error('Windows updater signature is empty');
  const manifest = {
    version,
    notes: await readFile(path.join(root, 'CHANGELOG.md'), 'utf8'),
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature,
        url: `https://github.com/${repository}/releases/download/${tag}/${installer}`,
      },
    },
  };
  await writeFile(path.join(directory, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await createUpdateManifest(process.argv[2] || 'dist', process.env.RELEASE_REPOSITORY, process.env.RELEASE_TAG);
}
