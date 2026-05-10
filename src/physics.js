// PHYSICS  (Lagrangian RK4, Quanser scale)
//
// Sign convention used by the renderer:
// - x increases to the right
// - theta = 0 is upright
// - positive theta means the bob leans to the left
//
// That means the pendulum kinematics are:
//   bob_x = cart_x - L * sin(theta)
//   bob_y = pivot_y + L * cos(theta)
var GG = 9.81, Mc = 0.57, Lp = 0.3302, bp = 0.0014, bc = 0.9, RAIL = 1.8;
var CART_WIDTH = 0.22;
var RAIL_LIMIT = RAIL - (CART_WIDTH / 2);
var Mp = 0.127;
var Mt, Ip;

function rephy() {
  Mt = Mc + Mp;
  // Effective upright inertia about the pivot.
  Ip = Mp * Lp * Lp * 1.333;
}
rephy();

function pendulumCartesian(s, pivotX, pivotY, rodLength) {
  var L = rodLength == null ? Lp * 2 : rodLength;
  return {
    x: pivotX - L * Math.sin(s.th),
    y: pivotY + L * Math.cos(s.th)
  };
}

function phyDen(th) {
  var coupling = Mp * Lp * Math.cos(th);
  return Mt * Ip - coupling * coupling;
}

function phyAppliedForce(s, F) {
  var motorF = F;
  var sth = Math.sin(s.th);
  var railF = 0;

  if (simGaps.backEMF > 0) motorF -= s.v * simGaps.backEMF * 0.5;

  if (s.x > RAIL_LIMIT) railF += -800 * (s.x - RAIL_LIMIT) - 40 * s.v;
  if (s.x < -RAIL_LIMIT) railF += -800 * (s.x + RAIL_LIMIT) - 40 * s.v;

  var netF = motorF - bc * s.v + railF - Mp * Lp * s.om * s.om * sth;
  
  // Kinetic friction ALWAYS opposes velocity, not the applied force
  if (Math.abs(s.v) >= 0.001 && simGaps.stiction > 0) {
    netF -= Math.sign(s.v) * simGaps.stiction * 0.2;
  }

  return netF;
}

function phyAppliedTorque(s) {
  var gravityTorque = Mp * GG * Lp * Math.sin(s.th);
  var dampingTorque = -bp * s.om;
  var wiringTorque = -simGaps.wiring * 0.05 * s.th;
  return gravityTorque + dampingTorque + wiringTorque;
}

function phyDeriv(s, F) {
  var coupling = Mp * Lp * Math.cos(s.th);
  var D = phyDen(s.th);
  var rhsForce = phyAppliedForce(s, F);
  var rhsTorque = phyAppliedTorque(s);

  if (Math.abs(D) < 1e-6) D = D < 0 ? -1e-6 : 1e-6;

  var dv = (Ip * rhsForce + coupling * rhsTorque) / D;
  var dom = (Mt * rhsTorque + coupling * rhsForce) / D;

  // STICTION FIX: Lock the cart if forces don't break static friction
  if (Math.abs(s.v) < 0.001 && simGaps.stiction > 0) {
    
    // Calculate the total force trying to break the cart free.
    // This includes the motor force AND the reactive pull from the leaning pendulum!
    var apparentForce = rhsForce + (coupling * rhsTorque / Ip);
    
    if (Math.abs(apparentForce) < simGaps.stiction) {
      dv = 0; // The cart is completely locked to the track
      dom = rhsTorque / Ip; // The pendulum swings freely as if on a fixed hinge
    }
  }

  return { th: s.om, om: dom, x: s.v, v: dv };
}

function rk4(s, F, dt) {
  var k1 = phyDeriv(s, F);
  var s2 = { th: s.th + k1.th * dt / 2, om: s.om + k1.om * dt / 2, x: s.x + k1.x * dt / 2, v: s.v + k1.v * dt / 2 };
  var k2 = phyDeriv(s2, F);
  var s3 = { th: s.th + k2.th * dt / 2, om: s.om + k2.om * dt / 2, x: s.x + k2.x * dt / 2, v: s.v + k2.v * dt / 2 };
  var k3 = phyDeriv(s3, F);
  var s4 = { th: s.th + k3.th * dt, om: s.om + k3.om * dt, x: s.x + k3.x * dt, v: s.v + k3.v * dt };
  var k4 = phyDeriv(s4, F);

  return {
    th: s.th + dt / 6 * (k1.th + 2 * k2.th + 2 * k3.th + k4.th),
    om: s.om + dt / 6 * (k1.om + 2 * k2.om + 2 * k3.om + k4.om),
    x: s.x + dt / 6 * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    v: s.v + dt / 6 * (k1.v + 2 * k2.v + 2 * k3.v + k4.v)
  };
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function recGains() {
  var wn = Math.sqrt(GG / Lp * Mt / (Mt - Mp + 0.001));
  return {
    Kp: Math.max(30, Math.ceil(Mt * Lp * wn * wn * 2.2)),
    Kd: Math.max(8, Math.ceil(Mt * Lp * wn * 1.4)),
    Ki: 1,
    Kx: Math.max(3, Math.ceil(wn * 0.8)),
    Kv: Math.max(5, Math.ceil(wn * 1.2))
  };
}
