// Inverse identification of an isolated underdamped Kelvin-Voigt end-stop.
// This is a ONE DEGREE OF FREEDOM approximation only, not a fit of the
// coupled seat/trolley/cable simulation. Do not interpret it as a tested
// playground safety model or use it to prescribe impacts.
//
// x(0)=0, xdot(0)=v_in; m*xddot + c*xdot + k*x=0, x>=0.
// Under-damped first return to x=0 has v_out/v_in =
//   exp(-pi*zeta / sqrt(1-zeta^2)).
// Maximum stroke x_max = (v_in/wn)*
//   exp(-zeta*acos(zeta)/sqrt(1-zeta^2)).
export const MEASUREMENT_KEYS = Object.freeze([
  'approachSpeed','reboundSpeed','compressionCm','effectiveMassKg'
]);
export const UNCERTAINTY = Object.freeze({
  speed: .10, compression:.12, effectiveMass:.20
});
export function parseObservations(form) {
  const values={};
  for(const key of MEASUREMENT_KEYS) {
    const raw=String(form[key]??'').trim();
    if(!raw) return {ok:false,error:'All four observations are needed. Missing: '+key+'.'};
    const n=Number(raw);
    if(!Number.isFinite(n)||n<=0)
      return {ok:false,error:'All observations must be positive finite numbers. Check '+key+'.'};
    values[key]=n;
  }
  const {approachSpeed:v,reboundSpeed:u,compressionCm:cm,effectiveMassKg:m}=values;
  if(v>20||u>20)return {ok:false,error:'Speeds above 20 m/s are outside this identification tool.'};
  if(cm<.2||cm>200)return {ok:false,error:'Use spring compression between 0.2 cm and 200 cm.'};
  if(m<.2||m>300)return {ok:false,error:'Effective moving mass must be between 0.2 kg and 300 kg.'};
  if(u>=v)return {ok:false,error:'Rebound speed must be lower than approach speed for this passive one-mass spring model. A larger rebound suggests pendulum energy transfer or measurement error.'};
  if(u/v<.03)return {ok:false,error:'Rebound below 3% of incoming speed is too close to zero for reliable spring identification.'};
  return {ok:true,values};
}
export function fitIsolatedStop(inputs) {
  const check=parseObservations(inputs);
  if(!check.ok)return check;
  const {approachSpeed:v,reboundSpeed:u,compressionCm:cm,effectiveMassKg:m}=check.values;
  const ratio=u/v;
  const log=-Math.log(ratio);
  const zeta=log/Math.hypot(Math.PI,log);
  const beta=Math.sqrt(1-zeta*zeta);
  const omega=(v/(cm/100))*Math.exp(-zeta*Math.acos(zeta)/beta);
  const k=m*omega*omega;
  const damping=2*m*zeta*omega;
  const contactTime=Math.PI/(omega*beta);
  const energyReturn=ratio*ratio;
  const inputEnergy=.5*m*v*v;
  const outputEnergy=.5*m*u*u;
  const fit={approachSpeed:v,reboundSpeed:u,compressionCm:cm,effectiveMassKg:m,
    coefficientOfRestitution:ratio,energyReturn,energyLoss:1-energyReturn,
    dampingRatio:zeta,stiffness:k,damping,contactTime,
    inputEnergy,outputEnergy,lostEnergy:inputEnergy-outputEnergy};
  return {ok:true,fit};
}
function roundBounds(r,lo,hi) {
  return {
    min: Math.max(lo,r*(1-UNCERTAINTY.speed)),
    max: Math.min(hi,r*(1+UNCERTAINTY.speed))
  };
}
export function fitWithSensitivity(inputs) {
  const nominal=fitIsolatedStop(inputs);
  if(!nominal.ok)return nominal;
  const {approachSpeed:v,reboundSpeed:u,compressionCm:cm,effectiveMassKg:m}=nominal.fit;
  const ranges=[
    roundBounds(v,.00001,20),
    roundBounds(u,.00001,20),
    {min:cm*(1-UNCERTAINTY.compression),max:cm*(1+UNCERTAINTY.compression)},
    {min:m*(1-UNCERTAINTY.effectiveMass),max:m*(1+UNCERTAINTY.effectiveMass)}
  ];
  let kMin=Infinity,kMax=-Infinity,cMin=Infinity,cMax=-Infinity;
  let etaMin=Infinity,etaMax=-Infinity, validCases=0;
  for(const speed1 of [ranges[0].min,v,ranges[0].max])
  for(const speed2 of [ranges[1].min,u,ranges[1].max])
  for(const stroke of [ranges[2].min,cm,ranges[2].max])
  for(const mass of [ranges[3].min,m,ranges[3].max]){
    const r=fitIsolatedStop({approachSpeed:speed1,reboundSpeed:speed2,compressionCm:stroke,effectiveMassKg:mass});
    if(!r.ok)continue;
    kMin=Math.min(kMin,r.fit.stiffness);kMax=Math.max(kMax,r.fit.stiffness);
    cMin=Math.min(cMin,r.fit.damping);cMax=Math.max(cMax,r.fit.damping);
    etaMin=Math.min(etaMin,r.fit.energyReturn);
    etaMax=Math.max(etaMax,r.fit.energyReturn);
    validCases++;
  }
  if(validCases===0)return {ok:false,error:'Observations produce no admissible sensitivity cases.'};
  return {...nominal,sensitivity:{
    stiffness:[kMin,kMax],damping:[cMin,cMax],
    energyReturn:[etaMin,etaMax],validCases,totalCases:81,
    assumptions:'±10% each speed, ±12% stroke, ±20% effective mass; these are illustrative perturbations, NOT measured error bars or statistical confidence bounds.'
  }};
}
export function estimateFromVideo(distanceMeters,frames,framesPerSecond) {
  const d=Number(distanceMeters),n=Number(frames),fps=Number(framesPerSecond);
  if(!(Number.isFinite(d)&&d>0&&d<=10))
    return {ok:false,error:'Enter a positive tracked travel distance of up to 10 m.'};
  if(!(Number.isInteger(n)&&n>=1&&n<=10000))
    return {ok:false,error:'Enter a positive whole number of video frames.'};
  if(!(Number.isFinite(fps)&&fps>=1&&fps<=1000))
    return {ok:false,error:'Frame rate must be between 1 and 1000 fps.'};
  return {ok:true,speed:d*fps/n};
}
