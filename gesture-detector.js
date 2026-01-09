/**
 * Gesture Detector - Detects hand gestures for interactive controls
 * Currently supports fist detection for theme cycling
 */

import { HAND_LANDMARKS, FINGERTIPS } from './mediapipe-tracker.js';

export class GestureDetector {
    constructor() {
        // Threshold for considering a finger as curled
        this.curlThreshold = 0.7;
    }

    /**
     * Detect if any hand is making a fist gesture
     * @param {Array} hands - Array of hand data with landmarks
     * @returns {boolean} - True if a fist is detected
     */
    detectFist(hands) {
        if (!hands || hands.length === 0) return false;

        for (const hand of hands) {
            if (this.isHandFist(hand.landmarks)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a hand is making a fist
     * A fist is detected when all fingers are curled (fingertips close to palm)
     */
    isHandFist(landmarks) {
        if (!landmarks || landmarks.length < 21) return false;

        const wrist = landmarks[HAND_LANDMARKS.WRIST];
        const palmCenter = this.getPalmCenter(landmarks);

        // Check each finger for curl
        let curledFingers = 0;

        // Check index finger
        if (this.isFingerCurled(
            landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP],
            landmarks[HAND_LANDMARKS.INDEX_FINGER_PIP],
            landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP],
            palmCenter
        )) {
            curledFingers++;
        }

        // Check middle finger
        if (this.isFingerCurled(
            landmarks[HAND_LANDMARKS.MIDDLE_FINGER_MCP],
            landmarks[HAND_LANDMARKS.MIDDLE_FINGER_PIP],
            landmarks[HAND_LANDMARKS.MIDDLE_FINGER_TIP],
            palmCenter
        )) {
            curledFingers++;
        }

        // Check ring finger
        if (this.isFingerCurled(
            landmarks[HAND_LANDMARKS.RING_FINGER_MCP],
            landmarks[HAND_LANDMARKS.RING_FINGER_PIP],
            landmarks[HAND_LANDMARKS.RING_FINGER_TIP],
            palmCenter
        )) {
            curledFingers++;
        }

        // Check pinky
        if (this.isFingerCurled(
            landmarks[HAND_LANDMARKS.PINKY_MCP],
            landmarks[HAND_LANDMARKS.PINKY_PIP],
            landmarks[HAND_LANDMARKS.PINKY_TIP],
            palmCenter
        )) {
            curledFingers++;
        }

        // Check thumb (different geometry)
        if (this.isThumbCurled(
            landmarks[HAND_LANDMARKS.THUMB_CMC],
            landmarks[HAND_LANDMARKS.THUMB_MCP],
            landmarks[HAND_LANDMARKS.THUMB_TIP],
            landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP]
        )) {
            curledFingers++;
        }

        // Fist = all 5 fingers curled
        return curledFingers >= 5;
    }

    /**
     * Check if a finger is curled by comparing distances
     */
    isFingerCurled(mcp, pip, tip, palmCenter) {
        if (!mcp || !pip || !tip || !palmCenter) return false;

        // Distance from fingertip to palm center
        const tipToPalm = this.distance(tip, palmCenter);

        // Distance from MCP (knuckle) to palm center
        const mcpToPalm = this.distance(mcp, palmCenter);

        // If fingertip is closer to palm than MCP, finger is curled
        const curlRatio = tipToPalm / (mcpToPalm + 0.001);

        return curlRatio < this.curlThreshold;
    }

    /**
     * Check if thumb is curled (crosses over palm)
     */
    isThumbCurled(cmc, mcp, tip, indexMcp) {
        if (!cmc || !mcp || !tip || !indexMcp) return false;

        // Check if thumb tip is close to index finger MCP
        const tipToIndex = this.distance(tip, indexMcp);
        const mcpToIndex = this.distance(mcp, indexMcp);

        // Thumb is curled if tip is closer to index than MCP is
        return tipToIndex < mcpToIndex * 1.2;
    }

    /**
     * Calculate palm center from landmarks
     */
    getPalmCenter(landmarks) {
        // Average of wrist and finger MCPs
        const points = [
            landmarks[HAND_LANDMARKS.WRIST],
            landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP],
            landmarks[HAND_LANDMARKS.MIDDLE_FINGER_MCP],
            landmarks[HAND_LANDMARKS.RING_FINGER_MCP],
            landmarks[HAND_LANDMARKS.PINKY_MCP]
        ];

        let sumX = 0, sumY = 0, sumZ = 0;
        let count = 0;

        for (const p of points) {
            if (p) {
                sumX += p.x;
                sumY += p.y;
                sumZ += p.z;
                count++;
            }
        }

        if (count === 0) return null;

        return {
            x: sumX / count,
            y: sumY / count,
            z: sumZ / count
        };
    }

    /**
     * Calculate 3D distance between two landmarks
     */
    distance(a, b) {
        if (!a || !b) return Infinity;

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = (a.z || 0) - (b.z || 0);

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Detect open palm gesture
     */
    detectOpenPalm(hands) {
        if (!hands || hands.length === 0) return false;

        for (const hand of hands) {
            if (this.isHandOpen(hand.landmarks)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if hand is open (all fingers extended)
     */
    isHandOpen(landmarks) {
        if (!landmarks || landmarks.length < 21) return false;

        const palmCenter = this.getPalmCenter(landmarks);
        let extendedFingers = 0;

        // Check each fingertip is far from palm
        const fingerTips = [
            landmarks[HAND_LANDMARKS.INDEX_FINGER_TIP],
            landmarks[HAND_LANDMARKS.MIDDLE_FINGER_TIP],
            landmarks[HAND_LANDMARKS.RING_FINGER_TIP],
            landmarks[HAND_LANDMARKS.PINKY_TIP]
        ];

        const fingerMcps = [
            landmarks[HAND_LANDMARKS.INDEX_FINGER_MCP],
            landmarks[HAND_LANDMARKS.MIDDLE_FINGER_MCP],
            landmarks[HAND_LANDMARKS.RING_FINGER_MCP],
            landmarks[HAND_LANDMARKS.PINKY_MCP]
        ];

        for (let i = 0; i < fingerTips.length; i++) {
            const tip = fingerTips[i];
            const mcp = fingerMcps[i];

            if (!tip || !mcp || !palmCenter) continue;

            const tipToPalm = this.distance(tip, palmCenter);
            const mcpToPalm = this.distance(mcp, palmCenter);

            // Finger extended if tip is significantly farther from palm than MCP
            if (tipToPalm > mcpToPalm * 1.3) {
                extendedFingers++;
            }
        }

        return extendedFingers >= 4;
    }
}
