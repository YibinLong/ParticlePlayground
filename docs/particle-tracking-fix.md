# Particle Tracking Fix

## The Problem

Particles were not matching the actual positions of hands and face. When you raised your hands in front of the camera, the particles would:
- Slow down
- Generate more particles (~2000 extra)
- Float around loosely instead of forming hand/face shapes

The particles were being **attracted** to the landmarks but never actually **snapping** to them.

## The Solution

Changed the particle system from physics-based attraction to direct position snapping.

### File Changed

`particle-system.js`

### What Was Changed

#### 1. Rewrote `applyTargetForce()` method (lines 398-435)

**Before:** Particles were pulled toward targets using physics forces. They would slowly drift toward landmarks but never settle exactly on them.

```javascript
// OLD CODE - Physics-based attraction
const dx = target.x - p.x;
const dy = target.y - p.y;
const dist = Math.sqrt(dx * dx + dy * dy);

// Calculate force and apply to velocity
force = this.attractionForce * distFactor * target.weight;
p.vx += (dx / dist) * force;
p.vy += (dy / dist) * force;
```

**After:** Particles move directly to their target position using linear interpolation. They snap to exactly where the landmarks are.

```javascript
// NEW CODE - Direct position snapping
const snapSpeed = 0.25; // How fast particles snap (0-1)

// Move particle directly toward target
p.x += (target.x - p.x) * snapSpeed;
p.y += (target.y - p.y) * snapSpeed;

// Kill velocity for stable positioning
p.vx *= 0.1;
p.vy *= 0.1;
```

#### 2. Updated `update()` method (lines 126-176)

Added a check to skip physics-based movement when particles are snapping to targets.

**Before:** After calculating forces, the code would apply friction, clamp speed, and add velocity to position. This interfered with direct snapping.

**After:** When in "attract" mode with active targets, the physics updates are skipped so the direct snapping isn't overridden.

```javascript
// Check if we're in direct snap mode
const directSnap = this.targets.length > 0 && this.mode === 'attract';

// Only apply physics when NOT snapping
if (!directSnap) {
    p.vx *= this.friction;
    // ... velocity clamping ...
    p.x += p.vx;
    p.y += p.vy;
}
```

## How It Works Now

1. MediaPipe detects hand/face landmarks from the camera
2. Landmarks are converted to screen coordinates as "targets"
3. Each particle is assigned to a target (distributed evenly)
4. Every frame, particles move 25% of the distance toward their target
5. This creates smooth snapping where particles form the exact shape of your hands and face

## Key Concept: Interpolation vs Physics

**Physics approach (old):**
- Apply forces to velocity
- Velocity moves the particle
- Particles orbit/drift around targets
- Never perfectly stable

**Interpolation approach (new):**
- Calculate difference between current position and target
- Move a percentage of that difference each frame
- Particles converge exactly on targets
- Stable and precise

## Adjusting the Snap Speed

In `applyTargetForce()`, the `snapSpeed` variable controls how fast particles reach their targets:

- `0.1` = Slow, floaty movement
- `0.25` = Balanced (current setting)
- `0.5` = Fast snapping
- `1.0` = Instant (no smoothing)
