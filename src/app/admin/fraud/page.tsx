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
    countryStats?: Array<{
        country: string;
        total: number;
        bad: number;
    }>;
    avgProcessingTime: number;
}

// =============================================================================
// MOCK DATA (Replace with real API calls)
// =============================================================================

const EMPTY_STATS: DashboardStats = {
    today: {
        total: 0,
        good: 0,
        warn: 0,
        bad: 0,
        goodRate: 0,
        warnRate: 0,
        badRate: 0,
    },
    deviceBreakdown: {
        mobile: 0,
        desktop: 0,
        tablet: 0,
        bot: 0,
    },
    topBadIps: [],

    hourlyData: [],
    countryStats: [],
    avgProcessingTime: 0,
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



function TopCountriesTable({ data }: { data: DashboardStats['countryStats'] }) {
    if (!data || data.length === 0) return <div className="text-gray-500 text-sm">No country data yet</div>;

    return (
        <div className="overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase text-gray-400 bg-gray-700/50">
                    <tr>
                        <th className="py-2 px-3">Country</th>
                        <th className="py-2 px-3 text-right">Traffic</th>
                        <th className="py-2 px-3 text-right">Bad</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {data.map((item, i) => (
                        <tr key={i} className="hover:bg-gray-700/30">
                            <td className="py-2 px-3 font-medium">{item.country}</td>
                            <td className="py-2 px-3 text-right">{item.total.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right text-red-400">{item.bad > 0 ? item.bad : '-'}</td>
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

    const handleAdd = async () => {
        if (!ip.trim()) return;

        try {
            const res = await fetch('/api/ip-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: ip.trim(), listType, action: 'add' }),
            });

            if (res.ok) {
                alert(`Successfully added ${ip} to ${listType}`);
                setIp('');
            } else {
                alert('Failed to add IP');
            }
        } catch (error) {
            console.error('Error adding IP:', error);
            alert('Error adding IP');
        }
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

interface FraudCheckLog {
    requestId: string;
    ip: string;
    classification: 'GOOD' | 'BAD' | 'WARN';
    reason: string;
    countryCode?: string;
    deviceType: string;
    createdAt: string;
    org?: string;
}

interface FilterState {
    status: string;
    days: number;
    country: string;
    ip: string;
}

function LogFilterBar({ filters, onChange, onRefresh, onExport }: {
    filters: FilterState;
    onChange: (f: FilterState) => void;
    onRefresh: () => void;
    onExport: () => void;
}) {
    return (
        <div className="flex flex-wrap gap-4 mb-4 bg-gray-800 p-4 rounded-lg border border-gray-700 items-end">
            <div>
                <label className="block text-xs text-gray-400 mb-1">Status</label>
                <select
                    className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 w-32"
                    value={filters.status}
                    onChange={(e) => onChange({ ...filters, status: e.target.value })}
                >
                    <option value="ALL">All Status</option>
                    <option value="GOOD">Good</option>
                    <option value="BAD">Bad</option>
                    <option value="WARN">Warning</option>
                </select>
            </div>

            <div>
                <label className="block text-xs text-gray-400 mb-1">Time Range</label>
                <select
                    className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 w-32"
                    value={filters.days}
                    onChange={(e) => onChange({ ...filters, days: parseInt(e.target.value) })}
                >
                    <option value={1}>Last 24 Hours</option>
                    <option value={7}>Last 7 Days</option>
                    <option value={30}>Last 30 Days</option>
                </select>
            </div>

            <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-gray-400 mb-1">Search (IP or Country)</label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search IP..."
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 flex-1"
                        value={filters.ip}
                        onChange={(e) => onChange({ ...filters, ip: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Country (e.g. US)"
                        className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-2 w-24"
                        value={filters.country}
                        onChange={(e) => onChange({ ...filters, country: e.target.value })}
                    />
                </div>
            </div>

            <button
                onClick={onRefresh}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded h-[38px]"
            >
                Refresh
            </button>
            <button
                onClick={onExport}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded h-[38px]"
            >
                Export CSV
            </button>
        </div>
    );
}

function LogsTable({ logs }: { logs: FraudCheckLog[] }) {
    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold">Traffic Activity Log</h2>
            </div>
            <div className="overflow-x-auto max-h-[500px]">
                <table className="w-full text-sm text-left relative">
                    <thead className="text-xs uppercase bg-gray-700 text-gray-400 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3">Time</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">IP Address</th>
                            <th className="px-4 py-3">Location</th>
                            <th className="px-4 py-3">Network (Org)</th>
                            <th className="px-4 py-3">Device</th>
                            <th className="px-4 py-3">Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((log) => (
                            <tr key={log.requestId} className="border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="px-4 py-2 font-mono text-gray-400 whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleTimeString()}
                                </td>
                                <td className="px-4 py-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.classification === 'GOOD' ? 'bg-green-900 text-green-300' :
                                        log.classification === 'BAD' ? 'bg-red-900 text-red-300' :
                                            'bg-yellow-900 text-yellow-300'
                                        }`}>
                                        {log.classification}
                                    </span>
                                </td>
                                <td className="px-4 py-2 font-mono">{log.ip}</td>
                                <td className="px-4 py-2">{log.countryCode || '-'}</td>
                                <td className="px-4 py-2 max-w-[150px] truncate" title={log.org}>{log.org || '-'}</td>
                                <td className="px-4 py-2 capitalize">{log.deviceType}</td>
                                <td className="px-4 py-2 max-w-[200px] truncate" title={log.reason}>
                                    {log.reason}
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                    No traffic logs found yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

export default function FraudDashboard() {
    const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
    const [logs, setLogs] = useState<FraudCheckLog[]>([]);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [dataSource, setDataSource] = useState<'loading' | 'database' | 'mock'>('loading');

    // Filter State
    const [filters, setFilters] = useState<FilterState>({
        status: 'ALL',
        days: 1,
        country: '',
        ip: ''
    });

    const fetchData = async () => {
        try {
            // Build query params for logs
            const params = new URLSearchParams();
            if (filters.status !== 'ALL') params.append('status', filters.status);
            if (filters.days) params.append('days', filters.days.toString());
            if (filters.country) params.append('country', filters.country);
            if (filters.ip) params.append('ip', filters.ip);

            const [statsRes, logsRes] = await Promise.all([
                fetch('/api/stats'),
                fetch(`/api/logs?${params.toString()}`)
            ]);

            if (statsRes.ok) {
                const data = await statsRes.json();
                setStats(data.stats);
                setDataSource(data.source || 'database');
            } else {
                console.error('Failed to fetch stats:', statsRes.statusText);
            }

            if (logsRes.ok) {
                const logsData = await logsRes.json();
                setLogs(logsData);
            } else {
                console.error('Failed to fetch logs:', logsRes.statusText);
            }

            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to fetch data', error);
            // Don't fall back to mock data implicitly if fetch fails, keep loading or empty
        }
    };

    const handleExport = () => {
        if (!logs.length) return;

        const headers = ['Time', 'Status', 'IP', 'Location', 'Network', 'Device', 'Reason'].join(',');
        const rows = logs.map(log => [
            new Date(log.createdAt).toISOString(),
            log.classification,
            log.ip,
            log.countryCode || '',
            log.org || '',
            log.deviceType,
            `"${log.reason.replace(/"/g, '""')}"`
        ].join(','));

        const csv = [headers, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fraud-logs-${new Date().toISOString()}.csv`;
        a.click();
    };

    useEffect(() => {
        // Initial fetch
        fetchData();

        // Poll every 10 seconds
        const interval = setInterval(fetchData, 10000);

        return () => clearInterval(interval);
    }, [filters]); // Re-fetch when filters change (optional, or just use Refresh button)

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-8">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                        Fraud Detection Dashboard
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                        Avg. Processing Time: <span className="text-green-400">{stats.avgProcessingTime.toFixed(2)}ms</span>
                    </span>
                    <div className="flex items-center gap-2 px-3 py-1 bg-green-900/30 border border-green-800 rounded-full">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs font-medium text-green-400">System Online</span>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-sm text-gray-400 mb-1">Total Checks (Today)</h3>
                    <p className="text-3xl font-bold text-white">{stats.today.total.toLocaleString()}</p>
                </div>
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

            {/* Traffic Logs */}
            <LogFilterBar
                filters={filters}
                onChange={setFilters}
                onRefresh={fetchData}
                onExport={handleExport}
            />
            <LogsTable logs={logs} />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Hourly Traffic */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h2 className="text-lg font-semibold mb-4">Hourly Traffic</h2>
                    <SimpleLineChart data={stats.hourlyData} />
                </div>

                {/* Country Distribution */}
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h2 className="text-lg font-semibold mb-4">Top Countries</h2>
                    <TopCountriesTable data={stats.countryStats} />
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
