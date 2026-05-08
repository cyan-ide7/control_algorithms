// CONTROLLERS
// ─────────────────────────────────────────────
var K0 = [60, 16, 5, 8];
var CTRLS = {
  PID: {
    label: 'PID', hex: '#2a6b3c',
    info: 'Proportional-Integral-Derivative. Proportional (Kp) reacts to tilt by moving the cart in the same direction; Derivative (Kd) acts like a brake to prevent overshoot; Integral (Ki) removes steady-state errors.',
    params: [{ id: 'Kp', l: 'Kp (angle)', min: 20, max: 220, s: 1, v: 135 }, { id: 'Kd', l: 'Kd (rate)', min: 2, max: 60, s: 0.5, v: 10 }, { id: 'Ki', l: 'Ki (integ)', min: 0, max: 8, s: 0.1, v: 1.2 }, { id: 'Kx', l: 'Kx (cart)', min: 0, max: 15, s: 0.5, v: 2.5 }, { id: 'Kv', l: 'Kv (vel)', min: 0, max: 20, s: 0.5, v: 2.5 }],
    make: function(p, sp) {
      var ie = 0;
      return function(s, dt) {
        var angleTerm = -p.Kp * s.th;
        var rateTerm = -p.Kd * s.om;
        var cartTerm = -p.Kx * (s.x - sp) - p.Kv * s.v;
        var noITerm = angleTerm + rateTerm + cartTerm;
        var rawF = noITerm + p.Ki * ie;
        var satF = clamp(rawF, -MAX_CTRL_FORCE, MAX_CTRL_FORCE);

        // Prevent the integral term from winding up while the cart is already
        // saturating in the same direction as the angle error.
        if (Math.abs(rawF) < 19.5 || Math.sign(rawF) === Math.sign(s.th)) {
          ie = clamp(ie + s.th * dt, -0.75, 0.75);
          satF = clamp(noITerm + p.Ki * ie, -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
        }

        return satF;
      };
    }
  },
  LQR: {
    label: 'LQR', hex: '#1a4f7a',
    info: 'Linear-Quadratic Regulator via Riccati equation. Each slider is literally a K-matrix entry. Q penalises state error, R penalises control effort.',
    params: [{ id: 'k1', l: 'K1 (theta)', min: 20, max: 150, s: 1, v: 60 }, { id: 'k2', l: 'K2 (omega)', min: 5, max: 50, s: 0.5, v: 16 }, { id: 'k3', l: 'K3 (x)', min: 0, max: 15, s: 0.5, v: 5 }, { id: 'k4', l: 'K4 (xdot)', min: 2, max: 25, s: 0.5, v: 8 }],
    make: function(p, sp) { return function(s, dt) { return clamp(p.k1 * s.th + p.k2 * s.om - p.k3 * (s.x - sp) - p.k4 * s.v, -MAX_CTRL_FORCE, MAX_CTRL_FORCE); }; }
  },
  SMC: {
    label: 'SMC', hex: '#8a1a5a',
    info: 'Sliding Mode Control. Drives state onto surface sigma=omega+lambda*theta, then slides to origin. tanh replaces sign() to reduce chattering. Very robust to disturbances.',
    params: [{ id: 'lam', l: 'lambda (slope)', min: 1, max: 20, s: 0.5, v: 8 }, { id: 'eta', l: 'eta (switch)', min: 1, max: 20, s: 0.5, v: 6 }, { id: 'phi', l: 'phi (smooth)', min: 0.01, max: 0.4, s: 0.01, v: 0.1 }],
    make: function(p, sp) { var ix = 0; return function(s, dt) { ix = clamp(ix + (s.x - sp) * dt, -2, 2); var b = K0[0] * s.th + K0[1] * s.om - K0[2] * (s.x - sp) - K0[3] * s.v - 0.5 * ix; return clamp(b + p.eta * Math.tanh((s.om + p.lam * s.th) / p.phi), -MAX_CTRL_FORCE, MAX_CTRL_FORCE); }; }
  },
  Backstepping: {
    label: 'Backstepping', hex: '#8a6a00',
    info: 'Recursive Lyapunov design. Step 1: virtual omega*(theta) stabilises angle. Step 2: real force makes omega track virtual setpoint. Each step carries a Lyapunov certificate.',
    params: [{ id: 'c1', l: 'c1 (outer)', min: 1, max: 15, s: 0.5, v: 8 }, { id: 'c2', l: 'c2 (inner)', min: 5, max: 40, s: 1, v: 20 }, { id: 'Kxb', l: 'Kx (cart)', min: 0, max: 12, s: 0.5, v: 5 }],
    make: function(p, sp) { return function(s, dt) { var ad = -p.c1 * s.th + 0.12 * (s.x - sp); var e2 = s.om - ad; return clamp((p.c2 * e2 + s.th + p.c1 * s.om) * 0.38 - p.Kxb * (s.x - sp) - K0[3] * s.v, -MAX_CTRL_FORCE, MAX_CTRL_FORCE); }; }
  },
  MPC: {
    label: 'MPC', hex: '#b85c00',
    info: 'Receding horizon optimisation. Simulates N steps ahead for candidate forces, picks lowest cost J = sum(Q*theta^2 + Qx*x^2 + R*u^2). Increase N for more prediction.',
    params: [{ id: 'N', l: 'N (horizon)', min: 3, max: 20, s: 1, v: 10 }, { id: 'Qth', l: 'Q (angle)', min: 50, max: 200, s: 5, v: 100 }, { id: 'Qx', l: 'Q (cart)', min: 0, max: 30, s: 1, v: 8 }],
    make: function(p, sp) {
      var lF = 0;
      return function(s, dt) {
        var nom = clamp(K0[0] * s.th + K0[1] * s.om - K0[2] * (s.x - sp) - K0[3] * s.v, -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
        var ds = [-6, -2, -0.5, 0, 0.5, 2, 6];
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
        lF = bF; return bF;
      };
    }
  },
  MRAC: {
    label: 'MRAC', hex: '#1a6b6b',
    info: 'Adaptive control: gain k-hat updates online via MIT rule. Converges to stable value automatically. Watch the state panel as k-hat adapts after mass changes.',
    params: [{ id: 'gam', l: 'gamma (adapt)', min: 0.05, max: 2, s: 0.05, v: 0.3 }, { id: 'k0', l: 'k0 (init)', min: 20, max: 100, s: 1, v: 60 }],
    make: function(p, sp) { var kth = p.k0; return function(s, dt) { kth = clamp(kth + p.gam * 0.5 * s.th * s.th * Math.sign(s.th) * dt, 30, 120); return clamp(kth * s.th + K0[1] * s.om - K0[2] * (s.x - sp) - K0[3] * s.v, -MAX_CTRL_FORCE, MAX_CTRL_FORCE); }; }
  },
  FBL: {
    label: 'Feedback Lin.', hex: '#5b3a8a',
    info: 'Cancels g*sin(theta) gravity term via feedforward, converting nonlinear plant to a linear integrator chain. Then applies standard linear state feedback.',
    params: [{ id: 'kpf', l: 'kp (angle)', min: 20, max: 120, s: 1, v: 60 }, { id: 'kdf', l: 'kd (rate)', min: 5, max: 35, s: 0.5, v: 16 }, { id: 'Kxf', l: 'Kx (cart)', min: 0, max: 15, s: 0.5, v: 5 }],
    make: function(p, sp) { return function(s, dt) { var Fg = Mt * GG * Math.sin(s.th) / Lp * 0.055; return clamp(p.kpf * s.th + p.kdf * s.om - p.Kxf * (s.x - sp) - K0[3] * s.v + Fg, -MAX_CTRL_FORCE, MAX_CTRL_FORCE); }; }
  },
  Fuzzy: {
    label: 'Fuzzy Logic', hex: '#c0392b',
    info: 'Gain-scheduling via fuzzy membership functions on |theta|. Small angles use lower gains, larger angles use higher gains. No explicit model required.',
    params: [{ id: 'fs', l: 'Scale', min: 0.5, max: 2, s: 0.05, v: 1 }, { id: 'fKx', l: 'Kx (cart)', min: 0, max: 12, s: 0.5, v: 5 }, { id: 'fKv', l: 'Kv (vel)', min: 2, max: 20, s: 0.5, v: 8 }],
    make: function(p, sp) { return function(s, dt) { var a = Math.abs(s.th); var Kp = a < 0.05 ? 60 : a < 0.12 ? 63 : 67; var Kd = a < 0.05 ? 16 : a < 0.12 ? 17 : 18; return clamp(p.fs * (Kp * s.th + Kd * s.om) - p.fKx * (s.x - sp) - p.fKv * s.v, -MAX_CTRL_FORCE, MAX_CTRL_FORCE); }; }
  },
  Manual: {
    label: 'Manual (Mouse)', hex: '#e67e22',
    info: 'Control the cart directly with your mouse. Move your cursor over the track to shift the cart. You must balance the pendulum yourself!',
    params: [{ id: 'stiff', l: 'Response', min: 5, max: 50, s: 1, v: 25 }],
    make: function(p, sp) { 
      return function(s, dt) { 
        var err = manualX - s.x;
        var f = p.stiff * 8 * err - 12 * s.v;
        return clamp(f, -30, 30);
      }; 
    }
  },
  None: {
    label: 'None (Passive)', hex: '#777',
    info: 'Passive physics. No control force is applied. Observe the natural damping, gravity, and cart-pendulum momentum exchange.',
    params: [],
    make: function(p, sp) { return function(s, dt) { return 0; }; }
  }
};

// ─────────────────────────────────────────────
