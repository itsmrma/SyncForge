import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildCliCommandAndScript } from '../web/src/cliExport.js';

const samples = [
  '/media/movie.mkv',
  'C:\\Media Files\\trailing\\',
  String.raw`/media/backslash\"quote".mkv`,
  "/media/director's cut.mkv",
  '/media/$HOME $(echo injected) `echo injected`; & | < >.mkv',
  '/media/first\nsecond.mkv',
  '/media/‘curly’quotes.mkv',
];

for (const shell of ['powershell', 'bash']) {
  test(`CLI export preserves literal arguments in ${shell}`, () => {
    for (const value of samples) {
      const { command, scriptJson } = buildCliCommandAndScript(
        { id: 'injection', needs: ['sub', 'output'] },
        { video: value, sub: value, output: value },
        {},
        { shell, audioTrack: value },
      );
      // Substitute only the executable: the shell must parse the real exported arguments.
      const capture = 'process.stdout.write(JSON.stringify(process.argv.slice(1)))';
      const prefix = shell === 'bash'
        ? `'${process.execPath}' -e '${capture}' --`
        : `& '${process.execPath}' -e '${capture}' --`;
      const invocation = command.replace(/^syncforge-cli/, prefix);
      const executable = shell === 'bash'
        ? (process.platform === 'win32' ? 'C:/Program Files/Git/bin/sh.exe' : 'sh')
        : 'pwsh';
      const script = invocation;
      const args = shell === 'bash' ? ['-c', script] : ['-NoProfile', '-NonInteractive', '-Command', script];
      const result = spawnSync(executable, args, {
        encoding: 'utf8', timeout: 10000,
        // Git Bash otherwise rewrites POSIX paths before invoking a Windows executable.
        env: { ...process.env, MSYS2_ARG_CONV_EXCL: '*' },
      });
      assert.ifError(result.error);
      assert.equal(result.status, 0, result.stderr);
      const actual = JSON.parse(result.stdout);
      assert.deepEqual(actual, ['run', 'injection', '-v', value, '-s', value, '-o', value, '--import-audio', '--audio-track', value, '-y']);
      assert.equal(JSON.parse(scriptJson).jobs[0].video, value);
    }
  });
}
