import React, { useState, useEffect, useMemo } from 'react';
import Button from '../components/common/Button';
import { getUserTrades } from '../services/api';

interface Trade {
    id: number;
    symbol: string;
    direction: 'long' | 'short';
    size: number;
    entryprice: number;
    exitprice?: number;
    createdat: string;
    entry_time?: string;
    exit_time?: string;
    stop_loss?: number;
    take_profit?: number;
}

interface DayStats {
    pnl: number;
    count: number;
    wins: number;
    winRate: number;
    avgRR: number;
    avgWinDuration: number;
    avgLossDuration: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

const getDurationMinutes = (trade: Trade): number | null => {
    const entry = trade.entry_time || trade.createdat;
    const exit = trade.exit_time;
    if (!entry || !exit) return null;
    const diff = new Date(exit).getTime() - new Date(entry).getTime();
    if (isNaN(diff) || diff < 0) return null;
    return diff / 60000;
};

const calculateTradePnL = (trade: Trade): number => {
    if (!trade.exitprice || !trade.entryprice || trade.size <= 0) return 0;
    const diff = trade.direction === 'long'
        ? trade.exitprice - trade.entryprice
        : trade.entryprice - trade.exitprice;
    return diff * trade.size;
};

const calculateRR = (trade: Trade): number | null => {
    if (!trade.exitprice || !trade.stop_loss || !trade.entryprice) return null;
    const riskPerUnit = Math.abs(trade.entryprice - trade.stop_loss);
    if (riskPerUnit === 0) return null;
    const pnl = calculateTradePnL(trade);
    return pnl / (riskPerUnit * trade.size);
};

const computeStats = (trades: Trade[]): DayStats => {
    const completed = trades.filter(t => t.exitprice);
    const pnl = completed.reduce((sum, t) => sum + calculateTradePnL(t), 0);
    const wins = completed.filter(t => calculateTradePnL(t) > 0).length;
    const winRate = completed.length > 0 ? (wins / completed.length) * 100 : 0;

    const rrValues = completed.map(t => calculateRR(t)).filter((v): v is number => v !== null);
    const avgRR = rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0;

    const winDurations = completed.filter(t => calculateTradePnL(t) > 0).map(t => getDurationMinutes(t)).filter((v): v is number => v !== null);
    const lossDurations = completed.filter(t => calculateTradePnL(t) <= 0).map(t => getDurationMinutes(t)).filter((v): v is number => v !== null);

    return {
        pnl,
        count: trades.length,
        wins,
        winRate,
        avgRR,
        avgWinDuration: winDurations.length > 0 ? winDurations.reduce((a, b) => a + b, 0) / winDurations.length : 0,
        avgLossDuration: lossDurations.length > 0 ? lossDurations.reduce((a, b) => a + b, 0) / lossDurations.length : 0,
    };
};

const formatDurationShort = (minutes: number): string => {
    if (minutes === 0) return '-';
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = Math.floor(minutes % 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0 && days === 0) parts.push(`${mins}m`);
    return parts.join(' ') || '-';
};

const StatsPage: React.FC = () => {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setError('Please log in to view statistics.');
            setLoading(false);
            return;
        }
        getUserTrades(token)
            .then((data) => {
                setTrades(data || []);
                setLoading(false);
            })
            .catch((err) => {
                setError(err.message || 'Failed to load trades.');
                setLoading(false);
            });
    }, []);

    const tradesByDay = useMemo(() => {
        const map: Record<string, Trade[]> = {};
        trades.forEach((trade) => {
            const dateStr = (trade.entry_time || trade.createdat || '').substring(0, 10);
            if (!dateStr) return;
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push(trade);
        });
        return map;
    }, [trades]);

    const calendarDays = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (string | null)[] = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            cells.push(dateStr);
        }
        return cells;
    }, [currentDate]);

    const summaryStats = useMemo(() => {
        const now = new Date();
        const filterByPeriod = (start: Date) => {
            return trades.filter((t) => {
                const entry = new Date(t.entry_time || t.createdat);
                return entry >= start && entry <= now;
            });
        };

        const weekStart = new Date(now);
        const weekDay = now.getDay();
        weekStart.setDate(now.getDate() - weekDay + (weekDay === 0 ? -6 : 1));
        weekStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const yearStart = new Date(now.getFullYear(), 0, 1);

        return {
            week: computeStats(filterByPeriod(weekStart)),
            month: computeStats(filterByPeriod(monthStart)),
            year: computeStats(filterByPeriod(yearStart)),
            all: computeStats(trades),
        };
    }, [trades]);

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };
    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };
    const goToday = () => setCurrentDate(new Date());

    if (loading) return (
        <div className="fixed inset-0 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading statistics...</p>
        </div>
    );
    if (error) return <div className="container mx-auto p-4 text-red-500">{error}</div>;

    const StatCard = ({ title, stats }: { title: string; stats: DayStats }) => (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 pb-2 border-b dark:border-gray-700">{title}</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500 dark:text-gray-400">P/L: </span><span className={`font-semibold ${stats.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(2)}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Trades: </span><span className="font-semibold text-gray-900 dark:text-white">{stats.count}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Win Rate: </span><span className="font-semibold text-gray-900 dark:text-white">{stats.winRate.toFixed(1)}%</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Avg R/R: </span><span className="font-semibold text-gray-900 dark:text-white">1:{stats.avgRR.toFixed(1)}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Win Time: </span><span className="font-semibold text-gray-900 dark:text-white">{formatDurationShort(stats.avgWinDuration)}</span></div>
                <div><span className="text-gray-500 dark:text-gray-400">Loss Time: </span><span className="font-semibold text-gray-900 dark:text-white">{formatDurationShort(stats.avgLossDuration)}</span></div>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trade Statistics</h1>
                <Button variant="gradient" onClick={() => window.history.back()}>Back</Button>
            </div>

            {/* Calendar */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 mb-6">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="primary" onClick={prevMonth} className="px-3 py-1 text-sm">‹</Button>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
                    <div className="flex gap-2">
                        <Button variant="primary" onClick={goToday} className="px-3 py-1 text-sm">Today</Button>
                        <Button variant="primary" onClick={nextMonth} className="px-3 py-1 text-sm">›</Button>
                    </div>
                </div>

                <div className="grid grid-cols-7 gap-1 mb-1">
                    {WEEKDAYS.map((day) => (
                        <div key={day} className="text-center text-xs font-semibold text-gray-500 dark:text-gray-400 py-2">{day}</div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((dateStr, idx) => {
                        if (!dateStr) return <div key={idx} className="min-h-[110px]" />;
                        const dayTrades = tradesByDay[dateStr] || [];
                        const stats = computeStats(dayTrades);
                        const dayNum = parseInt(dateStr.split('-')[2], 10);
                        const hasData = dayTrades.length > 0;
                        const todayStr = new Date().toISOString().substring(0, 10);
                        const isTodayCell = dateStr === todayStr;

                        return (
                            <div key={idx} className={`min-h-[110px] p-2 rounded-md border text-xs ${hasData ? (stats.pnl >= 0 ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800') : 'border-gray-200 dark:border-gray-700'} ${isTodayCell ? 'ring-2 ring-purple-500' : ''}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className={`font-bold ${isTodayCell ? 'text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'}`}>{dayNum}</span>
                                    {hasData && <span className="text-gray-400">{stats.count}T</span>}
                                </div>
                                {hasData && (
                                    <div className="space-y-0.5">
                                        <div className={`font-semibold ${stats.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{stats.pnl >= 0 ? '+' : ''}{stats.pnl.toFixed(2)}</div>
                                        <div className="text-gray-500 dark:text-gray-400">Win: {stats.winRate.toFixed(0)}%</div>
                                        <div className="text-gray-500 dark:text-gray-400">R/R: 1:{stats.avgRR.toFixed(1)}</div>
                                        <div className="text-gray-500 dark:text-gray-400">W:{formatDurationShort(stats.avgWinDuration)} L:{formatDurationShort(stats.avgLossDuration)}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="This Week" stats={summaryStats.week} />
                <StatCard title="This Month" stats={summaryStats.month} />
                <StatCard title="This Year" stats={summaryStats.year} />
                <StatCard title="All Time" stats={summaryStats.all} />
            </div>
        </div>
    );
};

export default StatsPage;