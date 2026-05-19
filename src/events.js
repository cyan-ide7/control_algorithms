// EVENTS
// ─────────────────────────────────────────────
document.getElementById('dChk').addEventListener('change', function(e) { distOn = e.target.checked; });
document.getElementById('doubleModeChk').addEventListener('change', function(e) {
  isDoubleMode = e.target.checked;
  resetSim();
});
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
document.getElementById('gHz').addEventListener('input', function(e) {
  simGaps.hz = parseInt(e.target.value);
  document.getElementById('gHzV').textContent = simGaps.hz + ' Hz';
});

// Init
renderCtrlBtns();
renderGains();
document.getElementById('cInfo').textContent = CTRLS[curCtrl].info;
lastWall = performance.now();
requestAnimationFrame(animate);

// Setup Resizers
(function() {
  const root = document.documentElement;

  function makeResizable(handlerId, isVertical, varName, isReverse) {
    const handler = document.getElementById(handlerId);
    if (!handler) return;
    
    let isDragging = false;
    
    handler.addEventListener('mousedown', function(e) {
      isDragging = true;
      document.body.style.cursor = isVertical ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none'; // Prevent text highlighting while dragging
      e.preventDefault(); 
    });
    
    window.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      
      if (isVertical) {
        // If it's the right panel (isReverse), width is window width minus mouse position
        let newWidth = isReverse ? window.innerWidth - e.clientX : e.clientX;
        // Clamp the width so it doesn't break the layout (min 150px, max 400px)
        newWidth = Math.max(150, Math.min(newWidth, 400)); 
        root.style.setProperty(varName, newWidth + 'px');
      } else {
        // Horizontal (Plots panel at the bottom)
        let newHeight = window.innerHeight - e.clientY;
        // Clamp height (min 80px, max half the screen)
        newHeight = Math.max(80, Math.min(newHeight, window.innerHeight * 0.5));
        root.style.setProperty(varName, newHeight + 'px');
      }
    });
    
    window.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    });
  }

  // Bind the three handlers
  makeResizable('drag-left', true, '--left-w', false);
  makeResizable('drag-right', true, '--right-w', true);
  makeResizable('drag-plots', false, '--plots-h', false);
})();
