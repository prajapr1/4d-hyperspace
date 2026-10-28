/**
 * math4d.js - Comprehensive 4D Vector, Matrix, and Projection Mathematics
 * Coordinates convention: [w, x, y, z] -> indices: 0: w, 1: x, 2: y, 3: z
 */

class Vector4 {
  constructor(w = 0, x = 0, y = 0, z = 0) {
    this.w = w;
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone() {
    return new Vector4(this.w, this.x, this.y, this.z);
  }

  copy(v) {
    this.w = v.w;
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }

  set(w, x, y, z) {
    this.w = w;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  toArray() {
    return [this.w, this.x, this.y, this.z];
  }

  static fromArray(arr) {
    return new Vector4(arr[0] || 0, arr[1] || 0, arr[2] || 0, arr[3] || 0);
  }

  add(v) {
    this.w += v.w;
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }

  sub(v) {
    this.w -= v.w;
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }

  multiplyScalar(s) {
    this.w *= s;
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }

  dot(v) {
    return this.w * v.w + this.x * v.x + this.y * v.y + this.z * v.z;
  }

  lengthSq() {
    return this.w * this.w + this.x * this.x + this.y * this.y + this.z * this.z;
  }

  length() {
    return Math.sqrt(this.lengthSq());
  }

  normalize() {
    const len = this.length();
    if (len > 0.000001) {
      this.multiplyScalar(1.0 / len);
    }
    return this;
  }

  distanceTo(v) {
    const dw = this.w - v.w;
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    const dz = this.z - v.z;
    return Math.sqrt(dw * dw + dx * dx + dy * dy + dz * dz);
  }

  lerp(v, alpha) {
    this.w += (v.w - this.w) * alpha;
    this.x += (v.x - this.x) * alpha;
    this.y += (v.y - this.y) * alpha;
    this.z += (v.z - this.z) * alpha;
    return this;
  }

  /**
   * Extract 3D projection based on the subspace type
   * @param {'wxy' | 'xyz' | 'yzw' | 'wxz'} subspace
   * @param {boolean} perspective - whether to apply 4D perspective foreshortening
   * @param {number} cameraDist - distance to 4D eye (e.g. 3.0)
   * @returns {{x: number, y: number, z: number}}
   */
  projectTo3D(subspace, perspective = false, cameraDist = 3.5) {
    let u, v, w_coord, ortho;

    switch (subspace) {
      case 'wxy':
        // Dimensions: w, x, y. Orthogonal: z
        u = this.w;
        v = this.x;
        w_coord = this.y;
        ortho = this.z;
        break;

      case 'xyz':
        // Dimensions: x, y, z. Orthogonal: w
        u = this.x;
        v = this.y;
        w_coord = this.z;
        ortho = this.w;
        break;

      case 'yzw':
        // Dimensions: y, z, w. Orthogonal: x
        u = this.y;
        v = this.z;
        w_coord = this.w;
        ortho = this.x;
        break;

      case 'wxz':
        // Dimensions: w, x, z. Orthogonal: y
        u = this.w;
        v = this.x;
        w_coord = this.z;
        ortho = this.y;
        break;

      default:
        u = this.x;
        v = this.y;
        w_coord = this.z;
        ortho = this.w;
    }

    if (perspective) {
      const factor = cameraDist / (cameraDist - ortho);
      return {
        x: u * factor,
        y: v * factor,
        z: w_coord * factor,
        ortho: ortho,
        scale: factor
      };
    } else {
      return {
        x: u,
        y: v,
        z: w_coord,
        ortho: ortho,
        scale: 1.0
      };
    }
  }
}

/**
 * 4x4 Matrix for 4D space transformations
 */
class Matrix4D {
  constructor() {
    this.elements = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }

  identity() {
    this.elements = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
    return this;
  }

  clone() {
    const m = new Matrix4D();
    m.elements = [...this.elements];
    return m;
  }

  copy(m) {
    this.elements = [...m.elements];
    return this;
  }

  multiply(m) {
    const a = this.elements;
    const b = m.elements;
    const r = new Array(16);

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[i * 4 + k] * b[k * 4 + j];
        }
        r[i * 4 + j] = sum;
      }
    }
    this.elements = r;
    return this;
  }

  /**
   * Applies the matrix transformation to a Vector4
   * @param {Vector4} v
   * @returns {Vector4}
   */
  transform(v) {
    const m = this.elements;
    const w = v.w, x = v.x, y = v.y, z = v.z;
    return new Vector4(
      m[0] * w + m[1] * x + m[2] * y + m[3] * z,
      m[4] * w + m[5] * x + m[6] * y + m[7] * z,
      m[8] * w + m[9] * x + m[10] * y + m[11] * z,
      m[12] * w + m[13] * x + m[14] * y + m[15] * z
    );
  }

  /**
   * In 4D, rotations occur in planes defined by pairs of coordinate axes.
   * Indices: 0: w, 1: x, 2: y, 3: z
   * There are 6 independent rotation planes:
   * - wx (0, 1)
   * - wy (0, 2)
   * - wz (0, 3)
   * - xy (1, 2)
   * - xz (1, 3)
   * - yz (2, 3)
   */
  static rotationInPlane(axisA, axisB, angleRad) {
    const m = new Matrix4D();
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);

    m.elements[axisA * 4 + axisA] = c;
    m.elements[axisA * 4 + axisB] = -s;
    m.elements[axisB * 4 + axisA] = s;
    m.elements[axisB * 4 + axisB] = c;

    return m;
  }

  /**
   * Build combined 4D rotation matrix from angles in all 6 planes
   * @param {{wx?: number, wy?: number, wz?: number, xy?: number, xz?: number, yz?: number}} angles
   */
  static fromEulerAngles(angles) {
    const res = new Matrix4D();
    // Indices: 0:w, 1:x, 2:y, 3:z
    if (angles.xy) res.multiply(Matrix4D.rotationInPlane(1, 2, angles.xy));
    if (angles.xz) res.multiply(Matrix4D.rotationInPlane(1, 3, angles.xz));
    if (angles.yz) res.multiply(Matrix4D.rotationInPlane(2, 3, angles.yz));
    if (angles.wx) res.multiply(Matrix4D.rotationInPlane(0, 1, angles.wx));
    if (angles.wy) res.multiply(Matrix4D.rotationInPlane(0, 2, angles.wy));
    if (angles.wz) res.multiply(Matrix4D.rotationInPlane(0, 3, angles.wz));
    return res;
  }
}

// Axis colors for consistent visualization across all viewports
const AXIS_COLORS = {
  w: 0xa55eea, // Purple / Violet
  x: 0xff4757, // Red / Coral
  y: 0x2ed573, // Green / Emerald
  z: 0x1e90ff  // Blue / Dodger
};

const AXIS_COLORS_HEX = {
  w: '#a55eea',
  x: '#ff4757',
  y: '#2ed573',
  z: '#1e90ff'
};

// Subspace definitions and their axis mappings
const SUBSPACES = {
  wxy: {
    id: 'wxy',
    name: 'W-X-Y Subspace',
    axes: ['w', 'x', 'y'],
    orthogonal: 'z',
    orthogonalName: 'Z axis',
    description: 'Viewing 3D coordinates (w, x, y) by slicing or projecting along Z'
  },
  xyz: {
    id: 'xyz',
    name: 'X-Y-Z Subspace',
    axes: ['x', 'y', 'z'],
    orthogonal: 'w',
    orthogonalName: 'W axis',
    description: 'Viewing 3D coordinates (x, y, z) by slicing or projecting along W (standard 3D space)'
  },
  yzw: {
    id: 'yzw',
    name: 'Y-Z-W Subspace',
    axes: ['y', 'z', 'w'],
    orthogonal: 'x',
    orthogonalName: 'X axis',
    description: 'Viewing 3D coordinates (y, z, w) by slicing or projecting along X'
  },
  wxz: {
    id: 'wxz',
    name: 'W-X-Z Subspace',
    axes: ['w', 'x', 'z'],
    orthogonal: 'y',
    orthogonalName: 'Y axis',
    description: 'Viewing 3D coordinates (w, x, z) by slicing or projecting along Y'
  }
};
