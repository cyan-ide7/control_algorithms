// THREE.JS SCENE
// ─────────────────────────────────────────────
var midEl = document.getElementById('mid');
var canvas3d = document.getElementById('c3d');
var renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

var scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f2ed);
scene.fog = new THREE.Fog(0xf4f2ed, 9, 24);

var cam = new THREE.PerspectiveCamera(42, 1, 0.01, 40);
cam.position.set(0, 0.5, 4.2);
cam.lookAt(0, 0.35, 0);

function resizeCam() {
  var W = midEl.clientWidth, H = midEl.clientHeight;
  renderer.setSize(W, H); cam.aspect = W / H; cam.updateProjectionMatrix();
}
resizeCam();
new ResizeObserver(resizeCam).observe(midEl);

// Lights
scene.add(new THREE.AmbientLight(0xf0ece4, 0.75));
var sun = new THREE.DirectionalLight(0xfff8f0, 1.1);
sun.position.set(3, 7, 4); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -5; sun.shadow.camera.right = 5;
sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -1;
scene.add(sun);
var fill = new THREE.DirectionalLight(0xe8f4ff, 0.3);
fill.position.set(-4, 2, -3); scene.add(fill);

// Floor — solid, darkens on fall
floorMat = new THREE.MeshLambertMaterial({ color: 0xe8e5dd });
var floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 10), floorMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
var grid = new THREE.GridHelper(16, 32, 0xd8d5cd, 0xd8d5cd);
grid.position.y = 0.001; scene.add(grid);

// Track
var trackBase = new THREE.Mesh(
  new THREE.BoxGeometry(RAIL * 2, 0.018, 0.12),
  new THREE.MeshLambertMaterial({ color: 0xd2cfc8 })
);
trackBase.position.set(0, 0.009, 0); trackBase.receiveShadow = true; scene.add(trackBase);
var railMat = new THREE.MeshPhongMaterial({ color: 0xaaa69e, shininess: 60 });
[-0.045, 0.045].forEach(function(z) {
  var r = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, RAIL * 2, 8), railMat);
  r.rotation.z = Math.PI / 2; r.position.set(0, 0.022, z); r.castShadow = true; scene.add(r);
});
var stopMat = new THREE.MeshLambertMaterial({ color: 0xb02020 });
[-RAIL, RAIL].forEach(function(x) {
  var s = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.14), stopMat);
  s.position.set(x, 0.03, 0); scene.add(s);
});

// Cart
var cartGrp = new THREE.Group(); scene.add(cartGrp);
var cartBody = new THREE.Mesh(
  new THREE.BoxGeometry(0.22, 0.08, 0.1),
  new THREE.MeshPhongMaterial({ color: 0x2c3e6b, shininess: 30 })
);
cartBody.position.y = 0.04; cartBody.castShadow = true; cartGrp.add(cartBody);
var wMat = new THREE.MeshPhongMaterial({ color: 0x6a6660, shininess: 50 });
[-0.08, 0.08].forEach(function(x) {
  var w = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.11, 12), wMat);
  w.rotation.x = Math.PI / 2; w.position.set(x, 0.018, 0); w.castShadow = true; cartGrp.add(w);
});
var pivotMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.012, 0.012, 0.11, 12),
  new THREE.MeshPhongMaterial({ color: 0x9a9690, shininess: 80 })
);
pivotMesh.rotation.x = Math.PI / 2;
pivotMesh.position.set(0, 0.08, 0);
cartGrp.add(pivotMesh);

// Pendulum group
var pendGrp = new THREE.Group();
pendGrp.position.set(0, 0.08, 0);
cartGrp.add(pendGrp);

var rod = new THREE.Mesh(
  new THREE.CylinderGeometry(0.006, 0.006, Lp * 2, 10),
  new THREE.MeshPhongMaterial({ color: 0x888480, shininess: 40 })
);
rod.position.y = Lp; rod.castShadow = true; pendGrp.add(rod);

var bobMat = new THREE.MeshPhongMaterial({ color: 0xc0392b, shininess: 80, emissive: 0x200000, emissiveIntensity: 0.1 });
var bob = new THREE.Mesh(new THREE.SphereGeometry(bobRadius, 14, 14), bobMat);
bob.position.y = Lp * 2; bob.castShadow = true; pendGrp.add(bob);

// Force arrow
var arrMat = new THREE.MeshLambertMaterial({ color: 0xb85c00, transparent: true, opacity: 0.85 });
var arrShaft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.012, 0.012), arrMat);
var arrHead = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 8), arrMat);
arrHead.rotation.z = -Math.PI / 2;
var arrGrp = new THREE.Group(); scene.add(arrGrp);
arrGrp.add(arrShaft); arrGrp.add(arrHead);

// Fall disc on ground
fallDisc = new THREE.Mesh(
  new THREE.CircleGeometry(0.1, 20),
  new THREE.MeshLambertMaterial({ color: 0xc0392b, transparent: true, opacity: 0 })
);
fallDisc.rotation.x = -Math.PI / 2;
fallDisc.position.y = 0.002;
scene.add(fallDisc);

// Bob push indicator
var pushIndicator = new THREE.Mesh(
  new THREE.SphereGeometry(0.04, 8, 8),
  new THREE.MeshLambertMaterial({ color: 0xff6600, transparent: true, opacity: 0 })
);
scene.add(pushIndicator);
var pushTimer = 0;
var impactPulse = 0;

// Trail
var TLEN = 100;
var trailPts = [];
for (var ti = 0; ti < TLEN; ti++) trailPts.push(new THREE.Vector3());
var trailGeo = new THREE.BufferGeometry().setFromPoints(trailPts);
var trailLine = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({ color: 0xc0392b, transparent: true, opacity: 0.15 }));
scene.add(trailLine);
var tIdx = 0;

// Manual target marker
var manualMarker = new THREE.Mesh(
  new THREE.CylinderGeometry(0.002, 0.002, 0.2, 8),
  new THREE.MeshLambertMaterial({ color: 0xe67e22, transparent: true, opacity: 0 })
);
manualMarker.rotation.x = Math.PI / 2;
manualMarker.position.y = 0.04;
scene.add(manualMarker);

// ─────────────────────────────────────────────
