// EVENTS
// ─────────────────────────────────────────────
document.getElementById('dChk').addEventListener('change', function(e) { distOn = e.target.checked; });
document.getElementById('dStr').addEventListener('input', function(e) {
  distStr = parseFloat(e.target.value);
  document.getElementById('dStrV').textContent = distStr.toFixed(1) + ' N';
});
document.getElementById('kick').addEventListener('click', function() {
  kickF = distStr * 5;
  if (hasFallen) resetSim();
});
document.getElementById('spSlider').addEventListener('input', function(e) {
  sp = parseFloat(e.target.value);
  document.getElementById('spV').textContent = sp.toFixed(2) + ' m';
  ctrlFn = CTRLS[curCtrl].make(params, sp);
});
document.getElementById('mpSlider').addEventListener('input', function(e) {
  Mp = parseFloat(e.target.value); rephy();
  document.getElementById('mpV').textContent = Mp.toFixed(3) + ' kg';
  bobRadius = 0.028 * Math.cbrt(Mp / 0.127);
  bob.geometry.dispose();
  bob.geometry = new THREE.SphereGeometry(bobRadius, 14, 14);
  ctrlFn = CTRLS[curCtrl].make(params, sp);
});
document.getElementById('mathBtn').addEventListener('click', openMath);

// Init
renderCtrlBtns();
renderGains();
document.getElementById('cInfo').textContent = CTRLS[curCtrl].info;
lastWall = performance.now();
requestAnimationFrame(animate);
