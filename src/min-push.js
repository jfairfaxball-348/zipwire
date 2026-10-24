import { simulateWind } from './wind.js';

// A transparent bounded-search approximation to
//   F* = min F : trolley AND seat centre return to their launch coordinates.
// Apparatus, release point and wind remain fixed during the search.
// We vary ONLY constant push force, its duration and small initial swing angle.
// Initial swing angular velocity is set to zero to avoid a free kinetic impulse.
// This is not a globally optimal control proof or real equipment operating limit.
export const MIN_PUSH_SETTINGS=Object.freeze({
  maxForceN:110,
  coarseStepN:5,
  fineStepN:1,
  durationsS:Object.freeze([.20,.25,.30,.35,.40,.45]),
  anglesDeg:Object.freeze([0,-2,2,-4,4,-6,6]),
  initialSwingRate:0
});
export function minPushCandidate(base,force,duration,angle) {
  return {...base,pushForce:force,pushDuration:duration,
    initialSwing:angle,initialSwingRate:MIN_PUSH_SETTINGS.initialSwingRate};
}
export function bestAtForce(base,force) {
  let tested=0,admissible=0,winner=null;
  for(const angle of MIN_PUSH_SETTINGS.anglesDeg){
    for(const duration of MIN_PUSH_SETTINGS.durationsS){
      const params=minPushCandidate(base,force,duration,angle);
      const result=simulateWind(params);
      tested++;
      if(result.valid)admissible++;
      if(result.valid&&result.trolleyReturned&&result.seatReturned){
        // At this fixed force, choose the smallest force×duration
        // (impulse proxy), then the smallest tilt magnitude.
        if(!winner||duration<winner.params.pushDuration-1e-8||
           (Math.abs(duration-winner.params.pushDuration)<1e-8 &&
            Math.abs(angle)<Math.abs(winner.params.initialSwing))){
          winner={params:{
            pushForce:force,pushDuration:duration,
            initialSwing:angle,initialSwingRate:0,
            startFraction:base.startFraction
          },result};
        }
      }
    }
  }
  return {winner,tested,admissible};
}
export function searchFiniteMinimumSync(base,notify=()=>{},abort=()=>false) {
  const settings=MIN_PUSH_SETTINGS;
  let total=0,admissible=0,winning=null,prevForce=0;
  for(let force=0;force<=settings.maxForceN+1e-8;force+=settings.coarseStepN){
    if(abort())return null;
    const res=bestAtForce(base,force);
    total+=res.tested;admissible+=res.admissible;
    notify({phase:'coarse',force,checked:total,admissible});
    if(res.winner){winning=res.winner;prevForce=Math.max(0,force-settings.coarseStepN);break;}
  }
  if(winning){
    // Coarse grid alone might miss a narrow swing-phase window. We scan
    // 1 N steps below the first successful 5 N grid point. We do not
    // claim anything about untested sub-newton values.
    for(let force=prevForce+settings.fineStepN;force<winning.params.pushForce-1e-8;force+=settings.fineStepN){
      if(abort())return null;
      const res=bestAtForce(base,force);
      total+=res.tested;admissible+=res.admissible;
      notify({phase:'refine',force,checked:total,admissible});
      if(res.winner){winning=res.winner;break;}
    }
  }
  return {
    found:Boolean(winning),winning,checked:total,admissible,
    maxForce:settings.maxForceN,coarseStep:settings.coarseStepN,
    fineStep:settings.fineStepN,
    fixedStartFraction:base.startFraction,
    // Note that force nonmonotonicity means this is a *bounded sampled*
    // minimum, not an analytic or certified exact threshold.
    note:'Finite launch grid; no monotonicity or global-optimality guarantee.'
  };
}
