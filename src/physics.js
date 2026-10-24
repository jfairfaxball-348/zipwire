// Coupled trolley-on-a-curved-cable / suspended-pendulum mechanics.
// Exploratory planar model, not a safety-grade structural simulation.
export const DEFAULTS = Object.freeze({
  length: 19, startHeight: 3.6, drop: 0.42, sag: 0.23,
  suspension: 1.63, platformHeight: 0.66,
  trolleyMass: 5, seatMass: 14,
  friction: 0.027, drag: 0.035,
  springLength: 0.95, endClearance: 2.2, springK: 1450, springDamping: 105,
  startFraction: 0.07, pushForce: 100, pushDuration: 0.30,
  initialSwing: 0, initialSwingRate: 0, swingDamping: 0.32
});
const G = 9.81;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export function cableY(x, p) {
  const q = x / p.length;
  return p.startHeight - p.drop * q - 4 * p.sag * q * (1 - q);
}
export function cableSlope(x, p) {
  return -p.drop / p.length - 4 * p.sag / p.length * (1 - 2*x/p.length);
}
export function cableCurvature(p) {
  return 8 * p.sag / (p.length*p.length);
}
export function stopX(p) {
  // The back of the spring/stop sits before the far support; the wire continues beyond it.
  return p.length - p.endClearance - p.springLength;
}
export function initialX(p) {
  return clamp(p.startFraction, 0.01, 0.89) * stopX(p);
}
export function initialState(p) {
  return {x:initialX(p), v:0, phi:p.initialSwing*Math.PI/180, w:p.initialSwingRate*Math.PI/180};
}
export function energy(st, p) {
  const slope = cableSlope(st.x,p);
  const M = p.trolleyMass+p.seatMass;
  const a = st.v, w = st.w, phi = st.phi;
  const ell = p.suspension;
  const translation = 0.5 * M * (1+slope*slope)*a*a;
  const coupling = p.seatMass*ell*(Math.cos(phi)+slope*Math.sin(phi))*a*w;
  const swing = 0.5*p.seatMass*ell*ell*w*w;
  const gravitational = M*G*cableY(st.x,p)-p.seatMass*G*ell*Math.cos(phi);
  const spring = 0.5*p.springK*Math.pow(Math.max(0,st.x-stopX(p)),2);
  return {kinetic:translation+coupling+swing, potential:gravitational, spring, total:translation+coupling+swing+gravitational+spring};
}
function derivatives(st, p, time) {
  const mt=Math.max(0.5,p.trolleyMass), ms=Math.max(0.5,p.seatMass);
  const M=mt+ms, ell=p.suspension;
  const x=st.x, v=st.v, phi=st.phi, w=st.w;
  const slope=cableSlope(x,p), curve=cableCurvature(p);
  const cs=Math.cos(phi), sn=Math.sin(phi);
  const A=M*(1+slope*slope);
  const B=ms*ell*(cs+slope*sn);
  const C=ms*ell*ell;
  const det=Math.max(0.001, A*C-B*B);
  const normal=M*G/Math.sqrt(1+slope*slope);
  const rolling=-p.friction*normal*Math.tanh(v/0.12);
  const air=-p.drag*v*Math.abs(v);
  const compression=Math.max(0,x-stopX(p));
  // The spring can push, not pull. Damping acts only while in contact.
  const springForce=compression>0 ? Math.min(0,-p.springK*compression-p.springDamping*v) : 0;
  const push=time<p.pushDuration ? p.pushForce : 0;
  const Qx=rolling+air+springForce+push;
  const Qphi=-p.swingDamping*w;
  const rhs1=Qx-M*G*slope-M*slope*curve*v*v+ms*ell*(sn-slope*cs)*w*w;
  const rhs2=Qphi-ms*ell*curve*sn*v*v-ms*G*ell*sn;
  const acc=(rhs1*C-B*rhs2)/det;
  const angAcc=(A*rhs2-B*rhs1)/det;
  return {x:v,v:acc,phi:w,w:angAcc};
}
function add(st, k, dt) {
  return {x:st.x+dt*k.x,v:st.v+dt*k.v,phi:st.phi+dt*k.phi,w:st.w+dt*k.w};
}
export function integrate(st,p,time,dt) {
  const k1=derivatives(st,p,time);
  const k2=derivatives(add(st,k1,dt/2),p,time+dt/2);
  const k3=derivatives(add(st,k2,dt/2),p,time+dt/2);
  const k4=derivatives(add(st,k3,dt),p,time+dt);
  const out={
    x:st.x+dt*(k1.x+2*k2.x+2*k3.x+k4.x)/6,
    v:st.v+dt*(k1.v+2*k2.v+2*k3.v+k4.v)/6,
    phi:st.phi+dt*(k1.phi+2*k2.phi+2*k3.phi+k4.phi)/6,
    w:st.w+dt*(k1.w+2*k2.w+2*k3.w+k4.w)/6
  };
  if(out.x<=0) {out.x=0;if(out.v<0)out.v=0;}
  return out;
}
export function makeRun(p) {
  return {
    state:initialState(p), time:0, phase:'ready', impactSpeed:null,
    maxCompression:0,maxSwing:Math.abs(p.initialSwing), returnDistance:0,
    impactTime:null, springReleaseSpeed:null, turningTime:null,
    lowestAfterImpact:stopX(p), samples:[], sampleClock:0,
    overtravel:false, finished:false, hasRebounded:false
  };
}
export function stepRun(run,p,dt=1/240) {
  if(run.finished)return run;
  const old=run.state;
  const contact=stopX(p);
  const next=integrate(old,p,run.time,dt);
  run.time+=dt;
  run.state=next;
  run.maxSwing=Math.max(run.maxSwing,Math.abs(next.phi*180/Math.PI));
  const compression=Math.max(0,next.x-contact);
  run.maxCompression=Math.max(run.maxCompression,compression);
  if(run.impactTime===null && next.x>=contact) {
    run.impactTime=run.time;
    run.impactSpeed=Math.max(0,old.v);
    run.phase='spring contact';
  }
  if(run.impactTime!==null) {
    if(next.v<0)run.hasRebounded=true;
    if(run.hasRebounded && next.x<=contact && run.springReleaseSpeed===null) {
      run.springReleaseSpeed=Math.abs(next.v);
      run.phase='returning';
    }
    if(run.springReleaseSpeed!==null) {
      run.lowestAfterImpact=Math.min(run.lowestAfterImpact,next.x);
      run.returnDistance=Math.max(0,contact-run.lowestAfterImpact);
      if(old.v < -0.02 && next.v >= -0.02 && run.time>run.impactTime+0.12) {
        run.turningTime=run.time;
        run.finished=true;run.phase='turnaround';
      }
    }
    if(compression>p.springLength*0.86) {
      run.overtravel=true;run.finished=true;run.phase='spring travel exceeded';
    }
  } else {
    run.phase=run.time<p.pushDuration?'pushing':'outbound';
  }
  if(run.time>20) {run.finished=true;run.phase='time limit';}
  run.sampleClock+=dt;
  if(run.recordSamples!==false && (run.sampleClock>=0.045 || run.samples.length===0)) {
    run.sampleClock=0;
    run.samples.push({t:run.time,x:next.x,v:next.v,phi:next.phi*180/Math.PI,comp:compression});
  }
  return run;
}
