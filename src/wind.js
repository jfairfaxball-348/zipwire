import {makeRun, stepRun, initialX, cableY, stopX, windAtTime, aerodynamicForce} from './physics.js';

// Steady reference winds for a signed, cable-parallel component (m/s).
// These are mathematical scenarios, NOT weather predictions.
export const WIND_SWEEP = Object.freeze([-9,-6,-3,0,3,6,9]);
export function windDescription(speed){
  if(Math.abs(speed)<.05)return 'Still air';
  return speed<0?Math.abs(speed).toFixed(1)+' m/s towards start':speed.toFixed(1)+' m/s towards end-stop';
}
export function simulateWind(p, dt=1/240) {
  // Same integrator and trajectory validity gates as the launch optimiser,
  // without clipping arbitrary user-selected launch parameters.
  const run=makeRun(p);
  run.recordSamples=false;
  const x0=initialX(p), startSeat=x0+p.suspension*Math.sin(p.initialSwing*Math.PI/180);
  let minSeat=Infinity, minHeight=Infinity;
  while(!run.finished && run.time<20) {
    stepRun(run,p,dt);
    const s=run.state;
    minHeight=Math.min(minHeight,cableY(s.x,p)-p.suspension*Math.cos(s.phi));
    if(run.springReleaseSpeed!==null)minSeat=Math.min(minSeat,s.x+p.suspension*Math.sin(s.phi));
    if(![s.x,s.v,s.phi,s.w].every(Number.isFinite))break;
  }
  const completed=run.turningTime!==null&&run.springReleaseSpeed!==null;
  const valid=completed&&!run.overtravel&&run.maxSwing<50&&minHeight>.35 &&
    Number.isFinite(run.returnDistance)&&Number.isFinite(run.maxCompression);
  let reason='Completed valid model rebound';
  if(run.overtravel)reason='Assumed spring stroke exceeded';
  else if(!(minHeight>.35))reason='Seat too close to ground';
  else if(run.maxSwing>=50)reason='Exceeds 50° model swing filter';
  else if(run.impactTime===null)reason='Did not reach spring';
  else if(run.springReleaseSpeed===null)reason='Did not rebound off spring';
  else if(!completed)reason='No completed turnaround within 20 seconds';
  const startGap=stopX(p)-x0;
  return {
    valid,reason,wind:p.windSpeed??0,drag:p.drag,
    impactSpeed:run.impactSpeed,
    reboundSpeed:run.springReleaseSpeed,
    returnDistance:valid?run.returnDistance:null,
    returnFraction:valid?run.returnDistance/Math.max(.01,startGap):null,
    trolleyReturned:Boolean(valid&&run.lowestAfterImpact<=x0+.02),
    seatReturned:Boolean(valid&&minSeat<=startSeat+.02),
    swing:run.maxSwing,springTravel:run.maxCompression,
    startGap,contactTime:run.impactTime,turnaroundTime:run.turningTime
  };
}
export function compareWind(p, speeds=WIND_SWEEP) {
  // Gusts OFF for controlled A/B comparisons, with exact same launch and
  // hardware. Turning gusts back on is possible in the live simulator.
  const fixed={...p,windGust:0};
  return speeds.map(wind=>simulateWind({...fixed,windSpeed:wind}));
}
export function windForceAtRest(p,time=0) {
  return aerodynamicForce(0,time,p);
}
