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
var Mp2 = 0.127, Lp2 = 0.3302, Ip2;

function rephy() {
  Mt = Mc + Mp;
  // Effective upright inertia about the pivot.
  Ip = Mp * Lp * Lp * 1.333;
  Ip2 = Mp2 * Lp2 * Lp2 * 1.333;
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

function phyDerivDouble(s, F) {
  var L_hinge = 2 * Lp; 

  var st1 = Math.sin(s.th);
  var ct1 = Math.cos(s.th);
  var st2 = Math.sin(s.th2);
  var ct2 = Math.cos(s.th2);
  var s12 = Math.sin(s.th - s.th2);
  var c12 = Math.cos(s.th - s.th2);

  var om1sq = s.om * s.om;
  var om2sq = s.om2 * s.om2;

  var m1L1_m2Lhinge = Mp * Lp + Mp2 * L_hinge;
  var m2L2 = Mp2 * Lp2;
  var m2LhingeL2 = Mp2 * L_hinge * Lp2;

  var M11 = Mc + Mp + Mp2;
  var M12 = -m1L1_m2Lhinge * ct1;
  var M13 = -m2L2 * ct2;
  var M22 = Ip + Mp2 * L_hinge * L_hinge;
  var M23 = m2LhingeL2 * c12;
  var M33 = Ip2;

  var motorF = F;
  if (simGaps.backEMF > 0) motorF -= s.v * simGaps.backEMF * 0.5;
  var railF = 0;
  if (s.x > RAIL_LIMIT) railF += -800 * (s.x - RAIL_LIMIT) - 40 * s.v;
  if (s.x < -RAIL_LIMIT) railF += -800 * (s.x + RAIL_LIMIT) - 40 * s.v;
  var netF = motorF - bc * s.v + railF;
  if (Math.abs(s.v) >= 0.001 && simGaps.stiction > 0) {
    netF -= Math.sign(s.v) * simGaps.stiction * 0.2;
  }

  var jointDamping = 0.001; // tiny friction for a free joint
  var torque2 = -jointDamping * (s.om2 - s.om);
  var torque1 = -bp * s.om - simGaps.wiring * 0.05 * s.th - torque2;

  var RHS_1 = netF - m1L1_m2Lhinge * st1 * om1sq - m2L2 * st2 * om2sq;
  var RHS_2 = -m2LhingeL2 * s12 * om2sq + m1L1_m2Lhinge * GG * st1 + torque1;
  var RHS_3 =  m2LhingeL2 * s12 * om1sq + m2L2 * GG * st2 + torque2;

  var detM = M11 * (M22 * M33 - M23 * M23) - M12 * (M12 * M33 - M13 * M23) + M13 * (M12 * M23 - M13 * M22);

  if (Math.abs(detM) < 1e-6) detM = detM < 0 ? -1e-6 : 1e-6;

  var inv11 = (M22 * M33 - M23 * M23) / detM;
  var inv12 = (M13 * M23 - M12 * M33) / detM;
  var inv13 = (M12 * M23 - M13 * M22) / detM;
  var inv22 = (M11 * M33 - M13 * M13) / detM;
  var inv23 = (M12 * M13 - M11 * M23) / detM;
  var inv33 = (M11 * M22 - M12 * M12) / detM;

  var dv   = inv11 * RHS_1 + inv12 * RHS_2 + inv13 * RHS_3;
  var dom1 = inv12 * RHS_1 + inv22 * RHS_2 + inv23 * RHS_3;
  var dom2 = inv13 * RHS_1 + inv23 * RHS_2 + inv33 * RHS_3;

  var bob1Y = 0.08 + 2 * Lp * ct1;
  if (hasFallen && bob1Y <= bobRadius + 0.015 && s.th * dom1 > 0) {
    // First rod is resting on the floor. 
    // Nullify its downward acceleration to decouple the second joint!
    dom1 = 0;
    dv = RHS_1 / M11;
    dom2 = RHS_3 / M33;
  }

  if (Math.abs(s.v) < 0.001 && simGaps.stiction > 0) {
    if (Math.abs(netF) < simGaps.stiction) {
      dv = 0; 
    }
  }

  return { th: s.om, om: dom1, th2: s.om2, om2: dom2, x: s.v, v: dv };
}

function rk4(s, F, dt) {
  var k1 = isDoubleMode ? phyDerivDouble(s, F) : phyDeriv(s, F);
  var s2 = { th: s.th + k1.th * dt / 2, om: s.om + k1.om * dt / 2, x: s.x + k1.x * dt / 2, v: s.v + k1.v * dt / 2, th2: s.th2 + (k1.th2||0) * dt / 2, om2: s.om2 + (k1.om2||0) * dt / 2 };
  var k2 = isDoubleMode ? phyDerivDouble(s2, F) : phyDeriv(s2, F);
  var s3 = { th: s.th + k2.th * dt / 2, om: s.om + k2.om * dt / 2, x: s.x + k2.x * dt / 2, v: s.v + k2.v * dt / 2, th2: s.th2 + (k2.th2||0) * dt / 2, om2: s.om2 + (k2.om2||0) * dt / 2 };
  var k3 = isDoubleMode ? phyDerivDouble(s3, F) : phyDeriv(s3, F);
  var s4 = { th: s.th + k3.th * dt, om: s.om + k3.om * dt, x: s.x + k3.x * dt, v: s.v + k3.v * dt, th2: s.th2 + (k3.th2||0) * dt, om2: s.om2 + (k3.om2||0) * dt };
  var k4 = isDoubleMode ? phyDerivDouble(s4, F) : phyDeriv(s4, F);

  return {
    th: s.th + dt / 6 * (k1.th + 2 * k2.th + 2 * k3.th + k4.th),
    om: s.om + dt / 6 * (k1.om + 2 * k2.om + 2 * k3.om + k4.om),
    x: s.x + dt / 6 * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    v: s.v + dt / 6 * (k1.v + 2 * k2.v + 2 * k3.v + k4.v),
    th2: s.th2 + dt / 6 * ((k1.th2||0) + 2 * (k2.th2||0) + 2 * (k3.th2||0) + (k4.th2||0)),
    om2: s.om2 + dt / 6 * ((k1.om2||0) + 2 * (k2.om2||0) + 2 * (k3.om2||0) + (k4.om2||0))
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
