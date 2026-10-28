# 4D HyperSpace Visualizer

An interactive 3D web application designed to explore, understand, and visualize 4-dimensional objects $(w, x, y, z)$ through simultaneous 3D projections, 4D hyperplane slicing, and real-time spacetime wave dynamics:
$$\frac{\partial^2 u}{\partial t^2} = v^2 \left( \frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2} + \frac{\partial^2 u}{\partial z^2} \right)$$

---

## 🎨 Color Theme (Color Hunt Palette)
The visualizer adopts the cool, luminous aesthetic from [Color Hunt Palette f8fafc-d9eafd-bcccdc-9aa6b2](https://colorhunt.co/palette/f8fafcd9eafdbcccdc9aa6b2):
- **`#F8FAFC`:** Crisp luminous white for primary typography, titles, and high-contrast labels.
- **`#D9EAFD`:** Soft radiant ice-sky blue for active buttons, tab pills, slider thumbs, glowing focus rings, and default equation isosurfaces.
- **`#BCCCDC`:** Dusty slate blue for secondary surfaces, subtle borders, card outlines, and wireframe edges.
- **`#9AA6B2`:** Cool steel gray for muted text, axis sub-labels, and background dividers.
- **`#090E15` / `#0F1622`:** Deep obsidian-slate foundations providing spatial depth and atmospheric contrast.

---

## 🌊 4D Spacetime Wave: Viewing a Wave in 3D Time-Space

In 4D spacetime $(t, x, y, z)$, Time $t$ is mapped directly to the 4th coordinate $W$ ($w = t$). The visualizer lets you observe how a wave behaves across all four 3D coordinate systems simultaneously:

| Coordinate System | Type | What You See |
| :--- | :--- | :--- |
| **$(x, y, z)$ Subspace** | **Physical 3D Space** | The instantaneous 3D wave at the current moment in time $t$. As time flows, concentric spherical wavefronts expand outward at velocity $v$, pulsating with wavelength $\lambda = 2\pi/k$. |
| **$(t, x, y)$ Subspace** | **Spacetime Diagram** | Space $(x, y)$ evolving along the vertical Time axis $t$. The expanding 2D circular wave ripple traces a **3D Spacetime Cone (Light Cone / Worldsheet)** through time! A glowing horizontal plane marks the current time $t$, cutting the cone into the exact circle seen expanding in physical space. |
| **$(y, z, t)$ Subspace** | **Spacetime Diagram** | The wave's spacetime history in the $(y, z)$ plane over Time $t$. Slicing at spatial offset $x = x_0$ transforms the cone into a relativistic hyperboloid. |
| **$(t, x, z)$ Subspace** | **Spacetime Diagram** | The wave's spacetime history in the $(x, z)$ plane over Time $t$. Slicing at spatial offset $y = y_0$ reveals the spatial-temporal hyperbolic sheet. |

### Wave Modes Supported:
1. **Spherical Wave & Spacetime Cone:** 3D spherical wavefront shells in physical space matching the 3D characteristic cone in spacetime.
2. **Characteristic Light Cone:** The geometric null cone $t^2 = (x^2 + y^2 + z^2) / v^2$.
3. **3D Resonant Standing Wave:** Pulsating 3D cavity antinodes in physical space forming vertical stationary columns in spacetime.
4. **Harmonic Plane Wave:** Parallel planar wavefronts traveling in space, forming tilted planar worldsheets in spacetime.
5. **Gaussian Wavepacket:** Localized 3D pulse forming a diagonal world-tube in spacetime.

---

## 🌟 Key Features

### 1. Zero-Scroll Single-Page Experience
The interface is engineered to fit completely within a single viewport (`100vh`) with zero vertical page scrolling:
- **Compact Glass Header (50px):** Houses the brand, progression tabs (`0D Point` to `4D Wave` and `Custom Equation`), integrated color-coded axis pills ($W, X, Y, Z$), and quick tools.
- **Collapsible Floating Drawer Sidebar:** Can be collapsed with 1 click to dedicate almost 100% of screen width to the 3D models.
- **Floating Spatial HUD Bar:** Floats at the bottom center with micro-controls for 4D rotation playback, slicing sweep, rendering mode cycling, camera syncing, camera reset, and layout switching.

---

### 2. Focus & Fullscreen Mode (1 Main + 3 Sideways Small Boxes)
- **2x2 Equal Grid Mode (Default):** All 4 3D models are shown in balanced, synchronized viewports simultaneously on one page.
- **Focus / Fullscreen Mode:**
  - The chosen 3D viewport expands into the main stage (occupying ~78% width).
  - The other 3 viewports are arranged sideways in a vertical stack of three interactive small boxes on the right.
  - Hovering over any side box reveals a glowing *"Click to Focus"* indicator. Clicking any side box promotes it to the main viewport.
  - Click the **Grid** button on the bottom quick-bar or press `Esc` to restore the 2x2 grid.

---

### 3. LaTeX & Cartesian Wave Equation Engine
Directly paste LaTeX differential equations like:
$$\frac{\partial^2 u}{\partial t^2} = v^2 \left( \frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2} + \frac{\partial^2 u}{\partial z^2} \right)$$
Automatic translation converts LaTeX fractions, roots, and derivatives into real-time Marching Cubes isosurfaces.

---

### ⌨️ Keyboard Shortcuts
| Key | Action |
| :--- | :--- |
| **`F`** | Toggle Focus Mode (expands main view with 3 side boxes) |
| **`Esc`** | Exit Focus Mode back to 2x2 Grid / Close Guide Modal |
| **`Space`** | Play / Pause 4D Auto-Rotation |
| **`S`** | Toggle Synchronized Cameras |

---

## 🚀 How to Run

Open directly in your browser:
```bash
open "/Users/rajeshprajapati/Experiment/4D Visualiser/index.html"
```

Or start a local web server:
```bash
cd "/Users/rajeshprajapati/Experiment/4D Visualiser"
python3 -m http.server 8000
```
Then visit `http://localhost:8000`.
