import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULTS, cableY, cableSlope, stopX, initialState, makeRun, stepRun, energy, clamp } from './physics.js';
import './style.css';
import { TEMPLATE, SEARCH_BOUNDS } from './optimizer.js';

const p = {...DEFAULTS};
let run = makeRun(p), playing = false, playbackRate = 1, tab = 'optimise', showTrail = true;
let optimizerWorker=null, optimizerJobId=0, optimizerBusy=false, optimizationResult=null, optimizerProgress='';
let currentScene = null, lastFrame = performance.now(), frameAccum = 0, trailPoints = [];
const app = document.getElementById('app');

app.innerHTML = [
  '<header class="topbar">',
  '<div class="identity"><div class="logo">Z</div><div class="brand">ZIPWIRE <span>LAB</span><small>Interactive physics studio</small></div></div>',
  '<div class="topRight"><span class="flag">3D PHYSICS · V1</span><a class="link" target="_blank" rel="noopener" href="https://github.com/jfairfaxball-348/zipwire">↗ GitHub</a></div>',
  '</header>',
  '<div class="workspace"><aside class="sidebar">',
  '<div class="eyebrow">Experiment setup</div><h2 class="panelTitle">Your zipwire</h2>',
  '<p class="muted">Inspired by the photographed steel A-frames, launch ramp, suspended disc seat and coil-spring stop.</p>',
  '<nav class="sidebarTabs" id="tabs" aria-label="Parameter categories"></nav>',
  '<div id="controls"></div>',
  '<div class="separator"></div><div class="groupTitle"><i>↺</i> Quick configurations</div>',
  '<div class="presetRow"><button class="chip" data-preset="empty">Empty seat</button><button class="chip" data-preset="rider">With rider</button><button class="chip" data-preset="gentle">Gentle release</button></div>',
  '<div class="sideNote"><b>Exploratory model.</b> Dimensions and material coefficients are estimates. The actual stop may have nonlinear damping and hard limits. Do not use simulated force or speed values as safe operating limits.</div>',
  '</aside><main class="content">',
  '<div class="stageHead"><div><div class="stageTitle">3D experiment chamber</div><div class="stageDesc">Orbit to inspect · Scroll to zoom · Drag on touchscreens</div></div>',
  '<div class="viewActions"><button class="smallButton" id="trailButton">◉ Trail on</button><button class="smallButton" id="cameraButton">⤾ View</button></div></div>',
  '<div class="viewer" id="viewport"><div class="viewTag">PHOTO-INSPIRED RECONSTRUCTION</div><div class="inset"><small>Simulation time</small><strong id="clock">0.00 s</strong></div>',
  '<div class="legend"><span><i class="legendDot"></i> Trolley / seat</span><span><i class="legendDot teal"></i> Return trajectory</span></div></div>',
  '<div class="playback"><div class="playActions"><button class="primary" id="release">▶ Release seat</button><button class="secondary" id="reset">↺ Reset</button><button class="secondary" id="speed">1× speed</button><button class="secondary" id="optimiseTop">✦ Optimise launch</button></div>',
  '<div class="status"><strong id="status">Ready for release</strong><span id="substatus">Adjust the sliders, then run the simulation.</span></div></div>',
  '<section class="dashboard"><div class="headingLine"><div class="sectionTitle">Live telemetry</div><span class="hint">Model-generated estimates · SI units</span></div>',
  '<div class="metrics">',
  '<div class="metric"><label>Impact velocity</label><strong id="impact">—</strong><small>At first spring contact</small></div>',
  '<div class="metric"><label>Return distance</label><strong class="accent" id="returnDistance">—</strong><small>Back from spring contact</small></div>',
  '<div class="metric"><label>Peak spring compression</label><strong id="compression">—</strong><small>Axial displacement</small></div>',
  '<div class="metric"><label>Peak seat swing</label><strong id="swing">0.0°</strong><small>From vertical</small></div>',
  '</div><section id="optimizerPanel" class="optimizerPanel"><div class="optimizerHeading">✦ Launch optimiser <small>Bounded model search</small></div><div id="optimizerOutput" class="optimizerOutput"></div></section><div class="bottomGrid">',
  '<div class="graphBox"><div class="graphTop"><div class="sectionTitle">Trolley travel</div><span class="hint">Distance along horizontal cable span vs time</span></div><svg class="chart" id="chart" viewBox="0 0 520 160" preserveAspectRatio="none" aria-label="Trolley position over time"></svg></div>',
  '<div class="insight"><div class="sectionTitle">What the model is solving</div><p id="insightText">A trolley constrained to the curved cable and a seat that swings beneath it are solved together. Impact compresses the spring; damping dissipates part of the energy before rebound.</p><p id="energyText" class="hint"></p></div>',
  '</div><div class="foot">This is a planar coupled Lagrangian model numerically integrated with RK4 at 240 steps/second. Cable sag is a prescribed parabola rather than a dynamically deforming cable. The spring is a unilateral linear spring/damper. Real swing, wheel dynamics, structure flex, rotational inertia, impact nonlinearities and safety margins require calibration or a higher-fidelity model.</div>',
  '</section></main></div>'
].join('');

const groups = {
  geometry: [
    {title:'Wire geometry',symbol:'⌁',items:[
      ['length','Span length',6,32,.5,'m','Horizontal distance between supports'],
      ['startHeight','Start anchor height',2.5,5.5,.1,'m'],
      ['drop','End-to-end drop',-0.8,1.8,.05,'m','Positive means the end is lower'],
      ['sag','Midspan cable sag',0,1.1,.02,'m','Prescribed bow below the straight chord'],
      ['suspension','Seat suspension length',.75,2.5,.05,'m'],
      ['platformHeight','Start platform height',.25,1.5,.05,'m'],
      ['endClearance','Stop-to-end-support gap',.3,3.5,.1,'m','Clear cable distance beyond the spring end block']
    ]},
    {title:'Position on wire',symbol:'◎',items:[
      ['startFraction','Starting position',2,75,1,'%','Share of the route before spring contact']
    ]}
  ],
  dynamics: [
    {title:'Mass and resistance',symbol:'⚖',items:[
      ['trolleyMass','Trolley / fittings mass',1,15,.5,'kg'],
      ['seatMass','Hanging mass incl. rider',2,90,1,'kg','Includes seat and any rider'],
      ['friction','Wheel resistance coefficient',.002,.12,.002,'','Effective resistance, not a measured value'],
      ['drag','Quadratic drag factor',0,.3,.005,'kg/m','Opposes trolley travel']
    ]},
    {title:'Spring end-stop',symbol:'〰',items:[
      ['springLength','Available coil length',.45,1.6,.05,'m'],
      ['endClearance','End support clearance',.3,3.5,.1,'m','Distance from the rear block of the spring to the end A-frame'],
      ['springK','Spring stiffness',200,6500,50,'N/m'],
      ['springDamping','Spring damping',0,800,10,'Ns/m','Energy lost during compression and rebound']
    ]},
    {title:'Swing damping',symbol:'◡',items:[
      ['swingDamping','Pendulum damping',0,4,.05,'N·m·s','Opposes angular motion']
    ]}
  ],
  optimise: [],
  launch: [
    {title:'Launch conditions',symbol:'↗',items:[
      ['startFraction','Starting position',2,75,1,'%','Controls the actual release height on the curved cable'],
      ['pushForce','Push force along the wire',0,350,5,'N','Applied during the first part of the run'],
      ['pushDuration','Push duration',.05,1,.05,'s','Force acts while the trolley is moving'],
      ['initialSwing','Initial seat angle',-35,35,1,'°','Positive = tilted towards the end'],
      ['initialSwingRate','Initial swing velocity',-90,90,5,'°/s','Positive = swinging towards the end']
    ]},
    {title:'Coordinate reference',symbol:'⌖',items:[
      ['drop','End-to-end drop',-0.8,1.8,.05,'m'],
      ['sag','Cable sag',0,1.1,.02,'m']
    ]}
  ]
};

function pretty(v,step) {
  const digits=step<.01?3:step<.1?2:step<1?1:0;
  return Number(v).toFixed(digits);
}
function mountControls(){
  const tabs=document.getElementById('tabs');
  tabs.innerHTML=['geometry','dynamics','launch','optimise'].map(k=>'<button class="tab '+(tab===k?'active':'')+'" data-tab="'+k+'">'+({geometry:'Geometry',dynamics:'Physics',launch:'Launch',optimise:'Optimise'}[k])+'</button>').join('');
  tabs.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab;mountControls();}));
  const wrap=document.getElementById('controls');wrap.innerHTML='';
  if(tab==='optimise'){renderOptimizerControls(wrap);return;}
  groups[tab].forEach(g=>{
    const group=document.createElement('section');group.className='group';
    group.innerHTML='<div class="groupTitle"><i>'+g.symbol+'</i>'+g.title+'</div>';
    g.items.forEach(([key,label,min,max,step,unit,note])=>{
      const isFraction=key==='startFraction';
      const val=isFraction?p[key]*100:p[key];
      const node=document.createElement('div');node.className='control';
      node.innerHTML='<div class="controlHeading"><label for="slide-'+key+'">'+label+'</label><span class="value" id="value-'+key+'">'+pretty(val,step)+' '+unit+'</span></div>'+
       '<input id="slide-'+key+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'" aria-label="'+label+'"/>'+
       '<div class="rangeEnds"><span>'+min+' '+unit+'</span><span>'+max+' '+unit+'</span></div>'+
       (note?'<div class="parameterNote">'+note+'</div>':'');
      const input=node.querySelector('input');
      input.addEventListener('input',()=>{
        const n=Number(input.value);p[key]=isFraction?n/100:n;
        cancelOptimization();optimizationResult=null;updateOptimizerOutput();
        node.querySelector('.value').textContent=pretty(n,step)+' '+unit;
        playing=false;run=makeRun(p);frameAccum=0;trailPoints=[];
        buildStatic();updateDynamics(run.state);updateTelemetry();
      });
      group.appendChild(node);
    });
    wrap.appendChild(group);
  });
}
mountControls();

document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>{
  cancelOptimization();optimizationResult=null;updateOptimizerOutput();
  Object.assign(p,DEFAULTS);
  if(b.dataset.preset==='empty'){p.seatMass=4;p.pushForce=70;}
  if(b.dataset.preset==='rider'){p.seatMass=40;p.pushForce=135;}
  if(b.dataset.preset==='gentle'){p.seatMass=5;p.pushForce=0;p.startFraction=.06;}
  playing=false;run=makeRun(p);trailPoints=[];frameAccum=0;
  mountControls();buildStatic();updateDynamics(run.state);updateTelemetry();
}));
const release=document.getElementById('release');
release.addEventListener('click',()=>{
  if(run.finished || run.phase==='ready') {
    run=makeRun(p);trailPoints=[];frameAccum=0;
  }
  playing=!playing;
  release.textContent=playing?'Ⅱ Pause':'▶ '+(run.phase==='ready'?'Release seat':'Resume');
  updateTelemetry();
});
document.getElementById('reset').addEventListener('click',()=>{
  playing=false;run=makeRun(p);trailPoints=[];frameAccum=0;
  updateDynamics(run.state);updateTelemetry();
});
document.getElementById('speed').addEventListener('click',e=>{
  playbackRate=playbackRate===1?.25:playbackRate===.25?2:1;
  e.currentTarget.textContent=playbackRate+'× speed';
});
document.getElementById('trailButton').addEventListener('click',e=>{
  showTrail=!showTrail;e.currentTarget.textContent=showTrail?'◉ Trail on':'◯ Trail off';
  if(trailLine)trailLine.visible=showTrail;
});


// Separate worker computes an actual bounded search over the same physics
// integrator; do not confuse the selected candidate with a certified optimum.
function renderOptimizerControls(node){
  node.innerHTML='<div class="optimiserSidebar"><div class="groupTitle"><i>✦</i> Reference launch</div>'+
    '<p class="muted">Fix the apparatus at illustrative values, then vary only how the trolley and seat start moving.</p>'+
    '<div class="fixedList"><strong>Fixed template (estimates)</strong>'+
    '<div><span>Cable span</span><b>'+TEMPLATE.length+' m</b></div>'+
    '<div><span>Total moving mass</span><b>'+(TEMPLATE.trolleyMass+TEMPLATE.seatMass)+' kg</b></div>'+
    '<div><span>Spring stiffness</span><b>'+TEMPLATE.springK+' N/m</b></div>'+
    '<div><span>Spring damping</span><b>'+TEMPLATE.springDamping+' Ns/m</b></div>'+
    '<div><span>Midspan sag</span><b>'+TEMPLATE.sag+' m</b></div></div>'+
    '<button class="secondary optFull" id="optLoad">↺ Reset to template</button>'+
    '<button class="primary optFull" id="optRun" '+(optimizerBusy?'disabled':'')+'>✦ '+(optimizerBusy?'Searching…':'Find best tested return')+'</button>'+
    '<button class="secondary optFull '+(optimizerBusy?'':'hidden')+'" id="optCancel">Cancel</button>'+
    '<div id="optStatus" class="optimiserStatus" aria-live="polite">'+(optimizerProgress||'Ready for mathematical search.')+'</div>'+
    '<div class="searchBounds"><strong>Search dimensions</strong><div>Push force: 0–150 N</div>'+
    '<div>Push duration: 0.15–0.55 s</div><div>Starting position: 4–20% of span to spring</div>'+
    '<div>Initial swing: −12° to +12°</div><div>Initial angular speed: −35°/s to +35°/s</div></div>'+
    '<p class="foot">The search ranges are arbitrary analytical bounds, not safe real-world push settings. Spring limits and mass are not measured.</p></div>';
  node.querySelector('#optLoad').addEventListener('click',loadTemplate);
  node.querySelector('#optRun').addEventListener('click',startOptimization);
  node.querySelector('#optCancel').addEventListener('click',cancelOptimization);
}
function cancelOptimization(){
  optimizerJobId++;
  if(optimizerWorker){optimizerWorker.terminate();optimizerWorker=null;}
  optimizerBusy=false;optimizerProgress='';
}
function loadTemplate(){
  cancelOptimization();
  Object.assign(p,TEMPLATE);
  optimizationResult=null;playing=false;run=makeRun(p);
  frameAccum=0;trailPoints=[];
  mountControls();buildStatic();updateDynamics(run.state);updateTelemetry();updateOptimizerOutput();
}
function startOptimization(){
  loadTemplate();
  optimizerBusy=true;optimizerProgress='Evaluating simulated launches…';
  mountControls();updateOptimizerOutput();
  const id=++optimizerJobId;
  const worker=new Worker(new URL('./optimizer.worker.js',import.meta.url),{type:'module'});
  optimizerWorker=worker;
  worker.onmessage=e=>{
    const d=e.data;
    if(d.id!==id||id!==optimizerJobId)return;
    if(d.type==='progress'){
      optimizerProgress=d.count+' tested · '+d.feasible+' admissible rebounds'+(d.best?' · best '+d.best.returnDistance.toFixed(2)+' m':'');
      const msg=document.getElementById('optStatus');
      if(msg)msg.textContent=optimizerProgress;
      updateOptimizerOutput();
    } else {
      optimizerBusy=false;worker.terminate();optimizerWorker=null;
      if(d.type==='done'){
        optimizationResult=d;
        optimizerProgress='Completed '+d.count+' numerical experiments.';
      }else optimizerProgress='Optimiser error: '+(d.message||'Unknown error');
      mountControls();updateOptimizerOutput();
    }
  };
  worker.onerror=()=>{
    if(id!==optimizerJobId)return;
    optimizerBusy=false;optimizerProgress='Could not complete numerical search.';
    if(optimizerWorker)optimizerWorker.terminate();
    optimizerWorker=null;mountControls();updateOptimizerOutput();
  };
  worker.postMessage({type:'search',id});
}
function replayOptimized(){
  if(!optimizationResult?.best)return;
  Object.assign(p,TEMPLATE,optimizationResult.best.params);
  playing=true;run=makeRun(p);frameAccum=0;trailPoints=[];
  tab='launch';mountControls();buildStatic();updateDynamics(run.state);updateTelemetry();
  document.getElementById('viewport').scrollIntoView({block:'nearest',behavior:'smooth'});
}
function forcePlot(sweep){
  if(!sweep?.length)return '';
  const top=Math.max(.01,...sweep.filter(d=>d.valid).map(d=>d.returnDistance));
  const X=x=>22+468*x/SEARCH_BOUNDS.pushForce[1];
  const Y=y=>132-109*y/top;
  let trace='',last=false;
  for(const d of sweep){
    if(!d.valid){last=false;continue;}
    trace+=(last?' L':' M')+X(d.force).toFixed(1)+' '+Y(d.returnDistance).toFixed(1);
    last=true;
  }
  return '<svg class="forcePlot" viewBox="0 0 510 163" preserveAspectRatio="none" role="img" aria-label="Return distance versus force; other launch settings held fixed">'+
    '<line x1="22" y1="132" x2="490" y2="132" stroke="#708a95"/>'+
    '<text x="22" y="15" font-size="11" fill="#9fb8c2">'+top.toFixed(1)+' m</text>'+
    '<text x="22" y="153" font-size="11" fill="#9fb8c2">0 N</text>'+
    '<text x="489" y="153" text-anchor="end" font-size="11" fill="#9fb8c2">150 N</text>'+
    '<path d="'+trace+'" fill="none" stroke="#6fe6bb" stroke-width="2.6"/>'+
    sweep.filter(d=>d.valid).map(d=>'<circle cx="'+X(d.force)+'" cy="'+Y(d.returnDistance)+'" r="3.5" fill="#88efd1"/>').join('')+
    '</svg>';
}
function updateOptimizerOutput(){
  const el=document.getElementById('optimizerOutput');
  if(!el)return;
  if(optimizerBusy){
    el.innerHTML='<p><b>Simulating launch candidates…</b> '+optimizerProgress+'</p><p>The 3D scene remains responsive while the numerical search runs in a worker.</p>';
    return;
  }
  const d=optimizationResult;
  if(!d){
    el.innerHTML='<p>Can we find a launch force and swing phase that return the trolley furthest towards the start, without changing the physical zipwire?</p>'+
    '<button class="secondary" id="optMainRun">✦ Search for best return</button>';
    el.querySelector('#optMainRun').addEventListener('click',()=>{tab='optimise';startOptimization();});
    return;
  }
  if(!d.best){
    el.innerHTML='<p><b>No valid completed rebound found.</b> '+d.count+' candidates tried; none passed the model completion, travel and clearance conditions.</p>'+
      '<button class="secondary" id="optRetry">Re-run search</button>';
    el.querySelector('#optRetry').addEventListener('click',startOptimization);
    return;
  }
  const b=d.best;
  const baseline=d.baseline?.valid?d.baseline.returnDistance.toFixed(2)+' m':'No valid return';
  const conclusion=d.interiorSweepPeak?
    'The force-only sweep has a possible interior peak for these swing settings, not a proven global optimum.':
    d.nearForceLimit?
    'The strongest result is at the largest tested force, so the search did not establish an interior force optimum.':
    'The best sampled force is interior, but a finite search does not prove a globally optimal force.';
  const boundaries=(d.nearSwingLimit?' The result is very close to the assumed 50° maximum swing filter.':'')+
    (d.nearStartLimit?' The start position is close to the upper end of the search interval.':'');
  el.innerHTML='<div class="optStats"><div><small>Best return</small><strong>'+b.returnDistance.toFixed(2)+' m</strong></div>'+
    '<div><small>Reference launch</small><strong>'+baseline+'</strong></div></div>'+
    '<p class="optFoot">'+d.feasible+' admissible rebounds / '+d.count+' candidates tested. Optimisation objective: maximise distance travelled back by the <b>trolley</b> from the spring.</p>'+
    '<div class="optDetails">'+
    '<div><span>Starting point</span><b>'+(b.params.startFraction*100).toFixed(1)+'% · '+b.releaseHeight.toFixed(2)+' m high</b></div>'+
    '<div><span>Push (force × duration)</span><b>'+b.params.pushForce.toFixed(1)+' N × '+b.params.pushDuration.toFixed(2)+' s</b></div>'+
    '<div><span>Initial swing angle</span><b>'+b.params.initialSwing.toFixed(1)+'°</b></div>'+
    '<div><span>Initial swing rate</span><b>'+b.params.initialSwingRate.toFixed(1)+'°/s</b></div>'+
    '<div><span>Spring compression</span><b>'+(b.springTravel*100).toFixed(1)+' cm</b></div>'+
    '<div><span>Maximum modelled swing</span><b>'+b.maxSwing.toFixed(1)+'° (50° filter)</b></div>'+
    '<div><span>Trolley back to launch?</span><b>'+(b.trolleyReturned?'Yes':'Not yet')+'</b></div>'+
    '<div><span>Seat centre back to launch?</span><b>'+(b.seatReturned?'Yes':'Not yet')+'</b></div>'+
    '</div><p><b>Force response, other settings held fixed</b></p>'+
    '<p class="optFoot">Blank portions represent runs rejected by the model.</p>'+forcePlot(d.sweep)+
    '<p class="optVerdict">'+conclusion+boundaries+'</p>'+
    '<div class="optButtons"><button class="primary" id="optReplay">▶ Replay best in 3D</button>'+
    '<button class="secondary" id="optRetry">↺ Optimise again</button></div>'+
    '<p class="optFoot">These are not measured or safe operating limits. The optimiser can exploit preloaded pendulum energy, and the photo-based spring dynamics are uncalibrated. A model optimum is not a recommendation to push real playground equipment.</p>';
  el.querySelector('#optReplay').addEventListener('click',replayOptimized);
  el.querySelector('#optRetry').addEventListener('click',()=>{tab='optimise';startOptimization();});
}
document.getElementById('optimiseTop').addEventListener('click',()=>{tab='optimise';startOptimization();});
updateOptimizerOutput();

const viewport=document.getElementById('viewport');
const scene=new THREE.Scene();
scene.background=new THREE.Color('#bed0d8');
scene.fog=new THREE.Fog('#bed0d8',29,115);
const camera=new THREE.PerspectiveCamera(48,1,.1,180);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
viewport.prepend(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);
orbit.enableDamping=true;orbit.dampingFactor=.065;orbit.minDistance=3.5;orbit.maxDistance=90;
orbit.maxPolarAngle=Math.PI*.49;
scene.add(new THREE.HemisphereLight(0xe1f4ff,0x708167,2.5));
const sun=new THREE.DirectionalLight(0xffefd2,2.5);
sun.position.set(-5,16,9);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-43;sun.shadow.camera.right=43;
sun.shadow.camera.top=43;sun.shadow.camera.bottom=-43;
scene.add(sun);

const mats={
 steel:new THREE.MeshStandardMaterial({color:0xc0cbd2,metalness:.72,roughness:.34}),
 dark:new THREE.MeshStandardMaterial({color:0x24323a,metalness:.6,roughness:.35}),
 cable:new THREE.MeshStandardMaterial({color:0x5a696d,metalness:.83,roughness:.3}),
 seat:new THREE.MeshStandardMaterial({color:0x151e25,roughness:.65}),
 rubber:new THREE.MeshStandardMaterial({color:0x30363b,roughness:.8}),
 platform:new THREE.MeshStandardMaterial({color:0x404952,roughness:.9}),
 red:new THREE.MeshStandardMaterial({color:0xb84444,roughness:.68}),
 asphalt:new THREE.MeshStandardMaterial({color:0x313b40,roughness:.95}),
 grass:new THREE.MeshStandardMaterial({color:0x66865a,roughness:1}),
 tree:new THREE.MeshStandardMaterial({color:0x5c4a3c,roughness:1}),
 foliage:new THREE.MeshStandardMaterial({color:0x527149,roughness:1}),
 spring:new THREE.LineBasicMaterial({color:0x384750,linewidth:2}),
 trace:new THREE.LineBasicMaterial({color:0x15bfa2,transparent:true,opacity:.82})
};
let environment=new THREE.Group();scene.add(environment);
let trolley,seat,rod,springLine,trailLine,nearMarker;
function box(parent,material,x,y,z,sx,sy,sz){
 const o=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material);
 o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
function ball(parent,material,x,y,z,r){
 const o=new THREE.Mesh(new THREE.SphereGeometry(r,9,7),material);
 o.position.set(x,y,z);o.castShadow=true;parent.add(o);return o;
}
function rodBetween(parent,from,to,r,material,segments=9){
 const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),d=new THREE.Vector3().subVectors(b,a);
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),segments),material);
 mesh.position.copy(a).add(b).multiplyScalar(.5);
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
 mesh.castShadow=true;parent.add(mesh);return mesh;
}
function disposeGroup(group){
 group.traverse(o=>{if(o.geometry)o.geometry.dispose();});
 group.clear();
}
function moveSegment(mesh,a,b){
 const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=new THREE.Vector3().subVectors(end,start);
 mesh.position.copy(start).add(end).multiplyScalar(.5);
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());
 mesh.scale.set(1,d.length(),1);
}
function buildStatic(){
 disposeGroup(environment);
 const L=p.length;
 box(environment,mats.grass,L/2,-.19,0,L+13,.32,17);
 box(environment,mats.asphalt,L/2,-.022,0,L+7,.055,6);
 const cable=[];
 for(let i=0;i<=120;i++){
  const x=L*i/120;cable.push(new THREE.Vector3(x,cableY(x,p),0));
 }
 const curve=new THREE.CatmullRomCurve3(cable);
 const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,140,.023,8,false),mats.cable);
 environment.add(mesh);
 // Two galvanised A-frames seen in the photographs.
 [0,L].forEach((x,i)=>{
   const y=cableY(x,p)+.12;
   rodBetween(environment,[x,y,0],[x-1.27,0,-1.58],.067,mats.steel);
   rodBetween(environment,[x,y,0],[x+1.27,0,1.58],.067,mats.steel);
   rodBetween(environment,[x,y,0],[x+.95,0,-1.24],.052,mats.steel);
   rodBetween(environment,[x-.5,y-.23,-.43],[x+.4,y-.23,.43],.07,mats.steel);
   box(environment,mats.dark,x,y,0,.30,.20,.24);
 });
 // The real access platform and descending ramp sit INSIDE the span, on
 // the travel-direction side of the starting A-frame, not behind it.
 // A visitor walks up the ramp toward the left to reach the raised platform.
 const platformLeft=0.12, platformRight=2.12;
 const platformCentre=(platformLeft+platformRight)/2;
 box(environment,mats.platform,platformCentre,p.platformHeight,0,platformRight-platformLeft,.11,1.35);
 const rampRun=2.7, rampAngle=Math.atan2(p.platformHeight,rampRun);
 const ramp=box(environment,mats.platform,platformRight+rampRun/2,p.platformHeight/2,0,Math.hypot(rampRun,p.platformHeight),.09,1.33);
 ramp.rotation.z=-rampAngle;
 // Short anti-slip transverse ribs follow the incline down to the ground.
 for(let i=1;i<=8;i++){
   const f=i/9, x=platformRight+f*rampRun, y=p.platformHeight*(1-f)+.055;
   box(environment,mats.steel,x,y,0,.048,.025,1.28);
 }
 [platformLeft+.15,platformRight-.18].forEach(x=>{
   rodBetween(environment,[x,0,-.63],[x,p.platformHeight+.68,-.63],.038,mats.dark);
   rodBetween(environment,[x,0,.63],[x,p.platformHeight+.68,.63],.038,mats.dark);
 });
 rodBetween(environment,[platformLeft+.15,p.platformHeight+.68,-.63],[platformRight-.18,p.platformHeight+.68,-.63],.035,mats.dark);
 rodBetween(environment,[platformLeft+.15,p.platformHeight+.68,.63],[platformRight-.18,p.platformHeight+.68,.63],.035,mats.dark);
 // Distinctive red fence behind the installation.
 for(let x=-5;x<=L+5;x+=.37) box(environment,mats.red,x,.74,-4,.075,1.28,.07);
 rodBetween(environment,[-5,.47,-4],[L+5,.47,-4],.035,mats.red);
 rodBetween(environment,[-5,1.19,-4],[L+5,1.19,-4],.035,mats.red);
 // Low-poly surroundings: visual context rather than survey geometry.
 for(let i=0;i<16;i++){
   const x=-8+i*(L+17)/15;
   const z=-6.5-(i%3)*1.1;
   const height=4.4+(i*17%6)*.58;
   rodBetween(environment,[x,0,z],[x,height,z],.15,mats.tree,7);
   for(let j=0;j<3;j++)ball(environment,mats.foliage,x+Math.sin(i*8+j)*1.1,height+.6+(j%2)*.65,z+Math.cos(i*3+j)*.45,1.24+(j%2)*.23);
 }
 // Spring/stop assembly sits BEFORE the far A-frame. The uninterrupted
 // cable from springBackX to L is visibly exposed, as in the photographs.
 const springBackX=L-p.endClearance;
 box(environment,mats.dark,L-.18,cableY(L,p),0,.22,.37,.32);
 box(environment,mats.rubber,springBackX,cableY(springBackX,p),0,.28,.47,.43);
 nearMarker=box(environment,mats.rubber,stopX(p),cableY(stopX(p),p),0,.22,.35,.34);
 // trolley and suspended equipment
 trolley=new THREE.Group();
 const chassis=box(trolley,mats.dark,0,-.16,0,.47,.18,.26);
 [-.14,.14].forEach(x=>{
   const wheel=new THREE.Mesh(new THREE.TorusGeometry(.087,.038,7,14),mats.steel);
   wheel.rotation.y=Math.PI/2;wheel.position.set(x,.05,0);trolley.add(wheel);
 });
 environment.add(trolley);
 seat=new THREE.Group();
 const disk=new THREE.Mesh(new THREE.CylinderGeometry(.25,.22,.14,30),mats.seat);seat.add(disk);
 rodBetween(seat,[-.18,.055,0],[.18,.055,0],.038,mats.rubber);
 environment.add(seat);
 rod=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,1,10),mats.dark);
 environment.add(rod);
 springLine=new THREE.Line(new THREE.BufferGeometry(),mats.spring);
 environment.add(springLine);
 trailLine=new THREE.Line(new THREE.BufferGeometry(),mats.trace);
 environment.add(trailLine);trailLine.visible=showTrail;
 // Move camera proportionally when span changes, keeping orbit controls alive.
 if(!currentScene || Math.abs(currentScene-p.length)>1.5) resetCamera();
 currentScene=p.length;
 updateDynamics(run.state);
}
function resetCamera(){
 const L=p.length;
 camera.position.set(L*.54,Math.max(6,L*.36),Math.max(10,L*.8));
 orbit.target.set(L*.5,1.5,0);
 orbit.update();
}
document.getElementById('cameraButton').addEventListener('click',resetCamera);

function updateDynamics(st){
 if(!trolley)return;
 const y=cableY(st.x,p);
 trolley.position.set(st.x,y,0);
 trolley.rotation.z=Math.atan(cableSlope(st.x,p));
 const pos=[st.x+p.suspension*Math.sin(st.phi),y-p.suspension*Math.cos(st.phi),0];
 seat.position.set(pos[0],pos[1],pos[2]);
 moveSegment(rod,[st.x,y-.19,0],[pos[0],pos[1]+.1,0]);
 const contact=stopX(p),comp=Math.max(0,st.x-contact);
 const coilStart=contact+comp,coilEnd=p.length-p.endClearance;
 const points=[];
 for(let i=0;i<=100;i++){
   const f=i/100;
   const x=coilStart+(coilEnd-coilStart)*f;
   const angle=f*Math.PI*20;
   const amp=Math.sin(Math.PI*f)*.12;
   points.push(new THREE.Vector3(x,cableY(x,p)+Math.cos(angle)*amp,Math.sin(angle)*amp));
 }
 springLine.geometry.dispose();
 springLine.geometry=new THREE.BufferGeometry().setFromPoints(points);
 nearMarker.position.x=coilStart;
 nearMarker.position.y=cableY(coilStart,p);
 if(showTrail&&trailPoints.length>1){
   trailLine.geometry.dispose();
   trailLine.geometry=new THREE.BufferGeometry().setFromPoints(trailPoints);
 }
}
function chart(){
 const node=document.getElementById('chart');
 const arr=run.samples, pad=15;
 if(arr.length<2){
   node.innerHTML='<line x1="23" y1="139" x2="505" y2="139" stroke="#3a5260"/><text x="23" y="75" fill="#627f8d" font-size="13">Release the seat to record its trajectory.</text>';
   return;
 }
 const maxT=Math.max(1,arr[arr.length-1].t),minX=0,maxX=p.length;
 const X=t=>pad+(t/maxT)*(520-2*pad);
 const Y=x=>144-(x-minX)/(maxX-minX)*122;
 const path=arr.map((s,i)=>(i?'L':'M')+X(s.t).toFixed(1)+','+Y(s.x).toFixed(1)).join(' ');
 const yStop=Y(stopX(p));
 const ticks=[0,.25,.5,.75,1].map(f=>'<line x1="'+X(f*maxT)+'" y1="10" x2="'+X(f*maxT)+'" y2="145" stroke="#203c49"/><text x="'+X(f*maxT)+'" y="158" text-anchor="middle" font-size="10" fill="#829ca9">'+(f*maxT).toFixed(1)+'s</text>').join('');
 node.innerHTML=ticks+'<line x1="15" y1="'+yStop+'" x2="505" y2="'+yStop+'" stroke="#e4b169" stroke-dasharray="5 6" opacity=".55"/>'+
 '<text x="502" y="'+Math.max(11,yStop-6)+'" text-anchor="end" font-size="10" fill="#e4b169">spring</text>'+
 '<path d="'+path+'" fill="none" stroke="#66e4bb" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>';
}
function updateTelemetry(){
 const fmt=(v,d=2)=>Number(v).toFixed(d);
 document.getElementById('clock').textContent=fmt(run.time)+' s';
 document.getElementById('impact').textContent=run.impactSpeed===null?'—':fmt(run.impactSpeed)+' m/s';
 document.getElementById('returnDistance').textContent=run.impactTime===null?'—':fmt(run.returnDistance)+' m';
 document.getElementById('compression').textContent=run.impactTime===null?'—':fmt(run.maxCompression*100,1)+' cm';
 document.getElementById('swing').textContent=fmt(run.maxSwing,1)+'°';
 document.getElementById('status').textContent=run.finished?'Finished: '+run.phase:(playing?'Simulating: '+run.phase:run.phase==='ready'?'Ready for release':'Paused: '+run.phase);
 document.getElementById('substatus').textContent=run.overtravel?'The assumed spring has exceeded its modelled travel. Results beyond this point are invalid.':
   (run.impactTime!==null?'First contact at '+fmt(run.impactTime)+' s · Spring point '+fmt(stopX(p))+' m · End gap '+fmt(p.endClearance)+' m':
   'Release height '+fmt(cableY(run.state.x,p))+' m · Spring point '+fmt(stopX(p))+' m · End gap '+fmt(p.endClearance)+' m');
 release.textContent=playing?'Ⅱ Pause':run.finished||run.phase==='ready'?'▶ Release seat':'▶ Resume';
 const E=energy(run.state,p);
 document.getElementById('energyText').textContent='Current kinetic energy: '+fmt(Math.max(0,E.kinetic),1)+' J · Spring energy: '+fmt(E.spring,1)+' J.';
 document.getElementById('insightText').textContent=run.overtravel?'The simulated spring ran out of travel. Increase available travel, reduce the input or change parameters before interpreting the result.':
  run.impactTime===null?'The launch force accelerates the trolley over the selected push duration. Gravity, resistance and seat swinging then determine the approach to the spring.':
  run.springReleaseSpeed===null?'The spring and hanging pendulum exchange energy while the trolley compresses the end-stop. Watch the delayed seat motion.':
  'The trolley has left the spring at '+fmt(run.springReleaseSpeed)+' m/s. Gravity, friction and continuing pendulum motion determine the turnaround point.';
 chart();
}
buildStatic();
updateTelemetry();

const observer=new ResizeObserver(()=>{
 const width=viewport.clientWidth,height=viewport.clientHeight;
 camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();
 renderer.setSize(width,height,false);
});observer.observe(viewport);

function frame(now){
 requestAnimationFrame(frame);
 const elapsed=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;
 if(playing) {
   frameAccum+=elapsed*playbackRate;
   let n=0;
   while(frameAccum>=1/240&&n<50&&!run.finished){
     stepRun(run,p,1/240);
     frameAccum-=1/240;n++;
     if(n%6===0){
       const st=run.state;
       trailPoints.push(new THREE.Vector3(st.x+p.suspension*Math.sin(st.phi),cableY(st.x,p)-p.suspension*Math.cos(st.phi),.035));
       if(trailPoints.length>650)trailPoints.shift();
     }
   }
   updateDynamics(run.state);
   if(run.finished)playing=false;
   updateTelemetry();
 }
 orbit.update();
 renderer.render(scene,camera);
}
requestAnimationFrame(frame);
