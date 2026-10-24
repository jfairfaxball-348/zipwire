import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, stopX } from '../src/physics.js';
import { TEMPLATE, SEARCH_BOUNDS, LAUNCH_KEYS, evaluateLaunch, launchParams, proposedLaunch, halton, nearForceLimit } from '../src/optimizer.js';

test('template has fixed illustrative physics and bounded launch inputs',()=>{
  assert.ok(TEMPLATE.springK>0);
  assert.ok(TEMPLATE.seatMass>0);
  assert.equal(TEMPLATE.length,DEFAULTS.length);
  assert.equal(LAUNCH_KEYS.length,5);
  const p=launchParams(TEMPLATE,{pushForce:999,startFraction:-2});
  assert.equal(p.pushForce,SEARCH_BOUNDS.pushForce[1]);
  assert.equal(p.startFraction,SEARCH_BOUNDS.startFraction[0]);
  assert.equal(p.springK,TEMPLATE.springK);
  assert.equal(stopX(p),stopX(TEMPLATE));
});
test('Halton proposals are deterministic and respect bounds',()=>{
  assert.equal(halton(1,2),0.5);
  assert.deepEqual(proposedLaunch(17),proposedLaunch(17));
  for(let i=1;i<20;i++){
    const p=proposedLaunch(i);
    for(const key of LAUNCH_KEYS){
      const [lo,hi]=SEARCH_BOUNDS[key];
      assert.ok(p[key]>=lo&&p[key]<=hi,key);
    }
  }
});
test('launch evaluation reports computed outcomes and rejects invalid cases',()=>{
  const r=evaluateLaunch(TEMPLATE,{...TEMPLATE,pushForce:60});
  assert.equal(typeof r.valid,'boolean');
  assert.ok(Number.isFinite(r.releaseHeight));
  assert.ok(Number.isFinite(r.springTravel));
  assert.ok(r.startGap>0);
  if(r.valid){
    assert.ok(r.impactSpeed!==null);
    assert.ok(r.turnaroundTime!==null);
    assert.ok(r.returnDistance>=0);
  } else {
    assert.notEqual(r.reason,'Valid completed rebound');
    assert.equal(r.score,-Infinity);
  }
});
test('force boundary is not misreported as an interior optimum',()=>{
  assert.ok(nearForceLimit({params:{pushForce:150}}));
  assert.equal(nearForceLimit({params:{pushForce:90}}),false);
});
