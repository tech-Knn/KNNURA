/**
 * Fraud Detection Configuration
 * 
 * All thresholds, ASN lists, and detection constants in one place.
 * Tunable to match or exceed Anura's detection accuracy.
 */

// =============================================================================
// CLASSIFICATION TYPES
// =============================================================================

export type Classification = 'GOOD' | 'WARN' | 'BAD';

export interface FraudResult {
    classification: Classification;
    score: number; // 0-100 (0 = definitely bad, 100 = definitely good)
    reason: string;
    details?: {
        ipReputation?: string;
        deviceType?: string;
        behaviorScore?: number;
        flags?: string[];
    };
}

// =============================================================================
// BEHAVIOR THRESHOLDS
// =============================================================================

export const BEHAVIOR_THRESHOLDS = {
    desktop: {
        mouseMovements: {
            good: 40,    // 40+ movements = GOOD
            warn: 20,    // 20-39 movements = WARN
            // Below 20 = WARN (not BAD, to reduce false positives)
        },
        scrollEvents: {
            good: 3,     // 3+ scroll events = slight positive signal
        },
        clickEvents: {
            good: 1,     // At least 1 click expected
        },
        minimumActiveTime: 2000, // 2 seconds minimum on page
    },
    mobile: {
        touchEvents: {
            good: 7,     // 7+ touches = GOOD
            warn: 3,     // 3-6 touches = WARN
            // Below 3 = WARN
        },
        scrollEvents: {
            good: 2,     // Mobile users scroll frequently
        },
        tapEvents: {
            good: 1,     // At least 1 tap expected
        },
        minimumActiveTime: 1500, // Mobile users are faster
    },
} as const;

// =============================================================================
// SCORING WEIGHTS (Total = 100)
// =============================================================================

export const SCORING_WEIGHTS = {
    ipReputation: 60,    // IP is the strongest signal
    deviceFingerprint: 30, // Device checks (fake mobile, automation)
    behavior: 10,         // Behavior is the weakest signal
} as const;

// =============================================================================
// MOBILE CARRIER ASN DATABASE
// Carrier IPs are whitelisted - always return GOOD regardless of behavior
// =============================================================================

export const MOBILE_CARRIER_ASNS = {
    // India (Primary Market - 70%+ of traffic)
    india: [
        55836,   // Reliance Jio Infocomm Limited
        45609,   // Reliance Jio (additional range)
        24560,   // Bharti Airtel Ltd
        9498,    // Bharti Airtel Ltd (Telemedia)
        45514,   // Bharti Airtel LTE
        55410,   // Vodafone Idea Ltd
        38266,   // Vodafone India
        9829,    // BSNL (Bharat Sanchar Nigam Ltd)
        4755,    // BSNL (additional)
        17747,   // Idea Cellular Limited
        18101,   // Reliance Communications
    ],

    // USA (Secondary Market)
    usa: [
        7018,    // AT&T Services Inc
        20115,   // AT&T Mobility
        22394,   // Verizon Wireless
        6167,    // Verizon Business
        21928,   // T-Mobile USA Inc
        20057,   // Sprint
    ],

    // Other Major Markets
    other: [
        // UK
        12576,   // EE Limited (UK)
        23455,   // O2 UK
        34984,   // Vodafone UK

        // UAE
        5384,    // Etisalat UAE
        15802,   // Du (Emirates Telecom)

        // Singapore
        24218,   // Singtel Mobile
        10091,   // M1 Limited
    ],
} as const;

// Flattened list for quick lookup
export const ALL_CARRIER_ASNS = new Set([
    ...MOBILE_CARRIER_ASNS.india,
    ...MOBILE_CARRIER_ASNS.usa,
    ...MOBILE_CARRIER_ASNS.other,
]);

// =============================================================================
// VPN & DATACENTER DETECTION
// =============================================================================

export const VPN_KEYWORDS = [
    'vpn', 'proxy', 'tor', 'tunnel', 'anonymou', 'private internet',
    'surfshark', 'nordvpn', 'expressvpn', 'cyberghost', 'purevpn',
    'ipvanish', 'protonvpn', 'mullvad', 'windscribe', 'hotspot shield',
    'hma', 'hide.me', 'privatevpn', 'strongvpn', 'torguard',
] as const;

export const DATACENTER_KEYWORDS = [
    // Major Cloud Providers
    'amazon', 'aws', 'ec2', 'cloudfront',
    'google', 'gcp', 'cloud',
    'microsoft', 'azure',
    'digitalocean', 'linode', 'vultr', 'hetzner',
    'ovh', 'scaleway', 'upcloud',

    // Hosting Providers
    'hosting', 'server', 'datacenter', 'data center',
    'colocation', 'colo', 'dedicated',
    'cloudflare', 'fastly', 'akamai', 'cdn',
    'rackspace', 'godaddy', 'bluehost', 'hostinger',

    // VPS Providers
    'vps', 'virtual private', 'virtual server',
] as const;

// Known datacenter ASNs (instant BAD)
export const DATACENTER_ASNS = new Set([
    // AWS
    16509, 14618, 8987,
    // Google Cloud
    15169, 396982,
    // Microsoft Azure
    8075, 8068, 8069,
    // DigitalOcean
    14061,
    // Linode
    63949,
    // Vultr
    20473,
    // OVH
    16276,
    // Hetzner
    24940,
    // Cloudflare
    13335,
]);

// =============================================================================
// BROWSER & OS RISK SCORING
// Based on your Anura data analysis
// =============================================================================

export const HIGH_RISK_BROWSERS = [
    'facebook',           // 9.33% bad rate
    'facebook messenger', // 10.45% bad rate
    'opera mini',         // Often used by bots
] as const;

export const SUSPICIOUS_PATTERNS = {
    // Non-identifiable OS claiming to be mobile = 100% fraud in your data
    nonIdentifiableOsMobile: true,

    // Vivo Browser has only 75.82% mobile rate (suspicious for a mobile browser)
    lowMobileRateBrowsers: ['vivo browser'],
} as const;

// =============================================================================
// AUTOMATION DETECTION
// =============================================================================

export const AUTOMATION_SIGNALS = {
    // WebDriver (Selenium, Puppeteer, Playwright)
    webdriver: true,

    // Headless browser markers
    headlessMarkers: [
        'headless',
        'phantomjs',
        'nightmare',
    ],

    // Missing browser features that bots often lack
    missingFeatures: [
        'chrome',        // Chromium should have window.chrome
        'notifications', // Most browsers have Notification API
    ],
} as const;

// =============================================================================
// PERFORMANCE & CACHING
// =============================================================================

export const CACHE_CONFIG = {
    ip: {
        maxSize: 1000,       // Max IP entries to cache
        ttlMs: 60 * 60 * 1000, // 1 hour TTL
    },
    fingerprint: {
        maxSize: 500,        // Max fingerprint entries
        ttlMs: 30 * 60 * 1000, // 30 minutes TTL
    },
} as const;

export const TIMEOUTS = {
    ipLookup: 3000,        // 3 second timeout for IP API
    totalCheck: 800,       // Target: complete check in 800ms
    behaviorCollection: 5000, // Collect behavior for 5 seconds max
} as const;

// =============================================================================
// API CONFIGURATION
// =============================================================================

export const IP_API_CONFIG = {
    // Free tier (default): ipapi.co - 30,000 requests/month
    free: {
        url: (ip: string) => `https://ipapi.co/${ip}/json/`,
        rateLimit: 30000, // per month
    },

    // Paid tier: IPHub - $30/month, 100k requests
    paid: {
        url: (ip: string) => `https://v2.api.iphub.info/ip/${ip}`,
        headers: (apiKey: string) => ({ 'X-Key': apiKey }),
        rateLimit: 100000, // per month
    },
} as const;

// =============================================================================
// CLASSIFICATION RULES (Priority Order)
// =============================================================================

export const CLASSIFICATION_PRIORITY = [
    'automation',      // 1. navigator.webdriver = true → BAD
    'headless',        // 2. Headless browser detected → BAD
    'fakeMobile',      // 3. Mobile UA + Desktop Platform → BAD
    'vpnDatacenter',   // 4. VPN/Datacenter IP → BAD
    'mobileCarrier',   // 5. Mobile carrier IP → GOOD (bypass behavior)
    'behavior',        // 6. Check behavior thresholds
] as const;

// =============================================================================
// DEBUG MODE
// =============================================================================

export const DEBUG = {
    enabled: process.env.NODE_ENV === 'development',
    logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error',
} as const;
