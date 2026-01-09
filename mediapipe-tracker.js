/**
 * MediaPipe Tracker - Handles Face and Hand Detection
 * Uses MediaPipe's Face Mesh and Hand Landmarker
 */

// MediaPipe CDN imports
const MEDIAPIPE_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe';
const HANDS_VERSION = 'hands@0.4.1675469240';
const FACE_MESH_VERSION = 'face_mesh@0.4.1633559619';
const DRAWING_UTILS_VERSION = 'drawing_utils@0.3.1620248257';

export class MediaPipeTracker {
    constructor(videoElement) {
        this.video = videoElement;
        this.hands = null;
        this.faceMesh = null;
        this.latestResults = {
            hands: [],
            face: null
        };
        this.isProcessing = false;
    }

    async initialize() {
        // Load MediaPipe scripts dynamically
        await this.loadScript(`${MEDIAPIPE_CDN}/${HANDS_VERSION}/hands.js`);
        await this.loadScript(`${MEDIAPIPE_CDN}/${FACE_MESH_VERSION}/face_mesh.js`);

        // Initialize Hands
        this.hands = new window.Hands({
            locateFile: (file) => {
                return `${MEDIAPIPE_CDN}/${HANDS_VERSION}/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => {
            this.processHandResults(results);
        });

        // Initialize Face Mesh
        this.faceMesh = new window.FaceMesh({
            locateFile: (file) => {
                return `${MEDIAPIPE_CDN}/${FACE_MESH_VERSION}/${file}`;
            }
        });

        this.faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5
        });

        this.faceMesh.onResults((results) => {
            this.processFaceResults(results);
        });

        // Wait for models to load
        await Promise.all([
            this.hands.initialize(),
            this.faceMesh.initialize()
        ]);

        console.log('MediaPipe models loaded successfully');
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script already loaded
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    processHandResults(results) {
        const hands = [];

        if (results.multiHandLandmarks && results.multiHandedness) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];

                hands.push({
                    landmarks: landmarks.map(lm => ({
                        x: lm.x,
                        y: lm.y,
                        z: lm.z
                    })),
                    handedness: handedness.label // 'Left' or 'Right'
                });
            }
        }

        this.latestResults.hands = hands;
    }

    processFaceResults(results) {
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            this.latestResults.face = {
                faceLandmarks: results.multiFaceLandmarks.map(face =>
                    face.map(lm => ({
                        x: lm.x,
                        y: lm.y,
                        z: lm.z
                    }))
                )
            };
        } else {
            this.latestResults.face = null;
        }
    }

    async detect() {
        if (this.isProcessing) {
            return this.latestResults;
        }

        if (this.video.readyState < 2) {
            return this.latestResults;
        }

        this.isProcessing = true;

        try {
            // Run both detections in parallel
            await Promise.all([
                this.hands.send({ image: this.video }),
                this.faceMesh.send({ image: this.video })
            ]);
        } catch (error) {
            console.error('Detection error:', error);
        }

        this.isProcessing = false;
        return this.latestResults;
    }

    destroy() {
        if (this.hands) {
            this.hands.close();
        }
        if (this.faceMesh) {
            this.faceMesh.close();
        }
    }
}

// Hand landmark indices for reference
export const HAND_LANDMARKS = {
    WRIST: 0,
    THUMB_CMC: 1,
    THUMB_MCP: 2,
    THUMB_IP: 3,
    THUMB_TIP: 4,
    INDEX_FINGER_MCP: 5,
    INDEX_FINGER_PIP: 6,
    INDEX_FINGER_DIP: 7,
    INDEX_FINGER_TIP: 8,
    MIDDLE_FINGER_MCP: 9,
    MIDDLE_FINGER_PIP: 10,
    MIDDLE_FINGER_DIP: 11,
    MIDDLE_FINGER_TIP: 12,
    RING_FINGER_MCP: 13,
    RING_FINGER_PIP: 14,
    RING_FINGER_DIP: 15,
    RING_FINGER_TIP: 16,
    PINKY_MCP: 17,
    PINKY_PIP: 18,
    PINKY_DIP: 19,
    PINKY_TIP: 20
};

// Hand skeleton connections
export const HAND_CONNECTIONS = [
    // Thumb
    [HAND_LANDMARKS.WRIST, HAND_LANDMARKS.THUMB_CMC],
    [HAND_LANDMARKS.THUMB_CMC, HAND_LANDMARKS.THUMB_MCP],
    [HAND_LANDMARKS.THUMB_MCP, HAND_LANDMARKS.THUMB_IP],
    [HAND_LANDMARKS.THUMB_IP, HAND_LANDMARKS.THUMB_TIP],
    // Index finger
    [HAND_LANDMARKS.WRIST, HAND_LANDMARKS.INDEX_FINGER_MCP],
    [HAND_LANDMARKS.INDEX_FINGER_MCP, HAND_LANDMARKS.INDEX_FINGER_PIP],
    [HAND_LANDMARKS.INDEX_FINGER_PIP, HAND_LANDMARKS.INDEX_FINGER_DIP],
    [HAND_LANDMARKS.INDEX_FINGER_DIP, HAND_LANDMARKS.INDEX_FINGER_TIP],
    // Middle finger
    [HAND_LANDMARKS.WRIST, HAND_LANDMARKS.MIDDLE_FINGER_MCP],
    [HAND_LANDMARKS.MIDDLE_FINGER_MCP, HAND_LANDMARKS.MIDDLE_FINGER_PIP],
    [HAND_LANDMARKS.MIDDLE_FINGER_PIP, HAND_LANDMARKS.MIDDLE_FINGER_DIP],
    [HAND_LANDMARKS.MIDDLE_FINGER_DIP, HAND_LANDMARKS.MIDDLE_FINGER_TIP],
    // Ring finger
    [HAND_LANDMARKS.WRIST, HAND_LANDMARKS.RING_FINGER_MCP],
    [HAND_LANDMARKS.RING_FINGER_MCP, HAND_LANDMARKS.RING_FINGER_PIP],
    [HAND_LANDMARKS.RING_FINGER_PIP, HAND_LANDMARKS.RING_FINGER_DIP],
    [HAND_LANDMARKS.RING_FINGER_DIP, HAND_LANDMARKS.RING_FINGER_TIP],
    // Pinky
    [HAND_LANDMARKS.WRIST, HAND_LANDMARKS.PINKY_MCP],
    [HAND_LANDMARKS.PINKY_MCP, HAND_LANDMARKS.PINKY_PIP],
    [HAND_LANDMARKS.PINKY_PIP, HAND_LANDMARKS.PINKY_DIP],
    [HAND_LANDMARKS.PINKY_DIP, HAND_LANDMARKS.PINKY_TIP],
    // Palm
    [HAND_LANDMARKS.INDEX_FINGER_MCP, HAND_LANDMARKS.MIDDLE_FINGER_MCP],
    [HAND_LANDMARKS.MIDDLE_FINGER_MCP, HAND_LANDMARKS.RING_FINGER_MCP],
    [HAND_LANDMARKS.RING_FINGER_MCP, HAND_LANDMARKS.PINKY_MCP]
];

// Fingertip indices
export const FINGERTIPS = [
    HAND_LANDMARKS.THUMB_TIP,
    HAND_LANDMARKS.INDEX_FINGER_TIP,
    HAND_LANDMARKS.MIDDLE_FINGER_TIP,
    HAND_LANDMARKS.RING_FINGER_TIP,
    HAND_LANDMARKS.PINKY_TIP
];

// Face mesh landmark groups
export const FACE_LANDMARKS = {
    // Silhouette (face oval)
    FACE_OVAL: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],

    // Left eye
    LEFT_EYE: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    LEFT_EYE_BROW: [46, 53, 52, 65, 55, 70, 63, 105, 66, 107],

    // Right eye
    RIGHT_EYE: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
    RIGHT_EYE_BROW: [276, 283, 282, 295, 285, 300, 293, 334, 296, 336],

    // Lips
    LIPS_OUTER: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
    LIPS_INNER: [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95],

    // Nose
    NOSE_BRIDGE: [168, 6, 197, 195, 5],
    NOSE_TIP: [4],
    NOSE_BOTTOM: [1, 2, 98, 327],

    // Irises (refined landmarks)
    LEFT_IRIS: [468, 469, 470, 471, 472],
    RIGHT_IRIS: [473, 474, 475, 476, 477]
};
