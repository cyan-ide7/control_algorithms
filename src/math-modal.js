// STABILITY MATH MODAL
// ─────────────────────────────────────────────

var mathTabIdx = 0;

var MATH_TABS = [
  { id: 'params',   label: '① Physical Parameters' },
  { id: 'eqs',      label: '② Equations of Motion' },
  { id: 'ctrl',     label: '③ Control Algorithms' },
];

var MATH_CONTENT = {
  params: `
    <h2>The Physical Setup</h2>
    <p>
      The inverted pendulum sits on a motorised cart that slides along a horizontal rail.
      Gravity constantly tries to topple the rod; the controller must push the cart to
      keep the bob directly above the pivot.
    </p>

    <table>
      <tr><th>Symbol</th><th>Name</th><th>Value used</th><th>Role</th></tr>
      <tr><td>M<sub>c</sub></td><td>Cart mass</td><td>0.57 kg</td>
          <td>Heavier cart ⟹ more inertia ⟹ larger force needed to accelerate.</td></tr>
      <tr><td>M<sub>p</sub></td><td>Bob (pendulum) mass</td><td>0.127 kg</td>
          <td>Heavier bob falls faster and hits the cart harder via the coupling torque.</td></tr>
      <tr><td>L</td><td>Half-rod length</td><td>0.3302 m</td>
          <td>Longer rod ⟹ slower natural frequency ⟹ easier to balance but larger swing radius.</td></tr>
      <tr><td>g</td><td>Gravity</td><td>9.81 m/s²</td>
          <td>The constant destabilising torque: τ<sub>gravity</sub> = M<sub>p</sub>·g·L·sin θ.</td></tr>
      <tr><td>b<sub>c</sub></td><td>Cart viscous friction</td><td>0.9 N·s/m</td>
          <td>Damps cart velocity; the controller must overcome it to keep moving.</td></tr>
      <tr><td>b<sub>p</sub></td><td>Pivot damping</td><td>0.0014 N·m·s</td>
          <td>Tiny joint friction that slowly kills angular oscillation.</td></tr>
      <tr><td>I<sub>p</sub></td><td>Pendulum moment of inertia</td><td>M<sub>p</sub>·L²·4/3</td>
          <td>Rotational "weight" — resists angular acceleration.</td></tr>
    </table>

    <h2>Natural Frequency &amp; Stability Margin</h2>
    <p>
      Without any control the pendulum behaves like an <em>upside-down</em> pendulum.
      The linearised open-loop eigenvalue at θ = 0 is:
    </p>
    <div class="eq">ω<sub>n</sub> = √( g / L )  ≈  5.45 rad/s   (≈ 0.87 Hz)</div>
    <p>
      This means the bob doubles its angle roughly every <strong>1/(ω<sub>n</sub>/2) ≈ 0.37 s</strong>
      if the controller is switched off — that's the "budget" the controller has to react.
      A heavier bob or shorter rod changes ω<sub>n</sub> and therefore changes how aggressively
      the gains must be tuned.
    </p>

    <h2>Rail Limits</h2>
    <p>
      The cart is confined to ±1.8 m (±RAIL). A soft wall spring kicks in beyond
      ±(RAIL − cart_width/2) ≈ ±1.69 m to simulate end-stops without a hard discontinuity.
      The controller must balance the pendulum <em>and</em> keep the cart inside this window.
    </p>
  `,

  eqs: `
    <h2>State Vector</h2>
    <p>The entire system is described by four numbers updated every 5 ms (DT = 0.005 s):</p>
    <div class="eq">x⃗ = [ θ,  θ̇,  x<sub>cart</sub>,  ẋ<sub>cart</sub> ]</div>
    <table>
      <tr><th>State</th><th>Meaning</th><th>Zero means…</th></tr>
      <tr><td>θ</td><td>Pendulum angle from vertical</td><td>Perfectly upright</td></tr>
      <tr><td>θ̇ (ω)</td><td>Angular velocity</td><td>Not rotating</td></tr>
      <tr><td>x</td><td>Cart position on rail</td><td>Centre of track</td></tr>
      <tr><td>ẋ (v)</td><td>Cart velocity</td><td>Stationary</td></tr>
    </table>

    <h2>Equations of Motion (Lagrangian derivation)</h2>
    <p>
      Applying the Euler-Lagrange method to the cart–pendulum Lagrangian gives two
      coupled ODEs (one for cart translation, one for pendulum rotation).
      Written as a 2×2 linear system:
    </p>
    <div class="eq">(M<sub>c</sub>+M<sub>p</sub>)·ẍ  −  M<sub>p</sub>·L·cos θ·θ̈  =  F − b<sub>c</sub>·ẋ − M<sub>p</sub>·L·θ̇²·sin θ

(I<sub>p</sub> + M<sub>p</sub>·L²)·θ̈  −  M<sub>p</sub>·L·cos θ·ẍ  =  M<sub>p</sub>·g·L·sin θ − b<sub>p</sub>·θ̇</div>
    <p>
      Notice the <strong>cos θ coupling terms</strong> — the two equations are not
      independent. Accelerating the cart induces a torque on the rod, and the swinging
      rod pulls the cart. This coupling is exactly what makes the problem interesting.
    </p>

    <h2>Solving for Accelerations (Matrix Inversion)</h2>
    <p>Rearranging into matrix form:</p>
    <div class="eq">⎡ M<sub>t</sub>      −M<sub>p</sub>L cosθ ⎤ ⎡ ẍ  ⎤   ⎡ RHS<sub>F</sub> ⎤
⎣ −M<sub>p</sub>L cosθ    I<sub>p</sub>    ⎦ ⎣ θ̈  ⎦ = ⎣ RHS<sub>τ</sub> ⎦

where  M<sub>t</sub> = M<sub>c</sub> + M<sub>p</sub>
       RHS<sub>F</sub> = F − b<sub>c</sub>ẋ − M<sub>p</sub>L θ̇² sinθ
       RHS<sub>τ</sub> = M<sub>p</sub>gL sinθ − b<sub>p</sub>θ̇</div>
    <p>
      The 2×2 determinant D = M<sub>t</sub>·I<sub>p</sub> − (M<sub>p</sub>L cosθ)²
      is never zero for |θ| &lt; 90°, so the system is always solvable near upright.
      We invert analytically to get ẍ and θ̈, then integrate with 4th-order Runge-Kutta.
    </p>

    <h2>Linearisation at the Upright Equilibrium</h2>
    <p>
      For small angles: sin θ ≈ θ, cos θ ≈ 1. The system becomes a <em>linear</em> ODE —
      the foundation for LQR design:
    </p>
    <div class="eq">ẋ⃗ = A·x⃗ + B·u

A = ⎡ 0        1        0   0 ⎤
    ⎡ M<sub>p</sub>gL/D   −b<sub>p</sub>/D    0  −M<sub>p</sub>Lb<sub>c</sub>/D ⎤
    ⎡ 0        0        0   1 ⎤
    ⎣ −M<sub>p</sub>gL/D   b<sub>p</sub>/D    0   M<sub>t</sub>b<sub>c</sub>/D  ⎦

B = ⎡ 0  ⎤
    ⎡−1/D⎤
    ⎡ 0  ⎤
    ⎣ 1/D⎦      (D = M<sub>t</sub>·I<sub>p</sub> − M<sub>p</sub>²L²)</div>

    <h2>Why the System Is Unstable Open-Loop</h2>
    <p>
      Evaluating A's eigenvalues reveals one <span class="bad">positive real eigenvalue</span>
      ≈ +5.45 — a mode that grows exponentially. The controller must place all
      closed-loop poles in the <span class="ok">left half-plane</span> to achieve stability.
    </p>

    <h2>Runge-Kutta 4 Integration</h2>
    <p>
      Rather than a simple Euler step (which accumulates error), the simulator uses RK4 —
      a four-stage weighted average that is 4th-order accurate in time step DT:
    </p>
    <div class="eq">k₁ = f(xₙ,       F)
k₂ = f(xₙ+k₁·h/2, F)
k₃ = f(xₙ+k₂·h/2, F)
k₄ = f(xₙ+k₃·h,   F)
xₙ₊₁ = xₙ + h/6·(k₁ + 2k₂ + 2k₃ + k₄)     h = 0.005 s</div>
  `,

  ctrl: `
    <h2>What Every Controller Does</h2>
    <p>
      Each controller reads the current state x⃗ = [θ, ω, x, v] and outputs
      a single force F (Newtons) applied to the cart motor.
      The goal is always: <strong>θ → 0  and  x → setpoint</strong>.
    </p>

    <h2>① Cascaded PID</h2>
    <p>
      Two nested loops work together — the outer loop decides <em>where the rod should
      lean</em>, and the inner loop pushes the cart to achieve that lean.
    </p>
    <div class="eq"><b>Outer Loop — Cart Position → Target Angle</b>
posError  = x − x<sub>sp</sub>
i<sub>x</sub>        += posError · dt          (integral, clamped ±5)
θ<sub>target</sub>   = K<sub>x</sub>·posError + K<sub>v</sub>·v + K<sub>i</sub>·i<sub>x</sub>
            (clamped to ±0.25 rad ≈ ±14°)

<b>Inner Loop — Angle Error → Motor Force</b>
angleError = θ − θ<sub>target</sub>
F = −K<sub>p</sub>·angleError − K<sub>d</sub>·ω</div>
    <table>
      <tr><th>Gain</th><th>Default</th><th>Effect</th></tr>
      <tr><td>K<sub>p</sub></td><td>135</td><td>Proportional — snappy angle correction. Too high → oscillations.</td></tr>
      <tr><td>K<sub>d</sub></td><td>10</td><td>Derivative — damps angular velocity, acts as a brake.</td></tr>
      <tr><td>K<sub>x</sub></td><td>0.05</td><td>Outer P — how much to tilt for a given cart offset.</td></tr>
      <tr><td>K<sub>v</sub></td><td>0.10</td><td>Outer D — damps cart velocity to stop overshooting.</td></tr>
      <tr><td>K<sub>i</sub></td><td>0.02</td><td>Integral — eliminates steady-state drift from friction.</td></tr>
    </table>
    <p class="note">
      INTUITION: Think of the outer loop as "nudging the rod slightly forward" to make the
      cart drift toward the setpoint. The inner loop then chases that nudge angle at high
      bandwidth. The integral stops the cart from parking off-centre when friction balances
      the gravity restoring force.
    </p>

    <h2>② LQI (Linear-Quadratic-Integral)</h2>
    <p>
      LQR solves the infinite-horizon optimal control problem: minimise the cost
    </p>
    <div class="eq">J = ∫₀^∞ ( x⃗ᵀ Q x⃗ + u² R ) dt

Q = diag(Q<sub>θ</sub>, Q<sub>ω</sub>, Q<sub>x</sub>, Q<sub>v</sub>)   — penalises state deviations
R                                     — penalises control effort</div>
    <p>
      The solution is a constant gain matrix K found by solving the
      <em>algebraic Riccati equation</em>: P·A + Aᵀ·P − P·B·R⁻¹·Bᵀ·P + Q = 0,
      then K = R⁻¹·Bᵀ·P.
    </p>
    <div class="eq"><b>LQI Force</b>
F = K₁·θ + K₂·ω − K₃·(x−x<sub>sp</sub>) − K₄·v − K<sub>i</sub>·i<sub>x</sub>

Default gains (pre-computed offline):
  K₁ = −489.25  (angle)      K₂ = −36.10  (omega)
  K₃ = −44.72   (position)   K₄ = −66.47  (velocity)
  K<sub>i</sub> =   2.00   (integral drift correction)</div>
    <table>
      <tr><th>Gain sign</th><th>Meaning</th></tr>
      <tr><td>K₁ negative</td><td>When θ &gt; 0 (leaning left), apply negative force (push left — "catch" it).</td></tr>
      <tr><td>K₃ negative</td><td>When cart is right of setpoint, push left to return.</td></tr>
      <tr><td>K<sub>i</sub> positive</td><td>Accumulated drift error generates a slow corrective push.</td></tr>
    </table>
    <p class="note">
      INTUITION: LQR is like a globally optimal PID — it trades off all four states
      simultaneously instead of tuning loops separately. The Q/R weights are the design
      knobs: crank Q<sub>θ</sub> high to make the controller angle-aggressive, raise R
      to keep forces small (gentler motor).
    </p>

    <h2>③ MPC (Model Predictive Control)</h2>
    <p>
      MPC simulates N steps into the future for several candidate force sequences,
      picks the one with lowest predicted cost, and applies only the first force.
      This is called a <em>receding horizon</em> strategy.
    </p>
    <div class="eq"><b>At each time step:</b>
For each candidate F in {F<sub>nom</sub>−40, …, F<sub>nom</sub>+40}:
  Simulate N·Δt seconds ahead with RK4
  Cost c = Σ ( Q<sub>θ</sub>·θ² + Q<sub>θ₂</sub>·θ₂² + Q<sub>x</sub>·x² + … )
  If c &lt; best_cost → remember this F

Apply the best F.  Repeat next frame.</div>
    <p class="note">
      INTUITION: MPC "thinks ahead" like a chess player — it avoids moves that look good
      now but lead to disaster later. This is why it naturally handles the double pendulum's
      complex coupled dynamics where PID and LQR struggle.
    </p>

    <h2>Pole Placement Summary</h2>
    <p>
      All three controllers achieve stability by moving the closed-loop eigenvalues
      from the <span class="bad">unstable right half-plane</span> to the
      <span class="ok">stable left half-plane</span>:
    </p>
    <table>
      <tr><th>Controller</th><th>Method</th><th>Design effort</th><th>Optimality</th></tr>
      <tr><td>PID</td><td>Manual gain tuning</td><td>Low</td><td>Not guaranteed</td></tr>
      <tr><td>LQI</td><td>Riccati equation (offline)</td><td>Medium</td><td>Optimal for linear model</td></tr>
      <tr><td>MPC</td><td>Online optimisation</td><td>High (CPU)</td><td>Near-optimal, handles constraints</td></tr>
    </table>
  `
};

function openMath() {
  mathTabIdx = 0;
  renderMathModal();
  document.getElementById('mathModal').classList.add('open');
}

function closeMath() {
  document.getElementById('mathModal').classList.remove('open');
}

function renderMathModal() {
  // Tabs
  var tabBar = document.getElementById('mathTabs');
  tabBar.innerHTML = '';
  MATH_TABS.forEach(function(t, i) {
    var btn = document.createElement('button');
    btn.className = 'mtab' + (i === mathTabIdx ? ' active' : '');
    btn.textContent = t.label;
    btn.onclick = function() { mathTabIdx = i; renderMathModal(); };
    tabBar.appendChild(btn);
  });

  // Body
  document.getElementById('mathBody').innerHTML =
    MATH_CONTENT[MATH_TABS[mathTabIdx].id];
}

// Close on backdrop click
document.getElementById('mathModal').addEventListener('click', function(e) {
  if (e.target === this) closeMath();
});
