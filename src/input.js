// MOUSE ORBIT + BOB CLICK
// ─────────────────────────────────────────────
var camPhi = Math.PI / 2 - 0.18, camTheta = 0, camR = 4.2;
var drag = false, mx0 = 0, my0 = 0, dragged = false;
var ray = new THREE.Raycaster(), mouse2 = new THREE.Vector2();

function updateCam() {
  cam.position.set(
    camR * Math.sin(camPhi) * Math.sin(camTheta),
    camR * Math.cos(camPhi) + 0.3,
    camR * Math.sin(camPhi) * Math.cos(camTheta)
  );
  cam.lookAt(0, 0.35, 0);
}

canvas3d.addEventListener('mousedown', function(e) { drag = true; dragged = false; mx0 = e.clientX; my0 = e.clientY; });
window.addEventListener('mouseup', function(e) {
  if (!dragged) {
    var rect = canvas3d.getBoundingClientRect();
    mouse2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(mouse2, cam);
    var targetBob = typeof isDoubleMode !== 'undefined' && isDoubleMode ? bob2 : bob;
    var hits = ray.intersectObject(targetBob, false);
    if (hits.length > 0) {
      var ang = Math.random() * Math.PI * 2;
      if (typeof isDoubleMode !== 'undefined' && isDoubleMode) {
        S.om2 += (distStr * 0.8) / Math.max(0.01, Ip2) / Lp2 * 0.03;
      } else {
        S.om += (distStr * 0.8) / Math.max(0.01, Ip) / Lp * 0.03;
      }
      bobPushF = Math.cos(ang) * distStr * 0.4;
      var bwp = new THREE.Vector3(); 
      targetBob.getWorldPosition(bwp);
      pushIndicator.position.copy(bwp);
      pushIndicator.material.opacity = 0.85;
      pushTimer = 0.5;
    }
  }
  drag = false;
});
window.addEventListener('mousemove', function(e) {
  var rect = canvas3d.getBoundingClientRect();
  mouse2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  mouse2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

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
