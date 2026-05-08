// MAIN LOOP
// ─────────────────────────────────────────────
var accum = 0;

function animate(now) {
  requestAnimationFrame(animate);
  var wall = Math.min((now - lastWall) / 1000, 0.05); lastWall = now;
  fpsC++; fpsA += wall;
  if (fpsA > 0.6) { fps = Math.round(fpsC / fpsA); fpsC = 0; fpsA = 0; }

  accum += wall;
  while (accum >= DT) {
    accum -= DT;
    if (!hasFallen) {
      var dist = 0;
      if (distOn) dist = (Math.sin(simT * 1.9 + 1.1) * 0.55 + Math.cos(simT * 3.1) * 0.35) * distStr;
      if (kickF) { dist += kickF; kickF = 0; }
      if (bobPushF) { dist += bobPushF; bobPushF = 0; }

      // 1. OBSERVE (Sim-to-Real gaps: noise and quantization)
      var obs = { th: S.th, om: S.om, x: S.x, v: S.v };
      if (simGaps.noise > 0) {
        obs.th += (Math.random() - 0.5) * simGaps.noise * 0.017; // deg to rad
        obs.x += (Math.random() - 0.5) * simGaps.noise * 0.005;
      }
      if (simGaps.quantize) {
        var stepTh = 0.006, stepX = 0.001; // 1024 PPR approx 0.35 deg
        obs.th = Math.round(obs.th / stepTh) * stepTh;
        obs.x = Math.round(obs.x / stepX) * stepX;
      }

      // 2. COMPUTE (at fixed sampling frequency)
      var F = lastFVal;
      if (simT >= lastCtrlT + (1 / simGaps.hz)) {
        F = clamp(ctrlFn(obs, DT), -20, 20);
        // Dead-zone
        if (Math.abs(F) < simGaps.deadzone) F = 0;
        lastFVal = F;
        lastCtrlT = simT;
      }
      
      // 3. DELAY (Transport delay)
      fBuffer.push(F);
      while (fBuffer.length > simGaps.delay + 1) fBuffer.shift();
      var appliedF = fBuffer[0] || 0;

      lastF = appliedF;
      S = rk4(S, appliedF + dist, DT);
      simT += DT;
      hist.th.push(S.th * 180 / Math.PI);
      hist.om.push(S.om * 180 / Math.PI);
      hist.x.push(S.x); hist.F.push(appliedF);
      phaseHist.push([S.th, S.om]);
      if (hist.th.length > HIST) { hist.th.shift(); hist.om.shift(); hist.x.shift(); hist.F.shift(); }
      if (phaseHist.length > HIST) phaseHist.shift();
      checkFall();
    } else {
      // Free fall under gravity, bounce off floor
      S = rk4(S, 0, DT);
      var bobY = 0.08 + Lp * 2 * Math.cos(S.th);
      var groundY = bobRadius + 0.002;
      if (bobY < groundY) {
        var thLim = Math.acos(clamp((0.08 - groundY) / (Lp * 2), -1, 1));
        if (Math.abs(S.th) > thLim) {
          S.th = Math.sign(S.th) * thLim;
          var isFallingDown = (S.th > 0 && S.om > 0) || (S.th < 0 && S.om < 0);
          if (isFallingDown) {
            var oldOm = S.om;
            S.om *= -0.5;
            S.v += oldOm * Math.sin(S.th) * (Mp / Mt) * 0.8;
            if (Math.abs(oldOm) > 1) impactPulse = 1.0;
          }
          S.v *= 0.98; S.om *= 0.99;
        }
      }
      simT += DT;
    }
  }

  // Push indicator fade
  if (pushTimer > 0) {
    pushTimer -= wall;
    pushIndicator.material.opacity = Math.max(0, pushTimer / 0.5 * 0.85);
  }

  // 3D positions
  cartGrp.position.x = S.x;
  pendGrp.rotation.z = S.th;

  // Manual marker
  if (curCtrl === 'Manual') {
    manualMarker.position.x = manualX;
    manualMarker.material.opacity = 0.5;
  } else {
    manualMarker.material.opacity = 0;
  }

  // Force arrow
  var fmag = Math.abs(lastF);
  arrGrp.visible = !hasFallen && fmag > 0.3;
  if (!hasFallen && fmag > 0.3) {
    var len = Math.min(0.55, fmag / 14);
    var dir = Math.sign(lastF);
    arrShaft.scale.x = len;
    arrShaft.position.set(S.x + dir * len / 2, 0.04, 0);
    arrHead.position.set(S.x + dir * len, 0.04, 0);
    arrHead.rotation.z = lastF > 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  // Bob world pos for trail and fall disc
  var bobWP = new THREE.Vector3(); bob.getWorldPosition(bobWP);
  trailPts[tIdx % TLEN].copy(bobWP); tIdx++;
  var tord = []; for (var i = 0; i < TLEN; i++) tord.push(trailPts[(tIdx + i) % TLEN].clone());
  trailGeo.setFromPoints(tord); trailGeo.attributes.position.needsUpdate = true;

  if (hasFallen) {
    fallDisc.position.set(bobWP.x, 0.002, bobWP.z);
    impactPulse = Math.max(0, impactPulse - wall * 2);
    var s = 1 + impactPulse * 0.5;
    fallDisc.scale.set(s, s, s);
    fallDisc.material.opacity = 0.3 + impactPulse * 0.4;
    floorMat.color.setHex(0xd8c8c0);
  }

  // Bob appearance
  var danger = hasFallen || Math.abs(S.th) > 0.3;
  bobMat.color.setHex(danger ? 0xc0392b : 0xd04040);
  bobMat.emissive.setHex(hasFallen ? 0x500000 : danger ? 0x300000 : 0x100000);
  bobMat.emissiveIntensity = hasFallen ? 0.55 : danger ? 0.2 : 0.07;

  updateCam();
  renderer.render(scene, cam);

  var cc = CTRLS[curCtrl].hex;
  drawPlot('pA', hist.th, 'angle', 'deg', cc, -65, 65, 0);
  drawPlot('pO', hist.om, 'ang vel', 'deg/s', '#6b6860', -150, 150, 0);
  drawPlot('pX', hist.x, 'cart x', 'm', '#5b3a8a', -RAIL, RAIL, sp);
  drawPlot('pF', hist.F, 'force', 'N', '#b85c00', -22, 22, 0);
  drawPhase(phaseHist, cc);
  updateRight(lastF);
  document.getElementById('hT').textContent = 't = ' + simT.toFixed(2) + ' s';
  document.getElementById('hA').textContent = 'theta = ' + (S.th * 180 / Math.PI).toFixed(1) + 'deg';
  document.getElementById('hF').textContent = fps + ' fps';
}

// ─────────────────────────────────────────────
