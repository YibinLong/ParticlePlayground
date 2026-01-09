/**
 * Particle System - Manages thousands of particles that flow toward landmarks
 * Uses golden ratio for organic distribution and supports multiple themes
 */

import { HAND_LANDMARKS, HAND_CONNECTIONS, FINGERTIPS } from './mediapipe-tracker.js';

// Golden ratio for organic distribution
const PHI = 1.618033988749895;
const PHI_ANGLE = Math.PI * 2 * (1 - 1 / PHI);

// Particle spread widths for different hand regions (tapered for organic flow)
const SPREAD_CONFIG = {
    fingertip: 4,      // Very narrow at fingertips
    fingerSegment: 10, // Medium for finger segments
    palm: 22,          // Wider for palm
    wrist: 18          // Wide at wrist
};

// Face feature depth multipliers for enhanced 3D pop effect
const FACE_DEPTH = {
    nose: 2.5,         // Strong pop on nose
    cheekbone: 1.8,    // Visible cheekbone depth
    eyeSocket: 1.6,    // Recessed eye areas
    lips: 1.4,         // Lips protrude slightly
    chin: 1.5,         // Chin definition
    forehead: 1.2,     // Slight forehead curve
    default: 1.0
};

export class ParticleSystem {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Particle counts
        this.minParticles = options.minParticles || 8000;
        this.maxParticles = options.maxParticles || 15000;
        this.particleCount = this.minParticles;

        // Current theme
        this.theme = options.theme || {
            colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff'],
            gradient: (t) => `hsl(${(t * 360) % 360}, 80%, 60%)`
        };

        // Mode: 'attract' or 'repel'
        this.mode = 'attract';

        // Particle physics - tuned for smooth liquid-like flow
        this.attractionForce = 0.08;
        this.repelForce = 0.25;
        this.friction = 0.92;
        this.maxSpeed = 15;
        this.noiseScale = 0.003;
        this.noiseStrength = 0.3;

        // Trail effect
        this.trailAlpha = 0.1;

        // Particle array
        this.particles = [];

        // Target landmarks
        this.targets = [];
        this.targetWeights = [];

        // Time for noise animation
        this.time = 0;

        // Initialize particles
        this.initParticles();
    }

    initParticles() {
        this.particles = [];

        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle(i));
        }
    }

    createParticle(index) {
        // Use golden angle for initial distribution - creates sunflower pattern
        const angle = index * PHI_ANGLE;
        const radius = Math.sqrt(index / this.maxParticles) * Math.min(this.width, this.height) * 0.45;

        const centerX = this.width / 2;
        const centerY = this.height / 2;

        return {
            x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 50,
            y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 50,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1,
            size: 1 + Math.random() * 1.2,
            colorIndex: Math.random(),
            baseColorIndex: Math.random(), // Store original for stable coloring
            life: 1,
            targetIndex: -1,
            active: index < this.particleCount
        };
    }

    setTheme(theme) {
        this.theme = theme;
    }

    setMode(mode) {
        this.mode = mode;
    }

    handleResize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }

    getActiveParticleCount() {
        return this.particleCount;
    }

    update(landmarks) {
        this.time += 0.016; // ~60fps time step

        // Extract all targets from landmarks
        this.extractTargets(landmarks);

        // Adjust active particle count based on targets
        this.adjustParticleCount();

        // Check if we're in direct snap mode (attract mode with targets)
        const directSnap = this.targets.length > 0 && this.mode === 'attract';

        // Update each particle
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            if (!p.active) continue;

            if (this.targets.length > 0) {
                this.applyTargetForce(p, i);
            } else {
                this.applyWanderForce(p, i);
            }

            // Only apply physics-based movement when NOT direct snapping
            if (!directSnap) {
                // Apply friction for smooth deceleration
                p.vx *= this.friction;
                p.vy *= this.friction;

                // Clamp speed
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                if (speed > this.maxSpeed) {
                    p.vx = (p.vx / speed) * this.maxSpeed;
                    p.vy = (p.vy / speed) * this.maxSpeed;
                }

                // Update position
                p.x += p.vx;
                p.y += p.vy;

                // Soft boundary bounce
                this.applyBoundary(p);
            }

            // Update color based on movement and time
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            p.colorIndex = p.baseColorIndex + this.time * 0.05 + speed * 0.005;
            if (p.colorIndex > 1) p.colorIndex -= Math.floor(p.colorIndex);
        }
    }

    extractTargets(landmarks) {
        this.targets = [];
        this.targetWeights = [];

        // Process hands
        if (landmarks.hands && landmarks.hands.length > 0) {
            for (const hand of landmarks.hands) {
                this.extractHandTargets(hand.landmarks);
            }
        }

        // Process face
        if (landmarks.face) {
            this.extractFaceTargets(landmarks.face);
        }
    }

    extractHandTargets(handLandmarks) {
        // Process each connection/bone with golden ratio distribution for organic flow
        for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
            const start = handLandmarks[startIdx];
            const end = handLandmarks[endIdx];

            if (!start || !end) continue;

            // Determine spread based on landmark type (smoothly tapered from palm to fingertips)
            let startSpread, endSpread;

            // Start point spread
            if (startIdx === HAND_LANDMARKS.WRIST) {
                startSpread = SPREAD_CONFIG.wrist;
            } else if ([5, 9, 13, 17].includes(startIdx)) { // MCP joints (palm)
                startSpread = SPREAD_CONFIG.palm;
            } else {
                startSpread = SPREAD_CONFIG.fingerSegment;
            }

            // End point spread (tapered narrower toward fingertips)
            if (FINGERTIPS.includes(endIdx)) {
                endSpread = SPREAD_CONFIG.fingertip;
            } else if ([6, 7, 10, 11, 14, 15, 18, 19].includes(endIdx)) { // PIP/DIP joints
                endSpread = SPREAD_CONFIG.fingerSegment * 0.8;
            } else {
                endSpread = SPREAD_CONFIG.fingerSegment;
            }

            // Generate points along bone using golden ratio for smooth organic distribution
            const numPoints = 5; // More points for smoother distribution
            for (let i = 0; i < numPoints; i++) {
                // Use golden ratio spacing along the bone
                const t = (i + 0.5) / numPoints;

                // Interpolate position along bone
                const x = start.x + (end.x - start.x) * t;
                const y = start.y + (end.y - start.y) * t;
                const z = start.z + (end.z - start.z) * t;

                // Convert to screen coordinates (mirrored)
                const screenX = (1 - x) * this.width;
                const screenY = y * this.height;

                // Smooth taper interpolation using golden ratio
                const taperT = t * PHI - Math.floor(t * PHI); // Golden ratio modulated taper
                const perpSpread = startSpread + (endSpread - startSpread) * t;

                // Use golden angle for perpendicular offset - creates organic sunflower-like pattern
                const goldenOffset = i * PHI_ANGLE;

                // Add primary target on bone
                this.targets.push({
                    x: screenX,
                    y: screenY,
                    z: z,
                    weight: FINGERTIPS.includes(endIdx) ? 1.6 : 1.0,
                    type: 'hand'
                });

                // Add surrounding targets using golden angle for organic spread
                for (let j = 0; j < 3; j++) {
                    const angle = goldenOffset + j * PHI_ANGLE;
                    const r = Math.sqrt((j + 1) / 4) * perpSpread;

                    this.targets.push({
                        x: screenX + Math.cos(angle) * r,
                        y: screenY + Math.sin(angle) * r,
                        z: z,
                        weight: FINGERTIPS.includes(endIdx) ? 1.5 : 0.9,
                        type: 'hand'
                    });
                }
            }
        }

        // Add extra density at fingertips and wrist with golden angle sunflower distribution
        for (const tipIdx of [...FINGERTIPS, HAND_LANDMARKS.WRIST]) {
            const tip = handLandmarks[tipIdx];
            if (!tip) continue;

            const screenX = (1 - tip.x) * this.width;
            const screenY = tip.y * this.height;
            const isFingertip = FINGERTIPS.includes(tipIdx);
            const spread = isFingertip ? SPREAD_CONFIG.fingertip : SPREAD_CONFIG.wrist;

            // Add targets in golden angle sunflower pattern (Vogel's formula)
            const count = isFingertip ? 8 : 12;
            for (let i = 0; i < count; i++) {
                const angle = i * PHI_ANGLE;
                const r = Math.sqrt(i / count) * spread; // Vogel's formula for uniform density

                this.targets.push({
                    x: screenX + Math.cos(angle) * r,
                    y: screenY + Math.sin(angle) * r,
                    z: tip.z,
                    weight: isFingertip ? 2.2 : 1.6,
                    type: 'hand'
                });
            }
        }

        // Add MCP joint clusters for palm definition
        const mcpJoints = [5, 9, 13, 17]; // Index, Middle, Ring, Pinky MCPs
        for (const mcpIdx of mcpJoints) {
            const mcp = handLandmarks[mcpIdx];
            if (!mcp) continue;

            const screenX = (1 - mcp.x) * this.width;
            const screenY = mcp.y * this.height;

            // Golden angle palm cluster
            for (let i = 0; i < 6; i++) {
                const angle = i * PHI_ANGLE;
                const r = Math.sqrt(i / 6) * SPREAD_CONFIG.palm * 0.6;

                this.targets.push({
                    x: screenX + Math.cos(angle) * r,
                    y: screenY + Math.sin(angle) * r,
                    z: mcp.z,
                    weight: 1.2,
                    type: 'hand'
                });
            }
        }
    }

    extractFaceTargets(faceLandmarks) {
        // Face landmarks should form a very tight mesh (1-2 pixels for dense effect)
        const tightSpread = 1.2;

        // Key facial feature indices for boosted depth - comprehensive mapping
        const noseIndices = new Set([1, 2, 4, 5, 6, 168, 195, 197, 98, 327, 19, 94, 164, 48, 115, 220, 45, 4, 275, 440, 344, 278]);
        const cheekboneIndices = new Set([123, 147, 187, 207, 213, 352, 376, 411, 427, 436, 116, 345, 234, 454, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323]);
        const eyeSocketIndices = new Set([33, 133, 157, 158, 159, 160, 161, 163, 362, 263, 384, 385, 386, 387, 388, 390, 7, 249, 173, 246, 466, 398, 382, 381, 380, 374, 373, 390, 145, 144, 153, 154, 155]);
        const lipsIndices = new Set([61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 78, 308, 13, 14, 87, 0, 267, 269, 270, 409, 415, 324, 318, 402, 317, 178, 88, 95, 191, 80, 81, 82]);
        const chinIndices = new Set([152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356]);
        const foreheadIndices = new Set([10, 151, 9, 8, 107, 66, 105, 63, 70, 46, 336, 296, 334, 293, 300, 276, 283, 282, 295, 285]);

        // Sample face landmarks with very tight clustering
        for (let i = 0; i < faceLandmarks.length; i++) {
            const lm = faceLandmarks[i];
            if (!lm) continue;

            // Convert to screen coordinates (mirrored)
            const screenX = (1 - lm.x) * this.width;
            const screenY = lm.y * this.height;

            // Determine depth multiplier for enhanced 3D pop effect
            let depthMult = FACE_DEPTH.default;
            let weight = 1.0;

            if (noseIndices.has(i)) {
                depthMult = FACE_DEPTH.nose;
                weight = 1.8;
            } else if (cheekboneIndices.has(i)) {
                depthMult = FACE_DEPTH.cheekbone;
                weight = 1.5;
            } else if (eyeSocketIndices.has(i)) {
                depthMult = FACE_DEPTH.eyeSocket;
                weight = 1.6;
            } else if (lipsIndices.has(i)) {
                depthMult = FACE_DEPTH.lips;
                weight = 1.4;
            } else if (chinIndices.has(i)) {
                depthMult = FACE_DEPTH.chin;
                weight = 1.3;
            } else if (foreheadIndices.has(i)) {
                depthMult = FACE_DEPTH.forehead;
                weight = 1.1;
            }

            // Add targets with very tight clustering (1-2px) using golden angle
            // More cluster points for key features
            const clusterCount = (weight > 1.3) ? 3 : 2;
            for (let j = 0; j < clusterCount; j++) {
                const angle = j * PHI_ANGLE + i * 0.1; // Offset by landmark index for variety
                const r = Math.sqrt(j / clusterCount) * tightSpread;

                this.targets.push({
                    x: screenX + Math.cos(angle) * r,
                    y: screenY + Math.sin(angle) * r,
                    z: lm.z * depthMult,
                    weight: weight * depthMult,
                    type: 'face'
                });
            }
        }
    }

    adjustParticleCount() {
        // Scale particle count based on visible targets
        const targetCount = this.targets.length;

        if (targetCount === 0) {
            this.particleCount = this.minParticles;
        } else {
            // More targets = more particles, up to max
            const ratio = Math.min(1, targetCount / 1500);
            this.particleCount = Math.floor(
                this.minParticles + (this.maxParticles - this.minParticles) * ratio
            );
        }

        // Activate/deactivate particles
        for (let i = 0; i < this.particles.length; i++) {
            this.particles[i].active = i < this.particleCount;
        }
    }

    applyTargetForce(p, particleIndex) {
        if (this.targets.length === 0) return;

        // Distribute particles evenly across targets
        const targetIndex = particleIndex % this.targets.length;
        const target = this.targets[targetIndex];

        if (this.mode === 'attract') {
            // DIRECT SNAP: Move particle directly to target position with smooth interpolation
            const snapSpeed = 0.25; // How fast particles snap to position (0-1, higher = faster)

            // Directly interpolate position toward target
            p.x += (target.x - p.x) * snapSpeed;
            p.y += (target.y - p.y) * snapSpeed;

            // Kill velocity when snapping to targets for stable positioning
            p.vx *= 0.1;
            p.vy *= 0.1;

            // Add very subtle jitter for organic feel (optional, keeps particles alive)
            const jitter = 0.3;
            p.x += (Math.random() - 0.5) * jitter;
            p.y += (Math.random() - 0.5) * jitter;
        } else {
            // Repel mode - push particles away from targets
            const dx = p.x - target.x;
            const dy = p.y - target.y;
            const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;

            const repelRadius = 150;
            if (dist < repelRadius) {
                const repelFactor = Math.pow(1 - dist / repelRadius, 1.5);
                const force = this.repelForce * repelFactor * target.weight;
                p.vx += (dx / dist) * force;
                p.vy += (dy / dist) * force;
            }
        }
    }

    applyWanderForce(p, particleIndex) {
        // Gentle center attraction when no targets
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;

        // Very gentle pull toward center
        p.vx += (dx / dist) * 0.008;
        p.vy += (dy / dist) * 0.008;

        // Add wander noise for organic movement
        const wanderAngle = this.time + particleIndex * PHI_ANGLE;
        p.vx += Math.sin(wanderAngle) * 0.1;
        p.vy += Math.cos(wanderAngle * 1.3) * 0.1;
    }

    applyBoundary(p) {
        const margin = 30;
        const bounce = 0.3;

        if (p.x < margin) {
            p.x = margin;
            p.vx *= -bounce;
        } else if (p.x > this.width - margin) {
            p.x = this.width - margin;
            p.vx *= -bounce;
        }

        if (p.y < margin) {
            p.y = margin;
            p.vy *= -bounce;
        } else if (p.y > this.height - margin) {
            p.y = this.height - margin;
            p.vy *= -bounce;
        }
    }

    render() {
        // Draw semi-transparent trail effect
        this.ctx.fillStyle = `rgba(10, 10, 15, ${this.trailAlpha})`;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Batch particles by color for better performance
        const colorBuckets = new Map();

        for (const p of this.particles) {
            if (!p.active) continue;

            // Quantize color index for batching
            const colorKey = Math.floor(p.colorIndex * 24) / 24;

            if (!colorBuckets.has(colorKey)) {
                colorBuckets.set(colorKey, []);
            }
            colorBuckets.get(colorKey).push(p);
        }

        // Draw each color batch
        for (const [colorKey, particles] of colorBuckets) {
            const color = this.theme.gradient(colorKey);

            this.ctx.fillStyle = color;
            this.ctx.beginPath();

            for (const p of particles) {
                this.ctx.moveTo(p.x + p.size, p.y);
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            }

            this.ctx.fill();
        }
    }

    /**
     * Render with glow effect (more expensive but prettier)
     */
    renderWithGlow() {
        // Draw semi-transparent trail effect
        this.ctx.fillStyle = `rgba(10, 10, 15, ${this.trailAlpha})`;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw glow layer first
        this.ctx.save();
        this.ctx.globalAlpha = 0.3;
        this.ctx.filter = 'blur(3px)';

        for (const p of this.particles) {
            if (!p.active) continue;

            const color = this.theme.gradient(p.colorIndex);
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
            this.ctx.fill();
        }

        this.ctx.restore();

        // Draw sharp particles on top
        for (const p of this.particles) {
            if (!p.active) continue;

            const color = this.theme.gradient(p.colorIndex);
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
}
