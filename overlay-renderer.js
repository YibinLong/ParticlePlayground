/**
 * Overlay Renderer - Draws skeleton and mesh overlays on the camera preview
 * Features multi-layer glowing lines for hands and colored mesh for face
 */

import { HAND_CONNECTIONS, FINGERTIPS, HAND_LANDMARKS, FACE_LANDMARKS } from './mediapipe-tracker.js';

export class OverlayRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Colors - All dark green
        this.colors = {
            handLeft: '#0d6b0d',      // Dark green for left hand
            handRight: '#0d6b0d',     // Dark green for right hand
            eyes: '#0d6b0d',          // Dark green for eyes
            lips: '#0d6b0d',          // Dark green for lips
            faceOval: '#0d6b0d',      // Dark green for face oval
            nose: '#0d6b0d'           // Dark green for nose
        };

        // Multi-layer glow configuration
        this.glowLayers = [
            { blur: 25, alpha: 0.15, lineWidth: 8 },   // Outermost glow
            { blur: 18, alpha: 0.25, lineWidth: 6 },   // Middle glow
            { blur: 12, alpha: 0.4, lineWidth: 4 },    // Inner glow
            { blur: 6, alpha: 0.7, lineWidth: 2.5 },   // Core glow
            { blur: 0, alpha: 1.0, lineWidth: 1.5 }    // Sharp center
        ];
    }

    render(results) {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.width, this.height);

        // Draw face mesh first (behind hands)
        if (results.face && results.face.faceLandmarks && results.face.faceLandmarks.length > 0) {
            this.drawFaceMesh(results.face.faceLandmarks[0]);
        }

        // Draw hands on top
        if (results.hands && results.hands.length > 0) {
            for (const hand of results.hands) {
                const isLeft = hand.handedness === 'Left';
                this.drawHandSkeleton(hand.landmarks, isLeft);
            }
        }
    }

    drawHandSkeleton(landmarks, isLeft) {
        const color = isLeft ? this.colors.handLeft : this.colors.handRight;

        this.ctx.save();
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // Draw connections with multi-layer glow effect
        for (const layer of this.glowLayers) {
            this.ctx.shadowColor = color;
            this.ctx.shadowBlur = layer.blur;
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = layer.lineWidth;
            this.ctx.globalAlpha = layer.alpha;

            for (const [start, end] of HAND_CONNECTIONS) {
                const p1 = landmarks[start];
                const p2 = landmarks[end];

                if (p1 && p2) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x * this.width, p1.y * this.height);
                    this.ctx.lineTo(p2.x * this.width, p2.y * this.height);
                    this.ctx.stroke();
                }
            }
        }

        // Draw landmarks with multi-layer glow
        this.ctx.fillStyle = color;

        for (let i = 0; i < landmarks.length; i++) {
            const lm = landmarks[i];
            const isFingertip = FINGERTIPS.includes(i);
            const isWrist = i === HAND_LANDMARKS.WRIST;

            // Larger dots at fingertips and wrist
            let baseRadius;
            if (isFingertip) {
                baseRadius = 5;
            } else if (isWrist) {
                baseRadius = 6;
            } else {
                baseRadius = 2.5;
            }

            // Draw glow layers for key points (fingertips and wrist)
            if (isFingertip || isWrist) {
                // Outer glow layers
                for (let layerIdx = 0; layerIdx < this.glowLayers.length - 1; layerIdx++) {
                    const layer = this.glowLayers[layerIdx];
                    this.ctx.shadowBlur = layer.blur;
                    this.ctx.globalAlpha = layer.alpha * 0.8;

                    this.ctx.beginPath();
                    this.ctx.arc(
                        lm.x * this.width,
                        lm.y * this.height,
                        baseRadius + (4 - layerIdx) * 1.5,
                        0,
                        Math.PI * 2
                    );
                    this.ctx.fill();
                }
            }

            // Draw solid point
            this.ctx.shadowBlur = 8;
            this.ctx.globalAlpha = 1;
            this.ctx.beginPath();
            this.ctx.arc(
                lm.x * this.width,
                lm.y * this.height,
                baseRadius,
                0,
                Math.PI * 2
            );
            this.ctx.fill();
        }

        this.ctx.restore();
    }

    drawFaceMesh(landmarks) {
        this.ctx.save();

        // Draw face oval
        this.drawFaceContour(landmarks, FACE_LANDMARKS.FACE_OVAL, this.colors.faceOval, 1.5, 10);

        // Draw eyes
        this.drawFaceContour(landmarks, FACE_LANDMARKS.LEFT_EYE, this.colors.eyes, 1, 8, true);
        this.drawFaceContour(landmarks, FACE_LANDMARKS.RIGHT_EYE, this.colors.eyes, 1, 8, true);

        // Draw eyebrows
        this.drawFaceContour(landmarks, FACE_LANDMARKS.LEFT_EYE_BROW, this.colors.eyes, 1, 6);
        this.drawFaceContour(landmarks, FACE_LANDMARKS.RIGHT_EYE_BROW, this.colors.eyes, 1, 6);

        // Draw lips
        this.drawFaceContour(landmarks, FACE_LANDMARKS.LIPS_OUTER, this.colors.lips, 1.5, 10, true);
        this.drawFaceContour(landmarks, FACE_LANDMARKS.LIPS_INNER, this.colors.lips, 1, 6, true);

        // Draw nose
        this.drawFaceContour(landmarks, FACE_LANDMARKS.NOSE_BRIDGE, this.colors.nose, 1, 6);
        this.drawFaceContour(landmarks, [...FACE_LANDMARKS.NOSE_BOTTOM, FACE_LANDMARKS.NOSE_TIP[0]], this.colors.nose, 1, 6);

        // Draw irises if available (468+ landmarks means refined face)
        if (landmarks.length > 468) {
            this.ctx.fillStyle = this.colors.eyes;
            this.ctx.shadowColor = this.colors.eyes;
            this.ctx.shadowBlur = 8;

            // Left iris center
            const leftIris = landmarks[468];
            if (leftIris) {
                this.ctx.beginPath();
                this.ctx.arc(leftIris.x * this.width, leftIris.y * this.height, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Right iris center
            const rightIris = landmarks[473];
            if (rightIris) {
                this.ctx.beginPath();
                this.ctx.arc(rightIris.x * this.width, rightIris.y * this.height, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        this.ctx.restore();
    }

    drawFaceContour(landmarks, indices, color, lineWidth, glowBlur, closed = false) {
        if (indices.length < 2) return;

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = glowBlur;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();

        const firstPoint = landmarks[indices[0]];
        if (!firstPoint) return;

        this.ctx.moveTo(firstPoint.x * this.width, firstPoint.y * this.height);

        for (let i = 1; i < indices.length; i++) {
            const point = landmarks[indices[i]];
            if (point) {
                this.ctx.lineTo(point.x * this.width, point.y * this.height);
            }
        }

        if (closed) {
            this.ctx.closePath();
        }

        this.ctx.stroke();
    }

    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
    }
}
