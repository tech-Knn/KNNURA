import { NextResponse } from 'next/server';
import { getRecentFraudChecks } from '@/lib/fraud/server/db';
import { FraudResult } from '@/lib/fraud/types';

export const dynamic = 'force-dynamic'; // Disable static caching

export async function GET() {
    try {
        const logs = await getRecentFraudChecks(100);
        return NextResponse.json(logs);
    } catch (error) {
        console.error('Error fetching logs:', error);
        return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
    }
}
