// FALL DETECTION
// ─────────────────────────────────────────────
function checkFall() {
  if (hasFallen) return;
  var deg = Math.abs(S.th) * 180 / Math.PI;
  var bobY = 0.08 + Lp * 2 * Math.cos(S.th);
  if (deg > 72 || bobY <= bobRadius + 0.005) {
    hasFallen = true;
    var rec = recGains();
    var ctrl = CTRLS[curCtrl];
    var gainHTML = '<div><span class="fl">Controller: </span><span class="fv">' + curCtrl + '</span></div>';
    ctrl.params.forEach(function(p) {
      gainHTML += '<div><span class="fl">' + p.l + ': </span><span class="fv">' + params[p.id].toFixed(2) + '</span></div>';
    });
    var reason = deg > 72
      ? 'Angle reached ' + deg.toFixed(0) + '°, exceeding the 72° recovery limit. Gains were insufficient for mp = ' + Mp.toFixed(3) + ' kg.'
      : 'Bob contacted the ground — rod swept past horizontal.';
    document.getElementById('failReason').textContent = reason;
    document.getElementById('failGains').innerHTML = gainHTML;
    document.getElementById('failMp').textContent = Mp.toFixed(3);
    document.getElementById('suggestGains').innerHTML =
      '<div><span class="fl">Kp (angle): </span><span class="fg">' + rec.Kp + '</span></div>' +
      '<div><span class="fl">Kd (rate):  </span><span class="fg">' + rec.Kd + '</span></div>' +
      '<div><span class="fl">Ki (integ): </span><span class="fg">' + rec.Ki + '</span></div>' +
      '<div><span class="fl">Kx (cart):  </span><span class="fg">' + rec.Kx + '</span></div>';
    document.getElementById('failOverlay').style.display = 'flex';
    floorMat.color.setHex(0xd8c8c0);
  }
}

function applyRecommended() {
  var rec = recGains();
  curCtrl = 'PID';
  var c = CTRLS['PID']; params = {};
  c.params.forEach(function(p) {
    params[p.id] = p.id === 'Kp' ? rec.Kp : p.id === 'Kd' ? rec.Kd : p.id === 'Ki' ? rec.Ki : p.id === 'Kx' ? rec.Kx : p.v;
  });
  ctrlFn = c.make(params, sp);
  renderCtrlBtns(); renderGains();
  document.getElementById('cInfo').textContent = c.info;
  resetSim();
}

// ─────────────────────────────────────────────
