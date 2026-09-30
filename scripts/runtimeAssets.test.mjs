import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Run the build helper through the project's TypeScript compiler, without an
// extra test runner or requiring Node's experimental TypeScript support.
const { outputText } = ts.transpileModule(readFileSync(new URL('./runtimeAssets.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
});
const { collectRuntimeAssets, runtimeAssetsPlugin } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'minigame-runtime-assets-'));
  t.after(() => {
    assert.equal(dirname(root), tmpdir());
    rmSync(root, { recursive: true, force: true });
  });
  const put = (file, content = 'fixture asset') => {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  };
  put('src/main.ts', '');
  put('index.html', '<div id="root"></div>');
  return { root, put };
}

test('ships UI, reward, CSS and manifest assets once; leaves originals and archives out', t => {
  const { root, put } = fixture(t);
  put('src/components/Reward.tsx', "const reward = '/assets/reward.mp3'; const logo = '/assets/logo.svg?v=2';");
  put('src/style.css', "body { background: url('/assets/background.webp'); }");
  put('src/frames.ts', "const root = 'assets/player'; const frame = `assets/player/${index}.png`;");
  const expected = ['.htaccess', 'assets/reward.mp3', 'assets/logo.svg', 'assets/background.webp', 'assets/player/0.png', 'assets/attack.wav'].sort();
  for (const file of [...expected, 'assets/original.wav', 'assets/original.png', 'assets/sources.rar']) put(`public/${file}`);
  assert.deepEqual(collectRuntimeAssets(root, {
    required: ['.htaccess', 'assets/player/0.png', '/assets/logo.svg?v=2'],
    optional: ['assets/attack.wav', 'assets/not-recorded-yet.mp3'],
  }), expected);
});

test('fails the build when required artwork disappears, but allows missing optional audio', t => {
  const { root, put } = fixture(t);
  assert.deepEqual(collectRuntimeAssets(root, { required: [], optional: ['assets/future-track.mp3'] }), []);
  put('src/main.ts', "const portrait = '/assets/missing.webp';");
  assert.throws(() => collectRuntimeAssets(root, { required: [], optional: [] }), /Required runtime asset is missing: public\/assets\/missing.webp/);
});

test('emits original runtime URLs and bytes without modifying public sources', t => {
  const { root, put } = fixture(t);
  const bytes = Buffer.from([0, 3, 7, 128, 255]);
  put('public/assets/player.png', bytes);
  put('public/assets/sources.rar', 'keep this original');
  const plugin = runtimeAssetsPlugin({ required: ['assets/player.png?v=1'], optional: [] });
  const emitted = [];
  plugin.configResolved({ root, publicDir: join(root, 'public'), logger: { info() {} } });
  plugin.generateBundle.call({ addWatchFile() {}, emitFile(asset) { emitted.push(asset); } });
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].fileName, 'assets/player.png');
  assert.deepEqual(emitted[0].source, bytes);
  assert.equal(readFileSync(join(root, 'public/assets/sources.rar'), 'utf8'), 'keep this original');
});
