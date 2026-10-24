import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/physics.js';
import { scenarioParams,DEMONSTRATION } from '../src/scenarios.js';
import { MIN_PUSH_SETTINGS, minPushCandidate,bestAtForce,searchFiniteMinimumSync } from '../src/min-push.js';

test('min-push candidate leaves apparatus, start and wind fixed',()=>{
  const base={...scenarioParams('efficient'),startFraction:.07,windSpeed:-2};
  const original={...base};
  const p=minPushCandidate(base,65,.35,4);
  assert.deepEqual(base,original);
  assert.equal(p.springDamping,base.springDamping);
  assert.equal(p.length,base.length);
  assert.equal(p.windSpeed,-2);
  assert.equal(p.startFraction,.07);
  assert.equal(p.initialSwingRate,0);
});
test('an achievable return is detected at demonstrated model force',()=>{
  const p={...scenarioParams('efficient'),...DEMONSTRATION};
  const r=bestAtForce(p,70);
  assert.ok(r.tested>0);
  assert.ok(r.winner);
  assert.equal(r.winner.result.valid,true);
  assert.equal(r.winner.result.trolleyReturned,true);
  assert.equal(r.winner.result.seatReturned,true);
  assert.ok(r.winner.params.pushForce===70);
});
test('finite search only calls a launch optimum when both return',()=>{
  const p={...scenarioParams('efficient'),startFraction:.07};
  const r=searchFiniteMinimumSync(p);
  assert.equal(r.found,true);
  assert.ok(r.winning.params.pushForce>=0&&r.winning.params.pushForce<=110);
  assert.equal(r.winning.result.seatReturned,true);
  assert.equal(r.winning.result.trolleyReturned,true);
  assert.equal(r.winning.params.initialSwingRate,0);
  assert.equal(r.winning.params.startFraction,p.startFraction);
});
test('under unfavourable conditions it reports no solution instead of faking one',()=>{
  const p={...DEFAULTS,length:32,drop:1.8,friction:.12,springDamping:800,drag:.3,windSpeed:-10};
  const r=searchFiniteMinimumSync(p);
  assert.equal(r.found,false);
  assert.equal(r.winning,null);
  assert.equal(r.maxForce,MIN_PUSH_SETTINGS.maxForceN);
});
