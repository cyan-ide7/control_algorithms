// PLOTS
// ─────────────────────────────────────────────
function drawPlot(id, data, label, unit, color, ymin, ymax, spV) {
  var c = document.getElementById(id); if (!c) return;
  var W = c.parentElement.clientWidth || 180, H = c.parentElement.clientHeight || 128;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#eceae4'; ctx.fillRect(0, 0, W, H);
  var mid = (ymax + ymin) / 2, range = ymax - ymin;
  var toY = function(v) { return H * 0.85 - clamp((v - mid) / range, -0.45, 0.45) * H * 0.9; };
  ctx.strokeStyle = '#d0cdc6'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(0, toY(0)); ctx.lineTo(W, toY(0)); ctx.stroke();
  if (spV !== undefined) {
    ctx.setLineDash([3, 3]); ctx.strokeStyle = '#b0aca4'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(0, toY(spV)); ctx.lineTo(W, toY(spV)); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (data.length > 1) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath();
    for (var i = 0; i < data.length; i++) {
      var px = i / (HIST - 1) * W, py = toY(data[i]);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#9e9b93'; ctx.font = '10px IBM Plex Mono,monospace'; ctx.fillText(label, 5, 13);
  if (data.length) {
    ctx.fillStyle = color; ctx.font = '500 11px IBM Plex Mono,monospace';
    ctx.textAlign = 'right'; ctx.fillText(data[data.length - 1].toFixed(2) + unit, W - 5, 13); ctx.textAlign = 'left';
  }
}

function drawPhase(pts, color) {
  var c = document.getElementById('pPh'); if (!c) return;
  var W = c.offsetWidth || 110, H = c.height || 88;
  if (c.width !== W) c.width = W;
  var ctx = c.getContext('2d');
  ctx.fillStyle = '#eceae4'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d0cdc6'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  ctx.fillStyle = '#c0bdb6'; ctx.font = '8px IBM Plex Mono,monospace';
  ctx.fillText('th>', W - 14, H / 2 - 2); ctx.fillText('om^', W / 2 + 2, 9);
  if (pts.length > 1) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.65; ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var px = clamp(W / 2 + pts[i][0] / 0.6 * W * 0.44, 1, W - 1);
      var py = clamp(H / 2 - pts[i][1] / 4 * H * 0.44, 1, H - 1);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
    var last = pts[pts.length - 1];
    var bx = clamp(W / 2 + last[0] / 0.6 * W * 0.44, 3, W - 3);
    var by = clamp(H / 2 - last[1] / 4 * H * 0.44, 3, H - 3);
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(bx, by, 3, 0, Math.PI * 2); ctx.fill();
  }
}

// ─────────────────────────────────────────────
