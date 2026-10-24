import { TEMPLATE, SEARCH_BOUNDS, LAUNCH_KEYS, evaluateLaunch, proposedLaunch, nearForceLimit } from './optimizer.js';
import { SCENARIOS, scenarioParams } from './scenarios.js';

let active = 0;
const chunk = () => new Promise(resolve=>setTimeout(resolve,0));
async function search(id,scenarioId='reference') {
  const base=scenarioParams(scenarioId);
  const candidates = [
    Object.fromEntries(LAUNCH_KEYS.map(k=>[k,base[k]])),
    ...Array.from({length:240},(_,i)=>proposedLaunch(i+1)),
    // Include physically intuitive no-swing cases, to compare against phase-tuned launches.
    ...[0,35,55,65,70,80,95,110].map(force=>({...base,pushForce:force,initialSwing:0,initialSwingRate:0})),
    ...[60,65,70,75,80,85,90,95].flatMap(force=>[0,4].map(angle=>({...base,startFraction:.07,pushForce:force,pushDuration:.4,initialSwing:angle,initialSwingRate:0})))
  ];
  let count=0, feasible=0, best=null;
  async function tryOne(params,totalHint) {
    if(id!==active) return null;
    const trial=evaluateLaunch(base,params);
    count++;
    if(trial.valid){
      feasible++;
      if(best===null || trial.score>best.score+1e-8) best=trial;
    }
    if(count%10===0){
      postMessage({type:'progress',id,count,total:totalHint,feasible,best:best && {returnDistance:best.returnDistance}});
      await chunk();
    }
    return trial;
  }
  for(const candidate of candidates){
    if(id!==active)return;
    await tryOne(candidate,316);
  }
  // Deterministic coordinate refinement around the most promising sampled point.
  if(best){
    for(const scale of [0.17,0.055,0.017]){
      for(const key of LAUNCH_KEYS) {
        for(const sign of [-1,1]){
          const [lo,hi] = SEARCH_BOUNDS[key];
          await tryOne({...best.params,[key]:Math.min(hi,Math.max(lo,best.params[key]+sign*(hi-lo)*scale))},316);
          if(id!==active)return;
        }
      }
    }
  }
  const baseline=evaluateLaunch(base,base);
  const sweep=[];
  if(best){
    // A sparse grid may miss a narrow force/swing-phase resonance.
    const coarse=Array.from({length:13},(_,i)=>SEARCH_BOUNDS.pushForce[1]*i/12);
    const local=[-12,-10,-8,-6,-4,-3,-2,-1,0,1,2,3,4,6,8,10,12]
      .map(delta=>best.params.pushForce+delta);
    const forces=[...new Set([...coarse,...local]
      .map(v=>Math.round(Math.min(SEARCH_BOUNDS.pushForce[1],Math.max(0,v))*1000)/1000))]
      .sort((a,b)=>a-b);
    for(let i=0;i<forces.length;i++){
      const force=forces[i];
      const result=evaluateLaunch(base,{...best.params,pushForce:force});
      sweep.push({force,valid:result.valid,returnDistance:result.valid?result.returnDistance:null,reason:result.reason});
      if(i%5===0)await chunk();
      if(id!==active)return;
    }
  }
  const validSweep=sweep.filter(x=>x.valid);
  const sweepMax=validSweep.reduce((a,b)=>a===null||b.returnDistance>a.returnDistance?b:a,null);
  const interiorSweepPeak = Boolean(sweepMax &&
    sweepMax.force > SEARCH_BOUNDS.pushForce[0]+1e-7 &&
    sweepMax.force < SEARCH_BOUNDS.pushForce[1]-1e-7 &&
    sweep.filter(x=>x.force>sweepMax.force&&x.valid).length>0);
  postMessage({
    type:'done', id, count, feasible,best,baseline,sweep,
    nearForceLimit:nearForceLimit(best),
    nearSwingLimit:Boolean(best && best.maxSwing>=49),
    nearStartLimit:Boolean(best && best.params.startFraction>=SEARCH_BOUNDS.startFraction[1]-.005),
    interiorSweepPeak,base,scenarioId
  });
}
// Hold the launch point fixed and start with zero angular speed. A four-degree
// tilt is a small controlled initial condition, not injected angular kinetic
// energy. We prefer both seat and trolley coming back to their starting points.
async function compare(id){
  const results=[];
  const forces=[35,45,55,60,65,70,75,80,85,90,95,100,110];
  const durations=[.2,.25,.3,.35,.4,.45];
  for(const config of SCENARIOS){
    if(id!==active)return;
    const base=scenarioParams(config.id);
    let best=null, bestHome=null, bestBoth=null, admissible=0, trials=0;
    for(const force of forces){
      for(const duration of durations){
        for(const angle of [0,4]){
          if(id!==active)return;
          const r=evaluateLaunch(base,{
            startFraction:.07,pushForce:force,pushDuration:duration,
            initialSwing:angle,initialSwingRate:0
          });
          trials++;
          if(r.valid){
            admissible++;
            if(!best||r.returnFraction>best.returnFraction)best=r;
            if(r.trolleyReturned && (!bestHome||force<bestHome.params.pushForce ||
              (force===bestHome.params.pushForce&&duration<bestHome.params.pushDuration)))bestHome=r;
            if(r.trolleyReturned&&r.seatReturned &&
              (!bestBoth||force<bestBoth.params.pushForce||
               (force===bestBoth.params.pushForce&&duration<bestBoth.params.pushDuration)))bestBoth=r;
          }
        }
      }
      await chunk();
    }
    results.push({scenarioId:config.id,name:config.name,description:config.description,
      trials,admissible,best,bestHome,bestBoth,
      selected:bestBoth||bestHome||best});
    postMessage({type:'compare-progress',id,done:results.length,total:SCENARIOS.length});
  }
  postMessage({type:'compare-done',id,results});
}
onmessage=e=>{
  if(e.data?.type==='cancel'){active++;return;}
  if(e.data?.type==='search'||e.data?.type==='compare'){
    const id=e.data.id; active=id;
    const task=e.data.type==='search'?search(id,e.data.scenarioId):compare(id);
    task.catch(error=>postMessage({type:'error',id,message:String(error?.message||error)}));
  }
};
