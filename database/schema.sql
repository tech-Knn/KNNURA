-- ===========================================================================
-- FRAUD DETECTION SYSTEM - DATABASE SCHEMA
-- PostgreSQL Database Schema
-- ===========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================================================
-- MAIN TABLES
-- ===========================================================================

-- Fraud check records (main audit log)
CREATE TABLE IF NOT EXISTS fraud_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Request identifiers
    request_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36),
    
    -- IP information
    ip_address INET NOT NULL,
    asn INTEGER,
    org VARCHAR(255),
    country_code CHAR(2),
    
    -- Classification result
    classification VARCHAR(4) NOT NULL CHECK (classification IN ('GOOD', 'WARN', 'BAD')),
    score SMALLINT NOT NULL CHECK (score >= 0 AND score <= 100),
    reason TEXT NOT NULL,
    flags TEXT[], -- Array of detection flags
    
    -- Device information
    fingerprint_hash VARCHAR(64), -- SHA-256 hash
    device_type VARCHAR(20) CHECK (device_type IN ('desktop', 'mobile', 'tablet', 'bot', 'unknown')),
    user_agent TEXT,
    os VARCHAR(50),
    os_version VARCHAR(20),
    browser VARCHAR(50),
    browser_version VARCHAR(20),
    
    -- Behavior metrics
    mouse_movements INTEGER DEFAULT 0,
    touch_events INTEGER DEFAULT 0,
    scroll_events INTEGER DEFAULT 0,
    active_time_ms INTEGER DEFAULT 0,
    
    -- Boolean flags
    is_vpn BOOLEAN DEFAULT FALSE,
    is_datacenter BOOLEAN DEFAULT FALSE,
    is_mobile_carrier BOOLEAN DEFAULT FALSE,
    is_fake_mobile BOOLEAN DEFAULT FALSE,
    is_automated BOOLEAN DEFAULT FALSE,
    is_headless BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_time_ms REAL,
    
    -- Page info
    page_url TEXT
);

-- IP reputation cache (reduce API calls)
CREATE TABLE IF NOT EXISTS ip_reputation (
    ip_address INET PRIMARY KEY,
    
    -- ASN info
    asn INTEGER,
    org VARCHAR(255),
    isp VARCHAR(255),
    
    -- Location
    country VARCHAR(100),
    country_code CHAR(2),
    region VARCHAR(100),
    city VARCHAR(100),
    
    -- Classification flags
    is_vpn BOOLEAN DEFAULT FALSE,
    is_datacenter BOOLEAN DEFAULT FALSE,
    is_mobile_carrier BOOLEAN DEFAULT FALSE,
    is_proxy BOOLEAN DEFAULT FALSE,
    is_tor BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
    check_count INTEGER DEFAULT 1
);

-- Fingerprint statistics (track unique devices)
CREATE TABLE IF NOT EXISTS fingerprint_stats (
    fingerprint_hash VARCHAR(64) PRIMARY KEY,
    
    -- Reputation
    reputation_score SMALLINT DEFAULT 50 CHECK (reputation_score >= 0 AND reputation_score <= 100),
    
    -- Counts
    total_checks INTEGER DEFAULT 1,
    good_count INTEGER DEFAULT 0,
    warn_count INTEGER DEFAULT 0,
    bad_count INTEGER DEFAULT 0,
    
    -- Device info (from first seen)
    device_type VARCHAR(20),
    user_agent TEXT,
    os VARCHAR(50),
    browser VARCHAR(50),
    
    -- Timestamps
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Flags
    is_blacklisted BOOLEAN DEFAULT FALSE,
    is_whitelisted BOOLEAN DEFAULT FALSE,
    notes TEXT
);

-- Known bot signatures (for pattern matching)
CREATE TABLE IF NOT EXISTS known_bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Signature type
    signature_type VARCHAR(20) NOT NULL CHECK (signature_type IN ('fingerprint', 'user_agent', 'canvas', 'webgl', 'ip_range')),
    signature_value TEXT NOT NULL,
    
    -- Classification
    is_malicious BOOLEAN DEFAULT TRUE,
    description TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    hit_count INTEGER DEFAULT 0
);

-- Daily aggregated statistics
CREATE TABLE IF NOT EXISTS daily_stats (
    date DATE PRIMARY KEY,
    
    -- Counts
    total_checks INTEGER DEFAULT 0,
    good_count INTEGER DEFAULT 0,
    warn_count INTEGER DEFAULT 0,
    bad_count INTEGER DEFAULT 0,
    
    -- Device breakdown
    mobile_count INTEGER DEFAULT 0,
    desktop_count INTEGER DEFAULT 0,
    tablet_count INTEGER DEFAULT 0,
    bot_count INTEGER DEFAULT 0,
    
    -- Detection breakdown
    vpn_blocked INTEGER DEFAULT 0,
    datacenter_blocked INTEGER DEFAULT 0,
    fake_mobile_blocked INTEGER DEFAULT 0,
    automated_blocked INTEGER DEFAULT 0,
    headless_blocked INTEGER DEFAULT 0,
    
    -- Performance
    avg_processing_time_ms REAL,
    max_processing_time_ms REAL,
    
    -- Timestamps
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Manual IP whitelist/blacklist
CREATE TABLE IF NOT EXISTS ip_lists (
    ip_address INET PRIMARY KEY,
    list_type VARCHAR(10) NOT NULL CHECK (list_type IN ('whitelist', 'blacklist')),
    reason TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE -- NULL = never expires
);

-- ===========================================================================
-- INDEXES
-- ===========================================================================

-- fraud_checks indexes
CREATE INDEX IF NOT EXISTS idx_fraud_checks_created_at ON fraud_checks (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_ip ON fraud_checks (ip_address);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_classification ON fraud_checks (classification);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_fingerprint ON fraud_checks (fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_fraud_checks_date ON fraud_checks (DATE(created_at));

-- ip_reputation indexes
CREATE INDEX IF NOT EXISTS idx_ip_reputation_asn ON ip_reputation (asn);
CREATE INDEX IF NOT EXISTS idx_ip_reputation_expires ON ip_reputation (expires_at);

-- fingerprint_stats indexes
CREATE INDEX IF NOT EXISTS idx_fingerprint_stats_last_seen ON fingerprint_stats (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_fingerprint_stats_reputation ON fingerprint_stats (reputation_score);

-- ===========================================================================
-- FUNCTIONS
-- ===========================================================================

-- Function to update daily stats
CREATE OR REPLACE FUNCTION update_daily_stats()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO daily_stats (
        date,
        total_checks,
        good_count,
        warn_count,
        bad_count,
        mobile_count,
        desktop_count,
        tablet_count,
        bot_count,
        vpn_blocked,
        datacenter_blocked,
        fake_mobile_blocked,
        automated_blocked,
        headless_blocked,
        avg_processing_time_ms,
        max_processing_time_ms
    ) VALUES (
        DATE(NEW.created_at),
        1,
        CASE WHEN NEW.classification = 'GOOD' THEN 1 ELSE 0 END,
        CASE WHEN NEW.classification = 'WARN' THEN 1 ELSE 0 END,
        CASE WHEN NEW.classification = 'BAD' THEN 1 ELSE 0 END,
        CASE WHEN NEW.device_type = 'mobile' THEN 1 ELSE 0 END,
        CASE WHEN NEW.device_type = 'desktop' THEN 1 ELSE 0 END,
        CASE WHEN NEW.device_type = 'tablet' THEN 1 ELSE 0 END,
        CASE WHEN NEW.device_type = 'bot' THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_vpn THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_datacenter THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_fake_mobile THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_automated THEN 1 ELSE 0 END,
        CASE WHEN NEW.is_headless THEN 1 ELSE 0 END,
        NEW.processing_time_ms,
        NEW.processing_time_ms
    )
    ON CONFLICT (date) DO UPDATE SET
        total_checks = daily_stats.total_checks + 1,
        good_count = daily_stats.good_count + CASE WHEN NEW.classification = 'GOOD' THEN 1 ELSE 0 END,
        warn_count = daily_stats.warn_count + CASE WHEN NEW.classification = 'WARN' THEN 1 ELSE 0 END,
        bad_count = daily_stats.bad_count + CASE WHEN NEW.classification = 'BAD' THEN 1 ELSE 0 END,
        mobile_count = daily_stats.mobile_count + CASE WHEN NEW.device_type = 'mobile' THEN 1 ELSE 0 END,
        desktop_count = daily_stats.desktop_count + CASE WHEN NEW.device_type = 'desktop' THEN 1 ELSE 0 END,
        tablet_count = daily_stats.tablet_count + CASE WHEN NEW.device_type = 'tablet' THEN 1 ELSE 0 END,
        bot_count = daily_stats.bot_count + CASE WHEN NEW.device_type = 'bot' THEN 1 ELSE 0 END,
        vpn_blocked = daily_stats.vpn_blocked + CASE WHEN NEW.is_vpn THEN 1 ELSE 0 END,
        datacenter_blocked = daily_stats.datacenter_blocked + CASE WHEN NEW.is_datacenter THEN 1 ELSE 0 END,
        fake_mobile_blocked = daily_stats.fake_mobile_blocked + CASE WHEN NEW.is_fake_mobile THEN 1 ELSE 0 END,
        automated_blocked = daily_stats.automated_blocked + CASE WHEN NEW.is_automated THEN 1 ELSE 0 END,
        headless_blocked = daily_stats.headless_blocked + CASE WHEN NEW.is_headless THEN 1 ELSE 0 END,
        avg_processing_time_ms = (daily_stats.avg_processing_time_ms * daily_stats.total_checks + NEW.processing_time_ms) / (daily_stats.total_checks + 1),
        max_processing_time_ms = GREATEST(daily_stats.max_processing_time_ms, NEW.processing_time_ms),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for daily stats
DROP TRIGGER IF EXISTS trg_update_daily_stats ON fraud_checks;
CREATE TRIGGER trg_update_daily_stats
    AFTER INSERT ON fraud_checks
    FOR EACH ROW
    EXECUTE FUNCTION update_daily_stats();

-- Function to clean up old records (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_records(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM fraud_checks
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also clean up expired IP reputation entries
    DELETE FROM ip_reputation
    WHERE expires_at < NOW();
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ===========================================================================
-- SAMPLE QUERIES
-- ===========================================================================

-- Get today's stats
-- SELECT * FROM daily_stats WHERE date = CURRENT_DATE;

-- Get fraud rate for last 7 days
-- SELECT 
--     date,
--     total_checks,
--     ROUND(bad_count::NUMERIC / NULLIF(total_checks, 0) * 100, 2) AS bad_rate_percent
-- FROM daily_stats
-- WHERE date >= CURRENT_DATE - INTERVAL '7 days'
-- ORDER BY date DESC;

-- Get top 10 bad IPs today
-- SELECT 
--     ip_address,
--     COUNT(*) AS bad_count,
--     MAX(reason) AS reason
-- FROM fraud_checks
-- WHERE classification = 'BAD'
--   AND created_at >= CURRENT_DATE
-- GROUP BY ip_address
-- ORDER BY bad_count DESC
-- LIMIT 10;

-- Get device type breakdown
-- SELECT 
--     device_type,
--     COUNT(*) AS total,
--     SUM(CASE WHEN classification = 'GOOD' THEN 1 ELSE 0 END) AS good,
--     SUM(CASE WHEN classification = 'BAD' THEN 1 ELSE 0 END) AS bad,
--     ROUND(AVG(score), 1) AS avg_score
-- FROM fraud_checks
-- WHERE created_at >= CURRENT_DATE
-- GROUP BY device_type;

-- ===========================================================================
-- INITIAL DATA (Optional)
-- ===========================================================================

-- Insert known bot signatures
INSERT INTO known_bots (signature_type, signature_value, is_malicious, description)
VALUES 
    ('user_agent', 'HeadlessChrome', TRUE, 'Headless Chrome browser'),
    ('user_agent', 'PhantomJS', TRUE, 'PhantomJS headless browser'),
    ('user_agent', 'Nightmare', TRUE, 'Nightmare automation tool'),
    ('user_agent', 'Selenium', TRUE, 'Selenium webdriver'),
    ('user_agent', 'Puppeteer', TRUE, 'Puppeteer automation')
ON CONFLICT DO NOTHING;
