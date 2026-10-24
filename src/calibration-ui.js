import { fitWithSensitivity, estimateFromVideo } from './calibration.js';

export function attachCalibrationUI({onApply,getMovingMass}){
  const panel=document.createElement('section');
  panel.id='calibrationPanel';panel.className='calibrationPanel';
  panel.innerHTML=[
    '<div class="optimizerHeading">◉ Spring observation & calibration <small id="calStatus">UNMEASURED</small></div>',
    '<div class="calibrationBody"><p>Enter observations from existing videos of ordinary, permitted operation. Do not tamper with playground equipment or intentionally strike the end-stop. The photographs contain no measurements of spring stiffness or damping.</p>',
    '<div class="calibrationFields">',
    '<label>Approach velocity <span>m/s, just before spring contact</span><input id="calApproach" type="number" min=".01" step="any" placeholder="Measured speed"></label>',
    '<label>Rebound velocity <span>m/s, just after separation</span><input id="calRebound" type="number" min=".01" step="any" placeholder="Measured speed"></label>',
    '<label>Peak spring compression <span>centimetres, observed shortening</span><input id="calCompression" type="number" min=".2" step="any" placeholder="Measured stroke"></label>',
    '<label>Effective moving mass <span>kg, must be estimated independently</span><input id="calMass" type="number" min=".2" step="any" placeholder="Estimated mass"></label>',
    '<label>Observed contact duration <span>milliseconds, optional consistency check</span><input id="calContact" type="number" min="1" step="any" placeholder="Optional"></label>',
    '</div><p id="calMassHint" class="optFoot"></p>',
    '<details class="frameHelper"><summary>Calculate a velocity from video frames</summary>',
    '<p>Track the trolley over a known distance in a stable side-on recording. Speed is distance × actual fps ÷ elapsed frame count. Use intervals near spring contact/separation; filming perspective and playback frame rate can distort estimates.</p>',
    '<div class="frameFields"><label>Distance (m)<input id="vidDistance" type="number" min=".01" step="any"></label>',
    '<label>Frames elapsed<input id="vidFrames" type="number" min="1" step="1"></label>',
    '<label>Recording fps<input id="vidFps" type="number" min="1" step="any"></label>',
    '<label>Send to<select id="vidTarget"><option value="calApproach">Approach</option><option value="calRebound">Rebound</option></select></label></div>',
    '<button class="secondary" id="calculateFrames">Use calculated speed</button><p id="frameNotice" aria-live="polite"></p></details>',
    '<div class="optButtons"><button class="primary" id="calEstimate">Estimate effective spring</button>',
    '<button class="secondary" id="calApply" disabled>Apply to simulator</button>',
    '<button class="secondary" id="calOptimise" disabled>Apply & optimise</button></div>',
    '<div class="calibrationOutput" id="calOutput" aria-live="polite">No measurements have been entered. The simulator still uses estimated spring values.</div>',
    '<p class="optFoot">This first-pass inverse fit assumes a single underdamped mass–spring–damper. The real seat swings, the cable vibrates and the stop may be a brake. A single observation cannot separately identify these effects or establish equipment safety.</p>',
    '</div>'
  ].join('');
  document.getElementById('optimizerPanel').insertAdjacentElement('afterend',panel);
  const get=id=>document.getElementById(id);
  let result=null,applied=false;
  const read=()=>({
    approachSpeed:get('calApproach').value,reboundSpeed:get('calRebound').value,
    compressionCm:get('calCompression').value,effectiveMassKg:get('calMass').value
  });
  function render(){
    const output=get('calOutput'),fit=result?.ok?result.fit:null;
    const eligible=Boolean(fit&&fit.stiffness>=200&&fit.stiffness<=6500&&fit.damping>=0&&fit.damping<=800);
    get('calApply').disabled=!eligible;get('calOptimise').disabled=!eligible;
    get('calStatus').textContent=applied?'ESTIMATE APPLIED':fit?'EFFECTIVE ESTIMATE':'UNMEASURED';
    output.classList.remove('calError');
    if(!result){output.textContent='No measurement fit calculated. The current spring values remain assumptions.';return;}
    if(!result.ok){output.classList.add('calError');output.textContent=result.error;return;}
    const b=result.sensitivity;
    const range=(v,unit,places=0)=>v.map(n=>n.toFixed(places)).join(' – ')+' '+unit;
    const raw=get('calContact').value.trim();
    let timing='';
    if(raw){
      const measured=Number(raw),predicted=fit.contactTime*1000;
      if(Number.isFinite(measured)&&measured>0){
        const mismatch=Math.abs(measured-predicted)/predicted;
        timing='<p class="'+(mismatch>.25?'calCaution':'')+'">Observed contact '+measured.toFixed(1)+' ms vs isolated-model estimate '+predicted.toFixed(1)+' ms. '+(mismatch>.25?'More than 25% apart: model is not consistent with observed contact time.':'Agreement alone does not validate the coupled system.')+'</p>';
      } else timing='<p class="calCaution">Contact time must be positive when entered.</p>';
    }
    output.innerHTML='<div class="optStats">'+
      '<div><small>Effective stiffness</small><strong>'+fit.stiffness.toFixed(0)+' N/m</strong></div>'+
      '<div><small>Effective viscous damping</small><strong>'+fit.damping.toFixed(1)+' Ns/m</strong></div>'+
      '<div><small>Approx. energy return</small><strong>'+(fit.energyReturn*100).toFixed(1)+'%</strong></div>'+
      '<div><small>Speed restitution</small><strong>'+fit.coefficientOfRestitution.toFixed(3)+'</strong></div></div>'+
      '<div class="calRanges"><strong>Illustrative parameter sensitivity</strong>'+
      '<div><span>Stiffness</span><b>'+range(b.stiffness,'N/m')+'</b></div>'+
      '<div><span>Damping</span><b>'+range(b.damping,'Ns/m',1)+'</b></div>'+
      '<div><span>Energy returned</span><b>'+range(b.energyReturn.map(x=>100*x),'%',1)+'</b></div>'+
      '<p>'+b.assumptions+'</p></div>'+
      '<p>Isolated-model contact duration: '+(1000*fit.contactTime).toFixed(1)+' ms; incoming effective kinetic energy: '+fit.inputEnergy.toFixed(1)+' J.</p>'+
      timing+
      (eligible?'':'<p class="calCaution">Inferred coefficients exceed the simulator slider bounds. Application is disabled instead of clipping silently.</p>')+
      (applied?'<p class="calLoaded">Estimate applied in this browser session. Rerun the launch optimiser to explore its consequences.</p>':'')+
      '<p class="calCaution">Coupled pendulum and wheel losses are not separately identifiable. These values are not a safety certificate or manufacturer specification.</p>';
  }
  for(const id of ['calApproach','calRebound','calCompression','calMass','calContact'])
    get(id).addEventListener('input',()=>{result=null;applied=false;render();});
  get('calEstimate').addEventListener('click',()=>{result=fitWithSensitivity(read());applied=false;render();});
  get('calApply').addEventListener('click',()=>{if(!result?.ok)return;onApply(result.fit,false);applied=true;render();});
  get('calOptimise').addEventListener('click',()=>{if(!result?.ok)return;onApply(result.fit,true);applied=true;render();});
  get('calculateFrames').addEventListener('click',()=>{
    const r=estimateFromVideo(get('vidDistance').value,get('vidFrames').value,get('vidFps').value);
    if(!r.ok){get('frameNotice').textContent=r.error;return;}
    const dest=get('vidTarget').value;get(dest).value=r.speed.toFixed(3);
    get('frameNotice').textContent=r.speed.toFixed(3)+' m/s set for '+(dest==='calApproach'?'approach':'rebound')+'.';
    result=null;applied=false;render();
  });
  render();
  return {open(){
    get('calMassHint').textContent='Current simulated trolley + seat mass: '+getMovingMass().toFixed(1)+' kg. Effective impact mass can differ because the seat swings.';
    panel.scrollIntoView({behavior:'smooth',block:'start'});
  }};
}
