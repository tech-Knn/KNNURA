/**
 * Fraud Classifier Unit Tests
 * 
 * Tests the classification logic with various scenarios.
 * Run with: npm test
 */

// Jest globals (describe, it, expect) are provided by jest
import { classifySync } from '../server/classifier';
import type {
    IpReputationResult,
    Fingerprint,
    BehaviorData,
    DeviceInfo,
} from '../types';

// =============================================================================
// TEST HELPERS
// =============================================================================

function createMockFingerprint(overrides: Partial<DeviceInfo> = {}): Fingerprint {
    const device: DeviceInfo = {
        type: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isFakeMobile: false,
        isAutomated: false,
        isHeadless: false,
        os: 'Windows',
        osVersion: '10',
        browser: 'Chrome',
        browserVersion: '120',
        platform: 'Win32',
        ...overrides,
    };

    return {
        device,
        screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040, colorDepth: 24, pixelRatio: 1 },
        hardware: { cores: 8, memory: 8, maxTouchPoints: 0, hasTouch: false },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        language: 'en-US',
        languages: ['en-US', 'en'],
        timezone: 'Asia/Kolkata',
        timezoneOffset: -330,
        canvasHash: 'abc123',
        webglVendor: 'Google Inc.',
        webglRenderer: 'ANGLE',
        webglHash: 'xyz789',
        plugins: [],
        mimeTypes: [],
        doNotTrack: null,
        cookiesEnabled: true,
        collectedAt: Date.now(),
    };
}

function createMockIpReputation(overrides: Partial<IpReputationResult> = {}): IpReputationResult {
    return {
        ip: '192.168.1.1',
        isVpn: false,
        isDatacenter: false,
        isMobileCarrier: false,
        isProxy: false,
        isTor: false,
        asn: 12345,
        org: 'Test ISP',
        isp: 'Test ISP',
        country: 'India',
        countryCode: 'IN',
        region: 'Maharashtra',
        city: 'Mumbai',
        cached: false,
        ...overrides,
    };
}

function createMockBehavior(overrides: Partial<BehaviorData> = {}): BehaviorData {
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
        totalTime: 3000,
        lastEventTime: Date.now(),
        sessionId: 'test-session',
        pageUrl: 'https://example.com',
        ...overrides,
    };
}

// =============================================================================
// TESTS
// =============================================================================

describe('Fraud Classifier', () => {

    describe('Automation Detection', () => {
        it('should return BAD for webdriver detected', () => {
            const fingerprint = createMockFingerprint({ isAutomated: true });
            const ipReputation = createMockIpReputation();
            const behavior = createMockBehavior();

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('BAD');
            expect(result.reason).toContain('Automation');
        });

        it('should return BAD for headless browser', () => {
            const fingerprint = createMockFingerprint({ isHeadless: true });
            const ipReputation = createMockIpReputation();
            const behavior = createMockBehavior();

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('BAD');
            expect(result.reason).toContain('Headless');
        });
    });

    describe('Fake Mobile Detection', () => {
        it('should return BAD for fake mobile (emulator)', () => {
            const fingerprint = createMockFingerprint({
                isFakeMobile: true,
                type: 'mobile',
                isMobile: true,
            });
            const ipReputation = createMockIpReputation();
            const behavior = createMockBehavior();

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('BAD');
            expect(result.reason).toContain('Fake mobile');
        });

        it('should return GOOD for real mobile with carrier IP', () => {
            const fingerprint = createMockFingerprint({
                type: 'mobile',
                isMobile: true,
                isDesktop: false,
                isFakeMobile: false,
            });
            const ipReputation = createMockIpReputation({
                isMobileCarrier: true,
                org: 'Reliance Jio',
                asn: 55836,
            });
            const behavior = createMockBehavior();

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('GOOD');
            expect(result.reason).toContain('Mobile carrier');
        });
    });

    describe('VPN/Datacenter Detection', () => {
        it('should return BAD for VPN IP', () => {
            const fingerprint = createMockFingerprint();
            const ipReputation = createMockIpReputation({
                isVpn: true,
                org: 'NordVPN',
            });
            const behavior = createMockBehavior({ mouseMovements: 50 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('BAD');
            expect(result.reason).toContain('VPN');
        });

        it('should return BAD for datacenter IP', () => {
            const fingerprint = createMockFingerprint();
            const ipReputation = createMockIpReputation({
                isDatacenter: true,
                org: 'Amazon AWS',
            });
            const behavior = createMockBehavior({ mouseMovements: 50 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('BAD');
            expect(result.reason).toContain('Datacenter');
        });

        it('should return BAD for Tor exit node', () => {
            const fingerprint = createMockFingerprint();
            const ipReputation = createMockIpReputation({
                isTor: true,
            });
            const behavior = createMockBehavior({ mouseMovements: 50 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('BAD');
            expect(result.reason).toContain('VPN/Tor');
        });
    });

    describe('Mobile Carrier Whitelist', () => {
        it('should return GOOD for Jio carrier IP', () => {
            const fingerprint = createMockFingerprint({
                type: 'mobile',
                isMobile: true,
            });
            const ipReputation = createMockIpReputation({
                isMobileCarrier: true,
                asn: 55836,
                org: 'Reliance Jio Infocomm Limited',
            });
            // Even with zero behavior, carrier IPs should be GOOD
            const behavior = createMockBehavior({ touchEvents: 0 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('GOOD');
        });

        it('should return GOOD for Airtel carrier IP', () => {
            const fingerprint = createMockFingerprint({
                type: 'mobile',
                isMobile: true,
            });
            const ipReputation = createMockIpReputation({
                isMobileCarrier: true,
                asn: 24560,
                org: 'Bharti Airtel Ltd',
            });
            const behavior = createMockBehavior({ touchEvents: 2 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('GOOD');
        });
    });

    describe('Desktop Behavior Thresholds', () => {
        it('should return GOOD for 40+ mouse movements', () => {
            const fingerprint = createMockFingerprint({ type: 'desktop' });
            const ipReputation = createMockIpReputation();
            const behavior = createMockBehavior({ mouseMovements: 45 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('GOOD');
        });

        it('should return WARN for 20-39 mouse movements', () => {
            const fingerprint = createMockFingerprint({ type: 'desktop' });
            const ipReputation = createMockIpReputation();
            const behavior = createMockBehavior({ mouseMovements: 25 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('WARN');
        });

        it('should return WARN for <20 mouse movements', () => {
            const fingerprint = createMockFingerprint({ type: 'desktop' });
            const ipReputation = createMockIpReputation();
            const behavior = createMockBehavior({ mouseMovements: 10 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('WARN');
        });
    });

    describe('Mobile Behavior Thresholds (Non-Carrier)', () => {
        it('should return GOOD for 7+ touch events on residential IP', () => {
            const fingerprint = createMockFingerprint({
                type: 'mobile',
                isMobile: true,
            });
            const ipReputation = createMockIpReputation(); // Not a carrier
            const behavior = createMockBehavior({ touchEvents: 10 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('GOOD');
        });

        it('should return WARN for 3-6 touch events on residential IP', () => {
            const fingerprint = createMockFingerprint({
                type: 'mobile',
                isMobile: true,
            });
            const ipReputation = createMockIpReputation();
            const behavior = createMockBehavior({ touchEvents: 5 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('WARN');
        });

        it('should return WARN for <3 touch events on residential IP', () => {
            const fingerprint = createMockFingerprint({
                type: 'mobile',
                isMobile: true,
            });
            const ipReputation = createMockIpReputation();
            const behavior = createMockBehavior({ touchEvents: 1 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('WARN');
        });
    });

    describe('Edge Cases', () => {
        it('should handle tablet device type', () => {
            const fingerprint = createMockFingerprint({
                type: 'tablet',
                isTablet: true,
                isMobile: false,
            });
            const ipReputation = createMockIpReputation();
            const behavior = createMockBehavior({ touchEvents: 10 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            expect(result.classification).toBe('GOOD');
        });

        it('should prioritize automation over good behavior', () => {
            const fingerprint = createMockFingerprint({ isAutomated: true });
            const ipReputation = createMockIpReputation({ isMobileCarrier: true });
            const behavior = createMockBehavior({ mouseMovements: 100 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            // Automation should still be BAD even with carrier IP and good behavior
            expect(result.classification).toBe('BAD');
        });

        it('should prioritize VPN over carrier status', () => {
            const fingerprint = createMockFingerprint();
            const ipReputation = createMockIpReputation({
                isVpn: true,
                isMobileCarrier: true, // Conflicting signals
            });
            const behavior = createMockBehavior({ mouseMovements: 50 });

            const result = classifySync(ipReputation, fingerprint, behavior);

            // VPN should take priority
            expect(result.classification).toBe('BAD');
        });
    });
});

// =============================================================================
// PERFORMANCE TESTS
// =============================================================================

describe('Performance', () => {
    it('should classify in under 10ms (sync version)', () => {
        const fingerprint = createMockFingerprint();
        const ipReputation = createMockIpReputation();
        const behavior = createMockBehavior({ mouseMovements: 45 });

        const start = performance.now();

        for (let i = 0; i < 1000; i++) {
            classifySync(ipReputation, fingerprint, behavior);
        }

        const elapsed = performance.now() - start;
        const avgTime = elapsed / 1000;

        expect(avgTime).toBeLessThan(10); // Less than 10ms per call
    });
});
