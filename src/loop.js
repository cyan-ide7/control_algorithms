// MAIN LOOP
var accum = 0;

function computeDisturbanceForce() {
  var dist = 0;
  if (distOn) dist = (Math.sin(simT * 1.9 + 1.1) * 0.55 + Math.cos(simT * 3.1) * 0.35) * distStr;
  if (kickF) { dist += kickF; kickF = 0; }
  if (bobPushF) { dist += bobPushF; bobPushF = 0; }
  return dist;
}

function observeStateVector(s) {
  var obs = copyStateVector(s);
  if (simGaps.noise > 0) {
    obs.th += (Math.random() - 0.5) * simGaps.noise * 0.017;
    obs.x += (Math.random() - 0.5) * simGaps.noise * 0.005;
  }
  if (simGaps.quantize) {
    var stepTh = 0.006;
    var stepX = 0.001;
    obs.th = Math.round(obs.th / stepTh) * stepTh;
    obs.x = Math.round(obs.x / stepX) * stepX;
  }
  return obs;
}

function computeControlForce(obs) {
  var F = lastFVal;
  if (simT >= lastCtrlT + (1 / simGaps.hz)) {
    F = clamp(ctrlFn(obs, DT), -MAX_CTRL_FORCE, MAX_CTRL_FORCE);
    if (Math.abs(F) < simGaps.deadzone) F = 0;
    lastFVal = F;
    lastCtrlT = simT;
  }

  fBuffer.push(F);
  while (fBuffer.length > simGaps.delay + 1) fBuffer.shift();
  return fBuffer[0] || 0;
}

function recordSimulationHistory(F) {
  hist.th.push(S.th * 180 / Math.PI);
  hist.om.push(S.om * 180 / Math.PI);
  hist.x.push(S.x);
  hist.F.push(F);
  hist.th2.push(S.th2 * 180 / Math.PI);
  hist.om2.push(S.om2 * 180 / Math.PI);
  phaseHist.push([S.th, S.om]);
  if (hist.th.length > HIST) {
    hist.th.shift();
    hist.om.shift();
    hist.x.shift();
    hist.F.shift();
    hist.th2.shift();
    hist.om2.shift();
  }
  if (phaseHist.length > HIST) phaseHist.shift();
}

function stepBalancedSimulation() {
  var disturbanceF = computeDisturbanceForce();
  var observedState = observeStateVector(S);
  var appliedF = computeControlForce(observedState);

  lastF = appliedF;
  S = rk4(S, appliedF + disturbanceF, DT);
  simT += DT;
  recordSimulationHistory(appliedF);
  checkFall();
}

function stepFallenSimulation() {
  S = rk4(S, 0, DT);
  var rodLength = Lp * 2;
  var pivotY = 0.08;
  var groundY = bobRadius + 0.002;
  
  if (isDoubleMode) {
    var bob1Y = pivotY + rodLength * Math.cos(S.th);
    var bob2Y = bob1Y + (Lp2 * 2) * Math.cos(S.th2);
    
    // Joint 1 hits the floor
    if (bob1Y < groundY) {
      var thLim1 = Math.acos(clamp((groundY - pivotY) / rodLength, -1, 1));
      if (Math.abs(S.th) > thLim1) {
        S.th = Math.sign(S.th) * thLim1;
        S.om *= -0.32;
        S.v *= 0.992;
        bob1Y = pivotY + rodLength * Math.cos(S.th);
        bob2Y = bob1Y + (Lp2 * 2) * Math.cos(S.th2);
      }
    }
    
    // Bob 2 hits the floor
    if (bob2Y < groundY) {
      var diffY = groundY - bob1Y;
      var thLim2 = Math.acos(clamp(diffY / (Lp2 * 2), -1, 1));
      if (Math.abs(S.th2) > thLim2) {
        S.th2 = Math.sign(S.th2) * thLim2;
        var bob2Vy = -rodLength * Math.sin(S.th) * S.om - (Lp2 * 2) * Math.sin(S.th2) * S.om2;
        if (bob2Vy < 0) {
          S.om2 *= -0.32;
          S.om *= 0.8;
          S.v *= 0.992;
          if (Math.abs(S.om2) > 0.8) impactPulse = 1.0;
        }
        S.v *= 0.992;
        S.om *= 0.985;
        S.om2 *= 0.985;
      }
    }
  } else {
    var bobPos = pendulumCartesian(S, S.x, pivotY, rodLength);
    if (bobPos.y < groundY) {
      var thLim = Math.acos(clamp((groundY - pivotY) / rodLength, -1, 1));
      if (Math.abs(S.th) > thLim) {
        S.th = Math.sign(S.th) * thLim;
        bobPos = pendulumCartesian(S, S.x, pivotY, rodLength);

        var bobVy = -rodLength * Math.sin(S.th) * S.om;
        var bobVx = S.v - rodLength * Math.cos(S.th) * S.om;
        if (bobVy < 0) {
          var oldOm = S.om;
          var oldBobVx = bobVx;
          S.om *= -0.32;
          S.v += (oldOm - S.om) * rodLength * Math.cos(S.th) * (Mp / Mt) * 0.22;
          S.v += (oldBobVx - bobVx) * 0.04;
          if (Math.abs(oldOm) > 0.8) impactPulse = 1.0;
        }
        S.v *= 0.992;
        S.om *= 0.985;
      }
    }
  }
  simT += DT;
}

function animate(now) {
  requestAnimationFrame(animate);
  var wall = Math.min((now - lastWall) / 1000, 0.05);
  lastWall = now;
  fpsC++;
  fpsA += wall;
  if (fpsA > 0.6) {
    fps = Math.round(fpsC / fpsA);
    fpsC = 0;
    fpsA = 0;
  }

  accum += wall;
  while (accum >= DT) {
    accum -= DT;
    if (!hasFallen) stepBalancedSimulation();
    else stepFallenSimulation();
  }

  if (pushTimer > 0) {
    pushTimer -= wall;
    pushIndicator.material.opacity = Math.max(0, pushTimer / 0.5 * 0.85);
  }

  cartGrp.position.x = S.x;
  pendGrp.rotation.z = S.th;
  
  if (typeof pendGrp2 !== 'undefined') {
    if (isDoubleMode) {
      pendGrp2.visible = true;
      pendGrp2.rotation.z = S.th2 - S.th;
      bob.visible = false;
    } else {
      pendGrp2.visible = false;
      bob.visible = true;
    }
  }

  if (curCtrl === 'Manual') {
    manualMarker.position.x = manualX;
    manualMarker.material.opacity = 0.5;
  } else {
    manualMarker.material.opacity = 0;
  }

  var fmag = Math.abs(lastF);
  arrGrp.visible = !hasFallen && fmag > 0.3;
  if (!hasFallen && fmag > 0.3) {
    var len = Math.min(0.55, fmag / (MAX_CTRL_FORCE * 0.7));
    var dir = Math.sign(lastF);
    arrShaft.scale.x = len;
    arrShaft.position.set(S.x + dir * len / 2, 0.04, 0);
    arrHead.position.set(S.x + dir * len, 0.04, 0);
    arrHead.rotation.z = lastF > 0 ? -Math.PI / 2 : Math.PI / 2;
  }

  var bobWP = new THREE.Vector3();
  if (isDoubleMode && typeof bob2 !== 'undefined') {
    bob2.getWorldPosition(bobWP);
  } else {
    bob.getWorldPosition(bobWP);
  }
  trailPts[tIdx % TLEN].copy(bobWP);
  tIdx++;
  var tord = [];
  for (var i = 0; i < TLEN; i++) tord.push(trailPts[(tIdx + i) % TLEN].clone());
  trailGeo.setFromPoints(tord);
  trailGeo.attributes.position.needsUpdate = true;

  if (hasFallen) {
    fallDisc.position.set(bobWP.x, 0.002, bobWP.z);
    impactPulse = Math.max(0, impactPulse - wall * 2);
    var s = 1 + impactPulse * 0.5;
    fallDisc.scale.set(s, s, s);
    fallDisc.material.opacity = 0.3 + impactPulse * 0.4;
    floorMat.color.setHex(0xd8c8c0);
  }

  var danger = hasFallen || Math.abs(S.th) > 0.3;
  bobMat.color.setHex(danger ? 0xc0392b : 0xd04040);
  bobMat.emissive.setHex(hasFallen ? 0x500000 : danger ? 0x300000 : 0x100000);
  bobMat.emissiveIntensity = hasFallen ? 0.55 : danger ? 0.2 : 0.07;

  if (typeof bob2Mat !== 'undefined') {
    bob2Mat.color.copy(bobMat.color);
    bob2Mat.emissive.copy(bobMat.emissive);
    bob2Mat.emissiveIntensity = bobMat.emissiveIntensity;
  }

  if (distOn) {
    var windForce = (Math.sin(simT * 1.9 + 1.1) * 0.55 + Math.cos(simT * 3.1) * 0.35) * distStr;
    windGrp.visible = true;
    for (var i = 0; i < windLines.length; i++) {
      var wl = windLines[i];
      wl.position.x += windForce * wl.userData.speedOffset * wall * 0.6;
      if (wl.position.x > 4) wl.position.x -= 8;
      if (wl.position.x < -4) wl.position.x += 8;
      wl.material.opacity = Math.min(0.6, Math.abs(windForce) * 0.15);
      wl.scale.x = Math.sign(windForce) || 1;
    }
  } else {
    windGrp.visible = false;
  }

  updateCam();
  renderer.render(scene, cam);

  var cc = CTRLS[curCtrl].hex;
  drawPlot('pA', hist.th, 'angle', 'deg', cc, -65, 65, 0);
  drawPlot('pO', hist.om, 'ang vel', 'deg/s', '#6b6860', -150, 150, 0);
  drawPlot('pX', hist.x, 'cart x', 'm', '#5b3a8a', -RAIL, RAIL, sp);
  drawPlot('pF', hist.F, 'force', 'N', '#b85c00', -(MAX_CTRL_FORCE + 2), MAX_CTRL_FORCE + 2, 0);
  drawPhase(phaseHist, cc);
  updateRight(lastF);
  document.getElementById('hT').textContent = 't = ' + simT.toFixed(2) + ' s';
  document.getElementById('hA').textContent = 'theta = ' + (S.th * 180 / Math.PI).toFixed(1) + 'deg';
  document.getElementById('hF').textContent = fps + ' fps';
}
