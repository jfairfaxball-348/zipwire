import { TEMPLATE } from './optimizer.js';

// Hypothetical photo-inspired engineering configurations, NOT actual field
// measurements or approved alterations to playground equipment.
export const SCENARIOS = Object.freeze([
  {
    id:'reference', name:'Reference · 19 m',
    description:'Original estimated cable, wheel and spring behaviour.',
    changes:{},
    category:'Baseline estimates'
  },
  {
    id:'rolling', name:'Reduced resistance · 19 m',
    description:'Same span, less trolley rolling resistance and less stop damping.',
    changes:{friction:.012,springDamping:45},
    category:'Lower assumed losses'
  },
  {
    id:'short', name:'Shorter course · 15 m',
    description:'A shorter, somewhat gentler descent and moderately reduced losses.',
    changes:{length:15,drop:.25,sag:.17,friction:.012,springDamping:45},
    category:'Shorter hypothetical geometry'
  },
  {
    id:'moderate', name:'Near-level · moderate damping',
    description:'15 m near-level cable and low friction, but a stop with measurable damping.',
    changes:{length:15,drop:.03,sag:.10,friction:.007,springDamping:30,trolleyMass:7},
    category:'Sensitivity control'
  },
  {
    id:'efficient', name:'Near-level · elastic stop',
    description:'15 m, almost no net drop, efficient bearings and highly elastic stop. Speculative: spring properties unmeasured.',
    changes:{length:15,drop:.03,sag:.10,friction:.007,springDamping:15,trolleyMass:7},
    category:'Optimistic hypothetical'
  }
]);
export const DEMONSTRATION = Object.freeze({
  scenarioId:'efficient',
  startFraction:.07,
  pushForce:70,
  pushDuration:.4,
  initialSwing:4,
  initialSwingRate:0
});
export function getScenario(id) {
  return SCENARIOS.find(c=>c.id===id) || SCENARIOS[0];
}
export function scenarioParams(id) {
  return {...TEMPLATE,...getScenario(id).changes};
}
