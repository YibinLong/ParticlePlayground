/**
 * Particle Playground - Real-time Face & Hand Tracking
 * Main Application Entry Point
 */

import { ParticleSystem } from './particle-system.js';
import { MediaPipeTracker } from './mediapipe-tracker.js';
import { OverlayRenderer } from './overlay-renderer.js';
import { GestureDetector } from './gesture-detector.js';

// Color Themes
const THEMES = {
    Rainbow: {
        colors: ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd'],
        gradient: (t) => {
            const hue = (t * 360) % 360;
            return `hsl(${hue}, 80%, 60%)`;
        }
    },
    Fire: {
        colors: ['#ff4500', '#ff6b35', '#ff8c42', '#ffa500', '#ffb347', '#ffd700'],
        gradient: (t) => {
            const hue = 20 + t * 40;
            return `hsl(${hue}, 100%, ${50 + t * 20}%)`;
        }
    },
    Ocean: {
        colors: ['#0077b6', '#00b4d8', '#48cae4', '#90e0ef', '#ade8f4', '#caf0f8'],
        gradient: (t) => {
            const hue = 180 + t * 40;
            return `hsl(${hue}, 80%, ${40 + t * 30}%)`;
        }
    },
    Galaxy: {
        colors: ['#7400b8', '#6930c3', '#5e60ce', '#5390d9', '#4ea8de', '#48bfe3'],
        gradient: (t) => {
            const hue = 260 + t * 60;
            return `hsl(${hue}, 70%, ${40 + t * 25}%)`;
        }
    },
    Matrix: {
        colors: ['#00ff00', '#00dd00', '#00bb00', '#009900', '#007700', '#005500'],
        gradient: (t) => {
            return `hsl(120, 100%, ${20 + t * 40}%)`;
        }
    }
};

const THEME_NAMES = Object.keys(THEMES);

class App {
    constructor() {
        this.isRunning = false;
        this.mode = 'attract';
        this.currentThemeIndex = 0;
        this.cameraVisible = true;
        this.lastFistTime = 0;
        this.fistCooldown = 1000; // 1 second cooldown for theme change

        // DOM Elements
        this.introScreen = document.getElementById('intro-screen');
        this.app = document.getElementById('app');
        this.enableCameraBtn = document.getElementById('enable-camera-btn');
        this.video = document.getElementById('video');
        this.particleCanvas = document.getElementById('particle-canvas');
        this.overlayCanvas = document.getElementById('overlay-canvas');
        this.cameraPreview = document.getElementById('camera-preview');
        this.statusEl = document.getElementById('status');
        this.statusText = this.statusEl.querySelector('.status-text');
        this.attractBtn = document.getElementById('attract-btn');
        this.repelBtn = document.getElementById('repel-btn');
        this.themeNameEl = document.getElementById('theme-name');
        this.particleCountEl = document.getElementById('particle-count');
        this.countValueEl = this.particleCountEl.querySelector('.count-value');

        this.init();
    }

    init() {
        this.enableCameraBtn.addEventListener('click', () => this.start());
        this.attractBtn.addEventListener('click', () => this.setMode('attract'));
        this.repelBtn.addEventListener('click', () => this.setMode('repel'));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeydown(e));

        // Handle window resize
        window.addEventListener('resize', () => this.handleResize());
    }

    async start() {
        try {
            this.updateStatus('loading', 'Requesting camera...');

            // Request camera access
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });

            this.video.srcObject = stream;
            await this.video.play();

            // Hide intro, show app
            this.introScreen.classList.add('hidden');
            this.app.classList.remove('hidden');

            // Setup canvases
            this.setupCanvases();

            this.updateStatus('loading', 'Loading MediaPipe...');

            // Initialize components
            this.tracker = new MediaPipeTracker(this.video);
            await this.tracker.initialize();

            this.overlayRenderer = new OverlayRenderer(this.overlayCanvas);
            this.gestureDetector = new GestureDetector();

            this.particleSystem = new ParticleSystem(this.particleCanvas, {
                minParticles: 8000,
                maxParticles: 15000,
                theme: THEMES[THEME_NAMES[this.currentThemeIndex]]
            });

            this.updateStatus('waiting', 'Show your hands!');
            this.isRunning = true;
            this.animate();

        } catch (error) {
            console.error('Failed to start:', error);
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                this.updateStatus('error', 'Camera access denied');
            } else {
                this.updateStatus('error', 'Failed to load: ' + error.message);
            }
        }
    }

    setupCanvases() {
        // Particle canvas fills the screen
        this.particleCanvas.width = window.innerWidth;
        this.particleCanvas.height = window.innerHeight;

        // Overlay canvas matches video aspect ratio in preview
        this.overlayCanvas.width = 256;
        this.overlayCanvas.height = 144;
    }

    handleResize() {
        if (!this.isRunning) return;

        this.particleCanvas.width = window.innerWidth;
        this.particleCanvas.height = window.innerHeight;

        if (this.particleSystem) {
            this.particleSystem.handleResize(window.innerWidth, window.innerHeight);
        }
    }

    handleKeydown(e) {
        if (!this.isRunning) return;

        switch (e.code) {
            case 'Space':
                e.preventDefault();
                this.toggleMode();
                break;
            case 'KeyV':
                this.toggleCamera();
                break;
        }
    }

    setMode(mode) {
        this.mode = mode;
        this.attractBtn.classList.toggle('active', mode === 'attract');
        this.repelBtn.classList.toggle('active', mode === 'repel');

        if (this.particleSystem) {
            this.particleSystem.setMode(mode);
        }
    }

    toggleMode() {
        this.setMode(this.mode === 'attract' ? 'repel' : 'attract');
    }

    toggleCamera() {
        this.cameraVisible = !this.cameraVisible;
        this.cameraPreview.style.display = this.cameraVisible ? 'block' : 'none';
    }

    cycleTheme() {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % THEME_NAMES.length;
        const themeName = THEME_NAMES[this.currentThemeIndex];
        this.themeNameEl.textContent = themeName;

        if (this.particleSystem) {
            this.particleSystem.setTheme(THEMES[themeName]);
        }
    }

    updateStatus(state, text) {
        this.statusEl.className = `status ${state}`;
        this.statusText.textContent = text;
    }

    async animate() {
        if (!this.isRunning) return;

        // Get tracking results
        const results = await this.tracker.detect();

        // Check for detection
        const hasHands = results.hands && results.hands.length > 0;
        const hasFace = results.face && results.face.faceLandmarks && results.face.faceLandmarks.length > 0;

        if (hasHands || hasFace) {
            this.updateStatus('detecting', 'Tracking active');
        } else {
            this.updateStatus('waiting', 'Show your hands!');
        }

        // Detect fist gesture for theme cycling
        if (hasHands) {
            const isFist = this.gestureDetector.detectFist(results.hands);
            const now = Date.now();

            if (isFist && now - this.lastFistTime > this.fistCooldown) {
                this.lastFistTime = now;
                this.cycleTheme();
            }
        }

        // Extract landmarks for particles
        const landmarks = this.extractLandmarks(results);

        // Update particle system
        this.particleSystem.update(landmarks);

        // Render overlay on camera preview
        this.overlayRenderer.render(results);

        // Render particles
        this.particleSystem.render();

        // Update particle count display
        this.updateParticleCount();

        requestAnimationFrame(() => this.animate());
    }

    updateParticleCount() {
        const count = this.particleSystem.getActiveParticleCount();
        this.countValueEl.textContent = count.toLocaleString();
    }

    extractLandmarks(results) {
        const landmarks = {
            hands: [],
            face: null
        };

        // Extract hand landmarks
        if (results.hands) {
            for (const hand of results.hands) {
                if (hand.landmarks) {
                    landmarks.hands.push({
                        landmarks: hand.landmarks,
                        handedness: hand.handedness
                    });
                }
            }
        }

        // Extract face landmarks
        if (results.face && results.face.faceLandmarks && results.face.faceLandmarks.length > 0) {
            landmarks.face = results.face.faceLandmarks[0];
        }

        return landmarks;
    }
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
