# Particle Playground

A real-time particle simulator where thousands of particles flow to form the shape of your face and hands on camera using MediaPipe for tracking.

## Features

- **Real-time Face & Hand Tracking**: Uses MediaPipe for detecting up to 2 hands (21 landmarks each) and face mesh (468 landmarks)
- **8,000-15,000 Flowing Particles**: Dynamic particle count that scales based on visible targets
- **5 Color Themes**: Rainbow, Fire, Ocean, Galaxy, and Matrix - cycle with a fist gesture
- **Attract/Repel Modes**: Toggle how particles interact with your body
- **Particle Trails**: Semi-transparent fade effect for smooth motion blur
- **Golden Ratio Distribution**: Organic particle placement along bones and landmarks

## Getting Started

1. Open `index.html` in a modern web browser (Chrome recommended)
2. Click "Enable Camera" to start
3. Show your hands and face to the camera

## Controls

| Key | Action |
|-----|--------|
| `SPACE` | Toggle Attract/Repel mode |
| `V` | Toggle camera preview visibility |
| `T` | Cycle color theme |
| Fist gesture | Cycle color theme |

## Technical Details

### Hand Tracking
- Detects up to 2 hands with all 21 landmarks
- Skeleton overlay with cyan (left) and pink (right) glowing lines
- Larger dots at fingertips and wrist
- Tapered particle spread: narrow at fingertips, medium on finger segments, wider on palm

### Face Tracking
- FaceMesh with 468 landmarks and refined iris tracking
- Boosted depth on nose, cheekbones, and eye sockets
- Colored mesh overlays: teal eyes, pink lips, cyan face oval
- Very tight 1-2px particle clustering for dense mesh effect

### Particle System
- Uses golden ratio (φ) for organic distribution
- Physics-based attraction/repulsion with friction
- Even distribution of particles across all visible landmarks

## Browser Support

Requires a modern browser with:
- WebRTC (camera access)
- ES6 Modules
- Canvas 2D API

## Files

- `index.html` - Main entry point
- `styles.css` - UI styling
- `app.js` - Application controller
- `particle-system.js` - Particle physics and rendering
- `mediapipe-tracker.js` - Face and hand detection
- `overlay-renderer.js` - Camera preview overlays
- `gesture-detector.js` - Hand gesture recognition
