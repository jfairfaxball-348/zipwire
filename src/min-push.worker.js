import { MIN_PUSH_SETTINGS,bestAtForce } from './min-push.js';

let activeId=0;
const yieldUI=()=>new Promise(resolve=>setTimeout(resolve,0));

self.onmessage=async e=>{
  const data=e.data;
  if(data?.type==='cancel'){activeId++;return;}
  if(data?.type!=='run')return;
  const id=data.id;
  activeId=id;
  const base={...data.base},st=MIN_PUSH_SETTINGS;
  let checked=0,admissible=0,winning=null,firstCoarse=null;
  try{
    for(let force=0;force<=st.maxForceN;force+=st.coarseStepN) {
      if(activeId!==id)return;
      const r=bestAtForce(base,force);
      checked+=r.tested;admissible+=r.admissible;
      postMessage({type:'progress',id,force,checked,admissible,phase:'coarse'});
      await yieldUI();
      if(activeId!==id)return;
      if(r.winner) {winning=r.winner;firstCoarse=force;break;}
    }
    if(winning){
      // Check every 1 N point in the preceding 5 N band. Do not use binary
      // search: return feasibility need not be monotone in force.
      const start=Math.max(0,firstCoarse-st.coarseStepN);
      for(let force=start+st.fineStepN;force<firstCoarse;force+=st.fineStepN){
        if(activeId!==id)return;
        const r=bestAtForce(base,force);
        checked+=r.tested;admissible+=r.admissible;
        postMessage({type:'progress',id,force,checked,admissible,phase:'refine'});
        await yieldUI();
        if(activeId!==id)return;
        if(r.winner){winning=r.winner;break;}
      }
    }
    postMessage({type:'done',id,found:Boolean(winning),winning,checked,admissible,
      maxForce:st.maxForceN,coarseStep:st.coarseStepN,fineStep:st.fineStepN,
      fixedStartFraction:base.startFraction});
  }catch(err){
    postMessage({type:'error',id,message:String(err?.message||err)});
  }
};