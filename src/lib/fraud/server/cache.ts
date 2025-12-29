/**
 * In-Memory LRU Cache
 * 
 * Simple LRU (Least Recently Used) cache for serverless environment.
 * Designed for IP reputation and fingerprint caching.
 * Swappable to Redis later if needed.
 */

interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    lastAccessed: number;
}

interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
}

export class LRUCache<T> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private maxSize: number;
    private defaultTtlMs: number;
    private stats: CacheStats;

    constructor(options: { maxSize: number; defaultTtlMs: number }) {
        this.maxSize = options.maxSize;
        this.defaultTtlMs = options.defaultTtlMs;
        this.stats = { hits: 0, misses: 0, size: 0, maxSize: options.maxSize };
    }

    /**
     * Get a value from cache by key.
     * Returns undefined if not found or expired.
     */
    get(key: string): T | undefined {
        const entry = this.cache.get(key);

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.size = this.cache.size;
            this.stats.misses++;
            return undefined;
        }

        // Update last accessed time (LRU)
        entry.lastAccessed = Date.now();
        this.cache.delete(key);
        this.cache.set(key, entry);

        this.stats.hits++;
        return entry.value;
    }

    /**
     * Set a value in cache with optional TTL.
     */
    set(key: string, value: T, ttlMs?: number): void {
        const ttl = ttlMs ?? this.defaultTtlMs;

        // If cache is full, evict least recently used
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }

        // Delete first to update position in Map (for LRU ordering)
        this.cache.delete(key);

        this.cache.set(key, {
            value,
            expiresAt: Date.now() + ttl,
            lastAccessed: Date.now(),
        });

        this.stats.size = this.cache.size;
    }

    /**
     * Check if a key exists and is not expired.
     */
    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.size = this.cache.size;
            return false;
        }

        return true;
    }

    /**
     * Delete a key from cache.
     */
    delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        this.stats.size = this.cache.size;
        return deleted;
    }

    /**
     * Clear all entries.
     */
    clear(): void {
        this.cache.clear();
        this.stats.size = 0;
    }

    /**
     * Get cache statistics.
     */
    getStats(): CacheStats & { hitRate: number } {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? this.stats.hits / total : 0;
        return { ...this.stats, hitRate };
    }

    /**
     * Clean up expired entries.
     * Call periodically in background.
     */
    cleanup(): number {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }

        this.stats.size = this.cache.size;
        return cleaned;
    }

    private evictOldest(): void {
        // Map maintains insertion order, first entry is oldest
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
            this.cache.delete(firstKey);
        }
    }
}

// =============================================================================
// CACHE INSTANCES (Singleton pattern for serverless)
// =============================================================================

import { CACHE_CONFIG } from '../../fraud-config';

// IP reputation cache: 1000 entries, 1 hour TTL
let ipCache: LRUCache<import('../types').IpReputationResult> | null = null;

export function getIpCache(): LRUCache<import('../types').IpReputationResult> {
    if (!ipCache) {
        ipCache = new LRUCache({
            maxSize: CACHE_CONFIG.ip.maxSize,
            defaultTtlMs: CACHE_CONFIG.ip.ttlMs,
        });
    }
    return ipCache;
}

// Fingerprint cache: 500 entries, 30 min TTL
let fingerprintCache: LRUCache<{ hash: string; reputation: number }> | null = null;

export function getFingerprintCache(): LRUCache<{ hash: string; reputation: number }> {
    if (!fingerprintCache) {
        fingerprintCache = new LRUCache({
            maxSize: CACHE_CONFIG.fingerprint.maxSize,
            defaultTtlMs: CACHE_CONFIG.fingerprint.ttlMs,
        });
    }
    return fingerprintCache;
}

// =============================================================================
// CACHE INTERFACE (For future Redis swap)
// =============================================================================

export interface CacheInterface<T> {
    get(key: string): Promise<T | undefined>;
    set(key: string, value: T, ttlMs?: number): Promise<void>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<boolean>;
}

/**
 * Async wrapper for LRUCache to match Redis interface.
 * Makes it easy to swap to Redis later.
 */
export class AsyncCacheWrapper<T> implements CacheInterface<T> {
    constructor(private cache: LRUCache<T>) { }

    async get(key: string): Promise<T | undefined> {
        return this.cache.get(key);
    }

    async set(key: string, value: T, ttlMs?: number): Promise<void> {
        this.cache.set(key, value, ttlMs);
    }

    async has(key: string): Promise<boolean> {
        return this.cache.has(key);
    }

    async delete(key: string): Promise<boolean> {
        return this.cache.delete(key);
    }
}
