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
    if (id === '../EventBus') return { EventBus: { emit() {}, on() {}, off() {} }, EVENTS: {} };
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

// A move delivers its rolled damage over several hits; the turn is decided once, when it ends.
function strikeFixture(enemyHp, damage) {
  const { scene } = fixture();
  scene.attackButtons = [{ unlocked: true, attack: { damage, name: 'Move' }, container: {} }];
  scene.currentEnemyHp = enemyHp;
  scene.updateEnemyHpBar = () => {};
  scene.stopEnemyEffects = () => {};
  const scheduled = [];
  scene.time = { delayedCall: (_ms, fn) => scheduled.push(fn) };
  const outcomes = [];
  scene.endBattle = outcome => outcomes.push(outcome);
  let enemyTurns = 0;
  scene.executeEnemyAttack = () => { enemyTurns++; };
  let hooks;
  scene.playPlayerAttackAnimation = (_attack, moveHooks) => { hooks = moveHooks; };
  scene.finishBattleIntro();
  scene.messageReady = true;
  scene.tryExecuteAttack(0);
  const runScheduled = () => scheduled.splice(0).forEach(fn => fn());
  return { scene, hooks: () => hooks, outcomes, enemyTurns: () => enemyTurns, runScheduled };
}

test('the hits of a move land exactly the rolled damage, however it splits them', () => {
  for (const [damage, shares] of [[14, [0.5, 1]], [15, [0.12, 0.12, 1]], [38, [0.7, 0.1, 0.1, 1]], [28, [0.3]]]) {
    const { scene, hooks } = strikeFixture(1000, damage);
    shares.forEach(share => hooks().hit(share, { weight: 'medium' }));
    hooks().done();
    assert.equal(1000 - scene.currentEnemyHp, damage, `damage ${damage} split ${shares}`);
  }
});

test('a lethal hit mid-combo does not end the battle before the move does, and the move resolves once', () => {
  const { scene, hooks, outcomes, enemyTurns, runScheduled } = strikeFixture(5, 28);
  hooks().hit(0.5, { weight: 'heavy' });
  assert.equal(scene.currentEnemyHp, 0);
  hooks().hit(1, { weight: 'heavy' });
  runScheduled();
  assert.deepEqual(outcomes, []);
  hooks().done();
  hooks().done();
  runScheduled();
  assert.deepEqual(outcomes, ['win']);
  assert.equal(enemyTurns(), 0);
});

test('a move that leaves the opponent standing hands the turn over once', () => {
  const { scene, hooks, outcomes, enemyTurns, runScheduled } = strikeFixture(100, 18);
  hooks().hit(1, { weight: 'heavy' });
  hooks().done();
  hooks().done();
  runScheduled();
  assert.equal(scene.currentEnemyHp, 82);
  assert.deepEqual(outcomes, []);
  assert.equal(enemyTurns(), 1);
});
