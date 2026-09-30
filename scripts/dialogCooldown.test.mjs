import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/game/scenes/WorldScene.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
);
const exports = {};
runInNewContext(outputText, {
  exports,
  require(id) {
    if (id === 'phaser') return {
      Scene: class {},
      Geom: { Rectangle: class {} },
      Math: { Distance: { Between: (x, y, a, b) => Math.hypot(a - x, b - y) } },
      Input: { Keyboard: { JustDown(key) { const down = key._justDown; key._justDown = false; return down; } } },
    };
    if (id === '../EventBus') return { EventBus: { emit() {} }, EVENTS: {} };
    if (id === '../input/MobileInput') return { consumeMobileAction: () => false };
    return {};
  },
});
const { WorldScene } = exports;

function fixture(npcField = 'npcSprite') {
  const scene = new WorldScene();
  scene.time = { now: 5000 };
  scene.dialogBox = { setVisible() {}, getData: () => null, setData() {} };
  scene.player = { x: 0, y: 0, faceToward() {} };
  scene[npcField] = { x: 5, y: 0, faceToward() {} };
  let starts = 0;
  const trigger = () => { starts++; scene.dialogActive = true; };
  scene.triggerNpc1 = scene.triggerNpc2 = scene.triggerNpc3 = trigger;
  return { scene, starts: () => starts };
}

for (const npc of ['npcSprite', 'npc2Sprite', 'npc3Sprite']) {
  test(`${npc}: repeated interaction is blocked for 1.2 seconds after dialogue`, () => {
    const { scene, starts } = fixture(npc);
    scene.dialogActive = true;
    scene.advanceDialog();
    assert.equal(scene.worldFrozen, false, 'Player can move during the cooldown');
    for (const elapsed of [0, 16, 200, 600, 1199]) {
      scene.time.now = 5000 + elapsed;
      scene.checkNpcProximity(true);
    }
    assert.equal(starts(), 0);
    scene.time.now = 6200;
    scene.checkNpcProximity(false);
    assert.equal(starts(), 0, 'Expiry alone must not start another dialogue');
    scene.checkNpcProximity(true);
    assert.equal(starts(), 1);
  });
}

test('E input is consumed while dialogue freezes world updates', () => {
  const { scene } = fixture();
  scene.dialogBox = undefined;
  scene.dialogActive = true;
  scene.worldFrozen = true;
  scene.interactKey = { _justDown: true };
  scene.updateNpcs = () => {};
  scene.setFootstepSurface = () => {};
  scene.update(0, 16);
  assert.equal(scene.interactKey._justDown, false);
});

test('dialogue completion callbacks still run during the NPC cooldown', () => {
  const { scene } = fixture();
  let completed = false;
  scene.dialogBox.getData = key => key === 'callback' ? () => { completed = true; } : null;
  scene.advanceDialog();
  assert.equal(completed, true);
});
