// UI
// ─────────────────────────────────────────────
function renderCtrlBtns() {
  var cont = document.getElementById('cBtns'); cont.innerHTML = '';
  Object.keys(CTRLS).forEach(function(k) {
    var c = CTRLS[k];
    var btn = document.createElement('button');
    btn.className = 'cbtn' + (k === curCtrl ? ' active' : '');
    var dot = document.createElement('span'); dot.className = 'cdot'; dot.style.background = c.hex;
    btn.appendChild(dot); btn.appendChild(document.createTextNode(c.label));
    btn.onclick = function() { 
      if (k === 'Manual' && curCtrl !== 'Manual') {
        startManualCountdown();
        return;
      }
      curCtrl = k; 
      if (k === 'Manual') manualX = S.x;
      ctrlFn = makeCtrl(); 
      renderCtrlBtns(); 
      renderGains(); 
      document.getElementById('ctrlInfo').textContent = c.info; 
    };
    cont.appendChild(btn);
  });
}

var countdownActive = false;
function startManualCountdown() {
  if (countdownActive) return;
  countdownActive = true;
  var overlay = document.getElementById('countOverlay');
  var text = document.getElementById('countText');
  overlay.style.display = 'flex';
  var count = 3;
  text.textContent = count;
  
  var interval = setInterval(function() {
    count--;
    if (count > 0) {
      text.textContent = count;
    } else {
      clearInterval(interval);
      overlay.style.display = 'none';
      countdownActive = false;
      curCtrl = 'Manual';
      manualX = S.x;
      ctrlFn = makeCtrl();
      renderCtrlBtns();
      renderGains();
      document.getElementById('ctrlInfo').textContent = CTRLS['Manual'].info;
    }
  }, 1000);
}

// Initial info
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('ctrlInfo').textContent = CTRLS[curCtrl].info;
});

function renderGains() {
  var cont = document.getElementById('gPanel'); cont.innerHTML = '';
  CTRLS[curCtrl].params.forEach(function(p) {
    var d = document.createElement('div'); d.className = 'gr';
    d.innerHTML = '<div class="gm"><span class="gn">' + p.l + '</span><span class="gv" id="gv_' + p.id + '">' + params[p.id].toFixed(2) + '</span></div><input type="range" min="' + p.min + '" max="' + p.max + '" step="' + p.s + '" value="' + params[p.id] + '">';
    d.querySelector('input').addEventListener('input', function(e) {
      params[p.id] = parseFloat(e.target.value);
      var el = document.getElementById('gv_' + p.id); if (el) el.textContent = params[p.id].toFixed(2);
      ctrlFn = CTRLS[curCtrl].make(params, sp);
    });
    cont.appendChild(d);
  });
}

function updateRight(F) {
  var deg = S.th * 180 / Math.PI;
  var stable = !hasFallen && Math.abs(deg) < 7;
  var col = hasFallen ? '#c0392b' : stable ? '#2a6b3c' : Math.abs(deg) < 25 ? '#b85c00' : '#c0392b';
  document.getElementById('statusBig').style.color = col;
  document.getElementById('statusBig').textContent = hasFallen ? 'FALLEN' : stable ? 'BALANCED' : 'UNSTABLE';
  var dotEl = document.getElementById('dot');
  if (dotEl) dotEl.style.background = hasFallen ? '#c0392b' : stable ? '#4a4' : '#b85c00';
  var rows = [
    ['theta', deg.toFixed(2), 'deg'],
    ['omega', (S.om * 180 / Math.PI).toFixed(1), 'deg/s'],
    ['x', S.x.toFixed(3), 'm'],
    ['xdot', S.v.toFixed(3), 'm/s'],
    ['F', F.toFixed(2), 'N'],
    ['mp', Mp.toFixed(3), 'kg'],
    ['t', simT.toFixed(1), 's']
  ];
  document.getElementById('sPanel').innerHTML = rows.map(function(r) {
    return '<div class="sr"><span class="sk">' + r[0] + '</span><span class="sv">' + r[1] + '<span style="font-size:8px;color:#9e9b93"> ' + r[2] + '</span></span></div>';
  }).join('');
  var err = Math.abs(deg);
  var perf = [
    ['|theta|', err.toFixed(2) + 'deg', err < 2 ? '#2a6b3c' : err < 12 ? '#b85c00' : '#c0392b'],
    ['|F|', Math.abs(F).toFixed(2) + ' N', '#1a4f7a'],
    ['|x|', Math.abs(S.x).toFixed(3) + ' m', '#5b3a8a']
  ];
  document.getElementById('perfPanel').innerHTML = perf.map(function(r) {
    return '<div class="sr"><span class="sk">' + r[0] + '</span><span class="sv" style="color:' + r[2] + '">' + r[1] + '</span></div>';
  }).join('');
}

// ─────────────────────────────────────────────
