/**
 * Fraud Detector - Client-Side Script
 * 
 * Lightweight fingerprinting and behavior tracking library.
 * Replaces Anura's client-side loader.
 * 
 * Usage:
 *   const detector = new FraudDetector({
 *     onComplete: (result) => {
 *       if (result.classification === 'GOOD') startCSA();
 *     }
 *   });
 *   detector.analyze();
 */

import type {
    FraudDetectorOptions,
    Fingerprint,
    BehaviorData,
    DeviceInfo,
    ScreenInfo,
    HardwareInfo,
    FraudResult,
    DetectionStage,
    FraudCheckResponse,
} from '../types';

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function generateSessionId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

async function hashString(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// =============================================================================
// DEVICE DETECTION
// =============================================================================

function detectDevice(): DeviceInfo {
    const ua = navigator.userAgent;
    const platform = navigator.platform;

    // Mobile detection via User Agent
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    const isMobileUA = mobileRegex.test(ua);

    // Tablet detection
    const tabletRegex = /iPad|Android(?=.*\b(tablet|pad)\b)|tablet/i;
    const isTablet = tabletRegex.test(ua) ||
        (ua.includes('Android') && !ua.includes('Mobile'));

    // Desktop platform detection
    const desktopPlatforms = ['Win32', 'Win64', 'Windows', 'MacIntel', 'Mac68K', 'Linux x86_64', 'Linux i686'];
    const isDesktopPlatform = desktopPlatforms.some(p => platform.includes(p));

    // CRITICAL: Fake mobile detection (Chrome DevTools mobile emulation)
    // This is an INSTANT BAD signal
    const isFakeMobile = isMobileUA && isDesktopPlatform && !isTablet;

    // Automation detection (Selenium, Puppeteer, Playwright)
    const isAutomated = (navigator as Navigator & { webdriver?: boolean }).webdriver === true;

    // Headless browser detection
    const isHeadless = /HeadlessChrome|Headless|PhantomJS|Nightmare/i.test(ua);

    // Parse OS
    let os = 'unknown';
    let osVersion = '';
    if (ua.includes('Windows NT 10')) { os = 'Windows'; osVersion = '10'; }
    else if (ua.includes('Windows NT 6.3')) { os = 'Windows'; osVersion = '8.1'; }
    else if (ua.includes('Windows NT 6.1')) { os = 'Windows'; osVersion = '7'; }
    else if (ua.includes('Mac OS X')) {
        os = 'macOS';
        const match = ua.match(/Mac OS X (\d+[._]\d+)/);
        osVersion = match ? match[1].replace('_', '.') : '';
    }
    else if (ua.includes('Android')) {
        os = 'Android';
        const match = ua.match(/Android (\d+\.?\d*)/);
        osVersion = match ? match[1] : '';
    }
    else if (ua.includes('iPhone') || ua.includes('iPad')) {
        os = ua.includes('iPad') ? 'iPadOS' : 'iOS';
        const match = ua.match(/OS (\d+[._]\d+)/);
        osVersion = match ? match[1].replace('_', '.') : '';
    }
    else if (ua.includes('Linux')) { os = 'Linux'; }

    // Parse browser
    let browser = 'unknown';
    let browserVersion = '';
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
        browser = 'Chrome';
        const match = ua.match(/Chrome\/(\d+)/);
        browserVersion = match ? match[1] : '';
    } else if (ua.includes('Firefox')) {
        browser = 'Firefox';
        const match = ua.match(/Firefox\/(\d+)/);
        browserVersion = match ? match[1] : '';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
        browser = 'Safari';
        const match = ua.match(/Version\/(\d+)/);
        browserVersion = match ? match[1] : '';
    } else if (ua.includes('Edg')) {
        browser = 'Edge';
        const match = ua.match(/Edg\/(\d+)/);
        browserVersion = match ? match[1] : '';
    }

    // Determine device type
    let type: DeviceInfo['type'] = 'desktop';
    if (isAutomated || isHeadless) type = 'bot';
    else if (isTablet) type = 'tablet';
    else if (isMobileUA && !isFakeMobile) type = 'mobile';

    return {
        type,
        isMobile: type === 'mobile',
        isTablet: type === 'tablet',
        isDesktop: type === 'desktop',
        isFakeMobile,
        isAutomated,
        isHeadless,
        os,
        osVersion,
        browser,
        browserVersion,
        platform,
    };
}

function getScreenInfo(): ScreenInfo {
    return {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
        pixelRatio: window.devicePixelRatio || 1,
    };
}

function getHardwareInfo(): HardwareInfo {
    return {
        cores: navigator.hardwareConcurrency || 0,
        // @ts-expect-error - deviceMemory is not in standard types
        memory: navigator.deviceMemory,
        maxTouchPoints: navigator.maxTouchPoints || 0,
        hasTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
    };
}

// =============================================================================
// CANVAS FINGERPRINTING
// =============================================================================

async function getCanvasFingerprint(): Promise<string> {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;

        const ctx = canvas.getContext('2d');
        if (!ctx) return 'canvas-unsupported';

        // Draw complex shapes that vary by GPU
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('FraudDetector', 2, 15);
        ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
        ctx.fillText('FraudDetector', 4, 17);

        // Add gradients
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, 'red');
        gradient.addColorStop(0.5, 'green');
        gradient.addColorStop(1, 'blue');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 30, 200, 10);

        // Arc
        ctx.beginPath();
        ctx.arc(50, 25, 10, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.fill();

        const dataUrl = canvas.toDataURL();
        return await hashString(dataUrl);
    } catch {
        return 'canvas-error';
    }
}

// =============================================================================
// WEBGL FINGERPRINTING
// =============================================================================

interface WebGLInfo {
    vendor: string;
    renderer: string;
    hash: string;
}

async function getWebGLFingerprint(): Promise<WebGLInfo> {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

        if (!gl || !(gl instanceof WebGLRenderingContext)) {
            return { vendor: 'unsupported', renderer: 'unsupported', hash: 'webgl-unsupported' };
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');

        let vendor = 'unknown';
        let renderer = 'unknown';

        if (debugInfo) {
            vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
            renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
        }

        const hash = await hashString(`${vendor}|${renderer}`);

        return { vendor, renderer, hash };
    } catch {
        return { vendor: 'error', renderer: 'error', hash: 'webgl-error' };
    }
}

// =============================================================================
// BEHAVIOR TRACKING
// =============================================================================

class BehaviorTracker {
    private data: BehaviorData;
    private startTime: number;
    private lastMousePos: { x: number; y: number } | null = null;
    private listeners: Array<{ type: string; handler: EventListener }> = [];

    constructor(sessionId: string, pageUrl: string) {
        this.startTime = Date.now();
        this.data = {
            mouseMovements: 0,
            mouseClicks: 0,
            mouseDistance: 0,
            touchEvents: 0,
            touchTaps: 0,
            touchSwipes: 0,
            scrollEvents: 0,
            scrollDistance: 0,
            keyPresses: 0,
            activeTime: 0,
            totalTime: 0,
            lastEventTime: Date.now(),
            sessionId,
            pageUrl,
        };
    }

    start(): void {
        // Mouse movement
        this.addListener('mousemove', (e: Event) => {
            const mouseEvent = e as MouseEvent;
            this.data.mouseMovements++;
            this.data.lastEventTime = Date.now();

            if (this.lastMousePos) {
                const dx = mouseEvent.clientX - this.lastMousePos.x;
                const dy = mouseEvent.clientY - this.lastMousePos.y;
                this.data.mouseDistance += Math.sqrt(dx * dx + dy * dy);
            }
            this.lastMousePos = { x: mouseEvent.clientX, y: mouseEvent.clientY };
        });

        // Mouse clicks
        this.addListener('click', () => {
            this.data.mouseClicks++;
            this.data.lastEventTime = Date.now();
        });

        // Touch events
        this.addListener('touchstart', () => {
            this.data.touchEvents++;
            this.data.touchTaps++;
            this.data.lastEventTime = Date.now();
        });

        this.addListener('touchmove', () => {
            this.data.touchEvents++;
            this.data.lastEventTime = Date.now();
        });

        this.addListener('touchend', () => {
            this.data.touchEvents++;
            this.data.lastEventTime = Date.now();
        });

        // Scroll events (throttled)
        let lastScroll = 0;
        let lastScrollY = window.scrollY;
        this.addListener('scroll', () => {
            const now = Date.now();
            if (now - lastScroll > 100) { // Throttle to 100ms
                this.data.scrollEvents++;
                this.data.scrollDistance += Math.abs(window.scrollY - lastScrollY);
                lastScrollY = window.scrollY;
                lastScroll = now;
                this.data.lastEventTime = now;
            }
        });

        // Key presses
        this.addListener('keydown', () => {
            this.data.keyPresses++;
            this.data.lastEventTime = Date.now();
        });
    }

    private addListener(type: string, handler: EventListener): void {
        document.addEventListener(type, handler, { passive: true });
        this.listeners.push({ type, handler });
    }

    stop(): void {
        for (const { type, handler } of this.listeners) {
            document.removeEventListener(type, handler);
        }
        this.listeners = [];
    }

    getData(): BehaviorData {
        const now = Date.now();
        this.data.totalTime = now - this.startTime;
        this.data.activeTime = this.data.lastEventTime - this.startTime;
        return { ...this.data };
    }
}

// =============================================================================
// MAIN FRAUD DETECTOR CLASS
// =============================================================================

export class FraudDetector {
    private options: Required<FraudDetectorOptions>;
    private sessionId: string;
    private behaviorTracker: BehaviorTracker | null = null;
    private stage: DetectionStage = 'init';

    constructor(options: FraudDetectorOptions) {
        this.options = {
            onComplete: options.onComplete,
            onError: options.onError || (() => { }),
            onProgress: options.onProgress || (() => { }),
            apiEndpoint: options.apiEndpoint || '/api/fraud-check',
            timeout: options.timeout || 5000,
            collectBehavior: options.collectBehavior !== false,
            behaviorDuration: options.behaviorDuration || 3000,
            debug: options.debug || false,
        };

        this.sessionId = generateSessionId();
    }

    /**
     * Start the fraud detection analysis.
     * This collects fingerprint, tracks behavior, and calls the API.
     */
    async analyze(): Promise<void> {
        try {
            const startTime = performance.now();

            // Stage 1: Fingerprinting (runs in parallel)
            this.setStage('fingerprinting');
            const fingerprint = await this.collectFingerprint();

            // Check for instant BAD signals (no need to continue)
            if (fingerprint.device.isAutomated || fingerprint.device.isHeadless) {
                const result: FraudResult = {
                    classification: 'BAD',
                    score: 0,
                    reason: fingerprint.device.isAutomated ? 'Automation detected (webdriver)' : 'Headless browser detected',
                    timestamp: Date.now(),
                    processingTime: performance.now() - startTime,
                };
                this.setStage('complete');
                this.options.onComplete(result);
                return;
            }

            if (fingerprint.device.isFakeMobile) {
                const result: FraudResult = {
                    classification: 'BAD',
                    score: 0,
                    reason: 'Fake mobile device detected (emulator)',
                    timestamp: Date.now(),
                    processingTime: performance.now() - startTime,
                };
                this.setStage('complete');
                this.options.onComplete(result);
                return;
            }

            // Stage 2: Behavior collection (if enabled)
            let behavior: BehaviorData;
            if (this.options.collectBehavior) {
                this.setStage('collecting_behavior');
                behavior = await this.collectBehavior();
            } else {
                behavior = this.getEmptyBehavior();
            }

            // Stage 3: Send to server for classification
            this.setStage('sending_request');
            const result = await this.sendForClassification(fingerprint, behavior);

            result.processingTime = performance.now() - startTime;

            this.setStage('complete');
            this.options.onComplete(result);

        } catch (error) {
            this.setStage('error');
            this.options.onError(error instanceof Error ? error : new Error(String(error)));

            // Fail-safe: On error, return WARN (not BAD) to avoid false positives
            const result: FraudResult = {
                classification: 'WARN',
                score: 50,
                reason: 'Detection error - defaulting to WARN',
                timestamp: Date.now(),
                processingTime: 0,
            };
            this.options.onComplete(result);
        }
    }

    /**
     * Start analysis immediately with minimal delay.
     * Use this when you want fastest possible result.
     */
    async analyzeNow(): Promise<FraudResult> {
        return new Promise((resolve, reject) => {
            this.options.onComplete = resolve;
            this.options.onError = reject;
            this.options.collectBehavior = false; // Skip behavior for speed
            this.analyze();
        });
    }

    private setStage(stage: DetectionStage): void {
        this.stage = stage;
        this.options.onProgress(stage);
        if (this.options.debug) {
            console.log(`[FraudDetector] Stage: ${stage}`);
        }
    }

    private async collectFingerprint(): Promise<Fingerprint> {
        const device = detectDevice();
        const screen = getScreenInfo();
        const hardware = getHardwareInfo();

        // Run canvas and WebGL fingerprinting in parallel
        const [canvasHash, webglInfo] = await Promise.all([
            getCanvasFingerprint(),
            getWebGLFingerprint(),
        ]);

        // Get plugins (may be empty in modern browsers)
        const plugins: string[] = [];
        for (let i = 0; i < navigator.plugins.length; i++) {
            plugins.push(navigator.plugins[i].name);
        }

        // Get MIME types
        const mimeTypes: string[] = [];
        for (let i = 0; i < navigator.mimeTypes.length; i++) {
            mimeTypes.push(navigator.mimeTypes[i].type);
        }

        return {
            device,
            screen,
            hardware,
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: Array.from(navigator.languages || [navigator.language]),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),
            canvasHash,
            webglVendor: webglInfo.vendor,
            webglRenderer: webglInfo.renderer,
            webglHash: webglInfo.hash,
            plugins,
            mimeTypes,
            doNotTrack: navigator.doNotTrack,
            cookiesEnabled: navigator.cookieEnabled,
            collectedAt: Date.now(),
        };
    }

    private collectBehavior(): Promise<BehaviorData> {
        return new Promise((resolve) => {
            this.behaviorTracker = new BehaviorTracker(this.sessionId, window.location.href);
            this.behaviorTracker.start();

            setTimeout(() => {
                if (this.behaviorTracker) {
                    const data = this.behaviorTracker.getData();
                    this.behaviorTracker.stop();
                    resolve(data);
                }
            }, this.options.behaviorDuration);
        });
    }

    private getEmptyBehavior(): BehaviorData {
        return {
            mouseMovements: 0,
            mouseClicks: 0,
            mouseDistance: 0,
            touchEvents: 0,
            touchTaps: 0,
            touchSwipes: 0,
            scrollEvents: 0,
            scrollDistance: 0,
            keyPresses: 0,
            activeTime: 0,
            totalTime: 0,
            lastEventTime: Date.now(),
            sessionId: this.sessionId,
            pageUrl: window.location.href,
        };
    }

    private async sendForClassification(
        fingerprint: Fingerprint,
        behavior: BehaviorData
    ): Promise<FraudResult> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

        try {
            const response = await fetch(this.options.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fingerprint,
                    behavior,
                    timestamp: Date.now(),
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data: FraudCheckResponse = await response.json();

            if (!data.success || !data.result) {
                throw new Error(data.error || 'Unknown API error');
            }

            return data.result;

        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    /**
     * Stop behavior tracking early.
     * Useful if user navigates away.
     */
    stopTracking(): void {
        if (this.behaviorTracker) {
            this.behaviorTracker.stop();
        }
    }

    /**
     * Get current detection stage.
     */
    getStage(): DetectionStage {
        return this.stage;
    }
}

// =============================================================================
// EXPORT FOR BROWSER (UMD-style)
// =============================================================================

// Auto-export to window for script tag usage
if (typeof window !== 'undefined') {
    (window as unknown as { FraudDetector: typeof FraudDetector }).FraudDetector = FraudDetector;
}

export default FraudDetector;
