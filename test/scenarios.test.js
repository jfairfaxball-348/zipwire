import test from 'node:test';
import assert from 'node:assert/strict';
import { SCENARIOS, DEMONSTRATION, scenarioParams } from '../src/scenarios.js';
import { evaluateLaunch } from '../src/optimizer.js';

test('all scenarios are fixed reference scenarios with unchanged launch defaults',()=>{
  assert.equal(SCENARIOS.length,5);
  assert.equal(scenarioParams('reference').length,19);
  assert.equal(scenarioParams('efficient').length,15);
  assert.equal(scenarioParams('efficient').springDamping,15);
  assert.equal(scenarioParams('moderate').springDamping,30);
});
test('near-level, efficient hypothetical spring can return BOTH seat and trolley',()=>{
  const r=evaluateLaunch(scenarioParams(DEMONSTRATION.scenarioId),DEMONSTRATION);
  assert.equal(r.valid,true);
  assert.equal(r.trolleyReturned,true);
  assert.equal(r.seatReturned,true);
  assert.ok(r.returnFraction>1.01 && r.returnFraction<1.08);
  assert.ok(r.params.pushForce<=110);
  assert.ok(r.maxSwing<50);
});
test('original long-span reference does not return to start under same trial',()=>{
  const trial=evaluateLaunch(scenarioParams('reference'),DEMONSTRATION);
  assert.equal(trial.trolleyReturned,false);
  assert.equal(trial.seatReturned,false);
});
