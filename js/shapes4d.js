/**
 * shapes4d.js - Generators for 0D, 1D, 2D, 3D, 4D Polytopes, and 4D Spacetime Waves
 */

// --------------------------------------------------------------------------
// 1. Tesseract (8-Cell) Geometry Data
// --------------------------------------------------------------------------
function createTesseractData() {
  const vertices = [];
  // 16 vertices: (+-1, +-1, +-1, +-1)
  for (let i = 0; i < 16; i++) {
    const w = (i & 8) ? 1 : -1;
    const x = (i & 4) ? 1 : -1;
    const y = (i & 2) ? 1 : -1;
    const z = (i & 1) ? 1 : -1;
    vertices.push(new Vector4(w, x, y, z));
  }

  // 32 edges: connect vertices that differ in exactly 1 bit
  const edges = [];
  for (let i = 0; i < 16; i++) {
    for (let bit = 1; bit <= 8; bit <<= 1) {
      if ((i & bit) === 0) {
        edges.push([i, i | bit]);
      }
    }
  }

  // 24 square faces
  const faces = [];
  const coords = ['w', 'x', 'y', 'z'];
  for (let a = 0; a < 4; a++) {
    for (let b = a + 1; b < 4; b++) {
      const otherAxes = [0, 1, 2, 3].filter(k => k !== a && k !== b);
      for (let s1 of [-1, 1]) {
        for (let s2 of [-1, 1]) {
          const faceVerts = [];
          for (let sa of [-1, 1]) {
            for (let sb of [-1, 1]) {
              const v = [0, 0, 0, 0];
              v[otherAxes[0]] = s1;
              v[otherAxes[1]] = s2;
              v[a] = sa;
              v[b] = sb;
              let idx = 0;
              if (v[0] === 1) idx |= 8;
              if (v[1] === 1) idx |= 4;
              if (v[2] === 1) idx |= 2;
              if (v[3] === 1) idx |= 1;
              faceVerts.push(idx);
            }
          }
          faces.push([faceVerts[0], faceVerts[1], faceVerts[3], faceVerts[2]]);
        }
      }
    }
  }

  const cells = [
    { name: 'W = -1 (Inner Cube)', axis: 'w', val: -1, color: 0x3b82f6 },
    { name: 'W = +1 (Outer Cube)', axis: 'w', val: 1, color: 0x8b5cf6 },
    { name: 'X = -1 Cell', axis: 'x', val: -1, color: 0xef4444 },
    { name: 'X = +1 Cell', axis: 'x', val: 1, color: 0xf97316 },
    { name: 'Y = -1 Cell', axis: 'y', val: -1, color: 0x10b981 },
    { name: 'Y = +1 Cell', axis: 'y', val: 1, color: 0x14b8a6 },
    { name: 'Z = -1 Cell', axis: 'z', val: -1, color: 0x06b6d4 },
    { name: 'Z = +1 Cell', axis: 'z', val: 1, color: 0xec4899 }
  ];

  return { vertices, edges, faces, cells };
}

// --------------------------------------------------------------------------
// 2. 5-Cell (4D Simplex / Pentatope)
// --------------------------------------------------------------------------
function create5CellData() {
  const r = 1.6;
  const s5 = Math.sqrt(5);
  const vertices = [
    new Vector4(r, r, r, -r / s5),
    new Vector4(r, -r, -r, -r / s5),
    new Vector4(-r, r, -r, -r / s5),
    new Vector4(-r, -r, r, -r / s5),
    new Vector4(0, 0, 0, r * (s5 - 1 / s5))
  ];

  const edges = [];
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      edges.push([i, j]);
    }
  }

  const faces = [];
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      for (let k = j + 1; k < 5; k++) {
        faces.push([i, j, k]);
      }
    }
  }

  return { vertices, edges, faces, cells: [] };
}

// --------------------------------------------------------------------------
// 3. 16-Cell (Hyperoctahedron)
// --------------------------------------------------------------------------
function create16CellData() {
  const s = 1.8;
  const vertices = [
    new Vector4( s,  0,  0,  0), new Vector4(-s,  0,  0,  0),
    new Vector4( 0,  s,  0,  0), new Vector4( 0, -s,  0,  0),
    new Vector4( 0,  0,  s,  0), new Vector4( 0,  0, -s,  0),
    new Vector4( 0,  0,  0,  s), new Vector4( 0,  0,  0, -s)
  ];

  const edges = [];
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      if ((i ^ j) !== 1) {
        edges.push([i, j]);
      }
    }
  }

  const faces = [];
  for (let i = 0; i < 8; i++) {
    for (let j = i + 1; j < 8; j++) {
      if ((i ^ j) === 1) continue;
      for (let k = j + 1; k < 8; k++) {
        if ((i ^ k) === 1 || (j ^ k) === 1) continue;
        faces.push([i, j, k]);
      }
    }
  }

  return { vertices, edges, faces, cells: [] };
}

// --------------------------------------------------------------------------
// 4. 24-Cell
// --------------------------------------------------------------------------
function create24CellData() {
  const vertices = [];
  const s = 1.5;
  const s2 = s * Math.SQRT2;
  const bases = [
    [s2, 0, 0, 0], [-s2, 0, 0, 0],
    [0, s2, 0, 0], [0, -s2, 0, 0],
    [0, 0, s2, 0], [0, 0, -s2, 0],
    [0, 0, 0, s2], [0, 0, 0, -s2]
  ];
  for (let b of bases) vertices.push(new Vector4(b[0], b[1], b[2], b[3]));

  for (let i = 0; i < 16; i++) {
    vertices.push(new Vector4(
      (i & 8) ? s : -s,
      (i & 4) ? s : -s,
      (i & 2) ? s : -s,
      (i & 1) ? s : -s
    ));
  }

  const edges = [];
  const targetDist = s * Math.SQRT2;
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      const d = vertices[i].distanceTo(vertices[j]);
      if (Math.abs(d - targetDist) < 0.05) {
        edges.push([i, j]);
      }
    }
  }

  return { vertices, edges, faces: [], cells: [] };
}

// --------------------------------------------------------------------------
// 5. Clifford Torus (Parametric 4D Surface)
// --------------------------------------------------------------------------
function createCliffordTorusData(uSteps = 24, vSteps = 24, R = 1.2, r = 1.2) {
  const vertices = [];
  const edges = [];
  const faces = [];

  for (let i = 0; i < uSteps; i++) {
    const u = (i / uSteps) * Math.PI * 2;
    for (let j = 0; j < vSteps; j++) {
      const v = (j / vSteps) * Math.PI * 2;
      vertices.push(new Vector4(
        R * Math.cos(u),
        R * Math.sin(u),
        r * Math.cos(v),
        r * Math.sin(v)
      ));
    }
  }

  for (let i = 0; i < uSteps; i++) {
    const nextI = (i + 1) % uSteps;
    for (let j = 0; j < vSteps; j++) {
      const nextJ = (j + 1) % vSteps;
      const idx1 = i * vSteps + j;
      const idx2 = nextI * vSteps + j;
      const idx3 = nextI * vSteps + nextJ;
      const idx4 = i * vSteps + nextJ;

      edges.push([idx1, idx2]);
      edges.push([idx1, idx4]);
      faces.push([idx1, idx2, idx3, idx4]);
    }
  }

  return { vertices, edges, faces, cells: [] };
}

// --------------------------------------------------------------------------
// 6. 3D Volume Embedded in 4D Space (Cube, Sphere, Cylinder)
// --------------------------------------------------------------------------
function create3DVolumeData(type = 'cube', size = 1.5, w0 = 0.0) {
  const vertices = [];
  const edges = [];
  const faces = [];

  if (type === 'cube') {
    for (let i = 0; i < 8; i++) {
      const x = (i & 4) ? size : -size;
      const y = (i & 2) ? size : -size;
      const z = (i & 1) ? size : -size;
      vertices.push(new Vector4(w0, x, y, z));
    }
    for (let i = 0; i < 8; i++) {
      for (let bit = 1; bit <= 4; bit <<= 1) {
        if ((i & bit) === 0) {
          edges.push([i, i | bit]);
        }
      }
    }
    faces.push(
      [0, 1, 3, 2], [4, 5, 7, 6],
      [0, 1, 5, 4], [2, 3, 7, 6],
      [0, 2, 6, 4], [1, 3, 7, 5]
    );
  } else if (type === 'sphere') {
    const latBands = 12;
    const lonBands = 16;
    for (let lat = 0; lat <= latBands; lat++) {
      const theta = (lat * Math.PI) / latBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      for (let lon = 0; lon <= lonBands; lon++) {
        const phi = (lon * 2 * Math.PI) / lonBands;
        const x = size * sinTheta * Math.cos(phi);
        const y = size * cosTheta;
        const z = size * sinTheta * Math.sin(phi);
        vertices.push(new Vector4(w0, x, y, z));
      }
    }
    for (let lat = 0; lat < latBands; lat++) {
      for (let lon = 0; lon < lonBands; lon++) {
        const first = lat * (lonBands + 1) + lon;
        const second = first + lonBands + 1;
        edges.push([first, second]);
        edges.push([first, first + 1]);
        faces.push([first, second, second + 1, first + 1]);
      }
    }
  } else if (type === 'tetrahedron') {
    const a = size * 1.4;
    vertices.push(
      new Vector4(w0,  a,  a,  a),
      new Vector4(w0, -a, -a,  a),
      new Vector4(w0, -a,  a, -a),
      new Vector4(w0,  a, -a, -a)
    );
    edges.push([0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]);
    faces.push([0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]);
  }

  return { vertices, edges, faces, cells: [] };
}

// --------------------------------------------------------------------------
// 7. 2D Plane Patch in 4D
// --------------------------------------------------------------------------
function create2DPlaneData(p0, uVec, vVec, size = 1.5, gridSteps = 6) {
  const vertices = [];
  const edges = [];
  const faces = [];

  for (let i = 0; i <= gridSteps; i++) {
    const s = ((i / gridSteps) * 2 - 1) * size;
    for (let j = 0; j <= gridSteps; j++) {
      const t = ((j / gridSteps) * 2 - 1) * size;
      const pt = new Vector4(
        p0.w + s * uVec.w + t * vVec.w,
        p0.x + s * uVec.x + t * vVec.x,
        p0.y + s * uVec.y + t * vVec.y,
        p0.z + s * uVec.z + t * vVec.z
      );
      vertices.push(pt);
    }
  }

  const rowCount = gridSteps + 1;
  for (let i = 0; i < gridSteps; i++) {
    for (let j = 0; j < gridSteps; j++) {
      const idx1 = i * rowCount + j;
      const idx2 = (i + 1) * rowCount + j;
      const idx3 = (i + 1) * rowCount + (j + 1);
      const idx4 = i * rowCount + (j + 1);

      edges.push([idx1, idx2]);
      edges.push([idx1, idx4]);
      faces.push([idx1, idx2, idx3, idx4]);
    }
  }

  return { vertices, edges, faces, cells: [] };
}

// --------------------------------------------------------------------------
// 8. 1D Line Segment in 4D
// --------------------------------------------------------------------------
function create1DLineData(ptA, ptB, steps = 10) {
  const vertices = [];
  const edges = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pt = new Vector4(
      ptA.w + t * (ptB.w - ptA.w),
      ptA.x + t * (ptB.x - ptA.x),
      ptA.y + t * (ptB.y - ptA.y),
      ptA.z + t * (ptB.z - ptA.z)
    );
    vertices.push(pt);
    if (i > 0) {
      edges.push([i - 1, i]);
    }
  }

  return { vertices, edges, faces: [], cells: [], ptA, ptB };
}

// --------------------------------------------------------------------------
// 9. 4D Spacetime Wave Mesh Generators (Cones, Hyperboloids, Wavefronts)
// --------------------------------------------------------------------------

/**
 * Creates 3D Spacetime Cone / Hyperboloid mesh: v^2 * t^2 - (x^2 + y^2) = z0^2
 * Used for (t, x, y), (y, z, t), and (t, x, z) views
 */
function createSpacetimeConeMesh(v = 1.0, z0 = 0.0, height = 2.4, radialSegments = 36, heightSegments = 24) {
  const positions = [];
  const uvs = [];
  const z0Sq = z0 * z0;

  for (let h = 0; h <= heightSegments; h++) {
    // t varies from -height to +height
    const t = ((h / heightSegments) * 2 - 1) * height;
    // radius in the two spatial dimensions at time t
    const rSq = (v * v * t * t) - z0Sq;
    const r = rSq > 0 ? Math.sqrt(rSq) : 0;

    for (let s = 0; s <= radialSegments; s++) {
      const theta = (s / radialSegments) * Math.PI * 2;
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      // In Three.js space: X is time t, Y is space X, Z is space Y
      positions.push(t, x, y);
      uvs.push(s / radialSegments, h / heightSegments);
    }
  }

  const indices = [];
  const rowSize = radialSegments + 1;
  for (let h = 0; h < heightSegments; h++) {
    for (let s = 0; s < radialSegments; s++) {
      const i0 = h * rowSize + s;
      const i1 = i0 + 1;
      const i2 = (h + 1) * rowSize + s;
      const i3 = i2 + 1;

      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

/**
 * Creates Instantaneous Time Slice Circle in Spacetime
 */
function createTimeSliceCircleMesh(currentTime, v = 1.0, z0 = 0.0, radialSegments = 48) {
  const z0Sq = z0 * z0;
  const rSq = (v * v * currentTime * currentTime) - z0Sq;
  if (rSq <= 0.001) return null;

  const r = Math.sqrt(rSq);
  const points = [];
  for (let s = 0; s <= radialSegments; s++) {
    const theta = (s / radialSegments) * Math.PI * 2;
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    // At current time t = currentTime
    points.push(new THREE.Vector3(currentTime, x, y));
  }

  const geom = new THREE.BufferGeometry().setFromPoints(points);
  return { geom, radius: r, time: currentTime };
}
