/**
 * app.js - Main Application Controller for 4D HyperSpace Visualizer
 * Supports:
 * - Zero-Scroll Single-Page View
 * - Focus Mode with 3 Sideways Small Boxes
 * - Spatial Depth UI & 60 FPS OrbitControls
 * - Cartesian & LaTeX Equation Parsing (including 3D Wave Equation & PDEs)
 * - Real-time 4D Manifold Slicing & Marching Cubes
 */

// Global Application State
const App = {
  mode: 'point', // 'point' | 'line' | 'plane' | 'volume' | 'polytope' | 'equation'
  visMode: 'slicing', // 'slicing' | 'projection' | 'both'
  perspective4D: false,
  cameraDist4D: 3.8,

  // Layout State
  layoutMode: 'grid', // 'grid' | 'focus'
  focusedSubspace: 'xyz', // 'wxy' | 'xyz' | 'yzw' | 'wxz'
  sidebarOpen: true,

  // Slicing coordinates for the 4 orthogonal axes
  sliceCoords: {
    w: 0.0, // Orthogonal to XYZ (Time t)
    z: 0.0, // Orthogonal to WXY
    x: 0.0, // Orthogonal to YZW
    y: 0.0  // Orthogonal to WXZ
  },
  sweepActive: false,
  sweepDir: 1,

  // 4D Rotation in 6 planes
  rotAngles: {
    xy: 0, xz: 0, xw: 0, yz: 0, yw: 0, zw: 0
  },
  autoRotate: {
    xy: false, xz: false, xw: true, yz: false, yw: false, zw: true
  },
  rotSpeed: 1.0,

  // Mode Specific Data
  data: {
    // 0D Point
    point: {
      w: 0.8, x: 0.8, y: 0.8, z: 0.8,
      animate: false
    },
    // 1D Line
    line: {
      ptA: new Vector4(-1.2, -1.2, -1.2, -1.2),
      ptB: new Vector4(1.2, 1.2, 1.2, 1.2),
      preset: 'diagonal'
    },
    // 2D Plane
    plane: {
      p0: new Vector4(0, 0, 0, 0),
      u: new Vector4(1, 0, 0, 0),
      v: new Vector4(0, 1, 0, 0),
      size: 1.4,
      preset: 'xw'
    },
    // 3D Volume
    volume: {
      type: 'cube', // 'cube' | 'sphere' | 'tetrahedron'
      size: 1.2,
      w0: 0.0
    },
    // 4D Polytope
    polytope: {
      type: 'tesseract', // 'tesseract' | '5cell' | '16cell' | '24cell' | 'clifford'
      highlightCell: 'all',
      wireframe: true,
      showFaces: true,
      faceOpacity: 0.25
    },
    // 4D Spacetime Wave (t, x, y, z)
    wave: {
      type: 'spherical', // 'spherical' | 'cone' | 'standing' | 'plane' | 'packet'
      speed: 1.0,        // wave velocity v
      k: 2.2,            // wavenumber k
      amplitude: 1.0,
      time: 0.0,         // time t \equiv w
      autoPlayTime: true,
      showTimePlane: true,
      showRays: true
    },
    // Custom Equation & LaTeX PDEs
    equation: {
      rawExpr: '\\frac{\\partial^2 u}{\\partial t^2} = v^2 \\left( \\frac{\\partial^2 u}{\\partial x^2} + \\frac{\\partial^2 u}{\\partial y^2} + \\frac{\\partial^2 u}{\\partial z^2} \\right)',
      compiledFn: null,
      resolution: 24,
      surfaceColor: '#d9eafd',
      surfaceOpacity: 0.85,
      wireframe: false,
      showPointCloud: false,
      // Wave PDE specific parameters
      isWavePDE: true,
      waveSpeed: 1.0, // Wave velocity v
      waveK: 2.2,     // Wavenumber k
      waveSolutionType: 'cone' // 'cone' | 'spherical' | 'standing' | 'plane' | 'klein_gordon'
    }
  },

  // Subsystems
  viewportManager: null,
  isosurfaceExtractor: null,
  lastTime: performance.now()
};

// --------------------------------------------------------------------------
// Initialization
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  App.viewportManager = new MultiViewportManager();
  App.viewportManager.init();
  App.isosurfaceExtractor = new IsosurfaceExtractor();

  setupUIEventListeners();
  compileCurrentEquation();
  renderModeControls();
  updateVisuals();

  // Animation Loop
  requestAnimationFrame(animationLoop);
});

// --------------------------------------------------------------------------
// Animation Loop (60 FPS)
// --------------------------------------------------------------------------
function animationLoop(timestamp) {
  requestAnimationFrame(animationLoop);

  const dt = Math.min((timestamp - App.lastTime) / 1000, 0.1);
  App.lastTime = timestamp;

  let needUpdate = false;

  // 1. 4D Rotations
  const speed = App.rotSpeed * dt;
  for (const plane of ['xy', 'xz', 'xw', 'yz', 'yw', 'zw']) {
    if (App.autoRotate[plane]) {
      App.rotAngles[plane] = (App.rotAngles[plane] + speed * 0.8) % (Math.PI * 2);
      const slider = document.getElementById(`rot-${plane}`);
      if (slider) slider.value = App.rotAngles[plane];
      needUpdate = true;
    }
  }

  // 2. Auto-Sweep Slicing (Time t / W progression)
  if (App.sweepActive) {
    const sweepDelta = dt * 0.6 * App.sweepDir;
    for (const axis of ['w', 'x', 'y', 'z']) {
      App.sliceCoords[axis] += sweepDelta;
      if (App.sliceCoords[axis] > 2.2) {
        App.sliceCoords[axis] = 2.2;
        App.sweepDir = -1;
      } else if (App.sliceCoords[axis] < -2.2) {
        App.sliceCoords[axis] = -2.2;
        App.sweepDir = 1;
      }
      const slider = document.getElementById(`sliderSlice${axis.toUpperCase()}`);
      const badge = document.getElementById(`valSlice${axis.toUpperCase()}`);
      const hud = document.getElementById(`hudSlice${axis.toUpperCase()}`);
      if (slider) slider.value = App.sliceCoords[axis];
      if (badge) badge.innerText = App.sliceCoords[axis].toFixed(2);
      if (hud) hud.innerText = App.sliceCoords[axis].toFixed(2);
    }
    needUpdate = true;
  }

  // 3. Point trajectory animation
  if (App.mode === 'point' && App.data.point.animate) {
    const t = timestamp * 0.0012;
    App.data.point.w = Math.sin(t * 1.3) * 1.5;
    App.data.point.x = Math.cos(t * 1.0) * 1.5;
    App.data.point.y = Math.sin(t * 0.8) * 1.5;
    App.data.point.z = Math.cos(t * 1.5) * 1.5;

    syncPointInputs();
    needUpdate = true;
  }

  // 4. 4D Spacetime Wave Time Flow Animation
  if (App.mode === 'wave' && App.data.wave.autoPlayTime) {
    App.data.wave.time += dt * 0.75 * App.data.wave.speed;
    if (App.data.wave.time > 2.4) App.data.wave.time = -2.4;
    App.sliceCoords.w = App.data.wave.time;

    const sliderT = document.getElementById('sliderWaveTime');
    const badgeT = document.getElementById('valWaveTime');
    if (sliderT) sliderT.value = App.data.wave.time;
    if (badgeT) badgeT.innerText = App.data.wave.time.toFixed(2);
    needUpdate = true;
  }

  if (needUpdate) {
    updateVisuals();
  }

  App.viewportManager.renderAll();
}

// --------------------------------------------------------------------------
// UI Event Handlers
// --------------------------------------------------------------------------
function setupUIEventListeners() {
  // Dimension tabs
  const tabButtons = document.querySelectorAll('#dimensionTabs .nav-tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.mode = btn.dataset.mode;
      renderModeControls();
      updateVisuals();
      updateEducationalText();
    });
  });

  // Sidebar tab switching
  const sidebarTabBtns = document.querySelectorAll('.sidebar-tab-btn');
  sidebarTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sidebarTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tabName = btn.dataset.stab;
      document.querySelectorAll('.sidebar-tab-page').forEach(page => {
        page.style.display = 'none';
      });
      const activePage = document.getElementById(`page-${tabName}`);
      if (activePage) activePage.style.display = 'block';
    });
  });

  // Toggle Sidebar Drawer
  const btnToggleSidebar = document.getElementById('btnToggleSidebar');
  const sidebar = document.getElementById('sidebarControls');
  btnToggleSidebar.addEventListener('click', () => {
    App.sidebarOpen = !App.sidebarOpen;
    sidebar.classList.toggle('collapsed', !App.sidebarOpen);
    btnToggleSidebar.classList.toggle('active', App.sidebarOpen);
    setTimeout(() => App.viewportManager.resizeAll(), 320);
  });

  // Focus Mode / Layout Toggle Handlers
  const viewportsWrapper = document.getElementById('viewportsWrapper');
  const labelLayoutMode = document.getElementById('labelLayoutMode');
  const btnToggleLayoutMode = document.getElementById('btnToggleLayoutMode');

  // Focus Button on each viewport panel
  document.querySelectorAll('.btn-focus-vp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const subspace = btn.dataset.subspace;
      if (App.layoutMode === 'focus' && App.focusedSubspace === subspace) {
        setGridMode();
      } else {
        setFocusMode(subspace);
      }
    });
  });

  // Reset Camera button on each viewport panel
  document.querySelectorAll('.btn-reset-cam').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const subspace = btn.dataset.subspace;
      if (App.viewportManager.viewports[subspace]) {
        App.viewportManager.viewports[subspace].resetCamera();
      }
    });
  });

  // Clicking anywhere on a sidecar panel in Focus Mode swaps it to main focus
  document.querySelectorAll('.viewport-panel').forEach(panel => {
    panel.addEventListener('click', () => {
      if (App.layoutMode === 'focus' && !panel.classList.contains('is-focused')) {
        const subspace = panel.dataset.subspace;
        setFocusMode(subspace);
      }
    });
  });

  // Quick Bar layout mode toggle
  btnToggleLayoutMode.addEventListener('click', () => {
    if (App.layoutMode === 'grid') {
      setFocusMode(App.focusedSubspace || 'xyz');
    } else {
      setGridMode();
    }
  });

  function setFocusMode(subspace) {
    App.layoutMode = 'focus';
    App.focusedSubspace = subspace;

    viewportsWrapper.classList.remove('layout-grid');
    viewportsWrapper.classList.add('layout-focus');

    document.querySelectorAll('.viewport-panel').forEach(p => {
      if (p.dataset.subspace === subspace) {
        p.classList.add('is-focused');
      } else {
        p.classList.remove('is-focused');
      }
    });

    labelLayoutMode.innerText = 'Focus View';
    btnToggleLayoutMode.classList.add('active');

    setTimeout(() => App.viewportManager.resizeAll(), 50);
  }

  function setGridMode() {
    App.layoutMode = 'grid';
    viewportsWrapper.classList.remove('layout-focus');
    viewportsWrapper.classList.add('layout-grid');

    document.querySelectorAll('.viewport-panel').forEach(p => {
      p.classList.remove('is-focused');
    });

    labelLayoutMode.innerText = 'Grid (2x2)';
    btnToggleLayoutMode.classList.remove('active');

    setTimeout(() => App.viewportManager.resizeAll(), 50);
  }

  // Quick Bar: Play/Pause 4D Rotation
  const btnToggle4DRot = document.getElementById('btnToggle4DRot');
  btnToggle4DRot.addEventListener('click', () => {
    const anyActive = Object.values(App.autoRotate).some(v => v);
    const newState = !anyActive;
    App.autoRotate.xw = newState;
    App.autoRotate.zw = newState;
    btnToggle4DRot.classList.toggle('active', newState);
    document.getElementById('auto-xw').classList.toggle('active', newState);
    document.getElementById('auto-zw').classList.toggle('active', newState);
  });

  // Quick Bar: Play/Pause Slicing Sweep
  const btnQuickSweep = document.getElementById('btnQuickSweep');
  const btnSweepSlice = document.getElementById('btnSweepSlice');
  const toggleSweep = () => {
    App.sweepActive = !App.sweepActive;
    btnQuickSweep.classList.toggle('active', App.sweepActive);
    btnSweepSlice.classList.toggle('active', App.sweepActive);
    btnSweepSlice.innerText = App.sweepActive ? '⏸ Pause' : '▶ Auto-Sweep';
  };
  btnQuickSweep.addEventListener('click', toggleSweep);
  btnSweepSlice.addEventListener('click', toggleSweep);

  // Quick Bar: Cycle Vis Mode (Slice -> Projection -> Both)
  const btnCycleVisMode = document.getElementById('btnCycleVisMode');
  const labelVisMode = document.getElementById('labelVisMode');
  btnCycleVisMode.addEventListener('click', () => {
    if (App.visMode === 'slicing') App.visMode = 'projection';
    else if (App.visMode === 'projection') App.visMode = 'both';
    else App.visMode = 'slicing';

    labelVisMode.innerText = App.visMode.charAt(0).toUpperCase() + App.visMode.slice(1);
    updateVisuals();
  });

  // Quick Bar: Sync Cameras
  const btnSync = document.getElementById('btnSyncCameras');
  btnSync.addEventListener('click', () => {
    App.viewportManager.syncCameras = !App.viewportManager.syncCameras;
    btnSync.classList.toggle('active', App.viewportManager.syncCameras);
  });

  // Quick Bar: Reset All Cameras
  document.getElementById('btnResetAllCams').addEventListener('click', () => {
    App.viewportManager.resetAllCameras();
  });

  // Browser Fullscreen API
  const btnBrowserFullscreen = document.getElementById('btnBrowserFullscreen');
  btnBrowserFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn("Fullscreen request error:", err);
      });
    } else {
      document.exitFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    btnBrowserFullscreen.classList.toggle('active', !!document.fullscreenElement);
    setTimeout(() => App.viewportManager.resizeAll(), 100);
  });

  // 4D Theory Modal
  const modal = document.getElementById('theoryModal');
  document.getElementById('btnTheoryModal').addEventListener('click', () => {
    modal.classList.add('active');
  });
  document.getElementById('btnCloseModal').addEventListener('click', () => {
    modal.classList.remove('active');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });

  // Slice coordinate sliders
  ['w', 'x', 'y', 'z'].forEach(axis => {
    const slider = document.getElementById(`sliderSlice${axis.toUpperCase()}`);
    const badge = document.getElementById(`valSlice${axis.toUpperCase()}`);
    const hud = document.getElementById(`hudSlice${axis.toUpperCase()}`);

    slider.addEventListener('input', (e) => {
      App.sliceCoords[axis] = parseFloat(e.target.value);
      badge.innerText = App.sliceCoords[axis].toFixed(2);
      hud.innerText = App.sliceCoords[axis].toFixed(2);
      updateVisuals();
    });
  });

  // Perspective 4D toggle
  document.getElementById('chkPerspective4D').addEventListener('change', (e) => {
    App.perspective4D = e.target.checked;
    updateVisuals();
  });

  // 4D Rotation sliders & auto-rotate toggles
  ['xy', 'xz', 'xw', 'yz', 'yw', 'zw'].forEach(plane => {
    const slider = document.getElementById(`rot-${plane}`);
    const toggle = document.getElementById(`auto-${plane}`);

    slider.addEventListener('input', (e) => {
      App.rotAngles[plane] = parseFloat(e.target.value);
      updateVisuals();
    });

    toggle.addEventListener('click', () => {
      App.autoRotate[plane] = !App.autoRotate[plane];
      toggle.classList.toggle('active', App.autoRotate[plane]);
    });
  });

  // Speed slider
  const speedSlider = document.getElementById('sliderRotSpeed');
  const speedBadge = document.getElementById('valRotSpeed');
  speedSlider.addEventListener('input', (e) => {
    App.rotSpeed = parseFloat(e.target.value);
    speedBadge.innerText = `${App.rotSpeed.toFixed(1)}x`;
  });

  // Reset 4D rotation button
  document.getElementById('btnResetRotations').addEventListener('click', () => {
    for (const plane of ['xy', 'xz', 'xw', 'yz', 'yw', 'zw']) {
      App.rotAngles[plane] = 0;
      App.autoRotate[plane] = false;
      const slider = document.getElementById(`rot-${plane}`);
      const toggle = document.getElementById(`auto-${plane}`);
      if (slider) slider.value = 0;
      if (toggle) toggle.classList.remove('active');
    }
    btnToggle4DRot.classList.remove('active');
    updateVisuals();
  });

  // Keyboard Shortcuts: Space, F, Esc, S
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    if (e.code === 'Space') {
      e.preventDefault();
      btnToggle4DRot.click();
    } else if (e.key === 'f' || e.key === 'F') {
      btnToggleLayoutMode.click();
    } else if (e.key === 'Escape') {
      modal.classList.remove('active');
      setGridMode();
    } else if (e.key === 's' || e.key === 'S') {
      btnSync.click();
    }
  });

  updateEducationalText();
}

// --------------------------------------------------------------------------
// Render Mode Specific Controls in Sidebar
// --------------------------------------------------------------------------
function renderModeControls() {
  const container = document.getElementById('dynamicShapeControls');
  container.innerHTML = '';

  const mode = App.mode;

  if (mode === 'point') {
    // 0D Point Controls
    container.innerHTML = `
      <div class="panel-block">
        <div class="panel-title">
          <span>0D Point Coordinates</span>
          <button class="action-btn" id="btnRandomPoint" style="padding: 2px 6px; font-size: 0.68rem;">Random</button>
        </div>
        <div class="form-row">
          <div class="row-label">
            <span>Coordinate W (4th Dim)</span>
            <span class="num-badge" id="valPtW">${App.data.point.w.toFixed(2)}</span>
          </div>
          <input type="range" id="sliderPtW" min="-2.2" max="2.2" step="0.05" value="${App.data.point.w}">
        </div>
        <div class="form-row">
          <div class="row-label">
            <span>Coordinate X</span>
            <span class="num-badge" id="valPtX">${App.data.point.x.toFixed(2)}</span>
          </div>
          <input type="range" id="sliderPtX" min="-2.2" max="2.2" step="0.05" value="${App.data.point.x}">
        </div>
        <div class="form-row">
          <div class="row-label">
            <span>Coordinate Y</span>
            <span class="num-badge" id="valPtY">${App.data.point.y.toFixed(2)}</span>
          </div>
          <input type="range" id="sliderPtY" min="-2.2" max="2.2" step="0.05" value="${App.data.point.y}">
        </div>
        <div class="form-row">
          <div class="row-label">
            <span>Coordinate Z</span>
            <span class="num-badge" id="valPtZ">${App.data.point.z.toFixed(2)}</span>
          </div>
          <input type="range" id="sliderPtZ" min="-2.2" max="2.2" step="0.05" value="${App.data.point.z}">
        </div>
        <div style="margin-top: 8px; display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary);">
          <span>Animate 4D Orbit</span>
          <input type="checkbox" id="chkAnimatePoint" ${App.data.point.animate ? 'checked' : ''} style="cursor: pointer;">
        </div>
      </div>
    `;

    ['w', 'x', 'y', 'z'].forEach(axis => {
      const slider = document.getElementById(`sliderPt${axis.toUpperCase()}`);
      const badge = document.getElementById(`valPt${axis.toUpperCase()}`);
      slider.addEventListener('input', (e) => {
        App.data.point[axis] = parseFloat(e.target.value);
        badge.innerText = App.data.point[axis].toFixed(2);
        updateVisuals();
      });
    });

    document.getElementById('btnRandomPoint').addEventListener('click', () => {
      ['w', 'x', 'y', 'z'].forEach(axis => {
        App.data.point[axis] = (Math.random() * 3 - 1.5);
      });
      syncPointInputs();
      updateVisuals();
    });

    document.getElementById('chkAnimatePoint').addEventListener('change', (e) => {
      App.data.point.animate = e.target.checked;
    });

  } else if (mode === 'line') {
    // 1D Line Controls
    container.innerHTML = `
      <div class="panel-block">
        <div class="panel-title"><span>1D Line Segment</span></div>
        <div class="form-row">
          <div class="row-label"><span>Orientation Preset</span></div>
          <select class="select-control" id="selectLinePreset">
            <option value="diagonal">4D Space Diagonal</option>
            <option value="w_axis">Pure W-Axis Aligned Segment</option>
            <option value="xw_diag">X-W Diagonal Segment</option>
            <option value="xyz_flat">Flat in XYZ (W = 0)</option>
          </select>
        </div>
        <div class="form-row">
          <div class="row-label"><span>Endpoint A (w, x, y, z)</span></div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
            <input type="number" step="0.1" class="input-control" id="lineAw" value="${App.data.line.ptA.w.toFixed(2)}">
            <input type="number" step="0.1" class="input-control" id="lineAx" value="${App.data.line.ptA.x.toFixed(2)}">
            <input type="number" step="0.1" class="input-control" id="lineAy" value="${App.data.line.ptA.y.toFixed(2)}">
            <input type="number" step="0.1" class="input-control" id="lineAz" value="${App.data.line.ptA.z.toFixed(2)}">
          </div>
        </div>
        <div class="form-row">
          <div class="row-label"><span>Endpoint B (w, x, y, z)</span></div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
            <input type="number" step="0.1" class="input-control" id="lineBw" value="${App.data.line.ptB.w.toFixed(2)}">
            <input type="number" step="0.1" class="input-control" id="lineBx" value="${App.data.line.ptB.x.toFixed(2)}">
            <input type="number" step="0.1" class="input-control" id="lineBy" value="${App.data.line.ptB.y.toFixed(2)}">
            <input type="number" step="0.1" class="input-control" id="lineBz" value="${App.data.line.ptB.z.toFixed(2)}">
          </div>
        </div>
      </div>
    `;

    const presetSelect = document.getElementById('selectLinePreset');
    presetSelect.value = App.data.line.preset;
    presetSelect.addEventListener('change', (e) => {
      const p = e.target.value;
      App.data.line.preset = p;
      if (p === 'diagonal') {
        App.data.line.ptA.set(-1.4, -1.4, -1.4, -1.4);
        App.data.line.ptB.set(1.4, 1.4, 1.4, 1.4);
      } else if (p === 'w_axis') {
        App.data.line.ptA.set(-1.6, 0, 0, 0);
        App.data.line.ptB.set(1.6, 0, 0, 0);
      } else if (p === 'xw_diag') {
        App.data.line.ptA.set(-1.5, -1.5, 0, 0);
        App.data.line.ptB.set(1.5, 1.5, 0, 0);
      } else if (p === 'xyz_flat') {
        App.data.line.ptA.set(0, -1.5, -1.2, 0.8);
        App.data.line.ptB.set(0, 1.5, 1.2, -0.8);
      }
      renderModeControls();
      updateVisuals();
    });

    ['w', 'x', 'y', 'z'].forEach(axis => {
      const inputA = document.getElementById(`lineA${axis}`);
      const inputB = document.getElementById(`lineB${axis}`);
      inputA.addEventListener('input', () => {
        App.data.line.ptA[axis] = parseFloat(inputA.value) || 0;
        updateVisuals();
      });
      inputB.addEventListener('input', () => {
        App.data.line.ptB[axis] = parseFloat(inputB.value) || 0;
        updateVisuals();
      });
    });

  } else if (mode === 'plane') {
    // 2D Plane Controls
    container.innerHTML = `
      <div class="panel-block">
        <div class="panel-title"><span>2D Plane Patch</span></div>
        <div class="form-row">
          <div class="row-label"><span>Orientation Preset</span></div>
          <select class="select-control" id="selectPlanePreset">
            <option value="xw">X-W Plane (Spanned by X & W)</option>
            <option value="xy">X-Y Plane (Classic 2D flat plane)</option>
            <option value="tilted">Tilted 4D Plane</option>
          </select>
        </div>
        <div class="form-row">
          <div class="row-label">
            <span>Plane Size</span>
            <span class="num-badge" id="valPlaneSize">${App.data.plane.size.toFixed(1)}</span>
          </div>
          <input type="range" id="sliderPlaneSize" min="0.5" max="2.5" step="0.1" value="${App.data.plane.size}">
        </div>
      </div>
    `;

    document.getElementById('selectPlanePreset').addEventListener('change', (e) => {
      const p = e.target.value;
      App.data.plane.preset = p;
      if (p === 'xw') {
        App.data.plane.u.set(1, 0, 0, 0);
        App.data.plane.v.set(0, 1, 0, 0);
      } else if (p === 'xy') {
        App.data.plane.u.set(0, 1, 0, 0);
        App.data.plane.v.set(0, 0, 1, 0);
      } else if (p === 'tilted') {
        App.data.plane.u.set(0.7, 0.7, 0, 0);
        App.data.plane.v.set(0, 0, 0.7, 0.7);
      }
      updateVisuals();
    });

    const szSlider = document.getElementById('sliderPlaneSize');
    szSlider.addEventListener('input', (e) => {
      App.data.plane.size = parseFloat(e.target.value);
      document.getElementById('valPlaneSize').innerText = App.data.plane.size.toFixed(1);
      updateVisuals();
    });

  } else if (mode === 'volume') {
    // 3D Volume Controls
    container.innerHTML = `
      <div class="panel-block">
        <div class="panel-title"><span>3D Volume in 4D</span></div>
        <div class="form-row">
          <div class="row-label"><span>Volume Shape</span></div>
          <select class="select-control" id="selectVolumeType">
            <option value="cube">3D Cube (8 Vertices, 6 Faces)</option>
            <option value="sphere">3D Sphere</option>
            <option value="tetrahedron">3D Tetrahedron</option>
          </select>
        </div>
        <div class="form-row">
          <div class="row-label">
            <span>Initial W Offset (W0)</span>
            <span class="num-badge" id="valVolumeW0">${App.data.volume.w0.toFixed(2)}</span>
          </div>
          <input type="range" id="sliderVolumeW0" min="-2.0" max="2.0" step="0.05" value="${App.data.volume.w0}">
        </div>
        <div class="form-row">
          <div class="row-label">
            <span>Scale</span>
            <span class="num-badge" id="valVolumeSize">${App.data.volume.size.toFixed(1)}</span>
          </div>
          <input type="range" id="sliderVolumeSize" min="0.5" max="2.2" step="0.1" value="${App.data.volume.size}">
        </div>
      </div>
    `;

    const selectType = document.getElementById('selectVolumeType');
    selectType.value = App.data.volume.type;
    selectType.addEventListener('change', (e) => {
      App.data.volume.type = e.target.value;
      updateVisuals();
    });

    const w0Slider = document.getElementById('sliderVolumeW0');
    w0Slider.addEventListener('input', (e) => {
      App.data.volume.w0 = parseFloat(e.target.value);
      document.getElementById('valVolumeW0').innerText = App.data.volume.w0.toFixed(2);
      updateVisuals();
    });

    const szSlider = document.getElementById('sliderVolumeSize');
    szSlider.addEventListener('input', (e) => {
      App.data.volume.size = parseFloat(e.target.value);
      document.getElementById('valVolumeSize').innerText = App.data.volume.size.toFixed(1);
      updateVisuals();
    });

  } else if (mode === 'polytope') {
    // 4D Polytope Controls
    container.innerHTML = `
      <div class="panel-block">
        <div class="panel-title"><span>4D Polytope Selector</span></div>
        <div class="form-row">
          <select class="select-control" id="selectPolytope">
            <option value="tesseract">Tesseract (8-Cell / Hypercube)</option>
            <option value="5cell">5-Cell (4D Simplex / Pentatope)</option>
            <option value="16cell">16-Cell (Hyperoctahedron)</option>
            <option value="24cell">24-Cell (Regular 4D Polytope)</option>
            <option value="clifford">Clifford Torus (Flat Torus in S3)</option>
          </select>
        </div>
        <div class="form-row">
          <div class="row-label">
            <span>Face Opacity</span>
            <span class="num-badge" id="valFaceOpacity">${App.data.polytope.faceOpacity.toFixed(2)}</span>
          </div>
          <input type="range" id="sliderFaceOpacity" min="0.0" max="0.8" step="0.05" value="${App.data.polytope.faceOpacity}">
        </div>
        <div style="display: flex; gap: 12px; font-size: 0.75rem; margin-top: 4px;">
          <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <input type="checkbox" id="chkShowFaces" ${App.data.polytope.showFaces ? 'checked' : ''}>
            <span>Faces</span>
          </label>
          <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <input type="checkbox" id="chkShowWireframe" ${App.data.polytope.wireframe ? 'checked' : ''}>
            <span>Wireframe Edges</span>
          </label>
        </div>
      </div>
    `;

    const selectPoly = document.getElementById('selectPolytope');
    selectPoly.value = App.data.polytope.type;
    selectPoly.addEventListener('change', (e) => {
      App.data.polytope.type = e.target.value;
      updateVisuals();
      updateEducationalText();
    });

    const opSlider = document.getElementById('sliderFaceOpacity');
    opSlider.addEventListener('input', (e) => {
      App.data.polytope.faceOpacity = parseFloat(e.target.value);
      document.getElementById('valFaceOpacity').innerText = App.data.polytope.faceOpacity.toFixed(2);
      updateVisuals();
    });

    document.getElementById('chkShowFaces').addEventListener('change', (e) => {
      App.data.polytope.showFaces = e.target.checked;
      updateVisuals();
    });

    document.getElementById('chkShowWireframe').addEventListener('change', (e) => {
      App.data.polytope.wireframe = e.target.checked;
      updateVisuals();
    });

  } else if (mode === 'wave') {
    // 4D Spacetime Wave Controls
    container.innerHTML = `
      <div class="panel-block">
        <div class="panel-title">
          <span>4D Spacetime Wave Controls</span>
          <span class="num-badge" style="background: rgba(217,234,253,0.18); color: #d9eafd; border-color: #bcccdc;">∂²u/∂t² = v² ∇²u</span>
        </div>

        <div class="form-row">
          <div class="row-label"><span>Wave Solution Type</span></div>
          <select class="select-control" id="selectWaveType">
            <option value="spherical" ${App.data.wave.type === 'spherical' ? 'selected' : ''}>Expanding Spherical Wave (Huygens)</option>
            <option value="cone" ${App.data.wave.type === 'cone' ? 'selected' : ''}>Spacetime Lightcone / Hyperboloid</option>
            <option value="standing" ${App.data.wave.type === 'standing' ? 'selected' : ''}>Harmonic Standing Wave (Resonance)</option>
            <option value="plane" ${App.data.wave.type === 'plane' ? 'selected' : ''}>Plane Wave along X-axis</option>
            <option value="packet" ${App.data.wave.type === 'packet' ? 'selected' : ''}>Gaussian Wave Packet</option>
          </select>
        </div>

        <div class="form-row">
          <div class="row-label">
            <span>Time t (W Coordinate)</span>
            <span class="num-badge" id="valWaveTime">${App.data.wave.time.toFixed(2)}</span>
          </div>
          <input type="range" id="sliderWaveTime" min="-2.0" max="2.0" step="0.02" value="${App.data.wave.time}">
        </div>

        <div class="action-grid" style="margin-top: 6px;">
          <button class="action-btn ${App.data.wave.autoPlayTime ? 'active' : ''}" id="btnPlayWaveTime">
            ${App.data.wave.autoPlayTime ? '⏸ Pause' : '▶ Play'}
          </button>
        </div>

        <div class="form-row" style="margin-top: 10px;">
          <div class="row-label">
            <span>Wave Speed (v)</span>
            <span class="num-badge" id="valWaveSpeed">${App.data.wave.speed.toFixed(2)}</span>
          </div>
          <input type="range" id="sliderWaveSpeed" min="0.2" max="2.0" step="0.05" value="${App.data.wave.speed}">
        </div>

        <div class="form-row" style="margin-top: 10px;">
          <div class="row-label">
            <span>Wavenumber (k)</span>
            <span class="num-badge" id="valWaveK">${App.data.wave.k.toFixed(1)}</span>
          </div>
          <input type="range" id="sliderWaveK" min="1.0" max="10.0" step="0.2" value="${App.data.wave.k}">
        </div>

        <div class="form-row" style="margin-top: 8px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--color-subtext); cursor: pointer;">
            <input type="checkbox" id="chkWaveTimePlane" ${App.data.wave.showTimePlane ? 'checked' : ''}>
            <span>Show Time Slicing Plane in Spacetime</span>
          </label>
        </div>

        <div class="form-row">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--color-subtext); cursor: pointer;">
            <input type="checkbox" id="chkWaveRays" ${App.data.wave.showRays ? 'checked' : ''}>
            <span>Show Wavefront Slice Rings</span>
          </label>
        </div>
      </div>
    `;

    document.getElementById('selectWaveType').addEventListener('change', (e) => {
      App.data.wave.type = e.target.value;
      updateVisuals();
      updateEducationalText();
    });

    const timeSlider = document.getElementById('sliderWaveTime');
    timeSlider.addEventListener('input', (e) => {
      App.data.wave.time = parseFloat(e.target.value);
      App.sliceCoords.w = App.data.wave.time;
      document.getElementById('valWaveTime').innerText = App.data.wave.time.toFixed(2);
      updateVisuals();
    });

    const playBtn = document.getElementById('btnPlayWaveTime');
    playBtn.addEventListener('click', () => {
      App.data.wave.autoPlayTime = !App.data.wave.autoPlayTime;
      playBtn.classList.toggle('active', App.data.wave.autoPlayTime);
      playBtn.innerText = App.data.wave.autoPlayTime ? '⏸ Pause' : '▶ Play';
    });

    document.getElementById('sliderWaveSpeed').addEventListener('input', (e) => {
      App.data.wave.speed = parseFloat(e.target.value);
      document.getElementById('valWaveSpeed').innerText = App.data.wave.speed.toFixed(2);
      updateVisuals();
    });

    document.getElementById('sliderWaveK').addEventListener('input', (e) => {
      App.data.wave.k = parseFloat(e.target.value);
      document.getElementById('valWaveK').innerText = App.data.wave.k.toFixed(1);
      updateVisuals();
    });

    document.getElementById('chkWaveTimePlane').addEventListener('change', (e) => {
      App.data.wave.showTimePlane = e.target.checked;
      updateVisuals();
    });

    document.getElementById('chkWaveRays').addEventListener('change', (e) => {
      App.data.wave.showRays = e.target.checked;
      updateVisuals();
    });
  } else if (mode === 'equation') {
    // Custom Equation & LaTeX PDE Controls
    const isWave = App.data.equation.isWavePDE;

    container.innerHTML = `
      <div class="panel-block">
        <div class="panel-title">
          <span>Cartesian & LaTeX Equation</span>
          ${isWave ? '<span class="num-badge" style="background: rgba(217,234,253,0.18); color: #d9eafd; border-color: #bcccdc;">⚡ Wave PDE</span>' : ''}
        </div>

        <div class="form-row">
          <div class="row-label"><span>Presets</span></div>
          <select class="select-control" id="selectEqPreset">
            <option value="\\frac{\\partial^2 u}{\\partial t^2} = v^2 \\left( \\frac{\\partial^2 u}{\\partial x^2} + \\frac{\\partial^2 u}{\\partial y^2} + \\frac{\\partial^2 u}{\\partial z^2} \\right)">3D Wave Equation (LaTeX): ∂²u/∂t² = v² ∇²u</option>
            <option value="w^2 + x^2 + y^2 + z^2 = 1.8">Hypersphere: w^2 + x^2 + y^2 + z^2 = 1.8</option>
            <option value="\\frac{w^2}{1.8^2} + \\frac{x^2}{1.4^2} + \\frac{y^2}{1^2} + \\frac{z^2}{1^2} = 1">4D Hyperellipsoid (LaTeX Fractions)</option>
            <option value="w = x^2 + y^2 + z^2">4D Paraboloid: w = x^2 + y^2 + z^2</option>
            <option value="w^2 + x^2 = y^2 + z^2">4D Hypercone: w^2 + x^2 = y^2 + z^2</option>
            <option value="x^2 + y^2 + z^2 - w^2 = 0.5">4D Hyperboloid (1-Sheet)</option>
            <option value="w^2 - x^2 - y^2 - z^2 = 0.4">4D Hyperboloid (2-Sheets)</option>
            <option value="(sqrt(x^2 + y^2) - 1.2)^2 + (sqrt(z^2 + w^2) - 1.2)^2 = 0.4^2">Duocylinder / Flat 4D Torus</option>
            <option value="cos(w) + cos(x) + cos(y) + cos(z) = 0">4D Periodic Gyroid</option>
            <option value="w^4 + x^4 + y^4 + z^4 = 1.8">Super-Hypersphere (4th Power)</option>
          </select>
        </div>

        <div class="form-row">
          <div class="row-label"><span>Enter Equation (LaTeX or Cartesian)</span></div>
          <div style="display: flex; gap: 4px;">
            <input type="text" class="input-control" id="inputCustomEq" value="${escapeHtml(App.data.equation.rawExpr)}">
            <button class="action-btn" id="btnApplyEq" style="background: var(--accent-indigo); color: #fff; font-weight: 700;">Apply</button>
          </div>
        </div>

        ${isWave ? `
        <!-- Wave PDE Specific Solution Modes & Parameters -->
        <div style="background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); border-radius: var(--radius-md); padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; margin-top: 2px;">
          <div class="form-row">
            <div class="row-label"><span>Wave Solution Manifold</span></div>
            <select class="select-control" id="selectWaveSolType">
              <option value="cone" ${App.data.equation.waveSolutionType === 'cone' ? 'selected' : ''}>Spacetime Wave Cone: (v*t)² = x² + y² + z²</option>
              <option value="spherical" ${App.data.equation.waveSolutionType === 'spherical' ? 'selected' : ''}>Expanding Spherical Wave: cos(k*r - v*k*t) = 0</option>
              <option value="standing" ${App.data.equation.waveSolutionType === 'standing' ? 'selected' : ''}>3D Resonant Standing Wave: sin(kx)*sin(ky)*sin(kz)*cos(ωt)</option>
              <option value="plane" ${App.data.equation.waveSolutionType === 'plane' ? 'selected' : ''}>Harmonic Plane Wave: cos(k·x - v*k*t) = 0</option>
              <option value="klein_gordon" ${App.data.equation.waveSolutionType === 'klein_gordon' ? 'selected' : ''}>Klein-Gordon Relativistic Dispersion: w² - v²(x²+y²+z²) = m²</option>
            </select>
          </div>

          <div class="form-row">
            <div class="row-label">
              <span>Wave Speed (v)</span>
              <span class="num-badge" id="valWaveSpeed">${App.data.equation.waveSpeed.toFixed(2)}</span>
            </div>
            <input type="range" id="sliderWaveSpeed" min="0.2" max="3.0" step="0.1" value="${App.data.equation.waveSpeed}">
          </div>

          <div class="form-row">
            <div class="row-label">
              <span>Wavenumber (k)</span>
              <span class="num-badge" id="valWaveK">${App.data.equation.waveK.toFixed(1)}</span>
            </div>
            <input type="range" id="sliderWaveK" min="0.5" max="5.0" step="0.2" value="${App.data.equation.waveK}">
          </div>
        </div>
        ` : ''}

        <div class="form-row" style="margin-top: 4px;">
          <div class="row-label">
            <span>Grid Resolution</span>
            <span class="num-badge" id="valEqRes">${App.data.equation.resolution}</span>
          </div>
          <input type="range" id="sliderEqRes" min="16" max="32" step="2" value="${App.data.equation.resolution}">
        </div>

        <div class="form-row">
          <div class="row-label">
            <span>Surface Opacity</span>
            <span class="num-badge" id="valEqOpacity">${App.data.equation.surfaceOpacity.toFixed(2)}</span>
          </div>
          <input type="range" id="sliderEqOpacity" min="0.2" max="1.0" step="0.05" value="${App.data.equation.surfaceOpacity}">
        </div>

        <div style="display: flex; gap: 12px; font-size: 0.75rem; margin-top: 4px;">
          <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <input type="checkbox" id="chkEqWireframe" ${App.data.equation.wireframe ? 'checked' : ''}>
            <span>Wireframe Mesh</span>
          </label>
          <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <input type="checkbox" id="chkEqPointCloud" ${App.data.equation.showPointCloud ? 'checked' : ''}>
            <span>4D Point Cloud Shell</span>
          </label>
        </div>
      </div>
    `;

    const presetSelect = document.getElementById('selectEqPreset');
    presetSelect.value = App.data.equation.rawExpr;
    presetSelect.addEventListener('change', (e) => {
      document.getElementById('inputCustomEq').value = e.target.value;
      App.data.equation.rawExpr = e.target.value;
      compileCurrentEquation();
      renderModeControls();
      updateVisuals();
      updateEducationalText();
    });

    const applyBtn = document.getElementById('btnApplyEq');
    applyBtn.addEventListener('click', () => {
      App.data.equation.rawExpr = document.getElementById('inputCustomEq').value;
      compileCurrentEquation();
      renderModeControls();
      updateVisuals();
      updateEducationalText();
    });

    document.getElementById('inputCustomEq').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        App.data.equation.rawExpr = e.target.value;
        compileCurrentEquation();
        renderModeControls();
        updateVisuals();
        updateEducationalText();
      }
    });

    if (isWave) {
      const selectWaveSol = document.getElementById('selectWaveSolType');
      if (selectWaveSol) {
        selectWaveSol.addEventListener('change', (e) => {
          App.data.equation.waveSolutionType = e.target.value;
          compileCurrentEquation();
          updateVisuals();
          updateEducationalText();
        });
      }

      const speedSlider = document.getElementById('sliderWaveSpeed');
      if (speedSlider) {
        speedSlider.addEventListener('input', (e) => {
          App.data.equation.waveSpeed = parseFloat(e.target.value);
          document.getElementById('valWaveSpeed').innerText = App.data.equation.waveSpeed.toFixed(2);
          compileCurrentEquation();
          updateVisuals();
        });
      }

      const kSlider = document.getElementById('sliderWaveK');
      if (kSlider) {
        kSlider.addEventListener('input', (e) => {
          App.data.equation.waveK = parseFloat(e.target.value);
          document.getElementById('valWaveK').innerText = App.data.equation.waveK.toFixed(1);
          compileCurrentEquation();
          updateVisuals();
        });
      }
    }

    const resSlider = document.getElementById('sliderEqRes');
    resSlider.addEventListener('input', (e) => {
      App.data.equation.resolution = parseInt(e.target.value);
      document.getElementById('valEqRes').innerText = App.data.equation.resolution;
      updateVisuals();
    });

    const opSlider = document.getElementById('sliderEqOpacity');
    opSlider.addEventListener('input', (e) => {
      App.data.equation.surfaceOpacity = parseFloat(e.target.value);
      document.getElementById('valEqOpacity').innerText = App.data.equation.surfaceOpacity.toFixed(2);
      updateVisuals();
    });

    document.getElementById('chkEqWireframe').addEventListener('change', (e) => {
      App.data.equation.wireframe = e.target.checked;
      updateVisuals();
    });

    document.getElementById('chkEqPointCloud').addEventListener('change', (e) => {
      App.data.equation.showPointCloud = e.target.checked;
      updateVisuals();
    });
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function syncPointInputs() {
  ['w', 'x', 'y', 'z'].forEach(axis => {
    const val = App.data.point[axis];
    const slider = document.getElementById(`sliderPt${axis.toUpperCase()}`);
    const badge = document.getElementById(`valPt${axis.toUpperCase()}`);
    if (slider) slider.value = val;
    if (badge) badge.innerText = val.toFixed(2);
  });
}

// --------------------------------------------------------------------------
// Comprehensive LaTeX & Cartesian Equation Compiler
// Supports 3D Wave Equations, Spacetime Characteristic Cones, and PDEs
// --------------------------------------------------------------------------
function compileCurrentEquation() {
  const raw = App.data.equation.rawExpr.trim();

  // 1. Detect 3D Wave Equation or Partial Differential Equations
  // Matches \frac{\partial^2 u}{\partial t^2} = v^2 (\frac{\partial^2 u}{\partial x^2} + ...)
  // or \partial^2 u / \partial t^2 - v^2 \nabla^2 u = 0, or d^2u/dt^2
  const isWave = (/\\partial|\bpartial\b|\\nabla\b|\bd\^2u\/dt\^2\b/i.test(raw) &&
                  (/t\b|w\b/i.test(raw)) &&
                  (/x\b/i.test(raw) || /y\b/i.test(raw) || /z\b/i.test(raw))) ||
                 /(\\partial\^2\s*u\s*\/\s*\\partial\s*t\^2)/i.test(raw);

  App.data.equation.isWavePDE = isWave;

  if (isWave) {
    // Extract wave speed v if specified, e.g. v^2, c^2, or numeric 2^2
    const speedMatch = raw.match(/=\s*([a-zA-Z0-9_.]+)\s*\^\s*2/);
    if (speedMatch) {
      const num = parseFloat(speedMatch[1]);
      if (!isNaN(num) && num > 0) App.data.equation.waveSpeed = num;
    }

    const solType = App.data.equation.waveSolutionType || 'cone';
    const v = App.data.equation.waveSpeed;
    const k = App.data.equation.waveK;

    if (solType === 'cone') {
      // Characteristic Spacetime Light Cone: (v*t)^2 = x^2 + y^2 + z^2
      // Slicing at time w = t gives expanding spherical wavefronts of radius r = v * |t|
      App.data.equation.compiledFn = (w, x, y, z) => {
        return (w * w) - (v * v) * (x * x + y * y + z * z);
      };
    } else if (solType === 'spherical') {
      // Expanding Spherical Wavefronts: cos(k * r - v * k * w) = 0
      App.data.equation.compiledFn = (w, x, y, z) => {
        const r = Math.sqrt(x * x + y * y + z * z);
        return Math.cos(k * r - v * k * w);
      };
    } else if (solType === 'standing') {
      // 3D Resonant Standing Wave: sin(k*x) * sin(k*y) * sin(k*z) * cos(omega*t) = 0
      const omega = v * Math.sqrt(3) * k;
      App.data.equation.compiledFn = (w, x, y, z) => {
        return Math.sin(k * x) * Math.sin(k * y) * Math.sin(k * z) * Math.cos(omega * w);
      };
    } else if (solType === 'plane') {
      // Harmonic Plane Wave: cos(k_vec · x_vec - omega*t) = 0
      App.data.equation.compiledFn = (w, x, y, z) => {
        return Math.cos(k * (x + y + z) / Math.SQRT3 - v * k * w);
      };
    } else if (solType === 'klein_gordon') {
      // Relativistic Mass Hyperboloid: w^2 - v^2(x^2 + y^2 + z^2) = m^2
      const m2 = 0.5;
      App.data.equation.compiledFn = (w, x, y, z) => {
        return (w * w) - (v * v) * (x * x + y * y + z * z) - m2;
      };
    }
    return;
  }

  // 2. Generic LaTeX Normalizer for Cartesian Equations
  let s = raw;

  // Replace \left( ... \right)
  s = s.replace(/\\left\s*\(/g, '(').replace(/\\right\s*\)/g, ')');
  s = s.replace(/\\left\s*\[/g, '[').replace(/\\right\s*\]/g, ']');
  s = s.replace(/\\left|\\right/g, '');

  // Convert \frac{A}{B} to ((A)/(B)) iteratively
  while (/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/.test(s)) {
    s = s.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))');
  }

  // Convert \sqrt{A} to sqrt(A)
  while (/\\sqrt\s*\{([^{}]+)\}/.test(s)) {
    s = s.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)');
  }

  // Map time variable t to w (the 4th dimension)
  s = s.replace(/\bt\b/g, 'w');

  // Strip LaTeX backslashes for math functions and operators
  s = s.replace(/\\(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|exp|log|abs)/g, '$1');
  s = s.replace(/\\cdot|\\times/g, '*');
  s = s.replace(/\\pi/g, 'PI');
  s = s.replace(/\\/g, '');
  s = s.replace(/\{([^{}]+)\}/g, '($1)');

  let parts = s.split('=');
  let lhs, rhs;

  if (parts.length === 2) {
    lhs = parts[0].trim();
    rhs = parts[1].trim();
  } else {
    lhs = s.trim();
    rhs = '0';
  }

  let jsExpr = `(${lhs}) - (${rhs})`;
  jsExpr = jsExpr.replace(/\^/g, '**');
  jsExpr = jsExpr.replace(/\b(sin|cos|tan|asin|acos|atan|sqrt|abs|exp|log|min|max|pow|PI)\b/g, 'Math.$1');

  try {
    const fn = new Function('w', 'x', 'y', 'z', `
      try {
        return (${jsExpr});
      } catch (err) {
        return 1e6;
      }
    `);
    fn(0, 0, 0, 0);
    App.data.equation.compiledFn = fn;
  } catch (err) {
    console.warn("Native compile failed, falling back to math.js parser:", err);
    try {
      const compiled = math.compile(`(${lhs}) - (${rhs})`);
      App.data.equation.compiledFn = (w, x, y, z) => {
        try {
          return compiled.evaluate({ w, x, y, z });
        } catch (e) {
          return 1e6;
        }
      };
    } catch (e2) {
      console.error("Equation parsing error:", e2);
      App.data.equation.compiledFn = (w, x, y, z) => (w*w + x*x + y*y + z*z - 1.0);
    }
  }
}

// --------------------------------------------------------------------------
// Main Rendering Pipeline: Generates Visuals in All 4 Subspaces
// --------------------------------------------------------------------------
function updateVisuals() {
  if (!App.viewportManager) return;
  App.viewportManager.clearAllObjects();

  const rotMatrix = Matrix4D.fromEulerAngles(App.rotAngles);

  const mode = App.mode;
  const visMode = App.visMode;
  const isSlicing = visMode === 'slicing' || visMode === 'both';
  const isProjection = visMode === 'projection' || visMode === 'both';

  for (const subspaceKey of ['wxy', 'xyz', 'yzw', 'wxz']) {
    const vp = App.viewportManager.viewports[subspaceKey];
    const subConfig = SUBSPACES[subspaceKey];
    const orthoAxis = subConfig.orthogonal;
    const currentSliceVal = App.sliceCoords[orthoAxis];

    vp.updateSliceIndicator(currentSliceVal, isSlicing);

    if (mode === 'point') {
      renderPointInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, currentSliceVal, orthoAxis);
    } else if (mode === 'line') {
      renderLineInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, currentSliceVal, orthoAxis);
    } else if (mode === 'plane') {
      renderPlaneInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, currentSliceVal, orthoAxis);
    } else if (mode === 'volume') {
      renderVolumeInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, currentSliceVal, orthoAxis);
    } else if (mode === 'polytope') {
      renderPolytopeInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, currentSliceVal, orthoAxis);
    } else if (mode === 'wave') {
      renderWaveInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, currentSliceVal, orthoAxis);
    } else if (mode === 'equation') {
      renderEquationInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, currentSliceVal, orthoAxis);
    }
  }
}

// --------------------------------------------------------------------------
// 1. Point Visualization
// --------------------------------------------------------------------------
function renderPointInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, sliceVal, orthoAxis) {
  const pOrig = new Vector4(App.data.point.w, App.data.point.x, App.data.point.y, App.data.point.z);
  const pRot = rotMatrix.transform(pOrig);

  const p3D = pRot.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D);
  const distToSlice = Math.abs(pRot[orthoAxis] - sliceVal);

  const group = new THREE.Group();

  let opacity = 1.0;
  let showPoint = true;

  if (isSlicing && !isProjection) {
    const threshold = 0.35;
    if (distToSlice > threshold) {
      opacity = Math.max(0.08, 1.0 - (distToSlice - threshold) * 2.0);
      if (opacity <= 0.08) showPoint = false;
    } else {
      opacity = 1.0 - (distToSlice / threshold) * 0.5;
    }
  }

  if (showPoint) {
    const isIntersecting = distToSlice < 0.12;
    const sphereRadius = isIntersecting ? 0.14 : 0.10;
    const sphereColor = isIntersecting ? 0xffffff : 0x818cf8;

    const sphereGeom = new THREE.SphereGeometry(sphereRadius, 24, 24);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: sphereColor,
      emissive: isIntersecting ? 0x6366f1 : 0x312e81,
      emissiveIntensity: isIntersecting ? 0.8 : 0.2,
      roughness: 0.2,
      metalness: 0.5,
      transparent: opacity < 1.0,
      opacity: opacity
    });
    const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
    sphereMesh.position.set(p3D.x, p3D.y, p3D.z);
    group.add(sphereMesh);

    if (isIntersecting) {
      const ringGeom = new THREE.RingGeometry(0.18, 0.22, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
      const ringMesh = new THREE.Mesh(ringGeom, ringMat);
      ringMesh.position.set(p3D.x, p3D.y, p3D.z);
      ringMesh.lookAt(vp.camera.position);
      group.add(ringMesh);
    }

    const dropMat = new THREE.LineDashedMaterial({
      color: 0x64748b,
      dashSize: 0.1,
      gapSize: 0.05,
      transparent: true,
      opacity: opacity * 0.5
    });

    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p3D.x, p3D.y, p3D.z),
      new THREE.Vector3(p3D.x, 0, p3D.z)
    ]);
    const dropLine = new THREE.Line(lineGeom, dropMat);
    dropLine.computeLineDistances();
    group.add(dropLine);
  }

  vp.addObject(group);
}

// --------------------------------------------------------------------------
// 2. Line Segment Visualization
// --------------------------------------------------------------------------
function renderLineInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, sliceVal, orthoAxis) {
  const lineData = create1DLineData(App.data.line.ptA, App.data.line.ptB, 20);
  const rotA = rotMatrix.transform(lineData.ptA);
  const rotB = rotMatrix.transform(lineData.ptB);

  const group = new THREE.Group();

  if (isProjection || !isSlicing) {
    const pA3 = rotA.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D);
    const pB3 = rotB.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D);

    const vA = new THREE.Vector3(pA3.x, pA3.y, pA3.z);
    const vB = new THREE.Vector3(pB3.x, pB3.y, pB3.z);

    const dist = vA.distanceTo(vB);
    if (dist > 0.001) {
      const cylGeom = new THREE.CylinderGeometry(0.035, 0.035, dist, 16);
      const cylMat = new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        roughness: 0.3,
        metalness: 0.6,
        transparent: isSlicing && App.visMode === 'both',
        opacity: isSlicing && App.visMode === 'both' ? 0.35 : 0.95
      });
      const cyl = new THREE.Mesh(cylGeom, cylMat);
      cyl.position.copy(vA).lerp(vB, 0.5);
      cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vB.clone().sub(vA).normalize());
      group.add(cyl);

      const ptGeom = new THREE.SphereGeometry(0.065, 16, 16);
      const ptMatA = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
      const ptMatB = new THREE.MeshStandardMaterial({ color: 0xec4899 });
      const mA = new THREE.Mesh(ptGeom, ptMatA);
      mA.position.copy(vA);
      const mB = new THREE.Mesh(ptGeom, ptMatB);
      mB.position.copy(vB);
      group.add(mA);
      group.add(mB);
    }
  }

  if (isSlicing) {
    const valA = rotA[orthoAxis];
    const valB = rotB[orthoAxis];

    const minVal = Math.min(valA, valB);
    const maxVal = Math.max(valA, valB);

    if (sliceVal >= minVal - 0.0001 && sliceVal <= maxVal + 0.0001 && Math.abs(maxVal - minVal) > 0.00001) {
      const t = (sliceVal - valA) / (valB - valA);
      const intersect4D = new Vector4().copy(rotA).lerp(rotB, t);
      const p3D = intersect4D.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D);

      const beadGeom = new THREE.SphereGeometry(0.12, 24, 24);
      const beadMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.9,
        roughness: 0.1
      });
      const bead = new THREE.Mesh(beadGeom, beadMat);
      bead.position.set(p3D.x, p3D.y, p3D.z);
      group.add(bead);

      const ringGeom = new THREE.RingGeometry(0.16, 0.22, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xfde047, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.set(p3D.x, p3D.y, p3D.z);
      ring.lookAt(vp.camera.position);
      group.add(ring);
    }
  }

  vp.addObject(group);
}

// --------------------------------------------------------------------------
// 3. Plane Visualization
// --------------------------------------------------------------------------
function renderPlaneInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, sliceVal, orthoAxis) {
  const planeData = create2DPlaneData(App.data.plane.p0, App.data.plane.u, App.data.plane.v, App.data.plane.size, 8);
  const rotVerts = planeData.vertices.map(v => rotMatrix.transform(v));

  const group = new THREE.Group();

  if (isProjection || !isSlicing) {
    const proj3D = rotVerts.map(v => v.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D));

    const positions = [];
    for (const quad of planeData.faces) {
      const v0 = proj3D[quad[0]], v1 = proj3D[quad[1]], v2 = proj3D[quad[2]], v3 = proj3D[quad[3]];
      positions.push(
        v0.x, v0.y, v0.z,  v1.x, v1.y, v1.z,  v2.x, v2.y, v2.z,
        v0.x, v0.y, v0.z,  v2.x, v2.y, v2.z,  v3.x, v3.y, v3.z
      );
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x6366f1,
      roughness: 0.3,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isSlicing && App.visMode === 'both' ? 0.25 : 0.65
    });
    group.add(new THREE.Mesh(geom, mat));

    const linePositions = [];
    for (const e of planeData.edges) {
      const p1 = proj3D[e[0]], p2 = proj3D[e[1]];
      linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    }
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0xa5b4fc,
      transparent: true,
      opacity: isSlicing && App.visMode === 'both' ? 0.35 : 0.85
    });
    group.add(new THREE.LineSegments(lineGeom, lineMat));
  }

  if (isSlicing) {
    const intersectPts = [];
    for (const e of planeData.edges) {
      const vA = rotVerts[e[0]], vB = rotVerts[e[1]];
      const valA = vA[orthoAxis], valB = vB[orthoAxis];
      if ((valA <= sliceVal && valB >= sliceVal) || (valA >= sliceVal && valB <= sliceVal)) {
        if (Math.abs(valB - valA) > 0.00001) {
          const t = (sliceVal - valA) / (valB - valA);
          const pt4D = new Vector4().copy(vA).lerp(vB, t);
          const p3 = pt4D.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D);
          intersectPts.push(new THREE.Vector3(p3.x, p3.y, p3.z));
        }
      }
    }

    if (intersectPts.length >= 2) {
      let maxDist = 0;
      let pBest1 = intersectPts[0], pBest2 = intersectPts[1];
      for (let i = 0; i < intersectPts.length; i++) {
        for (let j = i + 1; j < intersectPts.length; j++) {
          const d = intersectPts[i].distanceTo(intersectPts[j]);
          if (d > maxDist) {
            maxDist = d;
            pBest1 = intersectPts[i];
            pBest2 = intersectPts[j];
          }
        }
      }

      if (maxDist > 0.02) {
        const cylGeom = new THREE.CylinderGeometry(0.045, 0.045, maxDist, 16);
        const cylMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xeab308,
          emissiveIntensity: 0.9,
          roughness: 0.1
        });
        const cyl = new THREE.Mesh(cylGeom, cylMat);
        cyl.position.copy(pBest1).lerp(pBest2, 0.5);
        cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), pBest2.clone().sub(pBest1).normalize());
        group.add(cyl);
      }
    }
  }

  vp.addObject(group);
}

// --------------------------------------------------------------------------
// 4. Volume Visualization (3D Object in 4D)
// --------------------------------------------------------------------------
function renderVolumeInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, sliceVal, orthoAxis) {
  const volData = create3DVolumeData(App.data.volume.type, App.data.volume.size, App.data.volume.w0);
  const rotVerts = volData.vertices.map(v => rotMatrix.transform(v));
  const group = new THREE.Group();

  if (isProjection || !isSlicing) {
    const proj3D = rotVerts.map(v => v.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D));

    const positions = [];
    for (const f of volData.faces) {
      if (f.length === 4) {
        const v0 = proj3D[f[0]], v1 = proj3D[f[1]], v2 = proj3D[f[2]], v3 = proj3D[f[3]];
        positions.push(
          v0.x, v0.y, v0.z,  v1.x, v1.y, v1.z,  v2.x, v2.y, v2.z,
          v0.x, v0.y, v0.z,  v2.x, v2.y, v2.z,  v3.x, v3.y, v3.z
        );
      } else if (f.length === 3) {
        const v0 = proj3D[f[0]], v1 = proj3D[f[1]], v2 = proj3D[f[2]];
        positions.push(v0.x, v0.y, v0.z,  v1.x, v1.y, v1.z,  v2.x, v2.y, v2.z);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.35,
      metalness: 0.2,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: isSlicing && App.visMode === 'both' ? 0.2 : 0.6
    });
    group.add(new THREE.Mesh(geom, mat));

    const linePositions = [];
    for (const e of volData.edges) {
      const p1 = proj3D[e[0]], p2 = proj3D[e[1]];
      linePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
    }
    const lineGeom = new THREE.BufferGeometry();
    lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x93c5fd,
      transparent: true,
      opacity: isSlicing && App.visMode === 'both' ? 0.35 : 0.9
    });
    group.add(new THREE.LineSegments(lineGeom, lineMat));
  }

  if (isSlicing) {
    const intersectPts = [];
    for (const e of volData.edges) {
      const vA = rotVerts[e[0]], vB = rotVerts[e[1]];
      const valA = vA[orthoAxis], valB = vB[orthoAxis];
      if ((valA <= sliceVal && valB >= sliceVal) || (valA >= sliceVal && valB <= sliceVal)) {
        if (Math.abs(valB - valA) > 0.00001) {
          const t = (sliceVal - valA) / (valB - valA);
          const pt4D = new Vector4().copy(vA).lerp(vB, t);
          const p3 = pt4D.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D);
          intersectPts.push(new THREE.Vector3(p3.x, p3.y, p3.z));
        }
      }
    }

    if (intersectPts.length >= 3) {
      const center = new THREE.Vector3();
      intersectPts.forEach(p => center.add(p));
      center.divideScalar(intersectPts.length);

      const n = new THREE.Vector3().crossVectors(
        intersectPts[1].clone().sub(intersectPts[0]),
        intersectPts[2].clone().sub(intersectPts[0])
      ).normalize();

      const uVec = intersectPts[0].clone().sub(center).normalize();
      const vVec = new THREE.Vector3().crossVectors(n, uVec).normalize();

      intersectPts.sort((a, b) => {
        const da = a.clone().sub(center);
        const db = b.clone().sub(center);
        const angleA = Math.atan2(da.dot(vVec), da.dot(uVec));
        const angleB = Math.atan2(db.dot(vVec), db.dot(uVec));
        return angleA - angleB;
      });

      const polyPos = [];
      for (let i = 1; i < intersectPts.length - 1; i++) {
        polyPos.push(
          intersectPts[0].x, intersectPts[0].y, intersectPts[0].z,
          intersectPts[i].x, intersectPts[i].y, intersectPts[i].z,
          intersectPts[i + 1].x, intersectPts[i + 1].y, intersectPts[i + 1].z
        );
      }

      const polyGeom = new THREE.BufferGeometry();
      polyGeom.setAttribute('position', new THREE.Float32BufferAttribute(polyPos, 3));
      polyGeom.computeVertexNormals();

      const polyMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xca8a04,
        emissiveIntensity: 0.6,
        side: THREE.DoubleSide,
        roughness: 0.2
      });
      group.add(new THREE.Mesh(polyGeom, polyMat));

      const loopPos = [];
      for (let i = 0; i < intersectPts.length; i++) {
        const next = (i + 1) % intersectPts.length;
        loopPos.push(
          intersectPts[i].x, intersectPts[i].y, intersectPts[i].z,
          intersectPts[next].x, intersectPts[next].y, intersectPts[next].z
        );
      }
      const loopGeom = new THREE.BufferGeometry();
      loopGeom.setAttribute('position', new THREE.Float32BufferAttribute(loopPos, 3));
      const loopMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
      group.add(new THREE.LineSegments(loopGeom, loopMat));
    }
  }

  vp.addObject(group);
}

// --------------------------------------------------------------------------
// 5. 4D Polytope Visualization (Tesseract, 5-Cell, 16-Cell, 24-Cell, Clifford)
// --------------------------------------------------------------------------
function renderPolytopeInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, sliceVal, orthoAxis) {
  let polyData;
  const polyType = App.data.polytope.type;

  if (polyType === 'tesseract') polyData = createTesseractData();
  else if (polyType === '5cell') polyData = create5CellData();
  else if (polyType === '16cell') polyData = create16CellData();
  else if (polyType === '24cell') polyData = create24CellData();
  else if (polyType === 'clifford') polyData = createCliffordTorusData();

  const rotVerts = polyData.vertices.map(v => rotMatrix.transform(v));
  const group = new THREE.Group();

  if (isProjection || !isSlicing) {
    const proj3D = rotVerts.map(v => v.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D));

    if (App.data.polytope.showFaces && polyData.faces.length > 0) {
      const positions = [];
      for (const f of polyData.faces) {
        if (f.length === 4) {
          const v0 = proj3D[f[0]], v1 = proj3D[f[1]], v2 = proj3D[f[2]], v3 = proj3D[f[3]];
          positions.push(
            v0.x, v0.y, v0.z,  v1.x, v1.y, v1.z,  v2.x, v2.y, v2.z,
            v0.x, v0.y, v0.z,  v2.x, v2.y, v2.z,  v3.x, v3.y, v3.z
          );
        } else if (f.length === 3) {
          const v0 = proj3D[f[0]], v1 = proj3D[f[1]], v2 = proj3D[f[2]];
          positions.push(v0.x, v0.y, v0.z,  v1.x, v1.y, v1.z,  v2.x, v2.y, v2.z);
        }
      }

      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geom.computeVertexNormals();

      const faceMat = new THREE.MeshStandardMaterial({
        color: 0x8b5cf6,
        roughness: 0.3,
        metalness: 0.4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: App.data.polytope.faceOpacity
      });
      group.add(new THREE.Mesh(geom, faceMat));
    }

    if (App.data.polytope.wireframe && polyData.edges.length > 0) {
      const edgePositions = [];
      for (const e of polyData.edges) {
        const p1 = proj3D[e[0]], p2 = proj3D[e[1]];
        edgePositions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
      const edgeGeom = new THREE.BufferGeometry();
      edgeGeom.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0xc4b5fd,
        transparent: true,
        opacity: isSlicing && App.visMode === 'both' ? 0.35 : 0.85
      });
      group.add(new THREE.LineSegments(edgeGeom, edgeMat));

      const vertGeom = new THREE.SphereGeometry(0.045, 12, 12);
      const vertMat = new THREE.MeshStandardMaterial({ color: 0xa78bfa });
      for (const p of proj3D) {
        const vMesh = new THREE.Mesh(vertGeom, vertMat);
        vMesh.position.set(p.x, p.y, p.z);
        group.add(vMesh);
      }
    }
  }

  if (isSlicing && polyData.edges.length > 0) {
    const intersectPts = [];
    for (const e of polyData.edges) {
      const vA = rotVerts[e[0]], vB = rotVerts[e[1]];
      const valA = vA[orthoAxis], valB = vB[orthoAxis];
      if ((valA <= sliceVal && valB >= sliceVal) || (valA >= sliceVal && valB <= sliceVal)) {
        if (Math.abs(valB - valA) > 0.00001) {
          const t = (sliceVal - valA) / (valB - valA);
          const pt4D = new Vector4().copy(vA).lerp(vB, t);
          const p3 = pt4D.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D);
          intersectPts.push(new THREE.Vector3(p3.x, p3.y, p3.z));
        }
      }
    }

    if (intersectPts.length > 0) {
      const beadGeom = new THREE.SphereGeometry(0.07, 16, 16);
      const beadMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.8
      });
      for (const pt of intersectPts) {
        const bead = new THREE.Mesh(beadGeom, beadMat);
        bead.position.copy(pt);
        group.add(bead);
      }
    }
  }

  vp.addObject(group);
}

// --------------------------------------------------------------------------
// 6. Custom 4D Implicit & Wave PDE Visualization (Marching Cubes 3D Slices)
// --------------------------------------------------------------------------

// --------------------------------------------------------------------------
// 7. 4D Spacetime Wave Visualization across All 4 Coordinate Systems
// --------------------------------------------------------------------------
function renderWaveInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, sliceVal, orthoAxis) {
  const wave = App.data.wave;
  const t = wave.time;
  const v = wave.speed;
  const k = wave.k;
  const group = new THREE.Group();

  // Dynamic Spacetime HUD labels
  const hudBadge = document.querySelector('#panel-' + subspaceKey + ' .hud-badge-title');
  const hudOrtho = document.querySelector('#panel-' + subspaceKey + ' .hud-ortho-info');

  if (subspaceKey === 'xyz') {
    // ----------------------------------------------------------------------
    // Viewport 2: Pure Physical 3D Space (x, y, z) at Time t
    // ----------------------------------------------------------------------
    if (hudBadge) hudBadge.innerText = 'Physical 3D Space: (x, y, z)';
    if (hudOrtho) hudOrtho.innerHTML = 'Time: <strong>t = ' + t.toFixed(2) + 's</strong> &bull; Speed: ' + v.toFixed(1);

    // Central Wave Source Marker
    const sourceGeom = new THREE.SphereGeometry(0.08, 16, 16);
    const sourceMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xeab308,
      emissiveIntensity: 0.9,
      roughness: 0.1
    });
    group.add(new THREE.Mesh(sourceGeom, sourceMat));

    if (wave.type === 'spherical' || wave.type === 'cone') {
      // Concentric Expanding Spherical Wavefronts
      const maxR = 2.4;
      const baseR = Math.abs(v * t);
      const wavelength = (Math.PI * 2) / k;
      const shellCount = wave.type === 'cone' ? 1 : 3;

      for (let i = 0; i < shellCount; i++) {
        let r = baseR - i * wavelength;
        while (r < 0) r += maxR;
        r = r % maxR;

        if (r > 0.08 && r < maxR) {
          const shellGeom = new THREE.SphereGeometry(r, 32, 24);
          const opacity = Math.max(0.12, 0.55 - (r / maxR) * 0.4);
          const shellMat = new THREE.MeshStandardMaterial({
            color: i === 0 ? 0xd9eafd : 0xbcccdc,
            roughness: 0.25,
            metalness: 0.4,
            transparent: true,
            opacity: opacity,
            side: THREE.DoubleSide
          });
          group.add(new THREE.Mesh(shellGeom, shellMat));

          // Subtle Wavefront Ring Edge
          const edgeGeom = new THREE.RingGeometry(r - 0.015, r + 0.015, 36);
          const edgeMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide });
          const ring = new THREE.Mesh(edgeGeom, edgeMat);
          ring.rotation.x = Math.PI / 2;
          group.add(ring);
        }
      }

      // Radiating Wave Vectors / Rays
      if (wave.showRays) {
        const rayDirs = [
          [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
          [0.7, 0.7, 0], [-0.7, 0.7, 0], [0, 0.7, 0.7], [0, -0.7, 0.7], [0.7, 0, 0.7], [-0.7, 0, 0.7]
        ];
        const rayLen = Math.min(baseR > 0.1 ? baseR : 1.8, 2.3);
        for (const dir of rayDirs) {
          const p1 = new THREE.Vector3(0, 0, 0);
          const p2 = new THREE.Vector3(dir[0] * rayLen, dir[1] * rayLen, dir[2] * rayLen);
          const rayGeom = new THREE.BufferGeometry().setFromPoints([p1, p2]);
          const rayMat = new THREE.LineDashedMaterial({ color: 0x9aa6b2, dashSize: 0.08, gapSize: 0.05, transparent: true, opacity: 0.6 });
          const line = new THREE.Line(rayGeom, rayMat);
          line.computeLineDistances();
          group.add(line);
        }
      }

    } else if (wave.type === 'plane') {
      // 3D Harmonic Plane Wave: Moving parallel wavefront planes
      const planeSpacing = (Math.PI * 2) / k;
      const phase = (v * k * t) % (Math.PI * 2);
      for (let s = -2; s <= 2; s++) {
        const posX = s * planeSpacing + (phase / k);
        if (Math.abs(posX) <= 2.2) {
          const planeGeom = new THREE.PlaneGeometry(3.6, 3.6);
          const planeMat = new THREE.MeshStandardMaterial({
            color: 0xd9eafd,
            roughness: 0.3,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.35
          });
          const pMesh = new THREE.Mesh(planeGeom, planeMat);
          pMesh.position.set(posX, 0, 0);
          pMesh.rotation.y = Math.PI / 2;
          group.add(pMesh);
        }
      }

    } else if (wave.type === 'standing') {
      // 3D Resonant Standing Wave: pulsating cavity antinodes
      const amp = Math.abs(Math.cos(v * k * t));
      for (let ix = -1; ix <= 1; ix++) {
        for (let iy = -1; iy <= 1; iy++) {
          for (let iz = -1; iz <= 1; iz++) {
            const rNode = 0.28 * amp;
            if (rNode > 0.02) {
              const nodeGeom = new THREE.SphereGeometry(rNode, 16, 16);
              const nodeMat = new THREE.MeshStandardMaterial({
                color: (ix + iy + iz) % 2 === 0 ? 0xd9eafd : 0x38bdf8,
                roughness: 0.2,
                transparent: true,
                opacity: 0.65
              });
              const nMesh = new THREE.Mesh(nodeGeom, nodeMat);
              nMesh.position.set(ix * 0.9, iy * 0.9, iz * 0.9);
              group.add(nMesh);
            }
          }
        }
      }

    } else if (wave.type === 'packet') {
      // Moving Gaussian 3D wavepacket pulse
      const packetX = ((v * t + 2.4) % 4.8) - 2.4;
      const packetGeom = new THREE.SphereGeometry(0.65, 24, 24);
      packetGeom.scale(1.4, 0.9, 0.9);
      const packetMat = new THREE.MeshStandardMaterial({
        color: 0xd9eafd,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.4,
        roughness: 0.2,
        transparent: true,
        opacity: 0.65
      });
      const pMesh = new THREE.Mesh(packetGeom, packetMat);
      pMesh.position.set(packetX, 0, 0);
      group.add(pMesh);
    }

  } else {
    // ----------------------------------------------------------------------
    // Viewports 1, 3, 4: 3D Spacetime Views (wxy: (t, x, y), yzw: (y, z, t), wxz: (t, x, z))
    // ----------------------------------------------------------------------
    let spaceName = '';
    let spatialSliceAxis = '';
    let z0 = 0.0;

    if (subspaceKey === 'wxy') {
      spaceName = 'Spacetime (t, x, y)';
      spatialSliceAxis = 'Z';
      z0 = App.sliceCoords.z;
    } else if (subspaceKey === 'yzw') {
      spaceName = 'Spacetime (y, z, t)';
      spatialSliceAxis = 'X';
      z0 = App.sliceCoords.x;
    } else if (subspaceKey === 'wxz') {
      spaceName = 'Spacetime (t, x, z)';
      spatialSliceAxis = 'Y';
      z0 = App.sliceCoords.y;
    }

    if (hudBadge) hudBadge.innerText = spaceName;
    if (hudOrtho) hudOrtho.innerHTML = 'Slice: ' + spatialSliceAxis + ' = ' + z0.toFixed(2) + ' &bull; Time: <strong>t = ' + t.toFixed(2) + 's</strong>';

    // 1. Spacetime Cone / Hyperboloid Geometry
    // v^2 * t^2 - (x^2 + y^2) = z0^2
    const coneGeom = createSpacetimeConeMesh(v, z0, 2.3, 36, 24);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xbcccdc,
      roughness: 0.35,
      metalness: 0.3,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const coneMesh = new THREE.Mesh(coneGeom, coneMat);

    // Adjust orientation so time axis aligns properly with Three.js coordinates
    if (subspaceKey === 'yzw') {
      // In yzw: Three.js X=y, Y=z, Z=t (w). Rotate cone mesh to align time along Z
      coneMesh.rotation.y = Math.PI / 2;
    }
    group.add(coneMesh);

    // Wireframe edges on cone
    const edgeLines = new THREE.LineSegments(
      new THREE.WireframeGeometry(coneGeom),
      new THREE.LineBasicMaterial({ color: 0xd9eafd, transparent: true, opacity: 0.25 })
    );
    if (subspaceKey === 'yzw') edgeLines.rotation.y = Math.PI / 2;
    group.add(edgeLines);

    // 2. Current Time Slice Plane (t = currentTime)
    if (wave.showTimePlane) {
      const planeSize = 4.2;
      const timePlaneGeom = new THREE.PlaneGeometry(planeSize, planeSize);
      const timePlaneMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.2,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.22
      });
      const tPlaneMesh = new THREE.Mesh(timePlaneGeom, timePlaneMat);

      if (subspaceKey === 'wxy' || subspaceKey === 'wxz') {
        // Time is along X axis (w)
        tPlaneMesh.position.set(t, 0, 0);
        tPlaneMesh.rotation.y = Math.PI / 2;
      } else if (subspaceKey === 'yzw') {
        // Time is along Z axis (w)
        tPlaneMesh.position.set(0, 0, t);
      }
      group.add(tPlaneMesh);

      // 3. Highlighted Golden Intersection Ring at Current Time t
      // Radius R = sqrt(v^2 * t^2 - z0^2)
      const sliceCircle = createTimeSliceCircleMesh(t, v, z0, 48);
      if (sliceCircle) {
        const ringMat = new THREE.LineBasicMaterial({ color: 0xfde047, linewidth: 2.5 });
        const ringObj = new THREE.LineLoop(sliceCircle.geom, ringMat);
        if (subspaceKey === 'yzw') ringObj.rotation.y = Math.PI / 2;
        group.add(ringObj);

        // Pulsing bead on the ring
        const bead = new THREE.Mesh(
          new THREE.SphereGeometry(0.065, 12, 12),
          new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xeab308, emissiveIntensity: 0.8 })
        );
        if (subspaceKey === 'wxy' || subspaceKey === 'wxz') {
          bead.position.set(t, sliceCircle.radius, 0);
        } else {
          bead.position.set(sliceCircle.radius, 0, t);
        }
        group.add(bead);
      }
    }
  }

  vp.addObject(group);
}

function renderEquationInSubspace(vp, subspaceKey, rotMatrix, isSlicing, isProjection, sliceVal, orthoAxis) {
  if (!App.data.equation.compiledFn) return;
  const fn = App.data.equation.compiledFn;

  const group = new THREE.Group();

  if (isSlicing || App.visMode === 'both') {
    let eval3D;

    if (subspaceKey === 'wxy') {
      eval3D = (u, v, w_c) => fn(u, v, w_c, sliceVal);
    } else if (subspaceKey === 'xyz') {
      eval3D = (u, v, w_c) => fn(sliceVal, u, v, w_c);
    } else if (subspaceKey === 'yzw') {
      eval3D = (u, v, w_c) => fn(w_c, sliceVal, u, v);
    } else if (subspaceKey === 'wxz') {
      eval3D = (u, v, w_c) => fn(u, v, sliceVal, w_c);
    }

    try {
      const geo = App.isosurfaceExtractor.extract(eval3D, {
        min: -2.3,
        max: 2.3,
        resolution: App.data.equation.resolution,
        targetValue: 0.0
      });

      if (geo) {
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(App.data.equation.surfaceColor),
          roughness: 0.25,
          metalness: 0.4,
          side: THREE.DoubleSide,
          transparent: App.data.equation.surfaceOpacity < 0.99,
          opacity: App.data.equation.surfaceOpacity,
          wireframe: App.data.equation.wireframe
        });
        const mesh = new THREE.Mesh(geo, mat);
        group.add(mesh);
      }
    } catch (err) {
      console.warn("Isosurface extraction error:", err);
    }
  }

  if (App.data.equation.showPointCloud || isProjection) {
    const ptCloudGeo = createPointCloudForEquation(fn, subspaceKey, 600);
    if (ptCloudGeo) {
      const ptMat = new THREE.PointsMaterial({
        size: 0.04,
        vertexColors: true,
        transparent: true,
        opacity: isSlicing && App.visMode === 'both' ? 0.3 : 0.75
      });
      group.add(new THREE.Points(ptCloudGeo, ptMat));
    }
  }

  vp.addObject(group);
}

function createPointCloudForEquation(fn, subspaceKey, numPoints = 600) {
  const positions = [];
  const colors = [];
  const subConfig = SUBSPACES[subspaceKey];

  let found = 0;
  const attempts = numPoints * 8;

  for (let i = 0; i < attempts && found < numPoints; i++) {
    const w = (Math.random() * 2 - 1) * 2.0;
    const x = (Math.random() * 2 - 1) * 2.0;
    const y = (Math.random() * 2 - 1) * 2.0;
    const z = (Math.random() * 2 - 1) * 2.0;

    const val = fn(w, x, y, z);
    if (Math.abs(val) < 0.15) {
      const pt4D = new Vector4(w, x, y, z);
      const p3 = pt4D.projectTo3D(subspaceKey, App.perspective4D, App.cameraDist4D);
      positions.push(p3.x, p3.y, p3.z);

      const orthoVal = (pt4D[subConfig.orthogonal] + 2.0) / 4.0;
      const col = new THREE.Color().setHSL(0.65 + orthoVal * 0.4, 0.8, 0.55);
      colors.push(col.r, col.g, col.b);
      found++;
    }
  }

  if (positions.length === 0) return null;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

// --------------------------------------------------------------------------
// Educational Text Explanations
// --------------------------------------------------------------------------
function updateEducationalText() {
  const title = document.getElementById('eduCardTitle');
  const body = document.getElementById('eduCardBody');

  const mode = App.mode;

  if (mode === 'point') {
    title.innerText = '0D Point in 4D Space';
    body.innerHTML = `
      A point in 4D is specified by four numbers: <code>(w, x, y, z)</code>.<br><br>
      Notice how each of the 4 viewports displays three of the coordinates.
      When you move the <strong style="color: var(--axis-w)">W</strong> slider, its position changes in <strong>(w,x,y)</strong>, <strong>(y,z,w)</strong>, and <strong>(w,x,z)</strong>, but remains completely motionless in standard <strong>(x,y,z)</strong> space!
    `;
  } else if (mode === 'line') {
    title.innerText = '1D Line Segment in 4D';
    body.innerHTML = `
      A 1D line in 4D connects two 4-tuples $P_1$ and $P_2$.<br><br>
      <strong>Dimensional Rule:</strong> Slicing a 1D line with a 3D hyperplane yields at most <strong>one 0D point</strong>! Notice the yellow glowing bead that appears whenever the slicing plane cuts through the line segment.
    `;
  } else if (mode === 'plane') {
    title.innerText = '2D Plane Patch in 4D';
    body.innerHTML = `
      A 2D plane has 2 degrees of freedom inside 4-dimensional space.<br><br>
      <strong>Dimensional Rule:</strong> When a 3D hyperplane slices a 2D plane in 4D, the intersection is a <strong>1D line segment</strong>! Watch the yellow glowing laser line move across the plane as you adjust the slicing sliders.
    `;
  } else if (mode === 'volume') {
    title.innerText = '3D Volume in 4D Space';
    body.innerHTML = `
      A 3D cube or sphere can be placed at a specific coordinate in the 4th dimension (e.g. $w = w_0$).<br><br>
      When you rotate the 3D volume in a 4D plane (such as <strong>Plane X-W</strong>), the 3D volume literally rotates <em>into</em> the 4th dimension! Its shadow in $(x,y,z)$ compresses and expands, while appearing in $(w,x,y)$!
    `;
  } else if (mode === 'polytope') {
    title.innerText = '4D Polytopes & The Tesseract';
    body.innerHTML = `
      The Tesseract (8-cell) is the 4D analog of the 3D cube and 2D square.<br><br>
      It has <strong>16 vertices</strong>, <strong>32 edges</strong>, <strong>24 square faces</strong>, and <strong>8 cubic cells</strong>.
      Rotating in the $XW$ or $ZW$ planes produces the iconic 4D 'inside-out' motion, where the inner and outer cubes invert through each other!
    `;
  } else if (mode === 'equation') {
    if (App.data.equation.isWavePDE) {
      title.innerText = '3D Wave Equation in Spacetime (t, x, y, z)';
      body.innerHTML = `
        <strong>Wave Equation:</strong> <code>∂²u/∂t² = v² (∂²u/∂x² + ∂²u/∂y² + ∂²u/∂z²)</code><br><br>
        In 4D spacetime coordinates, Time $t$ is mapped directly to the 4th dimension <strong style="color: var(--axis-w)">W</strong> ($w = t$).<br><br>
        <strong>How it appears across the 4 3D Subspaces:</strong><br>
        • <strong>Subspace (x, y, z) [Sliced at Time w=t]:</strong> Shows physical 3D space evolving over time. At slice $w = t$, expanding spherical wavefronts of radius $R = v|t|$ expand outward at speed $v$.<br>
        • <strong>Subspace (w, x, y) [Sliced at Space z=z₀]:</strong> Shows the spacetime hyperbolic manifold $w² - v²(x² + y²) = v² z₀²$, revealing the cone structure connecting space and time.<br>
        • <strong>Subspaces (y, z, w) & (w, x, z):</strong> Slices along $X$ and $Y$ revealing the relativistic hyperbolic sheets!
      `;
    } else {
      title.innerText = '4D Implicit Equations: F(w, x, y, z) = 0';
      body.innerHTML = `
        For the 4D Hypersphere <code>w^2 + x^2 + y^2 + z^2 = r^2</code>:<br><br>
        When you slice at <code>w = w_slice</code>, the equation becomes a 3D sphere with radius $R_{3D} = \\sqrt{r^2 - w_{\\text{slice}}^2}$.
        Press <strong>Auto-Sweep</strong> to watch the 3D spheres grow, peak at the equator ($w=0$), and shrink away into empty space!
      `;
    }
  }
}
