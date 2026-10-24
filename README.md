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


## Feasibility comparison (V3)

The **Compare all five setups** action holds each hypothetical hardware configuration
fixed while sweeping modelled pushes up to 110 N, duration from 0.20 to
0.45 s and a *still* or slightly 4° forward-inclined seat. Initial angular
velocity is zero, so the result does not require pre-spinning the pendulum.
The five cases compare the 19 m estimated setup, an improved resistance model,
a 15 m shorter course, a near-level track with moderate damping, and a
near-level track with a deliberately highly elastic spring assumption.

The objective for this comparison prioritises cases in which **both trolley and
seat centre** cross their respective start positions. A trolley-only return is
labelled separately. If nothing returns, the greatest fraction of the route
traversed backwards is displayed. Within successful classes, the lowest
tested force is preferred (then shorter push duration). This is a sampled
best case, *not* a global mathematical optimum.

The showcased near-level, efficient-stop example uses 15 m span, 3 cm net
drop, 7 kg trolley, 4 kg seat, coefficient .007 and 15 N·s/m linear
damping—**all hypothetical**. At 70 N for 0.40 s, +4° initial seat tilt,
zero initial swing speed, the 240 Hz integration returns both the trolley
and seat to their initial coordinates. This result also survives 120 Hz
and 480 Hz step-size checks, but is extremely sensitive to damping and may
not be physically achievable with the real installed safety stop.
Do not adjust public equipment or use the values as safe operating limits.


## Calibrate from observations (V4)

The **Calibrate** tab opens a passive measurement workspace. Input fields are blank until observations are supplied. Enter the trolley speeds just before spring contact and just after spring separation, the observed peak spring stroke in centimetres and a separately estimated effective moving mass in kg. An optional contact duration checks model consistency; a distance-frames-fps helper converts existing recorded motion to speed.

The inverse identification is a *single underdamped Kelvin–Voigt mass–spring–damper approximation*, not a fit of the full suspended-pendulum/cable system. It calculates effective spring stiffness, damping, velocity restitution and isolated-model energy return. It also perturbs speed by ±10%, stroke by ±12% and effective mass by ±20% to illustrate sensitivity, not statistical confidence.

Apply estimate overwrites only current simulated spring parameters and creates a distinct **Observation-derived spring estimate** scenario. Apply & optimise reruns the bounded launch search with those same estimated parameters passed to the worker, rather than reverting to the unmeasured reference. No uploads, tracking or browser persistence; page refresh clears measurements. Underlying hardware geometry, moving masses and wheel friction remain the current model values and require independent calibration.

**Only analyse recordings of ordinary, permitted use. Do not create harder impacts, interact with the moving spring or alter public playground equipment.** A single bounce cannot identify the true end-stop safety performance because the swinging seat, wheels and cable exchange energy. Do not use the app to prescribe safe operating forces.

## Wind tunnel (V5)

The Physics → Wind along cable sliders specify signed wind along the horizontal route:
positive towards the end-stop and negative towards the launch platform.
The force is a one-dimensional quadratic relative-air drag law,
F_air = -D * (v - w) * abs(v - w), D = 0.5 * air_density * Cd * frontal_area
(kg/m). Wind changes the force on the outbound and return journeys.

The Wind tunnel Compare button reruns the same structure and launch at
-9, -6, -3, 0, +3, +6 and +9 m/s steady along-cable wind. It reports
completed spring rebounds, impact speed and whether both trolley and seat
return to their starting positions. It does not silently clamp manually
selected launch inputs. Selecting Load wind adjusts the live 3D simulation.

A configurable deterministic sinusoidal gust allows exploratory motion
experiments but is NOT a weather forecast. Wind comparison disables gusts
for a controlled comparison. With zero wind, the original simulation
physics remains unchanged.

Limitations: wind is represented as a *lumped longitudinal force*; it does
not act as a separate torque on the swinging seat, or include side winds,
lateral oscillation, deformation, uplift or turbulence. Effective aerodynamic
drag is not measured, and the actual rider and seat shapes strongly affect
drag. No outdoor experiment, impact or equipment modification is justified
by these numerical results.
