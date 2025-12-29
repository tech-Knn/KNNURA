/**
 * IP Reputation Service
 * 
 * Checks IP addresses for VPN, datacenter, and mobile carrier status.
 * Uses ipapi.co (free tier) or IPHub (paid tier).
 */

import type { IpReputationResult } from '../types';
import {
    VPN_KEYWORDS,
    DATACENTER_KEYWORDS,
    DATACENTER_ASNS,
    ALL_CARRIER_ASNS,
    IP_API_CONFIG,
    TIMEOUTS,
} from '../../fraud-config';
import { getIpCache } from './cache';

// =============================================================================
// IPAPI.CO RESPONSE TYPE
// =============================================================================

interface IpApiResponse {
    ip: string;
    city: string;
    region: string;
    country: string;
    country_code: string;
    postal: string;
    latitude: number;
    longitude: number;
    timezone: string;
    utc_offset: string;
    org: string;
    asn: string; // e.g., "AS55836"
    error?: boolean;
    reason?: string;
}

// =============================================================================
// IP REPUTATION CHECKER
// =============================================================================

/**
 * Check IP reputation using free ipapi.co API.
 * Results are cached for 1 hour to reduce API calls.
 */
export async function checkIpReputation(ip: string): Promise<IpReputationResult> {
    // Validate IP format
    if (!isValidIp(ip)) {
        return createUnknownResult(ip, 'Invalid IP format');
    }

    // Check cache first
    const cache = getIpCache();
    const cached = cache.get(ip);
    if (cached) {
        return { ...cached, cached: true };
    }

    try {
        const result = await fetchIpReputation(ip);

        // Cache the result
        cache.set(ip, result);

        return result;
    } catch (error) {
        console.error(`[IP Reputation] Error checking ${ip}:`, error);

        // Return unknown on error - don't block users on API failure
        return createUnknownResult(ip, 'API error');
    }
}

/**
 * Fetch IP reputation from ipapi.co
 */
async function fetchIpReputation(ip: string): Promise<IpReputationResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.ipLookup);

    try {
        const url = IP_API_CONFIG.free.url(ip);
        const response = await fetch(url, { signal: controller.signal });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data: IpApiResponse = await response.json();

        if (data.error) {
            throw new Error(data.reason || 'Unknown API error');
        }

        return parseIpApiResponse(data);

    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

/**
 * Parse ipapi.co response into our standard format.
 */
function parseIpApiResponse(data: IpApiResponse): IpReputationResult {
    const asnNumber = parseAsn(data.asn);
    const org = (data.org || '').toLowerCase();

    // Check if it's a mobile carrier (whitelist)
    const isMobileCarrier = asnNumber !== null && (ALL_CARRIER_ASNS as unknown as Set<number>).has(asnNumber);

    // Check if it's a known datacenter ASN (instant BAD)
    const isDatacenterAsn = asnNumber !== null && DATACENTER_ASNS.has(asnNumber);

    // Check org name for VPN keywords
    const isVpn = VPN_KEYWORDS.some(keyword => org.includes(keyword));

    // Check org name for datacenter keywords
    const isDatacenterName = DATACENTER_KEYWORDS.some(keyword => org.includes(keyword));

    return {
        ip: data.ip,
        isVpn,
        isDatacenter: isDatacenterAsn || isDatacenterName,
        isMobileCarrier,
        isProxy: false, // ipapi.co doesn't provide this directly
        isTor: org.includes('tor exit') || org.includes('tor project'),
        asn: asnNumber,
        org: data.org || '',
        isp: data.org || '', // ipapi.co uses org for ISP
        country: data.country || '',
        countryCode: data.country_code || '',
        region: data.region || '',
        city: data.city || '',
        cached: false,
    };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function isValidIp(ip: string): boolean {
    // IPv4
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(ip)) {
        return ip.split('.').every(octet => {
            const num = parseInt(octet, 10);
            return num >= 0 && num <= 255;
        });
    }

    // IPv6 (simplified check)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv6Regex.test(ip);
}

function parseAsn(asnString: string): number | null {
    if (!asnString) return null;

    // Format: "AS55836" or just "55836"
    const match = asnString.match(/\d+/);
    if (!match) return null;

    return parseInt(match[0], 10);
}

function createUnknownResult(ip: string, reason: string): IpReputationResult {
    console.warn(`[IP Reputation] Unknown result for ${ip}: ${reason}`);

    return {
        ip,
        isVpn: false,
        isDatacenter: false,
        isMobileCarrier: false,
        isProxy: false,
        isTor: false,
        asn: null,
        org: '',
        isp: '',
        country: '',
        countryCode: '',
        region: '',
        city: '',
        cached: false,
    };
}

// =============================================================================
// BULK OPERATIONS
// =============================================================================

/**
 * Check multiple IPs in parallel.
 * Useful for background enrichment.
 */
export async function checkMultipleIps(ips: string[]): Promise<Map<string, IpReputationResult>> {
    const results = new Map<string, IpReputationResult>();

    // Process in batches of 10 to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < ips.length; i += batchSize) {
        const batch = ips.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(checkIpReputation));

        for (let j = 0; j < batch.length; j++) {
            results.set(batch[j], batchResults[j]);
        }

        // Small delay between batches
        if (i + batchSize < ips.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
}

// =============================================================================
// MANUAL OVERRIDES
// =============================================================================

// Manual whitelist/blacklist (loaded from environment or database)
const manualWhitelist = new Set<string>();
const manualBlacklist = new Set<string>();

export function addToWhitelist(ip: string): void {
    manualWhitelist.add(ip);
    manualBlacklist.delete(ip); // Remove from blacklist if present
}

export function addToBlacklist(ip: string): void {
    manualBlacklist.add(ip);
    manualWhitelist.delete(ip); // Remove from whitelist if present
}

export function isWhitelisted(ip: string): boolean {
    return manualWhitelist.has(ip);
}

export function isBlacklisted(ip: string): boolean {
    return manualBlacklist.has(ip);
}
