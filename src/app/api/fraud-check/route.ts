/**
 * Fraud Detection API Route
 * 
 * POST /api/fraud-check
 * 
 * Receives fingerprint and behavior data from client,
 * performs IP reputation check, and returns classification.
 */

import { NextRequest, NextResponse } from 'next/server';
import { classify } from '@/lib/fraud/server/classifier';
import { insertFraudCheck } from '@/lib/fraud/server/db';
import type { FraudCheckRequest, FraudCheckResponse, Fingerprint, BehaviorData } from '@/lib/fraud/types';

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

function validateFingerprint(data: unknown): data is Fingerprint {
    if (!data || typeof data !== 'object') return false;

    const fp = data as Record<string, unknown>;

    // Check required top-level fields
    if (typeof fp.userAgent !== 'string') return false;
    if (typeof fp.language !== 'string') return false;
    if (typeof fp.timezone !== 'string') return false;
    if (!fp.device || typeof fp.device !== 'object') return false;
    if (!fp.screen || typeof fp.screen !== 'object') return false;
    if (!fp.hardware || typeof fp.hardware !== 'object') return false;

    // Check device fields
    const device = fp.device as Record<string, unknown>;
    if (typeof device.type !== 'string') return false;
    if (typeof device.isFakeMobile !== 'boolean') return false;
    if (typeof device.isAutomated !== 'boolean') return false;
    if (typeof device.isHeadless !== 'boolean') return false;

    return true;
}

function validateBehavior(data: unknown): data is BehaviorData {
    if (!data || typeof data !== 'object') return false;

    const bd = data as Record<string, unknown>;

    // Check required numeric fields
    if (typeof bd.mouseMovements !== 'number') return false;
    if (typeof bd.touchEvents !== 'number') return false;
    if (typeof bd.scrollEvents !== 'number') return false;

    return true;
}

// =============================================================================
// IP EXTRACTION
// =============================================================================

function extractClientIp(request: NextRequest): string {
    // Vercel headers
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
        // x-forwarded-for can contain multiple IPs, first one is the client
        const ips = xForwardedFor.split(',').map(ip => ip.trim());
        if (ips.length > 0 && ips[0]) {
            return ips[0];
        }
    }

    // Cloudflare
    const cfConnectingIp = request.headers.get('cf-connecting-ip');
    if (cfConnectingIp) {
        return cfConnectingIp;
    }

    // Standard headers
    const xRealIp = request.headers.get('x-real-ip');
    if (xRealIp) {
        return xRealIp;
    }

    // Fallback (shouldn't happen in production)
    return '127.0.0.1';
}

// =============================================================================
// ROUTE HANDLER
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<FraudCheckResponse>> {
    const startTime = performance.now();
    const requestId = crypto.randomUUID();

    try {
        // Parse request body
        const body: FraudCheckRequest = await request.json();

        // Validate fingerprint
        if (!validateFingerprint(body.fingerprint)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid fingerprint data',
                    requestId,
                },
                { status: 400 }
            );
        }

        // Validate behavior
        if (!validateBehavior(body.behavior)) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid behavior data',
                    requestId,
                },
                { status: 400 }
            );
        }

        // Extract client IP
        const clientIp = body.ip || extractClientIp(request);

        // Perform classification
        const result = await classify({
            ip: clientIp,
            fingerprint: body.fingerprint,
            behavior: body.behavior,
        });

        // Log for debugging (in production, send to logging service)
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
            console.log(`[Fraud Check] ${requestId}`, {
                ip: clientIp,
                classification: result.classification,
                score: result.score,
                reason: result.reason,
                processingTime: `${(performance.now() - startTime).toFixed(2)}ms`,
            });
        }

        // Save to database (async, don't block response)
        insertFraudCheck({
            requestId,
            ip: clientIp,
            asn: result.details?.ipReputation?.asn,
            org: result.details?.ipReputation?.org,
            countryCode: result.details?.ipReputation?.countryCode,
            classification: result.classification,
            score: result.score,
            reason: result.reason,
            flags: result.details?.flags || [],
            deviceType: body.fingerprint.device.type,
            userAgent: body.fingerprint.userAgent,
            os: body.fingerprint.device.os,
            osVersion: body.fingerprint.device.osVersion,
            browser: body.fingerprint.device.browser,
            browserVersion: body.fingerprint.device.browserVersion,
            mouseMovements: body.behavior.mouseMovements,
            touchEvents: body.behavior.touchEvents,
            scrollEvents: body.behavior.scrollEvents,
            isVpn: result.details?.ipReputation?.isVpn || false,
            isDatacenter: result.details?.ipReputation?.isDatacenter || false,
            isMobileCarrier: result.details?.ipReputation?.isMobileCarrier || false,
            isFakeMobile: body.fingerprint.device.isFakeMobile,
            isAutomated: body.fingerprint.device.isAutomated,
            isHeadless: body.fingerprint.device.isHeadless,
            processingTimeMs: result.processingTime,
            pageUrl: body.behavior.pageUrl,
        }).catch(err => console.error('[DB] Failed to save fraud check:', err));

        return NextResponse.json({
            success: true,
            result,
            requestId,
        });

    } catch (error) {
        console.error(`[Fraud Check] Error in ${requestId}:`, error);

        // Return WARN on error to avoid blocking legitimate users
        return NextResponse.json(
            {
                success: true,
                result: {
                    classification: 'WARN',
                    score: 50,
                    reason: 'Internal error - defaulting to WARN',
                    timestamp: Date.now(),
                    processingTime: performance.now() - startTime,
                },
                requestId,
            },
            { status: 200 } // Return 200 with WARN, not 500
        );
    }
}

// =============================================================================
// OPTIONS (CORS)
// =============================================================================

export async function OPTIONS(): Promise<NextResponse> {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
        },
    });
}

// =============================================================================
// CONFIG
// =============================================================================

// Edge runtime for low latency (optional - remove if you need Node.js features)
// export const runtime = 'edge';

// Disable static generation
export const dynamic = 'force-dynamic';
