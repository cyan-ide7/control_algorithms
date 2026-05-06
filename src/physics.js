// PHYSICS  (Lagrangian RK4, Quanser scale)
// ─────────────────────────────────────────────
var GG = 9.81, Mc = 0.57, Lp = 0.3302, bp = 0.0024, bc = 4.3, RAIL = 1.8;
var Mp = 0.127;
var Mt, Ip;
function rephy() { Mt = Mc + Mp; Ip = Mp * Lp * Lp * 1.333; }
rephy();

function phyDen(th) {
  var c = Math.cos(th);
  return Mt * Ip + Mc * Mp * Lp * Lp - Mp * Mp * Lp * Lp * c * c;
}
function phyDeriv(s, F) {
  var th = s.th, om = s.om, x = s.x, v = s.v;
  var sth = Math.sin(th), cth = Math.cos(th), D = phyDen(th);
  var dom = (Mt * Mp * Lp * GG * sth - Mp * Lp * cth * (F - bc * v + Mp * Lp * om * om * sth) - bp * Mt * om) / D;
  var dv  = (Ip * Mp * Lp * om * om * sth - Mp * Mp * Lp * Lp * GG * sth * cth + (Ip + Mp * Lp * Lp) * (F - bc * v) - bp * Mp * Lp * cth * om) / D;
  return { th: om, om: dom, x: v, v: dv };
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
    x:  clamp(s.x + dt / 6 * (k1.x + 2 * k2.x + 2 * k3.x + k4.x), -RAIL, RAIL),
    v:  s.v + dt / 6 * (k1.v + 2 * k2.v + 2 * k3.v + k4.v)
  };
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function recGains() {
  var wn = Math.sqrt(GG / Lp * Mt / (Mt - Mp + 0.001));
  return {
    Kp: Math.max(30, Math.ceil(Mt * Lp * wn * wn * 2.2)),
    Kd: Math.max(8,  Math.ceil(Mt * Lp * wn * 1.4)),
    Ki: 1,
    Kx: Math.max(3,  Math.ceil(wn * 0.8)),
    Kv: Math.max(5,  Math.ceil(wn * 1.2))
  };
}

// ─────────────────────────────────────────────
