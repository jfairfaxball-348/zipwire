import { TEMPLATE, SEARCH_BOUNDS, LAUNCH_KEYS, evaluateLaunch, proposedLaunch, nearForceLimit } from './optimizer.js';

let active = 0;
const chunk = () => new Promise(resolve=>setTimeout(resolve,0));
async function search(id) {
  const base = {...TEMPLATE};
  const candidates = [
    Object.fromEntries(LAUNCH_KEYS.map(k=>[k,base[k]])),
    ...Array.from({length:240},(_,i)=>proposedLaunch(i+1)),
    // Include physically intuitive no-swing cases, to compare against phase-tuned launches.
    ...[0,35,70,105,150].map(force=>({...base,pushForce:force,initialSwing:0,initialSwingRate:0}))
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
    for(let i=0;i<=12;i++){
      const force=SEARCH_BOUNDS.pushForce[1]*i/12;
      const result=evaluateLaunch(base,{...best.params,pushForce:force});
      sweep.push({force,valid:result.valid,returnDistance:result.valid?result.returnDistance:null,reason:result.reason});
      if(i%4===0)await chunk();
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
    interiorSweepPeak,base
  });
}
onmessage=e=>{
  if(e.data?.type==='cancel'){active++;return;}
  if(e.data?.type==='search'){
    const id=e.data.id;
    active=id;
    search(id).catch(error=>postMessage({type:'error',id,message:String(error?.message||error)}));
  }
};
