import { NextRequest, NextResponse } from 'next/server';
import { getRecentFraudChecks } from '@/lib/fraud/server/db';

export const dynamic = 'force-dynamic'; // Disable static caching

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;

        const limit = parseInt(searchParams.get('limit') || '100');
        const filters = {
            status: searchParams.get('status') || undefined,
            country: searchParams.get('country') || undefined,
            ip: searchParams.get('ip') || undefined,
            days: searchParams.get('days') ? parseInt(searchParams.get('days')!) : undefined
        };

        const logs = await getRecentFraudChecks(limit, filters);
        return NextResponse.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
