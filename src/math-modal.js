// MATH MODAL
// ─────────────────────────────────────────────
var MATH_TABS = [
  { tab: 'Equations of Motion', id: 'eom' },
  { tab: 'Linearisation', id: 'lin' },
  { tab: 'Routh-Hurwitz', id: 'routh' },
  { tab: 'LQR Design', id: 'lqr' },
  { tab: 'Lyapunov / SMC', id: 'lyap' },
  { tab: 'Your Rig Calculator', id: 'calc' }
];

var MATH_CONTENT = {
  eom: function() {
    var wn = Math.sqrt(GG / Lp * Mt / (Mt - Mp + 0.001));
    return '<h2>Lagrangian Derivation</h2>' +
      '<p>Two degrees of freedom: cart position x and pendulum angle theta from vertical. Lagrangian L = T minus V gives coupled nonlinear EOMs:</p>' +
      '<div class="eq">(Mc+Mp)xdd + Mp*L*(tdd*cos(t) - td^2*sin(t)) + bc*xd = F\n(Ic+Mp*L^2)*tdd + Mp*L*xdd*cos(t) + bp*td - Mp*g*L*sin(t) = 0</div>' +
      '<h2>Physical parameters (this simulation)</h2>' +
      '<table><tr><th>Symbol</th><th>Value</th><th>Description</th></tr>' +
      '<tr><td>Mc</td><td>0.57 kg</td><td>Cart mass</td></tr>' +
      '<tr><td>Mp</td><td>' + Mp.toFixed(3) + ' kg</td><td>Bob mass (adjustable slider)</td></tr>' +
      '<tr><td>L</td><td>0.330 m</td><td>Pivot to bob</td></tr>' +
      '<tr><td>bc</td><td>4.3 N.s/m</td><td>Cart friction</td></tr>' +
      '<tr><td>bp</td><td>0.0024 N.m.s</td><td>Pivot friction</td></tr></table>' +
      '<h2>Natural frequency at upright equilibrium</h2>' +
      '<div class="eq">wn = sqrt( g/L * Mt/(Mt-Mp) ) = ' + wn.toFixed(3) + ' rad/s  (' + (wn / 2 / Math.PI).toFixed(2) + ' Hz)\n\nOpen-loop unstable pole at: p = +' + wn.toFixed(3) + '\nController must move this into the left half-plane.</div>' +
      '<p class="note">Heavier bob raises wn and makes dynamics faster — same gains that worked before will be insufficient.</p>';
  },
  lin: function() {
    var wn = Math.sqrt(GG / Lp * Mt / (Mt - Mp + 0.001));
    return '<h2>Linearised state-space (around theta = 0)</h2>' +
      '<p>Using the Quanser convention where positive theta means leaning to the left, and assuming small angles:</p>' +
      '<div class="eq">d/dt [theta, omega, x, xdot]^T = A*x + B*u\n\nA matrix:\n  row 1:  [ 0,             1, 0, 0 ]\n  row 2:  [ (Mt*g)/(Mc*L), 0, 0, 0 ]\n  row 3:  [ 0,             0, 0, 1 ]\n  row 4:  [ (Mp*g)/Mc,     0, 0, 0 ]\n\nB matrix: [ 0, 1/(Mc*L), 0, 1/Mc ]^T</div>' +
      '<h2>Controllability</h2>' +
      '<p>rank[B, AB, A^2 B, A^3 B] = 4. Full rank — completely controllable. Any pole placement is achievable with one force input.</p>' +
      '<h2>Open-loop poles</h2>' +
      '<div class="eq">Unstable:  p1 = +' + wn.toFixed(3) + '  (right half-plane — must move)\nStable:    p2 = -' + wn.toFixed(3) + '\nCart:      p3,4 near 0</div>' +
      '<p class="note">Target closed-loop poles: Re(p) in [-8, -2]. Too far left saturates the actuator; too close means slow recovery.</p>';
  },
  routh: function() {
    var wn = Math.sqrt(GG / Lp * Mt / (Mt - Mp + 0.001));
    var rec = recGains();
    return '<h2>Minimum stable gains (Routh-Hurwitz)</h2>' +
      '<p>For the control law F = -K1*theta - K2*omega - K3*x - K4*xdot, stabilizing the Quanser system requires specific gain signs:</p>' +
      '<div class="eq">K1 < -Mt*g  =  ' + (-Mt * GG).toFixed(1) + '  N/rad   (minimum angle gain)\nK2 < 0             (angle damping)\nK3 < 0             (position push-out)\nK4 < 0             (velocity damping)\n\nWait, K3 must be negative? Yes! Non-minimum phase:\nTo move the cart left, you must first push it RIGHT\nto cause the pendulum to lean left.</div>' +
      '<h2>Why gains scale with mass</h2>' +
      '<p>Gravity torque = Mp*g*L*sin(theta). Heavier bob creates more torque. The required restoring force scales directly with Total Mass (Mt * g).</p>';
  },
  lqr: function() {
    return '<h2>Linear-Quadratic Regulator</h2>' +
      '<p>LQR minimises the infinite-horizon cost functional:</p>' +
      '<div class="eq">J = integral_0^inf ( x^T Q x + u^T R u ) dt\n\nSolution: Algebraic Riccati equation\n  A^T P + P A - P B R^-1 B^T P + Q = 0\nGain:  K = R^-1 B^T P  =>  u = -K x</div>' +
      '<h2>Tuning the Q/R matrices</h2>' +
      '<table><tr><th>Increase</th><th>Effect on closed-loop</th></tr>' +
      '<tr><td>Q(1,1) — Theta</td><td>Faster angle correction, strongly resists falling</td></tr>' +
      '<tr><td>Q(2,2) — Omega</td><td>More angle damping, less swinging overshoot</td></tr>' +
      '<tr><td>Q(3,3) — X</td><td>Tighter cart position hold (causes drifting if too high)</td></tr>' +
      '<tr><td>R (decrease)</td><td>Allows motor to work harder for aggressive correction</td></tr></table>' +
      '<h2>Key insight</h2>' +
      '<p>A PID-like balance prioritizes Angle over Position. In our tune_lqr.py, we heavily penalize Theta (10000) but lightly penalize X (100) with a low R (0.05) to allow massive motor forces.</p>';
  },
  lyap: function() {
    return '<h2>Lyapunov stability (Sliding Mode)</h2>' +
      '<p>Define sliding surface sigma = omega + lambda*theta. Lyapunov candidate V = 0.5*sigma^2:</p>' +
      '<div class="eq">V_dot = sigma * sigma_dot = sigma*(omega_dot + lambda*omega)\n\nControl:  u = u_eq - eta * tanh(sigma / phi)\n\nResult:   V_dot &lt; 0 whenever |sigma| &gt; phi  (boundary layer)\n          => sigma converges to |sigma| &lt; phi\n          => (theta, omega) -> 0</div>' +
      '<h2>Backstepping proof sketch</h2>' +
      '<div class="eq">Step 1:  V1 = 0.5*theta^2\n         Choose alpha(theta) = -c1*theta\n         V1_dot = theta*omega + theta*(alpha-omega) = -c1*theta^2 &lt;= 0\n\nStep 2:  e2 = omega - alpha(theta),  V2 = V1 + 0.5*e2^2\n         Choose F so V2_dot = -c1*theta^2 - c2*e2^2 &lt;= 0  always</div>' +
      '<h2>Common failure modes and fixes</h2>' +
      '<table><tr><th>Symptom</th><th>Cause</th><th>Fix</th></tr>' +
      '<tr><td>Growing oscillation</td><td>Kd too small</td><td class="ok">Increase Kd / K2</td></tr>' +
      '<tr><td>Falls slowly</td><td>Kp below minimum</td><td class="ok">Increase Kp / K1</td></tr>' +
      '<tr><td>Cart hits rail</td><td>Kx = 0</td><td class="ok">Add Kx &gt; 3</td></tr>' +
      '<tr><td>Heavier mass fails</td><td>Fixed gains, larger torque</td><td class="ok">Scale K1 with Mp*g/L</td></tr>' +
      '<tr><td>Integral windup</td><td>Ki too large</td><td class="ok">Clamp integrator</td></tr></table>';
  },
  calc: function() {
    return '<h2>Compute gains for your physical rig</h2>' +
      '<p>Enter your hardware parameters. Derives minimum stable PID gains from Routh-Hurwitz on the linearised model.</p>' +
      '<div class="irow"><label>Cart mass Mc</label><input type="number" id="ic_Mc" value="0.57" step="0.01"><span>kg</span></div>' +
      '<div class="irow"><label>Bob mass Mp</label><input type="number" id="ic_Mp" value="' + Mp.toFixed(3) + '" step="0.001"><span>kg</span></div>' +
      '<div class="irow"><label>Pivot-to-bob L</label><input type="number" id="ic_L" value="0.3302" step="0.005"><span>m</span></div>' +
      '<div class="irow"><label>Cart friction bc</label><input type="number" id="ic_bc" value="4.3" step="0.1"><span>N.s/m</span></div>' +
      '<div class="irow"><label>Max force Fmax</label><input type="number" id="ic_Fmax" value="20" step="1"><span>N</span></div>' +
      '<button class="calcbtn" onclick="calcRig()">Calculate</button>' +
      '<div id="ic_result"></div>';
  }
};

function calcRig() {
  var Mc_ = parseFloat(document.getElementById('ic_Mc').value) || 0.57;
  var Mp_ = parseFloat(document.getElementById('ic_Mp').value) || 0.127;
  var L_  = parseFloat(document.getElementById('ic_L').value)  || 0.33;
  var bc_ = parseFloat(document.getElementById('ic_bc').value) || 4.3;
  var Fm_ = parseFloat(document.getElementById('ic_Fmax').value) || 20;
  
  var Mt_ = Mc_ + Mp_;
  var wn = Math.sqrt(GG / L_ * Mt_ / (Mt_ - Mp_ + 0.001));
  
  var Kpmin = Math.ceil(Mt_ * GG); 
  var Kprec = Math.ceil(Mt_ * L_ * wn * wn * 2.2);
  var Kdrec = Math.ceil(Mt_ * L_ * wn * 1.4);
  var Kxrec = Math.ceil(wn * 0.8);
  var Kvrec = Math.ceil(wn * 1.2);
  
  var maxAng = Math.asin(Math.min(1, Fm_ / (Mt_ * GG))) * 180 / Math.PI;
  
  var div = document.getElementById('ic_result'); div.style.display = 'block';
  div.innerHTML =
    '<div class="ro">Natural frequency:  wn = ' + wn.toFixed(3) + ' rad/s  (' + (wn / 2 / Math.PI).toFixed(2) + ' Hz)</div>' +
    '<div class="ro">Unstable pole:      +/- ' + wn.toFixed(3) + '</div>' +
    '<div style="margin:6px 0;border-top:1px solid var(--border);"></div>' +
    '<div>Kp minimum (Routh):   <span class="rg">' + Kpmin + ' N/rad</span></div>' +
    '<div>Kp recommended:       <span class="rg">' + Kprec + ' N/rad</span></div>' +
    '<div>Kd recommended:       <span class="rg">' + Kdrec + ' N.s/rad</span></div>' +
    '<div>Ki recommended:       <span class="rg">0.5 to 2 N.s2/rad</span></div>' +
    '<div>Kx recommended:       <span class="rg">' + Kxrec + ' N/m</span></div>' +
    '<div>Kv recommended:       <span class="rg">' + Kvrec + ' N.s/m</span></div>' +
    '<div style="margin:6px 0;border-top:1px solid var(--border);"></div>' +
    '<div>Max recoverable angle at Fmax = ' + Fm_ + ' N:  <span class="rg">' + maxAng.toFixed(1) + 'deg</span></div>' +
    '<div class="ro" style="margin-top:5px;font-size:9px;">Start with Kp_min, increase Kd until oscillation stops, then tune Kx.</div>';
}

var activeMathTab = 'eom';
function buildMathModal() {
  var tabsEl = document.getElementById('mathTabs');
  tabsEl.innerHTML = '';
  MATH_TABS.forEach(function(sec) {
    var t = document.createElement('button');
    t.className = 'mtab' + (sec.id === activeMathTab ? ' active' : '');
    t.textContent = sec.tab;
    t.onclick = function() {
      activeMathTab = sec.id;
      document.querySelectorAll('.mtab').forEach(function(b) { b.classList.remove('active'); });
      t.classList.add('active');
      document.getElementById('mathBody').innerHTML = MATH_CONTENT[sec.id]();
    };
    tabsEl.appendChild(t);
  });
  document.getElementById('mathBody').innerHTML = MATH_CONTENT[activeMathTab]();
}

function openMath() {
  buildMathModal();
  document.getElementById('mathModal').classList.add('open');
}
function closeMath() { document.getElementById('mathModal').classList.remove('open'); }
document.getElementById('mathModal').addEventListener('click', function(e) {
  if (e.target === document.getElementById('mathModal')) closeMath();
});

// ─────────────────────────────────────────────
