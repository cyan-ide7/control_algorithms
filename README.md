# Pendulum Lab Source Map

This project is intentionally kept as a browser-native app: open `main.html`
directly and the scripts load in order. Each file owns one area of behavior.

- `physics.js`: physical constants, mass recalculation, RK4 integration, and
  recommended gain estimates.
- `controllers.js`: controller definitions and gain metadata. Add new control
  strategies here.
- `state.js`: simulation state, controller factory setup, and reset behavior.
- `scene.js`: Three.js renderer, camera, lights, cart, pendulum, trail, and
  force indicator objects.
- `input.js`: orbit controls and bob-click disturbance handling.
- `fall.js`: fall detection, fall overlay text, and recommended-gain action.
- `plots.js`: time-series and phase-plane canvas drawing.
- `ui.js`: controller/gain panel rendering and right-side status updates.
- `math-modal.js`: stability math tabs and calculator.
- `loop.js`: fixed-step simulation loop and per-frame render/update pipeline.
- `events.js`: DOM event wiring and app bootstrap.

When adding a feature, prefer changing the file that owns that behavior first.
If a change needs cross-file state, keep the shared variable in `state.js` or
the domain file that naturally owns it.
