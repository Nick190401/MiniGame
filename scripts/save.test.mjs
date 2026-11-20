import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// The save module is pure: run it against a fake localStorage.
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/store/save.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } },
);

function load(storage) {
  const exports = {};
  runInNewContext(outputText, { exports, localStorage: storage, JSON, Number, Math, Array, Set });
  return exports;
}

function memoryStorage() {
  const items = new Map();
  return {
    getItem: key => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: key => { items.delete(key); },
  };
}

const valid = {
  playerName: 'Mira',
  xp: 75,
  fragmentsFound: [2, 0],
  gateOpen: true,
  bossDefeated: false,
  bonusSongUnlocked: false,
  seenDialogs: ['professor-intro', 'gate-lock'],
  defeatedEnemies: ['static-noise'],
};

test('a written save reads back the same journey', () => {
  const save = load(memoryStorage());
  assert.equal(save.writeSave(save.serializeSave(valid)), true);
  // JSON round trip: the vm's arrays come from another realm.
  const read = JSON.parse(JSON.stringify(save.readSave()));
  assert.deepEqual(read, { ...valid, fragmentsFound: [0, 2] });
});

test('anything that is not a current save counts as no save', () => {
  const save = load(memoryStorage());
  for (const raw of [null, '', 'not json', '42', 'null', '[]', '{}',
    JSON.stringify({ version: 0, data: valid }),
    JSON.stringify({ version: 2, data: valid }),
    JSON.stringify({ version: 1 }),
    JSON.stringify({ version: 1, data: { ...valid, playerName: '   ' } }),
    JSON.stringify({ version: 1, data: { ...valid, playerName: 7 } })]) {
    assert.equal(save.parseSave(raw), null, String(raw));
  }
});

test('hand-edited values are clamped to what the game allows', () => {
  const save = load(memoryStorage());
  const read = save.parseSave(JSON.stringify({ version: 1, data: {
    playerName: '  A name that is far too long for the HUD  ',
    xp: 1e12,
    fragmentsFound: [1, 1, 5, -1, 2.5, '0', 0],
    gateOpen: 'yes',
    bossDefeated: 1,
    bonusSongUnlocked: true,
    seenDialogs: ['ok', 3, '', 'x'.repeat(200), 'ok'],
    defeatedEnemies: 'static-noise',
  } }));
  assert.equal(read.playerName, 'A name that is f');
  assert.equal(read.xp, 1_000_000);
  assert.deepEqual([...read.fragmentsFound], [0, 1]);
  assert.equal(read.gateOpen, false);
  assert.equal(read.bossDefeated, false);
  assert.equal(read.bonusSongUnlocked, true);
  assert.deepEqual([...read.seenDialogs], ['ok']);
  assert.deepEqual([...read.defeatedEnemies], []);
  assert.equal(save.parseSave(JSON.stringify({ version: 1, data: { ...valid, xp: -40 } })).xp, 0);
  assert.equal(save.parseSave(JSON.stringify({ version: 1, data: { ...valid, xp: 'lots' } })).xp, 0);
});

test('storage that refuses to work never throws into the game', () => {
  const broken = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('QuotaExceededError'); },
    removeItem() { throw new Error('denied'); },
  };
  const save = load(broken);
  assert.equal(save.readSave(), null);
  assert.equal(save.writeSave(save.serializeSave(valid)), false);
  assert.doesNotThrow(() => save.clearSave());
});
