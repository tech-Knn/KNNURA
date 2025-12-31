/**
 * Dashboard Stats API
 * 
 * GET /api/stats
 * Returns real-time statistics for the admin dashboard.
 */

import { NextResponse } from 'next/server';
import {
    getTodayStats,
    getTopBadIps,
    getDeviceBreakdown,
    getHourlyData,
    getCountryStats,
    checkDatabaseConnection,
} from '@/lib/fraud/server/db';

export async function GET() {
    try {
        // Check if database is connected
        const isConnected = await checkDatabaseConnection();

        if (!isConnected) {
            // Return mock data if database is not connected
            return NextResponse.json({
                success: true,
                source: 'mock',
                stats: getMockStats(),
            });
        }

        // Fetch real data from database
        const [todayStats, topBadIps, deviceBreakdown, hourlyData, countryStats] = await Promise.all([
            getTodayStats(),
            getTopBadIps(10),
            getDeviceBreakdown(),
            getHourlyData(),
            getCountryStats(1), // Last 24h
        ]);

        // Calculate rates
        const total = todayStats?.totalChecks || 0;
        const good = todayStats?.goodCount || 0;
        const warn = todayStats?.warnCount || 0;
        const bad = todayStats?.badCount || 0;

        return NextResponse.json({
            success: true,
            source: 'database',
            stats: {
                today: {
                    total,
                    good,
                    warn,
                    bad,
                    goodRate: total > 0 ? (good / total) * 100 : 0,
                    warnRate: total > 0 ? (warn / total) * 100 : 0,
                    badRate: total > 0 ? (bad / total) * 100 : 0,
                },
                deviceBreakdown,
                topBadIps,
                hourlyData,
                countryStats,
                avgProcessingTime: todayStats?.avgProcessingTimeMs || 0,
            },
        });

    } catch (error) {
        console.error('[Stats API] Error:', error);

        // Return mock data on error
        return NextResponse.json({
            success: true,
            source: 'mock',
            error: 'Database error - showing mock data',
            stats: getMockStats(),
        });
    }
}

function getMockStats() {
    return {
        today: {
            total: 50171,
            good: 37775,
            warn: 1305,
            bad: 3035,
            goodRate: 89.69,
            warnRate: 3.10,
            badRate: 7.21,
        },
        deviceBreakdown: {
            mobile: 48044,
            desktop: 643,
            tablet: 1292,
            bot: 252,
        },
        topBadIps: [
            { ip: '203.0.113.1', count: 45, reason: 'VPN detected' },
            { ip: '198.51.100.2', count: 38, reason: 'Datacenter IP' },
            { ip: '192.0.2.3', count: 32, reason: 'Automation detected' },
            { ip: '203.0.113.4', count: 28, reason: 'Fake mobile' },
            { ip: '198.51.100.5', count: 22, reason: 'VPN detected' },
        ],
        hourlyData: [
            { hour: '00:00', good: 1200, warn: 45, bad: 120 },
            { hour: '04:00', good: 800, warn: 30, bad: 80 },
            { hour: '08:00', good: 2500, warn: 90, bad: 200 },
            { hour: '12:00', good: 3500, warn: 120, bad: 280 },
            { hour: '16:00', good: 3800, warn: 130, bad: 300 },
            { hour: '20:00', good: 2000, warn: 70, bad: 150 },
        ],
        avgProcessingTime: 245,
    };
}

export const dynamic = 'force-dynamic';
