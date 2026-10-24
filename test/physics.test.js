import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS, stopX, initialX, cableY, makeRun} from '../src/physics.js';

test('the stop is inset from the far anchor by spring length and clearance', () => {
  const p={...DEFAULTS,length:19,endClearance:2.2,springLength:0.95};
  assert.ok(Math.abs(stopX(p)-15.85)<1e-9);
  assert.ok(Math.abs(p.length-(stopX(p)+p.springLength)-p.endClearance)<1e-9);
});
test('moving the stop closer to the starting frame changes the modelled contact location', () => {
  const p={...DEFAULTS};
  const base=stopX(p);
  const furtherBack=stopX({...p,endClearance:p.endClearance+1});
  assert.ok(Math.abs(base-furtherBack-1)<1e-9);
});
test('default start sits before the stop and height follows the cable', () => {
  const p={...DEFAULTS};
  assert.ok(initialX(p)>0);
  assert.ok(initialX(p)<stopX(p));
  assert.ok(Number.isFinite(cableY(initialX(p),p)));
  assert.equal(makeRun(p).state.x,initialX(p));
});
