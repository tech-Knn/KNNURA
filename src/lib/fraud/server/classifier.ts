/**
 * Fraud Classification Engine
 * 
 * Implements Anura's detection rules with priority-based classification.
 * This is the core brain of the fraud detection system.
 */

import type {
    Classification,
    FraudResult,
    Fingerprint,
    BehaviorData,
    IpReputationResult,
    DeviceType,
} from '../types';

import {
    BEHAVIOR_THRESHOLDS,
    SCORING_WEIGHTS,
    CLASSIFICATION_PRIORITY,
    HIGH_RISK_BROWSERS,
} from '../../fraud-config';

import { checkIpReputation, isWhitelisted, isBlacklisted } from './ip-reputation';

// =============================================================================
// MAIN CLASSIFICATION FUNCTION
// =============================================================================

export interface ClassifyInput {
    ip: string;
    fingerprint: Fingerprint;
    behavior: BehaviorData;
}

/**
 * Main classification function implementing Anura's detection hierarchy.
 * 
 * Priority Order:
 * 1. Manual blacklist → BAD
 * 2. Manual whitelist → GOOD
 * 3. Automation detected (webdriver) → BAD
 * 4. Headless browser → BAD
 * 5. Fake mobile (emulator) → BAD
 * 6. VPN/Datacenter IP → BAD
 * 7. Mobile carrier IP → GOOD (bypass behavior)
 * 8. Behavior thresholds → GOOD/WARN
 */
export async function classify(input: ClassifyInput): Promise<FraudResult> {
    const startTime = performance.now();
    const flags: string[] = [];

    const { ip, fingerprint, behavior } = input;
    const device = fingerprint.device;

    // ==========================================================================
    // PRIORITY 1: Manual lists (instant decision)
    // ==========================================================================

    if (await isBlacklisted(ip)) {
        return createResult('BAD', 0, 'IP is blacklisted', startTime, flags);
    }

    if (await isWhitelisted(ip)) {
        return createResult('GOOD', 100, 'IP is whitelisted', startTime, flags);
    }

    // ==========================================================================
    // PRIORITY 2: Automation detection (instant BAD)
    // ==========================================================================

    if (device.isAutomated) {
        flags.push('webdriver_detected');
        return createResult('BAD', 0, 'Automation detected (navigator.webdriver)', startTime, flags);
    }

    // ==========================================================================
    // PRIORITY 3: Headless browser (instant BAD)
    // ==========================================================================

    if (device.isHeadless) {
        flags.push('headless_browser');
        return createResult('BAD', 0, 'Headless browser detected', startTime, flags);
    }

    // ==========================================================================
    // PRIORITY 4: Fake mobile detection (instant BAD)
    // This catches Chrome DevTools mobile emulation
    // ==========================================================================

    if (device.isFakeMobile) {
        flags.push('fake_mobile');
        return createResult('BAD', 0, 'Fake mobile device detected (emulator)', startTime, flags);
    }

    // ==========================================================================
    // PRIORITY 5: IP Reputation Check
    // ==========================================================================

    const ipReputation = await checkIpReputation(ip);

    // VPN detection (instant BAD)
    if (ipReputation.isVpn) {
        flags.push('vpn_detected');
        return createResult('BAD', 5, `VPN detected: ${ipReputation.org}`, startTime, flags, ipReputation);
    }

    // Tor detection (instant BAD)
    if (ipReputation.isTor) {
        flags.push('tor_detected');
        return createResult('BAD', 0, 'Tor exit node detected', startTime, flags, ipReputation);
    }

    // Datacenter detection (instant BAD)
    if (ipReputation.isDatacenter) {
        flags.push('datacenter_ip');
        return createResult('BAD', 10, `Datacenter/hosting IP: ${ipReputation.org}`, startTime, flags, ipReputation);
    }

    // ==========================================================================
    // PRIORITY 6: Mobile carrier (instant GOOD - bypass behavior)
    // This is critical for your traffic - 70%+ is from mobile carriers
    // ==========================================================================

    if (ipReputation.isMobileCarrier) {
        flags.push('mobile_carrier');
        // Don't even check behavior - carrier IPs are trusted
        return createResult('GOOD', 95, `Mobile carrier: ${ipReputation.org}`, startTime, flags, ipReputation);
    }

    // ==========================================================================
    // PRIORITY 7: Behavior analysis (for non-carrier traffic)
    // ==========================================================================

    const behaviorResult = analyzeBehavior(device.type, behavior);
    flags.push(...behaviorResult.flags);

    // High-risk browser check
    const browserLower = (device.browser || '').toLowerCase();
    const isHighRiskBrowser = HIGH_RISK_BROWSERS.some(b => browserLower.includes(b));
    if (isHighRiskBrowser) {
        flags.push('high_risk_browser');
        // Downgrade score by 10 points for high-risk browsers
        behaviorResult.score = Math.max(0, behaviorResult.score - 10);
    }

    // Calculate final classification
    const finalScore = Math.round(
        (ipReputation.isMobileCarrier ? 60 : calculateIpScore(ipReputation)) * (SCORING_WEIGHTS.ipReputation / 100) +
        (device.isFakeMobile || device.isAutomated ? 0 : 80) * (SCORING_WEIGHTS.deviceFingerprint / 100) +
        behaviorResult.score * (SCORING_WEIGHTS.behavior / 100)
    );

    // Determine classification from score
    let classification: Classification;
    let reason: string;

    if (behaviorResult.score >= 80) {
        classification = 'GOOD';
        reason = behaviorResult.reason;
    } else if (behaviorResult.score >= 40) {
        classification = 'WARN';
        reason = behaviorResult.reason;
    } else {
        classification = 'WARN'; // We use WARN instead of BAD for low behavior to reduce false positives
        reason = behaviorResult.reason;
    }

    return createResult(classification, finalScore, reason, startTime, flags, ipReputation, device.type);
}

// =============================================================================
// BEHAVIOR ANALYSIS
// =============================================================================

interface BehaviorAnalysisResult {
    score: number;
    classification: Classification;
    reason: string;
    flags: string[];
}

function analyzeBehavior(deviceType: DeviceType, behavior: BehaviorData): BehaviorAnalysisResult {
    const flags: string[] = [];

    // Bot or unknown device type
    if (deviceType === 'bot' || deviceType === 'unknown') {
        return {
            score: 0,
            classification: 'BAD',
            reason: `Suspicious device type: ${deviceType}`,
            flags: ['suspicious_device_type'],
        };
    }

    // Desktop behavior analysis
    if (deviceType === 'desktop') {
        const thresholds = BEHAVIOR_THRESHOLDS.desktop;
        const mouseMovements = behavior.mouseMovements;

        if (mouseMovements >= thresholds.mouseMovements.good) {
            return {
                score: 100,
                classification: 'GOOD',
                reason: `Good desktop behavior: ${mouseMovements} mouse movements`,
                flags: ['good_mouse_behavior'],
            };
        } else if (mouseMovements >= thresholds.mouseMovements.warn) {
            flags.push('low_mouse_movements');
            return {
                score: 60,
                classification: 'WARN',
                reason: `Low mouse movements: ${mouseMovements} (threshold: ${thresholds.mouseMovements.good})`,
                flags,
            };
        } else {
            flags.push('very_low_mouse_movements');
            return {
                score: 40,
                classification: 'WARN',
                reason: `Very low mouse movements: ${mouseMovements}`,
                flags,
            };
        }
    }

    // Mobile/tablet behavior analysis
    if (deviceType === 'mobile' || deviceType === 'tablet') {
        const thresholds = BEHAVIOR_THRESHOLDS.mobile;
        const touchEvents = behavior.touchEvents;

        if (touchEvents >= thresholds.touchEvents.good) {
            return {
                score: 100,
                classification: 'GOOD',
                reason: `Good mobile behavior: ${touchEvents} touch events`,
                flags: ['good_touch_behavior'],
            };
        } else if (touchEvents >= thresholds.touchEvents.warn) {
            flags.push('low_touch_events');
            return {
                score: 60,
                classification: 'WARN',
                reason: `Low touch events: ${touchEvents} (threshold: ${thresholds.touchEvents.good})`,
                flags,
            };
        } else {
            flags.push('very_low_touch_events');
            return {
                score: 40,
                classification: 'WARN',
                reason: `Very low touch events: ${touchEvents}`,
                flags,
            };
        }
    }

    // Fallback
    return {
        score: 50,
        classification: 'WARN',
        reason: 'Unknown behavior pattern',
        flags: ['unknown_behavior'],
    };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function calculateIpScore(ipReputation: IpReputationResult): number {
    // Higher score = more trustworthy
    if (ipReputation.isMobileCarrier) return 95;
    if (ipReputation.isVpn || ipReputation.isTor) return 0;
    if (ipReputation.isDatacenter) return 10;
    if (ipReputation.isProxy) return 20;

    // Residential IP - good by default
    return 80;
}

function createResult(
    classification: Classification,
    score: number,
    reason: string,
    startTime: number,
    flags: string[],
    ipReputation?: IpReputationResult,
    deviceType?: DeviceType
): FraudResult {
    return {
        classification,
        score,
        reason,
        timestamp: Date.now(),
        processingTime: performance.now() - startTime,
        details: {
            ipReputation,
            deviceType,
            flags,
        },
    };
}

// =============================================================================
// BATCH CLASSIFICATION
// =============================================================================

/**
 * Classify multiple requests in parallel.
 * Useful for background processing.
 */
export async function classifyBatch(inputs: ClassifyInput[]): Promise<FraudResult[]> {
    return Promise.all(inputs.map(classify));
}

// =============================================================================
// TESTING HELPERS
// =============================================================================

/**
 * Test classification with mock data.
 * Useful for unit tests.
 */
export function classifySync(
    ipReputation: IpReputationResult,
    fingerprint: Fingerprint,
    behavior: BehaviorData
): { classification: Classification; reason: string } {
    // This is a simplified synchronous version for testing

    if (fingerprint.device.isAutomated) {
        return { classification: 'BAD', reason: 'Automation detected' };
    }

    if (fingerprint.device.isHeadless) {
        return { classification: 'BAD', reason: 'Headless browser' };
    }

    if (fingerprint.device.isFakeMobile) {
        return { classification: 'BAD', reason: 'Fake mobile' };
    }

    if (ipReputation.isVpn || ipReputation.isTor) {
        return { classification: 'BAD', reason: 'VPN/Tor detected' };
    }

    if (ipReputation.isDatacenter) {
        return { classification: 'BAD', reason: 'Datacenter IP' };
    }

    if (ipReputation.isMobileCarrier) {
        return { classification: 'GOOD', reason: 'Mobile carrier' };
    }

    // Behavior-based classification
    const deviceType = fingerprint.device.type;
    if (deviceType === 'desktop') {
        if (behavior.mouseMovements >= 40) {
            return { classification: 'GOOD', reason: 'Good desktop behavior' };
        }
        return { classification: 'WARN', reason: 'Low mouse movements' };
    }

    if (deviceType === 'mobile' || deviceType === 'tablet') {
        if (behavior.touchEvents >= 7) {
            return { classification: 'GOOD', reason: 'Good mobile behavior' };
        }
        return { classification: 'WARN', reason: 'Low touch events' };
    }

    return { classification: 'WARN', reason: 'Unknown pattern' };
}
