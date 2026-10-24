import { DEFAULTS, cableY, initialX, makeRun, stepRun, stopX, clamp } from './physics.js';

// These are illustrative values, not field measurements or operating limits.
// Keep every mechanical/system parameter locked during each optimisation.
export const TEMPLATE = Object.freeze({
  ...DEFAULTS,
  seatMass: 4,             // empty seat + suspension, hypothetical
  trolleyMass: 5,
  friction: 0.027,
  drag: 0.035,
  springK: 1450,
  springDamping: 105,
  startFraction: 0.07,
  pushForce: 65,
  pushDuration: 0.25,
  initialSwing: 0,
  initialSwingRate: 0
});
export const SEARCH_BOUNDS = Object.freeze({
  startFraction: [0.04, 0.20],
  pushForce: [0, 150],
  pushDuration: [0.15, 0.55],
  initialSwing: [-12, 12],
  initialSwingRate: [-35, 35]
});
export const LAUNCH_KEYS = Object.freeze(Object.keys(SEARCH_BOUNDS));
const DT = 1/240, MAX_TIME = 20;
export function launchParams(base, values) {
  const p = { ...base };
  for(const key of LAUNCH_KEYS) {
    const [low, high] = SEARCH_BOUNDS[key];
    p[key] = clamp(Number(values[key] ?? p[key]), low, high);
  }
  return p;
}
export function evaluateLaunch(base, settings = {}) {
  const p = launchParams(base, settings);
  const run = makeRun(p);
  run.recordSamples = false;
  const xLaunch = initialX(p);
  const seatLaunchX = xLaunch + p.suspension*Math.sin(p.initialSwing*Math.PI/180);
  let seatMinimum = Infinity, clearanceMinimum = Infinity;
  const maxSteps = Math.ceil(MAX_TIME/DT);
  for(let n=0; n<maxSteps && !run.finished; n++){
    stepRun(run,p,DT);
    const st = run.state;
    // Centre of the seat, not the bottom edge, for geometric consistency.
    const seatY = cableY(st.x,p)-p.suspension*Math.cos(st.phi);
    clearanceMinimum = Math.min(clearanceMinimum, seatY);
    if(run.springReleaseSpeed !== null){
      seatMinimum = Math.min(seatMinimum, st.x+p.suspension*Math.sin(st.phi));
    }
    if(!Number.isFinite(st.v)||!Number.isFinite(st.phi)) break;
  }
  const complete = Boolean(run.turningTime!==null && run.springReleaseSpeed!==null);
  const contact = run.impactSpeed!==null;
  const valid = complete && !run.overtravel && clearanceMinimum > 0.35 && run.maxSwing < 50
    && [run.returnDistance, run.impactSpeed, run.maxCompression].every(Number.isFinite);
  let reason = 'Valid completed rebound';
  if(run.overtravel) reason = 'Modelled spring stroke exceeded';
  else if(clearanceMinimum<=0.35) reason='Seat centre too near ground';
  else if(run.maxSwing>=50) reason='Excessive swing in model';
  else if(!contact) reason='Did not reach spring';
  else if(run.springReleaseSpeed===null) reason='Did not depart from spring';
  else if(!complete) reason='No completed turnaround within 20 s';
  return {
    valid, reason, params: Object.fromEntries(LAUNCH_KEYS.map(k=>[k,p[k]])),
    returnDistance: valid?run.returnDistance:0,
    springTravel:run.maxCompression,
    impactSpeed:run.impactSpeed,
    reboundSpeed:run.springReleaseSpeed,
    maxSwing:run.maxSwing,
    contactTime:run.impactTime,
    turnaroundTime:run.turningTime,
    releaseHeight:cableY(xLaunch,p),
    trolleyReturned:valid && run.lowestAfterImpact<=xLaunch+.02,
    seatReturned:valid && seatMinimum<=seatLaunchX+.02,
    startGap:stopX(p)-xLaunch,
    returnFraction:valid?run.returnDistance/Math.max(.001,stopX(p)-xLaunch):0,
    minSeatHeight:clearanceMinimum,
    // Clearly labelled model selection metric, not a real-world optimal force.
    score: valid?run.returnDistance:-Infinity
  };
}
export function halton(index, base) {
  let result=0, fraction=1/base;
  while(index>0) {
    result+=fraction*(index%base);
    index=Math.floor(index/base);
    fraction/=base;
  }
  return result;
}
export function proposedLaunch(index) {
  const primes=[2,3,5,7,11];
  const values={};
  LAUNCH_KEYS.forEach((key,j)=>{
    const [lo,hi]=SEARCH_BOUNDS[key];
    values[key]=lo+(hi-lo)*halton(index,primes[j]);
  });
  return values;
}
export function nearForceLimit(result) {
  return Boolean(result && result.params.pushForce >= SEARCH_BOUNDS.pushForce[1]*.975);
}
