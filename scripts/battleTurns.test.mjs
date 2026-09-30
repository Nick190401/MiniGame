import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

// Exercise the actual scene's input and turn logic without a browser renderer.
const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/game/scenes/BattleScene.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } },
);
const exports = {};
runInNewContext(outputText, {
  exports,
  require(id) {
    if (id === 'phaser') return { Scene: class {} };
    if (id === '../systems/AttackSystem') return { applyDamageVariance: damage => damage };
    return {};
  },
});
const { BattleScene } = exports;
const encounter = { enemyData: { maxHp: 100 }, isBoss: false };

function fixture() {
  const scene = new BattleScene();
  scene.init(encounter);
  scene.attackButtons = [{ unlocked: true, attack: { damage: 18, name: 'Bass Drop' }, container: {} }];
  scene.setMessage = () => { scene.messageReady = false; };
  scene.setAttackButtonsEnabled = () => {};
  scene.emitBattleUiState = () => {};
  scene.tweens = { add() {} };
  let attacks = 0;
  scene.playPlayerAttackAnimation = () => { attacks++; };
  return { scene, attacks: () => attacks };
}

test('finishing or skipping intro text cannot start an attack before the intro timer', () => {
  const { scene, attacks } = fixture();
  scene.messageReady = true;
  scene.tryExecuteAttack(0);
  assert.equal(attacks(), 0);
  scene.finishBattleIntro();
  scene.messageReady = true;
  scene.tryExecuteAttack(0);
  assert.equal(attacks(), 1);
});

test('repeated input and a late intro callback cannot grant an extra attack', () => {
  const { scene, attacks } = fixture();
  scene.finishBattleIntro();
  scene.messageReady = true;
  scene.tryExecuteAttack(0);
  scene.finishBattleIntro();
  scene.messageReady = true;
  for (let i = 0; i < 10; i++) scene.tryExecuteAttack(0);
  assert.equal(attacks(), 1);
  scene.setTurnState('enemy-attack');
  scene.messageReady = true;
  scene.tryExecuteAttack(0);
  assert.equal(attacks(), 1);
  scene.setTurnState('player-choose');
  scene.messageReady = true;
  scene.tryExecuteAttack(0);
  assert.equal(attacks(), 2);
});

test('reusing the scene resets the intro input lock and message readiness', () => {
  const { scene } = fixture();
  scene.finishBattleIntro();
  scene.messageReady = true;
  scene.init(encounter);
  assert.equal(scene.turnState, 'intro');
  assert.equal(scene.inputBlocked, true);
  assert.equal(scene.messageReady, false);
});
