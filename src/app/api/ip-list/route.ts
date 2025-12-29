import { NextRequest, NextResponse } from 'next/server';
import { addToIpList, removeFromIpList } from '@/lib/fraud/server/db';
import { getIpCache } from '@/lib/fraud/server/cache';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { ip, listType, action } = body;

        if (!ip) {
            return NextResponse.json({ success: false, error: 'IP is required' }, { status: 400 });
        }

        if (action === 'remove') {
            await removeFromIpList(ip);
        } else {
            if (listType !== 'whitelist' && listType !== 'blacklist') {
                return NextResponse.json({ success: false, error: 'Invalid list type' }, { status: 400 });
            }
            // Add to list (no expiration support in current db function, it's permanent)
            await addToIpList(ip, listType, 'Manual Entry via Dashboard', 'admin');
        }

        // Clear cache for this IP so the change takes effect immediately
        getIpCache().delete(ip);

        return NextResponse.json({ success: true, ip, listType, action });
    } catch (error) {
        console.error('[API] Error managing IP list:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
