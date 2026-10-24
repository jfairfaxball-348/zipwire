import { MIN_PUSH_SETTINGS } from './min-push.js';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { OPTIMAL_FORCE_OBJECTIVE, RETURN_CONSTRAINTS } from './min-push-formula.js';

// A single, always-visible action. Uses an isolated worker so the Three.js
// animation never blocks while the minimum-force grid is searched.
export function attachMinimumPushUI({getParams,onSearchStart,onLaunch,onLoadDemo}) {
  const section=document.createElement('section');
  section.id='minimumPushPanel'; section.className='minimumPushPanel';
  section.innerHTML=[
    '<div class="minPushTop"><div><strong>↶ Minimum-force return</strong>',
    '<p>Find a modelled push that brings <b>both trolley and seat</b> back to their release positions. Keep the present wire, mass, spring, start point and wind unchanged.</p></div></div>',
    '<button id="minPushButton" class="minPushButton" type="button" aria-label="Find the minimum modelled push force that returns the trolley and seat, then automatically launch the 3D simulation">',
    '<span class="minPushKicker">✧ THE CONSTRAINED RETURN OPTIMISATION</span>',
    '<span class="minPushFormulaStack">',
    '<span class="minPushObjective" id="minPushObjective" aria-hidden="true"></span>',
    '<span class="minPushFormulaDivider"></span>',
    '<span class="minPushConstraints" id="minPushConstraints" aria-hidden="true"></span>',
    '</span>',
    '<span class="minPushButtonAction"><span class="minPushArrow">↗</span> COMPUTE F<sub>★</sub> &amp; RELEASE</span>',
    '<span class="minPushActionSubtitle">Minimise push force · Satisfy both return conditions</span></button>',
    '<div id="minPushStatus" class="minPushStatus" role="status" aria-live="polite">Ready · lowest feasible force on the sampled launch grid (0–110 N).</div>',
    '<div class="minPushActions"><button type="button" id="minPushCancel" class="secondary" disabled>Stop search</button>',
    '<button type="button" id="minPushDemo" class="secondary">Load 15 m return example &amp; find push</button></div>',
    '<p class="minPushDisclaimer">Numerical approximation, <b>not</b> a proven global optimum. Tests constant-force pushes, 0.20–0.45 s durations and seat angles −6° to +6° with zero initial swing rate. Not a playground force or safety recommendation.</p>'
  ].join('');
  document.querySelector('.playback').insertAdjacentElement('afterend',section);
  // Mathematical typography is rendered locally; no remote LaTeX service.
  katex.render(OPTIMAL_FORCE_OBJECTIVE, section.querySelector('#minPushObjective'),
    {displayMode:true,throwOnError:true,output:'htmlAndMathml',strict:false});
  katex.render(RETURN_CONSTRAINTS, section.querySelector('#minPushConstraints'),
    {displayMode:true,throwOnError:true,output:'htmlAndMathml',strict:false});
  const button=section.querySelector('#minPushButton'),
    status=section.querySelector('#minPushStatus'),
    stop=section.querySelector('#minPushCancel');
  let active=null,nextId=0,searching=false;
  const setBusy=busy=>{
    searching=busy;button.disabled=busy;stop.disabled=!busy;
    section.classList.toggle('minPushSearching',busy);
  };
  const terminate=()=>{nextId++;if(active){active.terminate();active=null;}setBusy(false);};
  const cancel=()=>{
    if(!searching)return;
    terminate();status.textContent='Search stopped. No launch was changed.';
  };
  const invalidate=()=>{
    const wasSearching=searching;
    terminate();
    status.textContent=wasSearching?'Physical or launch settings changed; search cancelled.':'Settings changed. Find a fresh minimum-force launch for this configuration.';
  };
  function run(){
    terminate();
    const base={...getParams()};
    const id=++nextId;
    setBusy(true);
    status.textContent='Searching from 0 N upwards · apparatus held fixed…';
    onSearchStart();
    const worker=new Worker(new URL('./min-push.worker.js',import.meta.url),{type:'module'});
    active=worker;
    worker.onmessage=e=>{
      const d=e.data;
      if(d.id!==id||nextId!==id)return;
      if(d.type==='progress'){
        status.textContent='Testing '+d.force.toFixed(0)+' N · '+d.checked+' launches simulated'+
          (d.phase==='refine'?' · 1 N refinement':' · 5 N sweep')+'.';
        return;
      }
      terminate();
      if(d.type==='error'){
        status.textContent='The calculation could not complete: '+d.message;
        return;
      }
      if(!d.found){
        status.innerHTML='<b>No return found for this structure.</b> '+d.checked+
          ' launch combinations tested up to '+d.maxForce+' N; neither result nor equipment limits should be extrapolated. Try the labelled hypothetical 15 m example if you want to see a return.';
        return;
      }
      const solution=d.winning;
      const launch=solution.params;
      const returnDistance=solution.result.returnDistance;
      status.innerHTML='<b>Launching best sampled force: '+launch.pushForce.toFixed(0)+' N</b> for '+
        launch.pushDuration.toFixed(2)+' s · '+(launch.initialSwing>=0?'+':'')+launch.initialSwing.toFixed(0)+
        '° seat tilt. Predicted return '+returnDistance.toFixed(2)+' m ('+
        (100*solution.result.returnFraction).toFixed(0)+'% of start gap). '+
        d.checked+' simulated cases; 5 N grid with 1 N refinement.';
      onLaunch(solution.params,solution.result);
    };
    worker.onerror=()=>{
      if(id!==nextId)return;
      terminate();status.textContent='The launch calculation encountered an error. Existing settings are unchanged.';
    };
    worker.postMessage({type:'run',id,base});
  }
  button.addEventListener('click',run);
  stop.addEventListener('click',cancel);
  section.querySelector('#minPushDemo').addEventListener('click',()=>{
    terminate();
    onLoadDemo();
    run();
  });
  return {run,cancel,invalidate};
}
