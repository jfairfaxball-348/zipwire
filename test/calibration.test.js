import test from 'node:test';
import assert from 'node:assert/strict';
import {fitIsolatedStop,fitWithSensitivity,parseObservations,estimateFromVideo} from '../src/calibration.js';

test('inverse fit recovers parameters of known underdamped 1DOF spring',()=>{
  const m=9,k=1450,c=100,v=2;
  const omega=Math.sqrt(k/m),zeta=c/(2*m*omega),beta=Math.sqrt(1-zeta*zeta);
  const ratio=Math.exp(-Math.PI*zeta/beta);
  const x=(v/omega)*Math.exp(-zeta*Math.acos(zeta)/beta);
  const r=fitWithSensitivity({approachSpeed:v,reboundSpeed:v*ratio,compressionCm:x*100,effectiveMassKg:m});
  assert.equal(r.ok,true);
  assert.ok(Math.abs(r.fit.stiffness-k)<1e-8);
  assert.ok(Math.abs(r.fit.damping-c)<1e-8);
  assert.ok(Math.abs(r.fit.contactTime-Math.PI/(omega*beta))<1e-10);
  assert.ok(r.sensitivity.stiffness[0]<k&&r.sensitivity.stiffness[1]>k);
  assert.ok(r.sensitivity.damping[0]<c&&r.sensitivity.damping[1]>c);
  assert.ok(r.sensitivity.validCases>50);
});
test('no guessed real measurements and physics-invalid observations are rejected',()=>{
  assert.equal(parseObservations({}).ok,false);
  assert.equal(fitIsolatedStop({approachSpeed:1,reboundSpeed:1.5,compressionCm:10,effectiveMassKg:9}).ok,false);
  assert.equal(fitIsolatedStop({approachSpeed:3,reboundSpeed:0,compressionCm:10,effectiveMassKg:9}).ok,false);
  assert.equal(fitIsolatedStop({approachSpeed:3,reboundSpeed:1,compressionCm:0,effectiveMassKg:9}).ok,false);
  assert.equal(fitIsolatedStop({approachSpeed:'abc',reboundSpeed:1,compressionCm:1,effectiveMassKg:9}).ok,false);
});
test('video frame-distance helper derives speed without claiming calibration',()=>{
  const v=estimateFromVideo(0.4,12,120);
  assert.equal(v.ok,true);assert.equal(v.speed,4);
  assert.equal(estimateFromVideo(1,0,120).ok,false);
});
