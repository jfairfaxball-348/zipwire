import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULTS,windAtTime,aerodynamicForce} from '../src/physics.js';
import {TEMPLATE} from '../src/optimizer.js';
import {scenarioParams,DEMONSTRATION} from '../src/scenarios.js';
import {simulateWind,compareWind,windForceAtRest} from '../src/wind.js';

test('wind reverses quadratic relative-air force correctly',()=>{
 const p={...DEFAULTS,drag:.1,windSpeed:5,windGust:0};
 assert.equal(windAtTime(0,p),5);
 assert.equal(aerodynamicForce(0,0,p),2.5);
 assert.equal(aerodynamicForce(10,0,p),-2.5);
 assert.ok(Math.abs(aerodynamicForce(5,0,p))<1e-12);
 assert.equal(aerodynamicForce(0,0,{...p,windSpeed:-5}),-2.5);
 assert.equal(windForceAtRest(p),2.5);
});
test('gust is reproducible, with no change to still-air defaults',()=>{
 const p={...DEFAULTS,windGust:2,windPeriod:4};
 assert.ok(Math.abs(windAtTime(1,p)-2)<1e-12);
 assert.ok(Math.abs(windAtTime(3,p)+2)<1e-12);
 assert.equal(aerodynamicForce(3,0,DEFAULTS),-DEFAULTS.drag*9);
});
test('wind sweep retains unchanged baseline when gust is disabled',()=>{
 const base={...scenarioParams('efficient'),...DEMONSTRATION};
 const baseRun=simulateWind({...base,windSpeed:0});
 const series=compareWind(base,[-3,0,3]);
 assert.equal(series.length,3);
 assert.ok(Math.abs(series[1].returnDistance-baseRun.returnDistance)<1e-8);
 assert.equal(series[1].trolleyReturned,true);
 assert.equal(series[1].seatReturned,true);
 assert.ok(series[2].returnDistance < series[1].returnDistance);
 assert.ok(series[0].returnDistance < series[1].returnDistance);
 assert.ok(series[1].returnDistance>11);
});
test('wind comparison preserves hardware and launch settings',()=>{
 const base={...TEMPLATE,pushForce:70,pushDuration:.4,windGust:1.7};
 const copy={...base};
 const results=compareWind(base,[-6,0,6]);
 assert.equal(results.length,3);
 assert.deepEqual(base,copy);
 assert.equal(results[0].wind,-6);
 assert.equal(results[2].wind,6);
});
