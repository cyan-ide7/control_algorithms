// CONTROLLERS
// ─────────────────────────────────────────────
var K0 = [60, 16, 5, 8];
var CTRLS = {
  PID: {
    label: 'PID (Cascaded)', hex: '#2a6b3c',
    info: 'Dual-loop PID prevents drift. The Outer Loop converts cart position error into a target angle. The Inner Loop applies force to reach that target. Integral (Ki) ensures the cart returns exactly to the center.',
    // Notice the updated slider ranges suitable for cascaded angle targeting
    params: [
      { id: 'Kp', l: 'Kp (angle)', min: 20, max: 220, s: 1, v: 135 },
      { id: 'Kd', l: 'Kd (rate)', min: 2, max: 60, s: 0.5, v: 10 },
      { id: 'Kx', l: 'Kx (pos)', min: 0, max: 0.5, s: 0.01, v: 0.05 },
      { id: 'Kv', l: 'Kv (vel)', min: 0, max: 0.5, s: 0.01, v: 0.1 },
      { id: 'Ki', l: 'Ki (pos int)', min: 0, max: 0.2, s: 0.01, v: 0.02 }
    ],
    make: function (p, sp) {
      var ix = 0; // Integral of position error

      return function (s, dt) {
        // --- 1. OUTER LOOP: Cart Position -> Target Angle ---
        var posError = s.x - sp;

        // Integrate position error to overcome friction and eliminate drift
        // We clamp it to prevent integral windup if the cart gets pushed really far
        ix = clamp(ix + posError * dt, -5, 5);

        // Calculate the target angle needed to move the cart to the setpoint.
        // If posError > 0 (cart too far right), targetAngle is positive (lean left).
        var targetAngle = p.Kx * posError + p.Kv * s.v + p.Ki * ix;

        // Safety clamp: Never ask the inner loop to tilt more than ~14 degrees (0.25 rad)
        // Otherwise, it will just drop the pendulum trying to sprint back to center.
        targetAngle = clamp(targetAngle, -0.25, 0.25);

        // --- 2. INNER LOOP: Pendulum Angle -> Motor Force ---
        // Calculate the error between our current tilt and our target tilt
        var angleError = s.th - targetAngle;

        // Standard PD control to catch and hold the target angle
        var angleTerm = -p.Kp * angleError;
        var rateTerm = -p.Kd * s.om;

        var force = angleTerm + rateTerm;

        // Assuming MAX_CTRL_FORCE is defined globally in your script
        return clamp(force, -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
      };
    }
  },
  LQR: {
    label: 'LQI', hex: '#1a4f7a',
    info: 'Linear-Quadratic-Integral. Uses LQR for optimal dynamic balance, plus an Integral term to completely eliminate steady-state drift.',
    params: [
      { id: 'k1', l: 'K1 (theta)', min: -800, max: 150, s: 0.1, v: -489.25 },
      { id: 'k2', l: 'K2 (omega)', min: -100, max: 50, s: 0.1, v: -36.10 },
      { id: 'k3', l: 'K3 (x)', min: -100, max: 100, s: 0.1, v: -44.72 },
      { id: 'k4', l: 'K4 (xdot)', min: -150, max: 150, s: 0.1, v: -66.47 },
      { id: 'ki', l: 'Ki (drift)', min: 0, max: 20, s: 0.1, v: 2.0 }
    ],
    make: function (p, sp) {
      var ix = 0; // Integral accumulator
      return function (s, dt) {

        // Accumulate position error over time
        ix = clamp(ix + (s.x - sp) * dt, -5, 5);

        // Optimal LQR Force minus the Integral correction
        var u = p.k1 * s.th + p.k2 * s.om - p.k3 * (s.x - sp) - p.k4 * s.v - p.ki * ix;

        // Stiction feed-forward (keeps the cart from getting stuck)
        if (Math.abs(u) > 0.001 && simGaps.stiction > 0) {
          u += Math.sign(u) * simGaps.stiction;
        }

        return clamp(u, -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
      };
    }
  },


  MPC: {
    label: 'MPC-works only with DOUBLE PENDULUM', hex: '#b85c00',
    info: 'Receding horizon optimisation. Simulates N steps ahead for candidate forces, picks lowest cost. Double Pendulum mode uses a 2-phase sequence search for complex maneuvering.',
    params: [
      { id: 'N', l: 'N (horizon)', min: 4, max: 24, s: 2, v: 14 },
      { id: 'Qth', l: 'Q (angle 1)', min: 10, max: 500, s: 5, v: 120 },
      { id: 'Qth2', l: 'Q (angle 2)', min: 10, max: 1000, s: 5, v: 450 },
      { id: 'Qx', l: 'Q (cart)', min: 0, max: 100, s: 1, v: 40 }
    ],
    make: function (p, sp) {
      return function (s, dt) {
        if (!isDoubleMode) {
          var nom = clamp(K0[0] * s.th + K0[1] * s.om - K0[2] * (s.x - sp) - K0[3] * s.v, -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
          var ds = [-10, -6, -2, -0.5, 0, 0.5, 2, 6, 10];
          var bF = nom, bC = 1e12;
          for (var di = 0; di < ds.length; di++) {
            var F = clamp(nom + ds[di], -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
            var ss = { th: s.th, om: s.om, x: s.x, v: s.v }; var c = 0;
            for (var n = 0; n < Math.round(p.N); n++) {
              ss = rk4(ss, F, 0.025);
              c += p.Qth * ss.th * ss.th + 2 * ss.om * ss.om + p.Qx * (ss.x - sp) * (ss.x - sp) + 2 * ss.v * ss.v;
              if (Math.abs(ss.th) > 0.85) { c += 1e7; break; }
            }
            if (c < bC) { bC = c; bF = F; }
          }
          return bF;
        } else {
          // Double pendulum 2-phase sequence search with LQR baseline
          // Optimal LQR gains highly tuned for STRICT cart position tracking:
          var nom = clamp(-44.72 * (s.x - sp) - 275.53 * s.th + 696.46 * s.th2 - 70.04 * s.v + 50.85 * s.om + 117.51 * s.om2, -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
          var ds = [-40, -15, -5, 0, 5, 15, 40];
          var bF = nom, bC = 1e12;
          var steps1 = Math.floor(p.N / 2);
          var steps2 = Math.round(p.N) - steps1;
          var predDt = 0.025;

          for (var i = 0; i < ds.length; i++) {
            for (var j = 0; j < ds.length; j++) {
              var F1 = clamp(nom + ds[i], -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
              var F2 = clamp(nom + ds[j], -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
              var ss = { th: s.th, om: s.om, x: s.x, v: s.v, th2: s.th2, om2: s.om2 };
              var c = 0;
              for (var n = 0; n < steps1; n++) {
                ss = rk4(ss, F1, predDt);
                c += p.Qth * ss.th * ss.th + 2 * ss.om * ss.om
                  + p.Qth2 * ss.th2 * ss.th2 + 4 * ss.om2 * ss.om2
                  + p.Qx * (ss.x - sp) * (ss.x - sp) + 2 * ss.v * ss.v;
                if (Math.abs(ss.th) > 0.9 || Math.abs(ss.th2) > 0.9) { c += 1e7; break; }
              }
              if (c < 1e6) {
                for (var n = 0; n < steps2; n++) {
                  ss = rk4(ss, F2, predDt);
                  c += p.Qth * ss.th * ss.th + 2 * ss.om * ss.om
                    + p.Qth2 * ss.th2 * ss.th2 + 4 * ss.om2 * ss.om2
                    + p.Qx * (ss.x - sp) * (ss.x - sp) + 2 * ss.v * ss.v;
                  if (Math.abs(ss.th) > 0.9 || Math.abs(ss.th2) > 0.9) { c += 1e7; break; }
                }
              }
              c += 15 * (p.Qth * ss.th * ss.th + p.Qth2 * ss.th2 * ss.th2 + p.Qx * (ss.x - sp) * (ss.x - sp)); // terminal cost constraint
              if (c < bC) { bC = c; bF = F1; } // We only apply the first optimal action
            }
          }
          return bF;
        }
      };
    }
  },



  Manual: {
    label: 'Manual (Mouse)', hex: '#e67e22',
    info: 'Control the cart directly with your mouse. Move your cursor over the track to shift the cart. You must balance the pendulum yourself!',
    params: [{ id: 'stiff', l: 'Response', min: 5, max: 50, s: 1, v: 25 }],
    make: function (p, sp) {
      return function (s, dt) {
        var err = manualX - s.x;
        var f = p.stiff * 8 * err - 12 * s.v;
        return clamp(f, -30, 30);
      };
    }
  }
};

// ─────────────────────────────────────────────
