'use client';

/**
 * Fraud Detection Admin Dashboard
 * 
 * Real-time monitoring of fraud detection statistics.
 * Replicates key views from Anura dashboard.
 */

import { useState, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

interface DashboardStats {
    today: {
        total: number;
        good: number;
        warn: number;
        bad: number;
        goodRate: number;
        warnRate: number;
        badRate: number;
    };
    deviceBreakdown: {
        mobile: number;
        desktop: number;
        tablet: number;
        bot: number;
    };
    topBadIps: Array<{
        ip: string;
        count: number;
        reason: string;
    }>;
    hourlyData: Array<{
        hour: string;
        good: number;
        warn: number;
        bad: number;
    }>;
    avgProcessingTime: number;
}

// =============================================================================
// MOCK DATA (Replace with real API calls)
// =============================================================================

const MOCK_STATS: DashboardStats = {
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

// =============================================================================
// COMPONENTS
// =============================================================================

function StatCard({
    label,
    value,
    percentage,
    color
}: {
    label: string;
    value: number;
    percentage?: number;
    color: string;
}) {
    return (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">{label}</div>
            <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${color}`}>
                    {value.toLocaleString()}
                </span>
                {percentage !== undefined && (
                    <span className="text-sm text-gray-500">
                        ({percentage.toFixed(2)}%)
                    </span>
                )}
            </div>
        </div>
    );
}

function ProgressBar({
    good,
    warn,
    bad
}: {
    good: number;
    warn: number;
    bad: number;
}) {
    const total = good + warn + bad;
    return (
        <div className="h-4 rounded-full overflow-hidden flex bg-gray-700">
            <div
                className="bg-green-500"
                style={{ width: `${(good / total) * 100}%` }}
                title={`Good: ${good.toLocaleString()}`}
            />
            <div
                className="bg-yellow-500"
                style={{ width: `${(warn / total) * 100}%` }}
                title={`Warn: ${warn.toLocaleString()}`}
            />
            <div
                className="bg-red-500"
                style={{ width: `${(bad / total) * 100}%` }}
                title={`Bad: ${bad.toLocaleString()}`}
            />
        </div>
    );
}

function DeviceBreakdownChart({ data }: { data: DashboardStats['deviceBreakdown'] }) {
    const total = data.mobile + data.desktop + data.tablet + data.bot;

    const items = [
        { label: 'Mobile', value: data.mobile, color: 'bg-blue-500' },
        { label: 'Desktop', value: data.desktop, color: 'bg-purple-500' },
        { label: 'Tablet', value: data.tablet, color: 'bg-cyan-500' },
        { label: 'Bot', value: data.bot, color: 'bg-red-500' },
    ];

    return (
        <div className="space-y-3">
            {items.map(item => (
                <div key={item.label}>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-300">{item.label}</span>
                        <span className="text-gray-400">
                            {item.value.toLocaleString()} ({((item.value / total) * 100).toFixed(1)}%)
                        </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                        <div
                            className={item.color}
                            style={{ width: `${(item.value / total) * 100}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

function TopBadIpsTable({ ips }: { ips: DashboardStats['topBadIps'] }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                        <th className="text-left py-2">IP Address</th>
                        <th className="text-right py-2">Count</th>
                        <th className="text-left py-2 pl-4">Reason</th>
                    </tr>
                </thead>
                <tbody>
                    {ips.map((ip, i) => (
                        <tr key={i} className="border-b border-gray-800">
                            <td className="py-2 font-mono text-gray-300">{ip.ip}</td>
                            <td className="py-2 text-right text-red-400">{ip.count}</td>
                            <td className="py-2 pl-4 text-gray-400">{ip.reason}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SimpleLineChart({ data }: { data: DashboardStats['hourlyData'] }) {
    const maxValue = Math.max(...data.map(d => d.good + d.warn + d.bad));

    return (
        <div className="flex items-end gap-1 h-32">
            {data.map((d, i) => {
                const total = d.good + d.warn + d.bad;
                const height = (total / maxValue) * 100;

                return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                        <div
                            className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t"
                            style={{ height: `${height}%` }}
                            title={`${d.hour}: ${total} total`}
                        />
                        <span className="text-xs text-gray-500 mt-1">{d.hour}</span>
                    </div>
                );
            })}
        </div>
    );
}

function IpListManager() {
    const [ip, setIp] = useState('');
    const [listType, setListType] = useState<'whitelist' | 'blacklist'>('blacklist');

    const handleAdd = () => {
        if (!ip.trim()) return;
        // TODO: Call API to add IP
        console.log(`Adding ${ip} to ${listType}`);
        setIp('');
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <input
                    type="text"
                    value={ip}
                    onChange={(e) => setIp(e.target.value)}
                    placeholder="Enter IP address"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 text-sm"
                />
                <select
                    value={listType}
                    onChange={(e) => setListType(e.target.value as 'whitelist' | 'blacklist')}
                    className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                >
                    <option value="blacklist">Blacklist</option>
                    <option value="whitelist">Whitelist</option>
                </select>
                <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium"
                >
                    Add
                </button>
            </div>
        </div>
    );
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

export default function FraudDashboard() {
    const [stats, setStats] = useState<DashboardStats>(MOCK_STATS);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [dataSource, setDataSource] = useState<'loading' | 'database' | 'mock'>('loading');

    // Fetch stats from API
    const fetchStats = async () => {
        try {
            const response = await fetch('/api/stats');
            const data = await response.json();

            if (data.success && data.stats) {
                setStats(data.stats);
                setDataSource(data.source || 'database');
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error);
            setDataSource('mock');
        }
        setLastUpdated(new Date());
    };

    useEffect(() => {
        // Initial fetch
        fetchStats();

        // Poll every 10 seconds
        const interval = setInterval(fetchStats, 10000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold">Fraud Detection Dashboard</h1>
                    <p className="text-gray-400 text-sm">
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                        Avg. Processing Time:
                        <span className="text-green-400 ml-1">{stats.avgProcessingTime}ms</span>
                    </span>
                    <div className="px-3 py-1 bg-green-600 rounded-full text-sm">
                        System Online
                    </div>
                </div>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                    label="Total Checks (Today)"
                    value={stats.today.total}
                    color="text-white"
                />
                <StatCard
                    label="Good"
                    value={stats.today.good}
                    percentage={stats.today.goodRate}
                    color="text-green-400"
                />
                <StatCard
                    label="Warning"
                    value={stats.today.warn}
                    percentage={stats.today.warnRate}
                    color="text-yellow-400"
                />
                <StatCard
                    label="Bad (Blocked)"
                    value={stats.today.bad}
                    percentage={stats.today.badRate}
                    color="text-red-400"
                />
            </div>

            {/* Progress Bar */}
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-400">Classification Distribution</span>
                    <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-green-500 rounded" /> Good
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-yellow-500 rounded" /> Warn
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-3 h-3 bg-red-500 rounded" /> Bad
                        </span>
                    </div>
                </div>
                <ProgressBar
                    good={stats.today.good}
                    warn={stats.today.warn}
                    bad={stats.today.bad}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Hourly Traffic */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h2 className="text-lg font-semibold mb-4">Hourly Traffic</h2>
                    <SimpleLineChart data={stats.hourlyData} />
                </div>

                {/* Device Breakdown */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h2 className="text-lg font-semibold mb-4">Device Breakdown</h2>
                    <DeviceBreakdownChart data={stats.deviceBreakdown} />
                </div>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Bad IPs */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h2 className="text-lg font-semibold mb-4">Top Blocked IPs (Today)</h2>
                    <TopBadIpsTable ips={stats.topBadIps} />
                </div>

                {/* IP Management */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h2 className="text-lg font-semibold mb-4">IP Whitelist / Blacklist</h2>
                    <IpListManager />
                    <div className="mt-4 text-sm text-gray-500">
                        <p>• Whitelisted IPs always return GOOD</p>
                        <p>• Blacklisted IPs always return BAD</p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 text-center text-gray-500 text-sm">
                Fraud Detection System v1.0 |
            </div>
        </div>
    );
}
