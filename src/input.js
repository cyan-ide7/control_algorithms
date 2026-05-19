// MOUSE ORBIT + BOB CLICK + CARRY MODE
// ─────────────────────────────────────────────
var camPhi = Math.PI / 2 - 0.18, camTheta = 0, camR = 4.2;
var drag = false, mx0 = 0, my0 = 0, dragged = false;
var ray = new THREE.Raycaster(), mouse2 = new THREE.Vector2();

// ── Carry state ──────────────────────────────
var carryMode = false;          // true while the user is holding bob2
var carryWorldPos = new THREE.Vector3(); // where bob2 is being dragged to

// Ghost sphere that shows carry position
var carryGhost = new THREE.Mesh(
  new THREE.SphereGeometry(0.035, 14, 14),
  new THREE.MeshPhongMaterial({
    color: 0x00e5ff, emissive: 0x005566, emissiveIntensity: 0.5,
    transparent: true, opacity: 0.65, wireframe: false
  })
);
scene.add(carryGhost);
carryGhost.visible = false;

// Helper: given a world XY position for bob2, back-solve th and th2
function anglesFromBob2World(wx, wy) {
  var pivotY = 0.08;              // pivot height above floor
  var L1 = Lp * 2;               // rod-1 full length
  var L2 = Lp2 * 2;              // rod-2 full length
  var cx  = S.x;                  // cart x stays where it is

  // --- Solve th from the intermediate hinge position ---
  // We want hinge1 somewhere on the circle of radius L1 around (cx, pivotY)
  // and bob2 on the circle of radius L2 around hinge1.
  // Strategy: place hinge1 as close to (wx, wy) as physics allows, then
  // compute th and th2 analytically.

  var dx = wx - cx;
  var dy = wy - pivotY;
  var dist = Math.sqrt(dx * dx + dy * dy);

  var th, th2;

  if (dist <= L1 + L2) {
    // Standard two-link IK
    // Sign convention from physics.js: bob_x = cart_x - L*sin(th)
    // So we must use atan2(-dx, dy) — negate x component
    var cosAlpha = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1);
    var alpha = Math.acos(cosAlpha);
    var beta = Math.atan2(-dx, dy); // negated: rightward mouse → negative th (lean right)
    // Choose elbow-up configuration
    th = beta - alpha;
    // Hinge1 world position using correct convention
    var h1x = cx - L1 * Math.sin(th);
    var h1y = pivotY + L1 * Math.cos(th);
    // th2 from hinge1 to target — same sign convention
    var d2x = wx - h1x;
    var d2y = wy - h1y;
    th2 = Math.atan2(-d2x, d2y); // negated for same reason
  } else {
    // Target too far — fully extend both links toward target
    th = Math.atan2(-dx, dy);
    th2 = th;
  }

  // Clamp to reasonable angles (within ±150° — don't let it go fully inverted at base)
  th  = clamp(th,  -Math.PI * 0.95, Math.PI * 0.95);
  th2 = clamp(th2, -Math.PI * 0.95, Math.PI * 0.95);

  return { th: th, th2: th2 };
}

// Called every frame by loop.js to snap the pendulum to the carry position
function updateCarry() {
  // Move the ghost to the world carry position
  carryGhost.position.copy(carryWorldPos);

  if (isDoubleMode) {
    // Double pendulum: back-solve both angles via IK
    var ang = anglesFromBob2World(carryWorldPos.x, carryWorldPos.y);
    S.th  = ang.th;
    S.th2 = ang.th2;
  } else {
    // Single pendulum: back-solve th from bob world position
    var pivotY = 0.08;
    var L = Lp * 2;
    var dx = carryWorldPos.x - S.x;
    var dy = carryWorldPos.y - pivotY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    // Clamp to rod length
    if (dist > L) { dx *= L / dist; dy *= L / dist; }
    S.th = Math.atan2(-dx, dy); // negated x: sign convention bob_x = cart_x - L*sin(th)
  }
  S.om  = 0;
  S.om2 = 0;
  S.v   = 0;
}

function updateCam() {
  cam.position.set(
    camR * Math.sin(camPhi) * Math.sin(camTheta),
    camR * Math.cos(camPhi) + 0.3,
    camR * Math.sin(camPhi) * Math.cos(camTheta)
  );
  cam.lookAt(0, 0.35, 0);
}

canvas3d.addEventListener('mousedown', function(e) {
  // In carry mode the left click releases the bob — don't start camera drag
  if (carryMode) return;
  drag = true; dragged = false; mx0 = e.clientX; my0 = e.clientY;
});

canvas3d.addEventListener('click', function(e) {
  var rect = canvas3d.getBoundingClientRect();
  mouse2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(mouse2, cam);

  // ── RELEASE (second click) — works for both modes ──────────────
  if (carryMode) {
    carryMode = false;
    carryGhost.visible = false;
    S.om  = 0;
    S.om2 = 0;
    S.v   = 0;
    hasFallen = false;
    if (floorMat) floorMat.color.setHex(0xe8e5dd);
    document.getElementById('failOverlay').style.display = 'none';
    return;
  }

  if (!dragged) {
    // ── DOUBLE MODE: pick up bob2 ──
    if (isDoubleMode) {
      var hits2 = ray.intersectObject(bob2, false);
      if (hits2.length > 0) {
        carryMode = true;
        carryGhost.visible = true;
        bob2.getWorldPosition(carryWorldPos);
        return;
      }
    } else {
      // ── SINGLE MODE: pick up bob ──
      var hits1 = ray.intersectObject(bob, false);
      if (hits1.length > 0) {
        carryMode = true;
        carryGhost.visible = true;
        bob.getWorldPosition(carryWorldPos);
        return;
      }
    }
  }
});

window.addEventListener('mouseup', function(e) {
  drag = false;
});
window.addEventListener('mousemove', function(e) {
  var rect = canvas3d.getBoundingClientRect();
  mouse2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  // ── In carry mode: project mouse onto Z=0 plane (works for both single and double) ──
  if (carryMode) {
    ray.setFromCamera(mouse2, cam);
    var planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    var pt = new THREE.Vector3();
    if (ray.ray.intersectPlane(planeZ, pt)) {
      carryWorldPos.set(pt.x, Math.max(0.05, pt.y), 0);
    }
    return; // don't orbit camera while carrying
  }

  if (curCtrl === 'Manual') {
    ray.setFromCamera(mouse2, cam);
    // Intersection with plane Y = 0.04 (track level)
    var normal = new THREE.Vector3(0, 1, 0);
    var plane = new THREE.Plane(normal, -0.04);
    var point = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, point)) {
      manualX = clamp(point.x, -RAIL_LIMIT, RAIL_LIMIT);
    }
  }

  if (!drag) return;
  var dx = e.clientX - mx0, dy = e.clientY - my0;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
  camTheta -= dx * 0.007; camPhi = clamp(camPhi - dy * 0.007, 0.1, 1.4);
  mx0 = e.clientX; my0 = e.clientY;
});
canvas3d.addEventListener('wheel', function(e) { e.preventDefault(); camR = clamp(camR + e.deltaY * 0.008, 1.5, 10); }, { passive: false });
canvas3d.addEventListener('touchstart', function(e) { drag = true; dragged = false; mx0 = e.touches[0].clientX; my0 = e.touches[0].clientY; });
canvas3d.addEventListener('touchend', function() { drag = false; });
canvas3d.addEventListener('touchmove', function(e) {
  e.preventDefault(); dragged = true;
  camTheta -= (e.touches[0].clientX - mx0) * 0.009;
  camPhi = clamp(camPhi - (e.touches[0].clientY - my0) * 0.009, 0.1, 1.4);
  mx0 = e.touches[0].clientX; my0 = e.touches[0].clientY;
}, { passive: false });

// ─────────────────────────────────────────────
