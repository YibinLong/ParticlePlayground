/**
 * Particle System - Manages thousands of particles that flow toward landmarks
 * Uses golden ratio for organic distribution and supports multiple themes
 */

import { HAND_LANDMARKS, HAND_CONNECTIONS, FINGERTIPS } from './mediapipe-tracker.js';

// Golden ratio for organic distribution
const PHI = 1.618033988749895;
const PHI_ANGLE = Math.PI * 2 * (1 - 1 / PHI);

// Particle spread widths for different hand regions
const SPREAD_CONFIG = {
    fingertip: 8,      // Narrow at fingertips
    fingerSegment: 15, // Medium for finger segments
    palm: 30,          // Wider for palm
    wrist: 25          // Wide at wrist
};

// Face feature depth multipliers
const FACE_DEPTH = {
    nose: 1.5,
    cheekbone: 1.3,
    eyeSocket: 1.2,
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

        // Particle physics - tuned for liquid-like flow
        this.attractionForce = 0.12;
        this.repelForce = 0.2;
        this.friction = 0.94;
        this.maxSpeed = 12;

        // Trail effect
        this.trailAlpha = 0.12;

        // Particle array
        this.particles = [];

        // Target landmarks (current and previous for smoothing)
        this.targets = [];
        this.prevTargets = [];
        this.targetWeights = [];
        this.targetSmoothing = 0.3; // Interpolation factor

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
        // Use golden angle for initial distribution
        const angle = index * PHI_ANGLE;
        const radius = Math.sqrt(index / this.maxParticles) * Math.min(this.width, this.height) * 0.4;

        const centerX = this.width / 2;
        const centerY = this.height / 2;

        return {
            x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 100,
            y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 100,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            size: 1 + Math.random() * 1.5,
            colorIndex: Math.random(),
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
        // Extract all targets from landmarks
        this.extractTargets(landmarks);

        // Adjust active particle count based on targets
        this.adjustParticleCount();

        // Update each particle
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            if (!p.active) continue;

            if (this.targets.length > 0) {
                // Find nearest target or assigned target
                this.applyTargetForce(p, i);
            } else {
                // Gentle wandering when no targets
                this.applyWanderForce(p);
            }

            // Apply physics
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

            // Update color based on movement
            p.colorIndex += speed * 0.001;
            if (p.colorIndex > 1) p.colorIndex -= 1;
        }
    }

    extractTargets(landmarks) {
        this.targets = [];
        this.targetWeights = [];

        const screenScale = Math.min(this.width, this.height);

        // Process hands
        if (landmarks.hands && landmarks.hands.length > 0) {
            for (const hand of landmarks.hands) {
                this.extractHandTargets(hand.landmarks, screenScale);
            }
        }

        // Process face
        if (landmarks.face) {
            this.extractFaceTargets(landmarks.face, screenScale);
        }
    }

    extractHandTargets(handLandmarks, screenScale) {
        // Process each connection/bone with golden ratio distribution
        for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
            const start = handLandmarks[startIdx];
            const end = handLandmarks[endIdx];

            if (!start || !end) continue;

            // Determine spread based on landmark type
            let spread;
            if (FINGERTIPS.includes(endIdx)) {
                spread = SPREAD_CONFIG.fingertip;
            } else if (startIdx === HAND_LANDMARKS.WRIST) {
                spread = SPREAD_CONFIG.palm;
            } else if (endIdx >= 5 && endIdx <= 20) {
                spread = SPREAD_CONFIG.fingerSegment;
            } else {
                spread = SPREAD_CONFIG.palm;
            }

            // Generate points along bone using golden ratio
            const numPoints = 5;
            for (let i = 0; i < numPoints; i++) {
                const t = (i + 1) / (numPoints + 1);

                // Interpolate position
                const x = start.x + (end.x - start.x) * t;
                const y = start.y + (end.y - start.y) * t;
                const z = start.z + (end.z - start.z) * t;

                // Convert to screen coordinates (mirrored)
                const screenX = (1 - x) * this.width;
                const screenY = y * this.height;

                // Use golden angle for perpendicular offset
                const angle = i * PHI_ANGLE;
                const perpSpread = spread * (1 - t * 0.3); // Taper toward end

                this.targets.push({
                    x: screenX + Math.cos(angle) * perpSpread * Math.random(),
                    y: screenY + Math.sin(angle) * perpSpread * Math.random(),
                    z: z,
                    weight: FINGERTIPS.includes(endIdx) ? 1.5 : 1.0,
                    type: 'hand'
                });
            }
        }

        // Add extra density at fingertips and wrist
        for (const tipIdx of [...FINGERTIPS, HAND_LANDMARKS.WRIST]) {
            const tip = handLandmarks[tipIdx];
            if (!tip) continue;

            const screenX = (1 - tip.x) * this.width;
            const screenY = tip.y * this.height;
            const isFingertip = FINGERTIPS.includes(tipIdx);
            const spread = isFingertip ? SPREAD_CONFIG.fingertip : SPREAD_CONFIG.wrist;

            // Add multiple targets around the point using golden angle
            const count = isFingertip ? 8 : 12;
            for (let i = 0; i < count; i++) {
                const angle = i * PHI_ANGLE;
                const r = Math.sqrt(i / count) * spread;

                this.targets.push({
                    x: screenX + Math.cos(angle) * r,
                    y: screenY + Math.sin(angle) * r,
                    z: tip.z,
                    weight: isFingertip ? 2.0 : 1.5,
                    type: 'hand'
                });
            }
        }
    }

    extractFaceTargets(faceLandmarks, screenScale) {
        // Face landmarks should form a very tight mesh
        const tightSpread = 2; // 1-2 pixels as requested

        // Key facial feature indices for boosted depth
        const noseIndices = new Set([1, 2, 4, 5, 6, 168, 195, 197, 98, 327]);
        const cheekboneIndices = new Set([123, 147, 187, 207, 213, 352, 376, 411, 427, 436]);
        const eyeSocketIndices = new Set([33, 133, 157, 158, 159, 160, 161, 163, 362, 263, 384, 385, 386, 387, 388, 390]);

        // Sample face landmarks with tight clustering
        for (let i = 0; i < faceLandmarks.length; i++) {
            const lm = faceLandmarks[i];
            if (!lm) continue;

            // Convert to screen coordinates (mirrored)
            const screenX = (1 - lm.x) * this.width;
            const screenY = lm.y * this.height;

            // Determine depth multiplier
            let depthMult = FACE_DEPTH.default;
            if (noseIndices.has(i)) {
                depthMult = FACE_DEPTH.nose;
            } else if (cheekboneIndices.has(i)) {
                depthMult = FACE_DEPTH.cheekbone;
            } else if (eyeSocketIndices.has(i)) {
                depthMult = FACE_DEPTH.eyeSocket;
            }

            // Add targets with very tight clustering using golden angle
            const clusterCount = 3;
            for (let j = 0; j < clusterCount; j++) {
                const angle = j * PHI_ANGLE;
                const r = Math.sqrt(j / clusterCount) * tightSpread;

                this.targets.push({
                    x: screenX + Math.cos(angle) * r,
                    y: screenY + Math.sin(angle) * r,
                    z: lm.z * depthMult,
                    weight: depthMult,
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
            const ratio = Math.min(1, targetCount / 2000);
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
        // Distribute particles evenly across targets
        if (this.targets.length === 0) return;

        // Assign target based on particle index with some variation
        const baseIndex = particleIndex % this.targets.length;
        // Add slight variation for more organic distribution
        const variation = Math.floor(Math.sin(particleIndex * 0.1) * 3);
        const targetIndex = (baseIndex + variation + this.targets.length) % this.targets.length;
        const target = this.targets[targetIndex];

        const dx = target.x - p.x;
        const dy = target.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;

        // Calculate force with smooth falloff
        let force;
        if (this.mode === 'attract') {
            // Attraction with smooth easing - feels like liquid cohesion
            const distFactor = 1 - Math.exp(-dist / 150);
            force = this.attractionForce * distFactor * target.weight;

            // Add settling force when very close (particles settle into place)
            if (dist < 20) {
                force *= 0.5 + (dist / 40);
            }
        } else {
            // Repulsion - inverse square with cutoff
            const repelRadius = 100;
            if (dist < repelRadius) {
                force = -this.repelForce * Math.pow(1 - dist / repelRadius, 2) * target.weight;
            } else {
                force = 0;
            }
        }

        // Apply force
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;

        // Add perlin-like noise for organic movement (using sine waves)
        const noiseX = Math.sin(p.x * 0.01 + p.y * 0.01 + particleIndex * 0.1) * 0.2;
        const noiseY = Math.cos(p.x * 0.01 - p.y * 0.01 + particleIndex * 0.1) * 0.2;
        p.vx += noiseX;
        p.vy += noiseY;
    }

    applyWanderForce(p) {
        // Gentle center attraction when no targets
        const centerX = this.width / 2;
        const centerY = this.height / 2;

        const dx = centerX - p.x;
        const dy = centerY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy) + 0.01;

        // Very gentle pull toward center
        p.vx += (dx / dist) * 0.01;
        p.vy += (dy / dist) * 0.01;

        // Add wander noise
        p.vx += (Math.random() - 0.5) * 0.5;
        p.vy += (Math.random() - 0.5) * 0.5;
    }

    applyBoundary(p) {
        const margin = 50;
        const bounce = 0.5;

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
        // Group particles into color buckets
        const colorBuckets = new Map();

        for (const p of this.particles) {
            if (!p.active) continue;

            // Quantize color index for batching
            const colorKey = Math.floor(p.colorIndex * 20) / 20;

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
                // Draw particle
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
