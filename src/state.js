// SIM STATE
var curCtrl = 'PID', params = {}, sp = 0, ctrlFn = null;
var isDoubleMode = false;
var S = { th: 0.06, om: 0, x: 0, v: 0, th2: 0, om2: 0 };
var kickF = 0, distOn = false, distStr = 3, bobPushF = 0;
var manualX = 0, isManual = false;
var MAX_CTRL_FORCE = 90;
var simGaps = {
  quantize: false, delay: 0, noise: 0,
  stiction: 0, deadzone: 0, hz: 500,
  backEMF: 0, wiring: 0
};
var fBuffer = [];
var lastCtrlT = 0, lastFVal = 0;
var simT = 0, lastWall = 0, fps = 60, fpsC = 0, fpsA = 0;
var DT = 0.005, HIST = 160;
var hist = { th: [], om: [], x: [], F: [], th2: [], om2: [] }, phaseHist = [], lastF = 0;
var hasFallen = false;
var bobRadius = 0.028;

// THREE.JS objects declared here so resetSim can access them
var floorMat, fallDisc;

function createStateVector(th, om, x, v, th2, om2) {
  return { th: th, om: om, x: x, v: v, th2: th2 || 0, om2: om2 || 0 };
}

function initialStateVector() {
  return createStateVector(0.06 + (Math.random() - 0.5) * 0.02, 0, 0, 0, (Math.random() - 0.5) * 0.02, 0);
}

function copyStateVector(s) {
  return createStateVector(s.th, s.om, s.x, s.v, s.th2, s.om2);
}

function makeCtrl() {
  var c = CTRLS[curCtrl];
  params = {};
  c.params.forEach(function(p) { params[p.id] = p.v; });
  return c.make(params, sp);
}

function resetSim() {
  S = initialStateVector();
  kickF = 0;
  bobPushF = 0;
  simT = 0;
  lastF = 0;
  hasFallen = false;
  fBuffer = [];
  lastCtrlT = 0;
  lastFVal = 0;
  hist = { th: [], om: [], x: [], F: [], th2: [], om2: [] };
  phaseHist = [];
  document.getElementById('failOverlay').style.display = 'none';
  if (floorMat) floorMat.color.setHex(0xe8e5dd);
  if (fallDisc) fallDisc.material.opacity = 0;
  ctrlFn = makeCtrl();
}

ctrlFn = makeCtrl();
