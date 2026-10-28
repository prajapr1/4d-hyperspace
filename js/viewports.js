/**
 * viewports.js - Multi-viewport 3D scene manager for the 4 coordinate subspaces
 * Subspaces:
 * 1. wxy: (w, x, y), orthogonal = z
 * 2. xyz: (x, y, z), orthogonal = w
 * 3. yzw: (y, z, w), orthogonal = x
 * 4. wxz: (w, x, z), orthogonal = y
 */

class Viewport3D {
  constructor(containerId, subspaceId, label, options = {}) {
    this.container = document.getElementById(containerId);
    this.subspaceId = subspaceId;
    this.subspaceConfig = SUBSPACES[subspaceId];
    this.label = label;
    this.options = options;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.axesGroup = null;
    this.gridGroup = null;
    this.objectGroup = null;
    this.slicePlaneGroup = null;
    this.resizeObserver = null;

    this.initScene();
    this.setupResizeObserver();
  }

  initScene() {
    const width = this.container.clientWidth || 300;
    const height = this.container.clientHeight || 300;

    // 1. Scene with palette-matched dark slate depth
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b12); // Deep palette-matched slate dark

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(3.8, 3.2, 4.5);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Controls
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0, 0);

    // 5. Lighting with spatial depth
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(5, 8, 5);
    this.scene.add(dirLight1);

    // Primary axis tint light
    const axisColor = AXIS_COLORS[this.subspaceConfig.axes[0]];
    const accentLight = new THREE.DirectionalLight(axisColor, 0.45);
    accentLight.position.set(-5, -4, -5);
    this.scene.add(accentLight);

    // 6. Object & Axis containers
    this.objectGroup = new THREE.Group();
    this.scene.add(this.objectGroup);

    this.axesGroup = new THREE.Group();
    this.scene.add(this.axesGroup);

    this.gridGroup = new THREE.Group();
    this.scene.add(this.gridGroup);

    this.slicePlaneGroup = new THREE.Group();
    this.scene.add(this.slicePlaneGroup);

    this.buildAxesAndGrid();
  }

  setupResizeObserver() {
    if (window.ResizeObserver) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
      });
      this.resizeObserver.observe(this.container);
    }
  }

  /**
   * Builds custom color-coded 3D coordinate axes and grid for this specific subspace
   */
  buildAxesAndGrid() {
    while (this.axesGroup.children.length > 0) {
      this.axesGroup.remove(this.axesGroup.children[0]);
    }
    while (this.gridGroup.children.length > 0) {
      this.gridGroup.remove(this.gridGroup.children[0]);
    }

    const axesNames = this.subspaceConfig.axes; // e.g. ['w', 'x', 'y']
    const axisColors = axesNames.map(name => AXIS_COLORS[name]);

    const length = 2.6;
    const radius = 0.022;

    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    ];

    for (let i = 0; i < 3; i++) {
      const color = axisColors[i];
      const dir = directions[i];
      const name = axesNames[i].toUpperCase();

      // Axis cylinder
      const geom = new THREE.CylinderGeometry(radius, radius, length * 2, 16);
      const mat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.85 });
      const cyl = new THREE.Mesh(geom, mat);

      if (i === 0) cyl.rotation.z = -Math.PI / 2;
      else if (i === 2) cyl.rotation.x = Math.PI / 2;

      this.axesGroup.add(cyl);

      // Arrow cones at positive tip
      const coneGeom = new THREE.ConeGeometry(radius * 2.8, 0.16, 16);
      const coneMat = new THREE.MeshBasicMaterial({ color: color });
      const cone = new THREE.Mesh(coneGeom, coneMat);

      if (i === 0) {
        cone.position.set(length, 0, 0);
        cone.rotation.z = -Math.PI / 2;
      } else if (i === 1) {
        cone.position.set(0, length, 0);
      } else if (i === 2) {
        cone.position.set(0, 0, length);
        cone.rotation.x = Math.PI / 2;
      }
      this.axesGroup.add(cone);

      // Positive axis text sprite
      const labelSprite = this.createTextSprite(`+${name}`, color);
      if (i === 0) labelSprite.position.set(length + 0.3, 0, 0);
      if (i === 1) labelSprite.position.set(0, length + 0.3, 0);
      if (i === 2) labelSprite.position.set(0, 0, length + 0.3);
      this.axesGroup.add(labelSprite);

      // Negative axis text sprite
      const negSprite = this.createTextSprite(`-${name}`, color, true);
      if (i === 0) negSprite.position.set(-length - 0.25, 0, 0);
      if (i === 1) negSprite.position.set(0, -length - 0.25, 0);
      if (i === 2) negSprite.position.set(0, 0, -length - 0.25);
      this.axesGroup.add(negSprite);
    }

    // Subtle Ground Grid
    const gridHelper = new THREE.GridHelper(4.8, 12, 0x334155, 0x172033);
    gridHelper.position.y = 0;
    this.gridGroup.add(gridHelper);

    // Bounding Box outline [-2, 2]^3 with soft opacity
    const boxGeom = new THREE.BoxGeometry(4, 4, 4);
    const boxEdges = new THREE.EdgesGeometry(boxGeom);
    const boxLines = new THREE.LineSegments(boxEdges, new THREE.LineBasicMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.22
    }));
    this.gridGroup.add(boxLines);
  }

  createTextSprite(text, colorHex, isNegative = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.font = 'Bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const hexStr = '#' + new THREE.Color(colorHex).getHexString();
    ctx.fillStyle = isNegative ? 'rgba(148, 163, 184, 0.75)' : hexStr;
    ctx.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(0.65, 0.325, 1);
    return sprite;
  }

  updateSliceIndicator(sliceVal, isSlicingActive = true) {
    while (this.slicePlaneGroup.children.length > 0) {
      this.slicePlaneGroup.remove(this.slicePlaneGroup.children[0]);
    }
  }

  resetCamera() {
    this.camera.position.set(3.8, 3.2, 4.5);
    this.camera.zoom = 1.0;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
  }

  resize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width > 0 && height > 0) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    }
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  clearObjects() {
    while (this.objectGroup.children.length > 0) {
      const child = this.objectGroup.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
      this.objectGroup.remove(child);
    }
  }

  addObject(obj) {
    this.objectGroup.add(obj);
  }
}

/**
 * Manager that synchronizes all 4 Viewports
 */
class MultiViewportManager {
  constructor() {
    this.viewports = {};
    this.syncCameras = true;
    this.isSyncing = false;
  }

  init() {
    this.viewports.wxy = new Viewport3D('vp-wxy', 'wxy', 'W-X-Y Subspace');
    this.viewports.xyz = new Viewport3D('vp-xyz', 'xyz', 'X-Y-Z Subspace');
    this.viewports.yzw = new Viewport3D('vp-yzw', 'yzw', 'Y-Z-W Subspace');
    this.viewports.wxz = new Viewport3D('vp-wxz', 'wxz', 'W-X-Z Subspace');

    // Attach camera sync listener
    for (const key of Object.keys(this.viewports)) {
      const vp = this.viewports[key];
      vp.controls.addEventListener('change', () => {
        if (!this.syncCameras || this.isSyncing) return;
        this.syncAllCamerasTo(vp);
      });
    }

    window.addEventListener('resize', () => this.resizeAll());
  }

  syncAllCamerasTo(sourceVp) {
    this.isSyncing = true;
    const srcCam = sourceVp.camera;
    const pos = srcCam.position;
    const target = sourceVp.controls.target;

    for (const key of Object.keys(this.viewports)) {
      const vp = this.viewports[key];
      if (vp !== sourceVp) {
        vp.camera.position.copy(pos);
        vp.camera.zoom = srcCam.zoom;
        vp.camera.updateProjectionMatrix();
        vp.controls.target.copy(target);
      }
    }
    this.isSyncing = false;
  }

  resetAllCameras() {
    for (const key of Object.keys(this.viewports)) {
      this.viewports[key].resetCamera();
    }
  }

  resizeAll() {
    for (const key of Object.keys(this.viewports)) {
      this.viewports[key].resize();
    }
  }

  renderAll() {
    for (const key of Object.keys(this.viewports)) {
      this.viewports[key].render();
    }
  }

  clearAllObjects() {
    for (const key of Object.keys(this.viewports)) {
      this.viewports[key].clearObjects();
    }
  }
}
