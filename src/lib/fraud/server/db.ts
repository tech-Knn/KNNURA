/**
 * MongoDB Database Connection Utilities
 * 
 * MongoDB Atlas connection with typed query functions.
 * For fraud detection data storage and retrieval.
 */

import { MongoClient, type Db, type Collection, ObjectId } from 'mongodb';
import type {
    Classification,
    DeviceType,
} from '../types';

// =============================================================================
// CONNECTION
// =============================================================================

let client: MongoClient | null = null;
let db: Db | null = null;

async function getDatabase(): Promise<Db> {
    if (!db) {
        const uri = process.env.MONGODB_URI;

        if (!uri) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        client = new MongoClient(uri);
        await client.connect();

        // Use database name from URI or default
        const dbName = process.env.MONGODB_DATABASE || 'fraud_detection';
        db = client.db(dbName);

        console.log('[MongoDB] Connected to database:', dbName);
    }

    return db;
}

// =============================================================================
// COLLECTION TYPES
// =============================================================================

export interface FraudCheckDocument {
    _id?: ObjectId;
    requestId: string;
    sessionId?: string;
    ip: string;
    asn?: number;
    org?: string;
    countryCode?: string;
    classification: Classification;
    score: number;
    reason: string;
    flags: string[];
    fingerprintHash?: string;
    deviceType?: DeviceType;
    userAgent?: string;
    os?: string;
    osVersion?: string;
    browser?: string;
    browserVersion?: string;
    mouseMovements: number;
    touchEvents: number;
    scrollEvents: number;
    activeTimeMs: number;
    isVpn: boolean;
    isDatacenter: boolean;
    isMobileCarrier: boolean;
    isFakeMobile: boolean;
    isAutomated: boolean;
    isHeadless: boolean;
    processingTimeMs: number;
    pageUrl?: string;
    createdAt: Date;
}

export interface IpListDocument {
    _id?: ObjectId;
    ip: string;
    listType: 'whitelist' | 'blacklist';
    reason?: string;
    createdBy?: string;
    createdAt: Date;
    expiresAt?: Date;
}

export interface DailyStatsDocument {
    _id?: ObjectId;
    date: string; // YYYY-MM-DD format
    totalChecks: number;
    goodCount: number;
    warnCount: number;
    badCount: number;
    mobileCount: number;
    desktopCount: number;
    tabletCount: number;
    botCount: number;
    vpnBlocked: number;
    datacenterBlocked: number;
    fakeMobileBlocked: number;
    automatedBlocked: number;
    headlessBlocked: number;
    avgProcessingTimeMs: number;
    maxProcessingTimeMs: number;
    updatedAt: Date;
}

// =============================================================================
// COLLECTIONS
// =============================================================================

async function getFraudChecksCollection(): Promise<Collection<FraudCheckDocument>> {
    const database = await getDatabase();
    return database.collection<FraudCheckDocument>('fraud_checks');
}

async function getIpListsCollection(): Promise<Collection<IpListDocument>> {
    const database = await getDatabase();
    return database.collection<IpListDocument>('ip_lists');
}

async function getDailyStatsCollection(): Promise<Collection<DailyStatsDocument>> {
    const database = await getDatabase();
    return database.collection<DailyStatsDocument>('daily_stats');
}

// =============================================================================
// FRAUD CHECK OPERATIONS
// =============================================================================

interface InsertFraudCheckParams {
    requestId: string;
    sessionId?: string;
    ip: string;
    asn?: number | null;
    org?: string;
    countryCode?: string;
    classification: Classification;
    score: number;
    reason: string;
    flags?: string[];
    fingerprintHash?: string;
    deviceType?: DeviceType;
    userAgent?: string;
    os?: string;
    osVersion?: string;
    browser?: string;
    browserVersion?: string;
    mouseMovements?: number;
    touchEvents?: number;
    scrollEvents?: number;
    activeTimeMs?: number;
    isVpn?: boolean;
    isDatacenter?: boolean;
    isMobileCarrier?: boolean;
    isFakeMobile?: boolean;
    isAutomated?: boolean;
    isHeadless?: boolean;
    processingTimeMs?: number;
    pageUrl?: string;
}

export async function insertFraudCheck(params: InsertFraudCheckParams): Promise<string> {
    const collection = await getFraudChecksCollection();

    const doc: FraudCheckDocument = {
        requestId: params.requestId,
        sessionId: params.sessionId,
        ip: params.ip,
        asn: params.asn ?? undefined,
        org: params.org,
        countryCode: params.countryCode,
        classification: params.classification,
        score: params.score,
        reason: params.reason,
        flags: params.flags || [],
        fingerprintHash: params.fingerprintHash,
        deviceType: params.deviceType,
        userAgent: params.userAgent,
        os: params.os,
        osVersion: params.osVersion,
        browser: params.browser,
        browserVersion: params.browserVersion,
        mouseMovements: params.mouseMovements || 0,
        touchEvents: params.touchEvents || 0,
        scrollEvents: params.scrollEvents || 0,
        activeTimeMs: params.activeTimeMs || 0,
        isVpn: params.isVpn || false,
        isDatacenter: params.isDatacenter || false,
        isMobileCarrier: params.isMobileCarrier || false,
        isFakeMobile: params.isFakeMobile || false,
        isAutomated: params.isAutomated || false,
        isHeadless: params.isHeadless || false,
        processingTimeMs: params.processingTimeMs || 0,
        pageUrl: params.pageUrl,
        createdAt: new Date(),
    };

    const result = await collection.insertOne(doc);

    // Update daily stats (async, don't wait)
    updateDailyStats(params).catch(console.error);

    return result.insertedId.toString();
}

export interface LogFilters {
    status?: string;
    country?: string;
    ip?: string;
    days?: number;
}

export async function getRecentFraudChecks(limit: number = 100, filters?: LogFilters): Promise<FraudCheckDocument[]> {
    const collection = await getFraudChecksCollection();

    // Build query based on filters
    const query: any = {};

    if (filters?.status && filters.status !== 'ALL') {
        query.classification = filters.status;
    }

    if (filters?.country) {
        query.countryCode = filters.country.toUpperCase();
    }

    if (filters?.ip) {
        query.ip = { $regex: filters.ip, $options: 'i' }; // Partial match
    }

    if (filters?.days) {
        const date = new Date();
        date.setDate(date.getDate() - filters.days);
        query.createdAt = { $gte: date };
    }

    // Fetch last N records matching the query
    const docs = await collection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

    return docs;
}

// =============================================================================
// DAILY STATS
// =============================================================================

async function updateDailyStats(params: InsertFraudCheckParams): Promise<void> {
    const collection = await getDailyStatsCollection();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    await collection.updateOne(
        { date: today },
        {
            $inc: {
                totalChecks: 1,
                goodCount: params.classification === 'GOOD' ? 1 : 0,
                warnCount: params.classification === 'WARN' ? 1 : 0,
                badCount: params.classification === 'BAD' ? 1 : 0,
                mobileCount: params.deviceType === 'mobile' ? 1 : 0,
                desktopCount: params.deviceType === 'desktop' ? 1 : 0,
                tabletCount: params.deviceType === 'tablet' ? 1 : 0,
                botCount: params.deviceType === 'bot' ? 1 : 0,
                vpnBlocked: params.isVpn ? 1 : 0,
                datacenterBlocked: params.isDatacenter ? 1 : 0,
                fakeMobileBlocked: params.isFakeMobile ? 1 : 0,
                automatedBlocked: params.isAutomated ? 1 : 0,
                headlessBlocked: params.isHeadless ? 1 : 0,
            },
            $set: { updatedAt: new Date() },
            $setOnInsert: {
                date: today,
                avgProcessingTimeMs: params.processingTimeMs || 0,
                maxProcessingTimeMs: params.processingTimeMs || 0,
            },
        },
        { upsert: true }
    );
}

export async function getTodayStats(): Promise<DailyStatsDocument | null> {
    const collection = await getDailyStatsCollection();
    const today = new Date().toISOString().split('T')[0];

    return collection.findOne({ date: today });
}

// =============================================================================
// STATISTICS QUERIES
// =============================================================================

export async function getTopBadIps(limit = 10): Promise<Array<{ ip: string; count: number; reason: string }>> {
    const collection = await getFraudChecksCollection();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await collection.aggregate([
        { $match: { classification: 'BAD', createdAt: { $gte: today } } },
        { $group: { _id: '$ip', count: { $sum: 1 }, reason: { $first: '$reason' } } },
        { $sort: { count: -1 } },
        { $limit: limit },
        { $project: { ip: '$_id', count: 1, reason: 1, _id: 0 } },
    ]).toArray();

    return results as Array<{ ip: string; count: number; reason: string }>;
}

export async function getDeviceBreakdown(): Promise<{
    mobile: number;
    desktop: number;
    tablet: number;
    bot: number;
}> {
    const collection = await getFraudChecksCollection();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await collection.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: '$deviceType', count: { $sum: 1 } } },
    ]).toArray();

    const breakdown = { mobile: 0, desktop: 0, tablet: 0, bot: 0 };
    for (const row of results) {
        const count = row.count as number;
        if (row._id === 'mobile') breakdown.mobile = count;
        else if (row._id === 'desktop') breakdown.desktop = count;
        else if (row._id === 'tablet') breakdown.tablet = count;
        else if (row._id === 'bot') breakdown.bot = count;
    }

    return breakdown;
}

export async function getHourlyData(): Promise<Array<{
    hour: string;
    good: number;
    warn: number;
    bad: number;
}>> {
    const collection = await getFraudChecksCollection();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const results = await collection.aggregate([
        { $match: { createdAt: { $gte: today } } },
        {
            $group: {
                _id: { $hour: '$createdAt' },
                good: { $sum: { $cond: [{ $eq: ['$classification', 'GOOD'] }, 1, 0] } },
                warn: { $sum: { $cond: [{ $eq: ['$classification', 'WARN'] }, 1, 0] } },
                bad: { $sum: { $cond: [{ $eq: ['$classification', 'BAD'] }, 1, 0] } },
            },
        },
        { $sort: { _id: 1 } },
    ]).toArray();

    return results.map(row => ({
        hour: `${String(row._id).padStart(2, '0')}:00`,
        good: row.good as number,
        warn: row.warn as number,
        bad: row.bad as number,
    }));
}

// =============================================================================
// IP LIST OPERATIONS
// =============================================================================

export async function addToIpList(
    ip: string,
    listType: 'whitelist' | 'blacklist',
    reason?: string,
    createdBy?: string
): Promise<void> {
    const collection = await getIpListsCollection();

    await collection.updateOne(
        { ip },
        {
            $set: {
                listType,
                reason,
                createdBy,
                createdAt: new Date(),
            },
        },
        { upsert: true }
    );
}

export async function removeFromIpList(ip: string): Promise<void> {
    const collection = await getIpListsCollection();
    await collection.deleteOne({ ip });
}

export async function getIpListStatus(ip: string): Promise<'whitelist' | 'blacklist' | null> {
    const collection = await getIpListsCollection();

    const doc = await collection.findOne({
        ip,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
    });

    return doc?.listType || null;
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

export async function checkDatabaseConnection(): Promise<boolean> {
    try {
        const database = await getDatabase();
        await database.command({ ping: 1 });
        return true;
    } catch {
        return false;
    }
}

// =============================================================================
// INDEXES (Run once on startup)
// =============================================================================

export async function createIndexes(): Promise<void> {
    const fraudChecks = await getFraudChecksCollection();
    const ipLists = await getIpListsCollection();
    const dailyStats = await getDailyStatsCollection();

    // Fraud checks indexes
    await fraudChecks.createIndex({ createdAt: -1 });
    await fraudChecks.createIndex({ ip: 1 });
    await fraudChecks.createIndex({ classification: 1 });
    await fraudChecks.createIndex({ fingerprintHash: 1 });

    // IP lists indexes
    await ipLists.createIndex({ ip: 1 }, { unique: true });

    // Daily stats indexes
    await dailyStats.createIndex({ date: 1 }, { unique: true });

    console.log('[MongoDB] Indexes created');
}

// =============================================================================
// CLEANUP
// =============================================================================

export async function closeConnection(): Promise<void> {
    if (client) {
        await client.close();
        client = null;
        db = null;
    }
}
