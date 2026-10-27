import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createUpdateManifest(directory, repository, tag) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const { version } = JSON.parse(await readFile(path.join(root, 'src-tauri/tauri.conf.json'), 'utf8'));
  if (tag !== `v${version}`) throw new Error(`Release tag must be v${version}`);
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid release repository');
  // macOS is a universal bundle: both native architectures use the same signed archive.
  const bundles = [
    { file: `SyncForge-Windows-${version}-setup.exe`, targets: ['windows-x86_64'] },
    { file: `SyncForge-macOS-${version}.tar.gz`, targets: ['darwin-aarch64', 'darwin-x86_64'] },
    { file: `SyncForge-Linux-${version}-x86_64.AppImage`, targets: ['linux-x86_64'] },
  ];
  const platforms = {};
  for (const { file, targets } of bundles) {
    if (!(await stat(path.join(directory, file))).size) throw new Error(`Update bundle is empty: ${file}`);
    const signature = (await readFile(path.join(directory, `${file}.sig`), 'utf8')).trim();
    if (!signature) throw new Error(`Updater signature is empty: ${file}`);
    for (const target of targets) {
      platforms[target] = { signature, url: `https://github.com/${repository}/releases/download/${tag}/${file}` };
    }
  }
  const manifest = {
    version,
    notes: await readFile(path.join(root, 'CHANGELOG.md'), 'utf8'),
    pub_date: new Date().toISOString(),
    platforms,
  };
  await writeFile(path.join(directory, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await createUpdateManifest(process.argv[2] || 'dist', process.env.RELEASE_REPOSITORY, process.env.RELEASE_TAG);
}
