/**
 * Fraud Detection Library - Main Export
 * 
 * Re-exports all public APIs for convenient imports.
 */

// Types
export type {
    Classification,
    FraudResult,
    FraudDetails,
    DeviceType,
    DeviceInfo,
    ScreenInfo,
    HardwareInfo,
    Fingerprint,
    FingerprintHash,
    BehaviorData,
    IpReputationResult,
    FraudCheckRequest,
    FraudCheckResponse,
    FraudDetectorOptions,
    DetectionStage,
    FraudCheckRecord,
    IpReputationRecord,
    DailyStats,
    LogLevel,
    Logger,
} from './types';

// Configuration
export {
    BEHAVIOR_THRESHOLDS,
    SCORING_WEIGHTS,
    MOBILE_CARRIER_ASNS,
    ALL_CARRIER_ASNS,
    VPN_KEYWORDS,
    DATACENTER_KEYWORDS,
    DATACENTER_ASNS,
    HIGH_RISK_BROWSERS,
    SUSPICIOUS_PATTERNS,
    AUTOMATION_SIGNALS,
    CACHE_CONFIG,
    TIMEOUTS,
    IP_API_CONFIG,
    CLASSIFICATION_PRIORITY,
    DEBUG,
} from '../fraud-config';
