import { windDescription, windForceAtRest } from './wind.js';

// Lightweight, client-side comparison. Trials run in an isolated worker.
export function attachWindLab({getParams,onSelectWind}) {
  const panel=document.createElement('section');
  panel.className='windLab';panel.id='windLab';
  panel.innerHTML=[
    '<div class="optimizerHeading">⇄ Wind tunnel <small>Same launch · Different airflows</small></div>',
    '<div class="windBody"><p>Compare steady wind along the cable, holding the current trolley, seat, spring, friction and launch <b>unchanged</b>. Negative wind blows towards the launch platform and positive wind blows towards the end-stop.</p>',
    '<div class="windOverview"><div><small>Current mean wind</small><strong id="windMean">Still air</strong></div>',
    '<div><small>Effective drag coefficient</small><strong id="windDrag">0.035 kg/m</strong></div>',
    '<div><small>Approximate wind force from rest</small><strong id="windPush">0.00 N</strong></div></div>',
    '<div class="optButtons"><button class="primary" id="windCompare">⇄ Compare −9 to +9 m/s</button>',
    '<button class="secondary" id="windZero">Set still air</button></div>',
    '<div class="windResults" id="windResults" aria-live="polite"><p>Press Compare to see how the wind changes the outward trip and rebound. You can then load any wind condition into the 3D replay.</p></div>',
    '<p class="optFoot">Uses relative airflow F = −D(v−w)|v−w|, where D = ½ρCᴅA and w is the horizontal along-cable wind. Gusts are switched off for this controlled comparison. Crosswinds, aerodynamic swing torque, gust turbulence and changes to the spring due to wind are NOT modelled. This is not a weather forecast or a safety assessment.</p>',
    '</div>'
  ].join('');
  document.getElementById('optimizerPanel').insertAdjacentElement('beforebegin',panel);
  const byId=id=>document.getElementById(id);
  let worker=null,id=0,data=null,active=false;
  function update(){
    const p=getParams();
    byId('windMean').textContent=windDescription(p.windSpeed??0);
    byId('windDrag').textContent=Number(p.drag??0).toFixed(3)+' kg/m';
    const f=windForceAtRest(p);
    byId('windPush').textContent=(f>0?'+':'')+f.toFixed(2)+' N';
  }
  function cancel(){
    id++;if(worker){worker.terminate();worker=null;}
    active=false;data=null;
    byId('windCompare').disabled=false;
    byId('windResults').innerHTML='<p>Launch or equipment values changed. Run a new wind comparison to refresh results.</p>';
    update();
  }
  function render(){
    if(!data)return;
    const rows=data;
    const max= Math.max(0.1,...rows.map(r=>r.returnDistance||0));
    const baseline=rows.find(r=>r.wind===0);
    byId('windResults').innerHTML='<div class="windComparisonHeader"><b>Steady-wind results</b><span>Fixed launch · '+Number(getParams().pushForce).toFixed(0)+' N push</span></div>'+
      '<div class="windCaseList">'+rows.map(r=>{
        const width=r.valid?Math.min(100,100*r.returnDistance/max):0;
        const full=r.valid&&r.trolleyReturned&&r.seatReturned;
        const label=!r.valid?r.reason:full?'Both return to start':r.trolleyReturned?'Trolley returns to start':r.returnDistance.toFixed(2)+' m back · '+(r.returnFraction*100).toFixed(0)+'% of route';
        return '<div class="windCase">'+
          '<div class="windCaseTop"><strong>'+windDescription(r.wind)+'</strong><span>'+(r.impactSpeed===null?'No spring contact':'Impact '+r.impactSpeed.toFixed(2)+' m/s')+'</span></div>'+
          '<div class="windCaseTrack"><div style="width:'+width.toFixed(1)+'%"></div></div>'+
          '<div class="windCaseFoot"><span class="'+(full?'windSuccess':'')+'">'+label+'</span>'+
          '<button class="smallButton" data-windspeed="'+r.wind+'">Load wind</button></div>'+
          '</div>';
      }).join('')+'</div>'+
      '<p class="optFoot">The longest bar represents the furthest admissible return in this comparison, not a safe launch. Invalid or incomplete trials have no bar. Still-air baseline: '+(baseline?.valid?baseline.returnDistance.toFixed(2)+' m':'not a completed valid rebound')+'.</p>';
    byId('windResults').querySelectorAll('[data-windspeed]').forEach(b=>b.addEventListener('click',()=>{
      onSelectWind(Number(b.dataset.windspeed));
      cancel();
    }));
  }
  function compare(){
    if(worker){worker.terminate();worker=null;}
    id++;const thisId=id;active=true;data=null;
    byId('windCompare').disabled=true;
    byId('windResults').innerHTML='<p>Calculating controlled wind cases with the current physics parameters…</p>';
    const w=new Worker(new URL('./wind.worker.js',import.meta.url),{type:'module'});
    worker=w;
    w.onmessage=e=>{
      const result=e.data;
      if(result.id!==thisId||id!==thisId)return;
      active=false;worker.terminate();worker=null;byId('windCompare').disabled=false;
      if(result.type==='done'){data=result.results;render();}
      else byId('windResults').textContent='Wind comparison failed: '+result.message;
    };
    w.onerror=()=>{
      if(id!==thisId)return;
      worker.terminate();worker=null;active=false;byId('windCompare').disabled=false;
      byId('windResults').textContent='Wind comparison worker could not complete.';
    };
    w.postMessage({type:'compare',id:thisId,params:getParams()});
  }
  byId('windCompare').addEventListener('click',compare);
  byId('windZero').addEventListener('click',()=>{onSelectWind(0);cancel();});
  update();
  return {update,cancel,compare,open(){
    panel.scrollIntoView({block:'start',behavior:'smooth'});
  }};
}
