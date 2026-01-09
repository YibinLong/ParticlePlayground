/**
 * Overlay Renderer - Draws skeleton and mesh overlays on the camera preview
 * Features glowing lines for hands and colored mesh for face
 */

import { HAND_CONNECTIONS, FINGERTIPS, HAND_LANDMARKS, FACE_LANDMARKS } from './mediapipe-tracker.js';

export class OverlayRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = canvas.width;
        this.height = canvas.height;

        // Colors
        this.colors = {
            handLeft: '#00ffff',      // Cyan for left hand
            handRight: '#ff69b4',     // Pink for right hand
            eyeTeal: '#00d4aa',       // Teal for eyes
            lipsPink: '#ff6b9d',      // Pink for lips
            faceOvalCyan: '#00d4ff',  // Cyan for face oval
            nosePurple: '#9d4edd'     // Purple for nose
        };
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

        // First pass: draw outer glow (larger, more blur)
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 20;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.globalAlpha = 0.4;

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

        // Second pass: draw bright core lines
        this.ctx.globalAlpha = 1;
        this.ctx.shadowBlur = 12;
        this.ctx.lineWidth = 2;

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

        // Draw all landmarks with differentiated sizes
        this.ctx.fillStyle = color;
        this.ctx.shadowBlur = 15;

        for (let i = 0; i < landmarks.length; i++) {
            const lm = landmarks[i];
            const isFingertip = FINGERTIPS.includes(i);
            const isWrist = i === HAND_LANDMARKS.WRIST;

            // Larger dots at fingertips and wrist as specified
            let radius;
            if (isFingertip) {
                radius = 6;
            } else if (isWrist) {
                radius = 7;
            } else {
                radius = 3;
            }

            // Draw outer glow for key points
            if (isFingertip || isWrist) {
                this.ctx.globalAlpha = 0.5;
                this.ctx.beginPath();
                this.ctx.arc(
                    lm.x * this.width,
                    lm.y * this.height,
                    radius + 3,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            }

            // Draw solid point
            this.ctx.globalAlpha = 1;
            this.ctx.beginPath();
            this.ctx.arc(
                lm.x * this.width,
                lm.y * this.height,
                radius,
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
        this.drawFaceContour(landmarks, FACE_LANDMARKS.FACE_OVAL, this.colors.faceOvalCyan, 1.5, 10);

        // Draw eyes
        this.drawFaceContour(landmarks, FACE_LANDMARKS.LEFT_EYE, this.colors.eyeTeal, 1, 8, true);
        this.drawFaceContour(landmarks, FACE_LANDMARKS.RIGHT_EYE, this.colors.eyeTeal, 1, 8, true);

        // Draw eyebrows
        this.drawFaceContour(landmarks, FACE_LANDMARKS.LEFT_EYE_BROW, this.colors.eyeTeal, 1, 6);
        this.drawFaceContour(landmarks, FACE_LANDMARKS.RIGHT_EYE_BROW, this.colors.eyeTeal, 1, 6);

        // Draw lips
        this.drawFaceContour(landmarks, FACE_LANDMARKS.LIPS_OUTER, this.colors.lipsPink, 1.5, 10, true);
        this.drawFaceContour(landmarks, FACE_LANDMARKS.LIPS_INNER, this.colors.lipsPink, 1, 6, true);

        // Draw nose
        this.drawFaceContour(landmarks, FACE_LANDMARKS.NOSE_BRIDGE, this.colors.nosePurple, 1, 6);
        this.drawFaceContour(landmarks, [...FACE_LANDMARKS.NOSE_BOTTOM, FACE_LANDMARKS.NOSE_TIP[0]], this.colors.nosePurple, 1, 6);

        // Draw irises if available (refined landmarks)
        if (landmarks.length > 468) {
            this.ctx.fillStyle = this.colors.eyeTeal;
            this.ctx.shadowColor = this.colors.eyeTeal;
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
