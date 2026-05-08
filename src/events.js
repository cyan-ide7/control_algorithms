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
document.getElementById('gQuant').addEventListener('change', function(e) { simGaps.quantize = e.target.checked; });
document.getElementById('gNoise').addEventListener('input', function(e) {
  simGaps.noise = parseFloat(e.target.value);
  document.getElementById('gNoiseV').textContent = simGaps.noise.toFixed(1);
});
document.getElementById('gDelay').addEventListener('input', function(e) {
  simGaps.delay = parseInt(e.target.value);
  document.getElementById('gDelayV').textContent = (simGaps.delay * DT * 1000).toFixed(0) + ' ms';
});
document.getElementById('gStic').addEventListener('input', function(e) {
  simGaps.stiction = parseFloat(e.target.value);
  document.getElementById('gSticV').textContent = simGaps.stiction.toFixed(1) + ' N';
});
document.getElementById('gDead').addEventListener('input', function(e) {
  simGaps.deadzone = parseFloat(e.target.value);
  document.getElementById('gDeadV').textContent = simGaps.deadzone.toFixed(1) + ' N';
});
document.getElementById('gHz').addEventListener('input', function(e) {
  simGaps.hz = parseInt(e.target.value);
  document.getElementById('gHzV').textContent = simGaps.hz + ' Hz';
});
document.getElementById('gEmf').addEventListener('input', function(e) {
  simGaps.backEMF = parseFloat(e.target.value);
  document.getElementById('gEmfV').textContent = simGaps.backEMF.toFixed(1);
});
document.getElementById('gWire').addEventListener('input', function(e) {
  simGaps.wiring = parseFloat(e.target.value);
  document.getElementById('gWireV').textContent = simGaps.wiring.toFixed(1);
});

// Init
renderCtrlBtns();
renderGains();
document.getElementById('cInfo').textContent = CTRLS[curCtrl].info;
lastWall = performance.now();
requestAnimationFrame(animate);
