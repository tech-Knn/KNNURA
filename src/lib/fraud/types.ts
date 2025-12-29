/**
 * Fraud Detection TypeScript Types
 * 
 * Core interfaces and types for the fraud detection system.
 */

// =============================================================================
// CLASSIFICATION
// =============================================================================

export type Classification = 'GOOD' | 'WARN' | 'BAD';

export interface FraudResult {
    classification: Classification;
    score: number; // 0-100 (0 = definitely bad, 100 = definitely good)
    reason: string;
    timestamp: number;
    processingTime: number; // in ms
    details?: FraudDetails;
}

export interface FraudDetails {
    ipReputation?: IpReputationResult;
    deviceType?: DeviceType;
    fingerprint?: FingerprintHash;
    behaviorScore?: number;
    flags?: string[];
}

// =============================================================================
// DEVICE & FINGERPRINT
// =============================================================================

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';

export interface DeviceInfo {
    type: DeviceType;
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isFakeMobile: boolean; // Mobile UA but Desktop platform
    isAutomated: boolean;  // navigator.webdriver = true
    isHeadless: boolean;   // Headless browser detected
    os: string;
    osVersion: string;
    browser: string;
    browserVersion: string;
    platform: string;      // navigator.platform
}

export interface ScreenInfo {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelRatio: number;
}

export interface HardwareInfo {
    cores: number;         // navigator.hardwareConcurrency
    memory?: number;       // navigator.deviceMemory (if available)
    maxTouchPoints: number;
    hasTouch: boolean;
}

export interface Fingerprint {
    // Device identification
    device: DeviceInfo;
    screen: ScreenInfo;
    hardware: HardwareInfo;

    // Browser environment
    userAgent: string;
    language: string;
    languages: string[];
    timezone: string;
    timezoneOffset: number;

    // Canvas fingerprint (GPU-based)
    canvasHash: string;

    // WebGL fingerprint
    webglVendor: string;
    webglRenderer: string;
    webglHash: string;

    // Additional signals
    plugins: string[];
    mimeTypes: string[];
    doNotTrack: string | null;
    cookiesEnabled: boolean;

    // Timestamps
    collectedAt: number;
}

export type FingerprintHash = string; // SHA-256 hash of fingerprint

// =============================================================================
// BEHAVIOR TRACKING
// =============================================================================

export interface BehaviorData {
    // Mouse events (desktop)
    mouseMovements: number;
    mouseClicks: number;
    mouseDistance: number; // Total pixels traveled

    // Touch events (mobile)
    touchEvents: number;
    touchTaps: number;
    touchSwipes: number;

    // Scroll events
    scrollEvents: number;
    scrollDistance: number;

    // Keyboard events
    keyPresses: number;

    // Timing
    activeTime: number;     // Time with any interaction
    totalTime: number;      // Time since page load
    lastEventTime: number;  // Timestamp of last event

    // Session info
    sessionId: string;
    pageUrl: string;
}

// =============================================================================
// IP REPUTATION
// =============================================================================

export interface IpReputationResult {
    ip: string;
    isVpn: boolean;
    isDatacenter: boolean;
    isMobileCarrier: boolean;
    isProxy: boolean;
    isTor: boolean;

    // ASN info
    asn: number | null;
    org: string;
    isp: string;

    // Location
    country: string;
    countryCode: string;
    region: string;
    city: string;

    // Cache info
    cached: boolean;
    cachedAt?: number;
}

// =============================================================================
// API REQUEST/RESPONSE
// =============================================================================

export interface FraudCheckRequest {
    // Required
    fingerprint: Fingerprint;
    behavior: BehaviorData;

    // Optional (filled by server if not provided)
    ip?: string;
    timestamp?: number;
}

export interface FraudCheckResponse {
    success: boolean;
    result?: FraudResult;
    error?: string;
    requestId: string;
}

// =============================================================================
// CLIENT-SIDE DETECTOR
// =============================================================================

export interface FraudDetectorOptions {
    // Callback when detection completes
    onComplete: (result: FraudResult) => void;

    // Optional callbacks
    onError?: (error: Error) => void;
    onProgress?: (stage: DetectionStage) => void;

    // Configuration
    apiEndpoint?: string;  // Default: '/api/fraud-check'
    timeout?: number;      // Default: 5000ms
    collectBehavior?: boolean; // Default: true
    behaviorDuration?: number; // Default: 3000ms (collect for 3 seconds)

    // Debug
    debug?: boolean;
}

export type DetectionStage =
    | 'init'
    | 'fingerprinting'
    | 'collecting_behavior'
    | 'sending_request'
    | 'complete'
    | 'error';

// =============================================================================
// DATABASE MODELS
// =============================================================================

export interface FraudCheckRecord {
    id: string;
    ip: string;
    fingerprintHash: FingerprintHash;
    classification: Classification;
    score: number;
    reason: string;

    // Request data
    userAgent: string;
    deviceType: DeviceType;
    os: string;
    browser: string;
    country: string;

    // Behavior metrics
    mouseMovements: number;
    touchEvents: number;
    scrollEvents: number;
    activeTime: number;

    // Flags
    isVpn: boolean;
    isDatacenter: boolean;
    isMobileCarrier: boolean;
    isFakeMobile: boolean;
    isAutomated: boolean;

    // Timestamps
    createdAt: Date;
    processingTime: number;
}

export interface IpReputationRecord {
    ip: string;
    asn: number | null;
    org: string;
    isp: string;
    country: string;
    countryCode: string;
    isVpn: boolean;
    isDatacenter: boolean;
    isMobileCarrier: boolean;

    // Timestamps
    lastChecked: Date;
    expiresAt: Date;
}

export interface DailyStats {
    date: string; // YYYY-MM-DD
    totalChecks: number;
    goodCount: number;
    warnCount: number;
    badCount: number;

    // Breakdown
    mobileCount: number;
    desktopCount: number;
    tabletCount: number;
    botCount: number;

    // Detection counts
    vpnBlocked: number;
    datacenterBlocked: number;
    fakeMobileBlocked: number;
    automatedBlocked: number;

    // Average metrics
    avgProcessingTime: number;
    avgBehaviorScore: number;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
    debug: (message: string, data?: unknown) => void;
    info: (message: string, data?: unknown) => void;
    warn: (message: string, data?: unknown) => void;
    error: (message: string, data?: unknown) => void;
}
