/**
 * marching_cubes.js - Real-time 3D Isosurface Extractor for Implicit Equations
 * Directly compatible with THREE.edgeTable and THREE.triTable
 */

class IsosurfaceExtractor {
  constructor() {
    this.edgeTable = null;
    this.triTable = null;
    this.initTables();
  }

  initTables() {
    if (typeof THREE !== 'undefined' && THREE.edgeTable && THREE.triTable) {
      this.edgeTable = THREE.edgeTable;
      this.triTable = THREE.triTable;
    }
  }

  /**
   * Evaluates implicit function f(u, v, w) over a 3D grid and produces THREE.BufferGeometry
   * @param {Function} evalFunc - (u, v, w) => number. Surface is at evalFunc(u, v, w) = targetValue
   * @param {Object} options
   */
  extract(evalFunc, options = {}) {
    if (!this.edgeTable || !this.triTable) {
      this.initTables();
      if (!this.edgeTable || !this.triTable) {
        console.error("Marching cubes tables are missing!");
        return null;
      }
    }

    const min = options.min !== undefined ? options.min : -2.3;
    const max = options.max !== undefined ? options.max : 2.3;
    const res = options.resolution || 24;
    const targetValue = options.targetValue !== undefined ? options.targetValue : 0.0;

    const step = (max - min) / (res - 1);
    const size = res;
    const size2 = size * size;
    const size3 = size2 * size;

    // 1. Evaluate scalar field on grid
    const field = new Float32Array(size3);
    let idx = 0;
    for (let k = 0; k < size; k++) {
      const z = min + k * step;
      for (let j = 0; j < size; j++) {
        const y = min + j * step;
        for (let i = 0; i < size; i++) {
          const x = min + i * step;
          let val = 0;
          try {
            val = evalFunc(x, y, z) - targetValue;
            if (isNaN(val) || !isFinite(val)) val = 1e6;
          } catch (e) {
            val = 1e6;
          }
          field[idx++] = val;
        }
      }
    }

    const getIdx = (x, y, z) => x + y * size + z * size2;

    const vertices = [];
    const edgeVerts = new Array(12);

    // Linear interpolation
    const lerpVert = (p1, p2, v1, v2) => {
      if (Math.abs(v1 - v2) < 0.000001) {
        return [p1[0], p1[1], p1[2]];
      }
      const mu = (0.0 - v1) / (v2 - v1);
      return [
        p1[0] + mu * (p2[0] - p1[0]),
        p1[1] + mu * (p2[1] - p1[1]),
        p1[2] + mu * (p2[2] - p1[2])
      ];
    };

    // 2. March through all grid cells
    for (let k = 0; k < size - 1; k++) {
      const fz = min + k * step;
      const fz2 = fz + step;

      for (let j = 0; j < size - 1; j++) {
        const fy = min + j * step;
        const fy2 = fy + step;

        for (let i = 0; i < size - 1; i++) {
          const fx = min + i * step;
          const fx2 = fx + step;

          // 8 corner values matching Three.js MarchingCubes convention
          const field0 = field[getIdx(i, j, k)];         // (0,0,0)
          const field1 = field[getIdx(i + 1, j, k)];     // (1,0,0)
          const field2 = field[getIdx(i, j + 1, k)];     // (0,1,0)
          const field3 = field[getIdx(i + 1, j + 1, k)]; // (1,1,0)
          const field4 = field[getIdx(i, j, k + 1)];     // (0,0,1)
          const field5 = field[getIdx(i + 1, j, k + 1)]; // (1,0,1)
          const field6 = field[getIdx(i, j + 1, k + 1)]; // (0,1,1)
          const field7 = field[getIdx(i + 1, j + 1, k + 1)]; // (1,1,1)

          // Bitmask indexing
          let cubeindex = 0;
          if (field0 < 0) cubeindex |= 1;
          if (field1 < 0) cubeindex |= 2;
          if (field3 < 0) cubeindex |= 4;
          if (field2 < 0) cubeindex |= 8;
          if (field4 < 0) cubeindex |= 16;
          if (field5 < 0) cubeindex |= 32;
          if (field7 < 0) cubeindex |= 64;
          if (field6 < 0) cubeindex |= 128;

          if (cubeindex === 0 || cubeindex === 255) continue;

          const bits = this.edgeTable[cubeindex];
          if (bits === 0) continue;

          // Positions of the 8 corners:
          // c0: (fx, fy, fz), c1: (fx2, fy, fz), c2: (fx, fy2, fz), c3: (fx2, fy2, fz)
          // c4: (fx, fy, fz2), c5: (fx2, fy, fz2), c6: (fx, fy2, fz2), c7: (fx2, fy2, fz2)

          // Edge 0: c0 -> c1 (along X, y=fy, z=fz)
          if (bits & 1) {
            edgeVerts[0] = lerpVert([fx, fy, fz], [fx2, fy, fz], field0, field1);
          }
          // Edge 1: c1 -> c3 (along Y, x=fx2, z=fz)
          if (bits & 2) {
            edgeVerts[1] = lerpVert([fx2, fy, fz], [fx2, fy2, fz], field1, field3);
          }
          // Edge 2: c2 -> c3 (along X, y=fy2, z=fz)
          if (bits & 4) {
            edgeVerts[2] = lerpVert([fx, fy2, fz], [fx2, fy2, fz], field2, field3);
          }
          // Edge 3: c0 -> c2 (along Y, x=fx, z=fz)
          if (bits & 8) {
            edgeVerts[3] = lerpVert([fx, fy, fz], [fx, fy2, fz], field0, field2);
          }
          // Edge 4: c4 -> c5 (along X, y=fy, z=fz2)
          if (bits & 16) {
            edgeVerts[4] = lerpVert([fx, fy, fz2], [fx2, fy, fz2], field4, field5);
          }
          // Edge 5: c5 -> c7 (along Y, x=fx2, z=fz2)
          if (bits & 32) {
            edgeVerts[5] = lerpVert([fx2, fy, fz2], [fx2, fy2, fz2], field5, field7);
          }
          // Edge 6: c6 -> c7 (along X, y=fy2, z=fz2)
          if (bits & 64) {
            edgeVerts[6] = lerpVert([fx, fy2, fz2], [fx2, fy2, fz2], field6, field7);
          }
          // Edge 7: c4 -> c6 (along Y, x=fx, z=fz2)
          if (bits & 128) {
            edgeVerts[7] = lerpVert([fx, fy, fz2], [fx, fy2, fz2], field4, field6);
          }
          // Edge 8: c0 -> c4 (along Z, x=fx, y=fy)
          if (bits & 256) {
            edgeVerts[8] = lerpVert([fx, fy, fz], [fx, fy, fz2], field0, field4);
          }
          // Edge 9: c1 -> c5 (along Z, x=fx2, y=fy)
          if (bits & 512) {
            edgeVerts[9] = lerpVert([fx2, fy, fz], [fx2, fy, fz2], field1, field5);
          }
          // Edge 10: c3 -> c7 (along Z, x=fx2, y=fy2)
          if (bits & 1024) {
            edgeVerts[10] = lerpVert([fx2, fy2, fz], [fx2, fy2, fz2], field3, field7);
          }
          // Edge 11: c2 -> c6 (along Z, x=fx, y=fy2)
          if (bits & 2048) {
            edgeVerts[11] = lerpVert([fx, fy2, fz], [fx, fy2, fz2], field2, field6);
          }

          // Triangulate
          const triOffset = cubeindex * 16;
          for (let t = 0; t < 16; t += 3) {
            const e1 = this.triTable[triOffset + t];
            if (e1 === -1) break;
            const e2 = this.triTable[triOffset + t + 1];
            const e3 = this.triTable[triOffset + t + 2];

            const v1 = edgeVerts[e1];
            const v2 = edgeVerts[e2];
            const v3 = edgeVerts[e3];

            vertices.push(
              v1[0], v1[1], v1[2],
              v2[0], v2[1], v2[2],
              v3[0], v3[1], v3[2]
            );
          }
        }
      }
    }

    if (vertices.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();

    return geometry;
  }
}
