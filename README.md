# Zipwire Physics Lab

A photo-inspired, interactive 3D model of a playground aerial runway. The app simulates a trolley, swinging suspended seat, sagging cable, spring end-stop, friction and launch force. The access ramp runs inward from the starting A-frame toward the cable span, and an adjustable clear stretch of wire separates the end-stop's fixed block from the far support.

**Model status:** exploratory engineering simulation, not a calibrated model of playground safety or a recommendation for impact speeds. All dimensions and coefficients are initial estimates pending measurement.

## Run locally

```bash
npm install
npm run dev
npm run build
```

## Vercel

Import `jfairfaxball-348/zipwire`, framework **Vite**, build command `npm run build`, output directory `dist`. No environment variables are required.


## Optimise launch (V2)

Select **Optimise** or **Optimise launch** to run a deterministic bounded numerical search. It holds the photographed-but-unmeasured hardware at fixed illustrative reference values, and varies five launch-only inputs (start position, push force, push duration, swing angle and initial angular velocity). Each candidate uses the same coupled pendulum, trolley and spring integrator as the release animation. A Web Worker keeps 3D responsive. Incomplete journeys, excessive spring stroke, too-low seat centre and extreme swing are rejected.

The best valid candidate maximises trolley return distance from spring contact. A comparison with the unoptimised reference, trolley and seat launch-return indicators and force-only sensitivity sweep help assess whether a possible interior peak exists. Such a candidate is **not a global proof**, and the search does not establish equipment safety. Input swing can store additional energy. The force bounds are illustrative, **not tested safe playground push settings**. Measurements and manufacturer limits are required for calibration.
