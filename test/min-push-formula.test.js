import test from 'node:test';
import assert from 'node:assert/strict';
import katex from 'katex';
import { OPTIMAL_FORCE_OBJECTIVE, RETURN_CONSTRAINTS } from '../src/min-push-formula.js';

test('minimum-force objective renders as mathematical typography',()=>{
  const html=katex.renderToString(OPTIMAL_FORCE_OBJECTIVE,{displayMode:true,throwOnError:true});
  assert.ok(html.includes('katex'));
  assert.ok(html.includes('math'));
});
test('constraints include both trolley and seat return conditions',()=>{
  const html=katex.renderToString(RETURN_CONSTRAINTS,{displayMode:true,throwOnError:true});
  assert.ok(html.includes('katex'));
  assert.ok(RETURN_CONSTRAINTS.includes('x_{\\mathrm T}'));
  assert.ok(RETURN_CONSTRAINTS.includes('x_{\\mathrm S}'));
});
