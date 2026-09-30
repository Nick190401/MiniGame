import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const { outputText } = ts.transpileModule(
  readFileSync(new URL('../src/game/audio/Waveform.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
);
const { getWaveformHeights } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('waveform follows quiet, medium and loud sections in chronological order', () => {
  const samples = new Float32Array([0, 0, 0.5, -0.5, 1, -1]);
  assert.deepEqual(getWaveformHeights([samples], 3), [0, 50, 100]);
});

test('opposite-phase stereo channels do not cancel the waveform', () => {
  const left = new Float32Array([0.25, -0.25, 1, -1]);
  const right = new Float32Array([-0.25, 0.25, -1, 1]);
  assert.deepEqual(getWaveformHeights([left, right], 2), [25, 100]);
  assert.deepEqual(getWaveformHeights([new Float32Array(4), right], 2), [25, 100]);
});

test('silence stays flat and the final samples are included', () => {
  assert.deepEqual(getWaveformHeights([new Float32Array(10)], 3), [0, 0, 0]);
  assert.deepEqual(getWaveformHeights([new Float32Array([0, 0, 0, 0, 1])], 2), [0, 100]);
  assert.deepEqual(getWaveformHeights([], 3), [0, 0, 0]);
});
