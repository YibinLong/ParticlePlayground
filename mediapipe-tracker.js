/**
 * MediaPipe Tracker - Handles Face and Hand Detection
 * Uses MediaPipe Vision Tasks API for reliable tracking
 */

// MediaPipe Vision Tasks CDN
const VISION_TASKS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18';

export class MediaPipeTracker {
    constructor(videoElement) {
        this.video = videoElement;
        this.handLandmarker = null;
        this.faceLandmarker = null;
        this.latestResults = {
            hands: [],
            face: null
        };
        this.isProcessing = false;
        this.lastVideoTime = -1;
    }

    async initialize() {
        // Dynamically import the Vision Tasks ES module
        const vision = await import(`${VISION_TASKS_CDN}/vision_bundle.mjs`);
        const { HandLandmarker, FaceLandmarker, FilesetResolver } = vision;

        // Initialize the fileset resolver
        const filesetResolver = await FilesetResolver.forVisionTasks(
            `${VISION_TASKS_CDN}/wasm`
        );

        // Initialize Hand Landmarker
        this.handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numHands: 4,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        // Initialize Face Landmarker
        this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numFaces: 2,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
            outputFaceBlendshapes: false,
            outputFacialTransformationMatrixes: false
        });

        console.log('MediaPipe Vision Tasks loaded successfully');
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

    async detect() {
        if (this.video.readyState < 2) {
            return this.latestResults;
        }

        const currentTime = this.video.currentTime;

        // Only process if video time has changed
        if (currentTime === this.lastVideoTime) {
            return this.latestResults;
        }

        this.lastVideoTime = currentTime;
        const timestamp = performance.now();

        try {
            // Run hand detection
            if (this.handLandmarker) {
                const handResults = this.handLandmarker.detectForVideo(this.video, timestamp);
                this.processHandResults(handResults);
            }

            // Run face detection
            if (this.faceLandmarker) {
                const faceResults = this.faceLandmarker.detectForVideo(this.video, timestamp);
                this.processFaceResults(faceResults);
            }
        } catch (error) {
            console.error('Detection error:', error);
        }

        return this.latestResults;
    }

    processHandResults(results) {
        const hands = [];

        if (results.landmarks && results.handednesses) {
            for (let i = 0; i < results.landmarks.length; i++) {
                const landmarks = results.landmarks[i];
                const handedness = results.handednesses[i];

                hands.push({
                    landmarks: landmarks.map(lm => ({
                        x: lm.x,
                        y: lm.y,
                        z: lm.z
                    })),
                    handedness: handedness[0]?.categoryName || 'Unknown'
                });
            }
        }

        this.latestResults.hands = hands;
    }

    processFaceResults(results) {
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            this.latestResults.face = {
                faceLandmarks: results.faceLandmarks.map(face =>
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

    destroy() {
        if (this.handLandmarker) {
            this.handLandmarker.close();
        }
        if (this.faceLandmarker) {
            this.faceLandmarker.close();
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
