import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import SEO from '../components/common/SEO';
import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart2,
  Calendar,
  Award,
  Activity,
  Zap,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  PieChart,
  Clock,
  Compass,
  Layers,
  Smile,
  AlertTriangle,
  Sliders,
  DollarSign,
  CheckCircle2,
  HelpCircle,
  Plus
} from 'lucide-react';
import { getUserTrades } from '../services/api';
import { useRealtimeTrades } from '../services/realtime';
import { Trade } from '../components/calendar/calendarTypes';
import {
  calculateTradePnL,
  calculateTradeRR,
  getTradeEntryPrice,
  getTradeExitPrice,
  getTradeSize,
  getTradeDirection,
  getTradeEntryTime,
  getTradeTradingDate,
  getTradeExitTime,
  formatCurrency,
  formatDurationShort,
  formatDateTime
} from '../components/calendar/calendarUtils';

type TimeRange = 'today' | 'week' | 'month' | 'year' | 'all';
type ChartTab = 'equity' | 'daily_pnl' | 'session';

export default function DashboardPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [chartTab, setChartTab] = useState<ChartTab>('equity');
  const [equityMode, setEquityMode] = useState<'pnl' | 'balance'>('pnl');
  const [symbolRankingTab, setSymbolRankingTab] = useState<'profit' | 'loss'>('profit');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverDailyBar, setHoverDailyBar] = useState<{
    date: string;
    pnl: number;
    profit: number;
    loss: number;
    count: number;
    wins: number;
    losses: number;
    x: number;
    y: number;
  } | null>(null);
  const [dailyBarLayout, setDailyBarLayout] = useState<'zero_centered' | 'side_by_side'>('zero_centered');
  const dailyBarContainerRef = useRef<HTMLDivElement>(null);
  const equityContainerRef = useRef<HTMLDivElement>(null);
  const [chartDimensions, setChartDimensions] = useState<{ width: number; height: number }>({ width: 860, height: 260 });
  const navigate = useNavigate();

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      const data = await getUserTrades(token);
      setTrades(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err: any) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.message || '获取交易仪表盘数据失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [navigate]);

  // 监听服务端实时订单推送，有新平仓订单时秒级自动推送到仪表盘刷新数据
  useRealtimeTrades(() => {
    fetchDashboardData();
  });

  useEffect(() => {
    if (!equityContainerRef.current) return;
    const updateDims = () => {
      if (equityContainerRef.current) {
        const w = equityContainerRef.current.clientWidth;
        const h = equityContainerRef.current.clientHeight;
        if (w > 0) {
          setChartDimensions({ width: w, height: h > 0 ? h : 260 });
        }
      }
    };
    updateDims();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => {
        updateDims();
      });
      observer.observe(equityContainerRef.current);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', updateDims);
      return () => window.removeEventListener('resize', updateDims);
    }
  }, [chartTab]);

  // Filter trades based on selected time range
  const filteredTrades = useMemo(() => {
    if (timeRange === 'all') return trades;
    const now = new Date();

    return trades.filter((trade) => {
      const rawDate = getTradeEntryTime(trade);
      if (!rawDate) return false;
      const tradeDate = new Date(rawDate.replace(' ', 'T').slice(0, 16));
      if (isNaN(tradeDate.getTime())) return false;

      if (timeRange === 'today') {
        const pad = (n: number) => String(n).padStart(2, '0');
        const localNowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const currentTradingDay = getTradeTradingDate({ entry_time: localNowStr } as any);
        return getTradeTradingDate(trade) === currentTradingDay;
      }

      if (timeRange === 'week') {
        const startOfWeek = new Date(now);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);
        return tradeDate >= startOfWeek;
      }

      if (timeRange === 'month') {
        return (
          tradeDate.getFullYear() === now.getFullYear() &&
          tradeDate.getMonth() === now.getMonth()
        );
      }

      if (timeRange === 'year') {
        return tradeDate.getFullYear() === now.getFullYear();
      }

      return true;
    });
  }, [trades, timeRange]);

  // Performance Metrics calculations (TradeZella standard)
  const metrics = useMemo(() => {
    const completedTrades = filteredTrades.filter(
      (t) => (getTradeExitPrice(t) > 0 && getTradeEntryPrice(t) > 0) || (t.manual_pnl != null || (t as any).manualPnl != null)
    );

    let totalProfitLoss = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;
    let totalVolume = 0;
    let bestTrade = 0;
    let worstTrade = 0;

    // Sort chronologically for equity curve & drawdown
    const sortedCompleted = [...completedTrades].sort((a, b) => {
      const timeA = new Date(getTradeEntryTime(a) || 0).getTime();
      const timeB = new Date(getTradeEntryTime(b) || 0).getTime();
      return timeA - timeB;
    });

    let peak = 0;
    let runningPnL = 0;
    let maxDrawdown = 0;

    sortedCompleted.forEach((trade) => {
      const pnl = calculateTradePnL(trade);
      totalProfitLoss += pnl;
      runningPnL += pnl;

      if (runningPnL > peak) peak = runningPnL;
      const dd = peak - runningPnL;
      if (dd > maxDrawdown) maxDrawdown = dd;

      if (pnl > 0.001) {
        winningTrades++;
        grossProfit += pnl;
        if (pnl > bestTrade) bestTrade = pnl;
      } else if (pnl < -0.001) {
        losingTrades++;
        grossLoss += Math.abs(pnl);
        if (pnl < worstTrade) worstTrade = pnl;
      } else {
        breakevenTrades++;
      }
    });

    filteredTrades.forEach((t) => {
      totalVolume += getTradeSize(t);
    });

    const closedCount = winningTrades + losingTrades;
    const winRate = closedCount > 0 ? (winningTrades / closedCount) * 100 : 0;
    const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.9 : 0);
    const winLossRatio = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? avgWin : 0);
    const expectancy = closedCount > 0 ? totalProfitLoss / closedCount : 0;

    // Unique trading days (TradeZella / TraderSync Session Standard)
    const daysMap = new Set<string>();
    filteredTrades.forEach((t) => {
      const d = getTradeTradingDate(t);
      if (d && d.length >= 10) daysMap.add(d);
    });
    const tradingDaysCount = daysMap.size;
    const avgDailyPnL = tradingDaysCount > 0 ? totalProfitLoss / tradingDaysCount : 0;

    return {
      totalTrades: filteredTrades.length,
      completedTrades: completedTrades.length,
      totalProfitLoss,
      grossProfit,
      grossLoss,
      winRate,
      winningTrades,
      losingTrades,
      breakevenTrades,
      profitFactor,
      avgWin,
      avgLoss,
      winLossRatio,
      expectancy,
      maxDrawdown,
      bestTrade,
      worstTrade,
      totalVolume,
      tradingDaysCount,
      avgDailyPnL,
      sortedCompleted
    };
  }, [filteredTrades]);

  // Equity Curve trajectory points
  const equityPoints = useMemo(() => {
    const initialBalance = 10000;
    let running = equityMode === 'balance' ? initialBalance : 0;
    const points: { date: string; value: number; pnl: number; peak: number }[] = [];

    let currentPeak = running;
    points.push({ date: '起点', value: running, pnl: 0, peak: currentPeak });

    metrics.sortedCompleted.forEach((trade, idx) => {
      const pnl = calculateTradePnL(trade);
      running += pnl;
      if (running > currentPeak) currentPeak = running;
      const rawDate = getTradeEntryTime(trade);
      const dateStr = rawDate ? rawDate.substring(5, 10) : `#${idx + 1}`;
      points.push({
        date: dateStr,
        value: Math.round(running * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        peak: Math.round(currentPeak * 100) / 100
      });
    });

    if (points.length === 1) {
      // Empty trajectory fallback
      return [
        { date: '01', value: running, pnl: 0, peak: running },
        { date: '02', value: running, pnl: 0, peak: running }
      ];
    }
    return points;
  }, [metrics.sortedCompleted, equityMode]);

  // Daily P&L bars data (TradeZella Iconic Daily Distribution & Two-Bar Breakdown)
  const dailyPnLData = useMemo(() => {
    const map: Record<string, {
      date: string;
      pnl: number;
      profit: number;
      loss: number;
      count: number;
      wins: number;
      losses: number;
    }> = {};

    metrics.sortedCompleted.forEach((trade) => {
      const dateStr = getTradeTradingDate(trade) || '未知';
      if (!map[dateStr]) {
        map[dateStr] = {
          date: dateStr,
          pnl: 0,
          profit: 0,
          loss: 0,
          count: 0,
          wins: 0,
          losses: 0,
        };
      }
      const pnl = calculateTradePnL(trade);
      map[dateStr].pnl += pnl;
      map[dateStr].count++;
      if (pnl > 0.001) {
        map[dateStr].profit += pnl;
        map[dateStr].wins++;
      } else if (pnl < -0.001) {
        map[dateStr].loss += Math.abs(pnl);
        map[dateStr].losses++;
      }
    });

    const list = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
    const greenDays = list.filter((d) => d.pnl > 0.001).length;
    const redDays = list.filter((d) => d.pnl < -0.001).length;
    const totalGrossProfit = list.reduce((acc, d) => acc + d.profit, 0);
    const totalGrossLoss = list.reduce((acc, d) => acc + d.loss, 0);
    const totalWins = list.reduce((acc, d) => acc + d.wins, 0);
    const totalLosses = list.reduce((acc, d) => acc + d.losses, 0);

    return { list, greenDays, redDays, totalGrossProfit, totalGrossLoss, totalWins, totalLosses };
  }, [metrics.sortedCompleted]);

  // Session Analytics breakdown (TradeSync Signature)
  const sessionData = useMemo(() => {
    const sessions = {
      Asia: { name: '亚盘 (Asia)', icon: '🌅', pnl: 0, count: 0, wins: 0, volume: 0 },
      London: { name: '欧盘 (London)', icon: '🏛️', pnl: 0, count: 0, wins: 0, volume: 0 },
      NewYork: { name: '美盘 (New York)', icon: '🏙️', pnl: 0, count: 0, wins: 0, volume: 0 }
    };

    filteredTrades.forEach((trade) => {
      let sessionKey: 'Asia' | 'London' | 'NewYork' = 'London';
      const explicitSession = (trade as any).session;
      if (explicitSession === 'Asia') sessionKey = 'Asia';
      else if (explicitSession === 'Europe') sessionKey = 'London';
      else if (explicitSession === 'US') sessionKey = 'NewYork';
      else {
        // Derive from entry hour
        const rawDate = getTradeEntryTime(trade);
        if (rawDate) {
          const hour = parseInt(rawDate.replace(' ', 'T').substring(11, 13), 10);
          if (!isNaN(hour)) {
            if (hour >= 8 && hour < 15) sessionKey = 'Asia';
            else if (hour >= 15 && hour < 21) sessionKey = 'London';
            else sessionKey = 'NewYork';
          }
        }
      }

      const pnl = calculateTradePnL(trade);
      sessions[sessionKey].pnl += pnl;
      sessions[sessionKey].count++;
      sessions[sessionKey].volume += getTradeSize(trade);
      if (pnl > 0.001) sessions[sessionKey].wins++;
    });

    return Object.entries(sessions).map(([key, data]) => {
      const winRate = data.count > 0 ? (data.wins / data.count) * 100 : 0;
      return { key, ...data, winRate };
    });
  }, [filteredTrades]);

  // Long vs Short breakdown (TradeSync / TradeZella)
  const directionStats = useMemo(() => {
    const longTrades = filteredTrades.filter((t) => getTradeDirection(t) === 'long');
    const shortTrades = filteredTrades.filter((t) => getTradeDirection(t) === 'short');

    const calcDir = (list: Trade[]) => {
      const completed = list.filter((t) => getTradeExitPrice(t) > 0);
      let pnl = 0;
      let wins = 0;
      let grossWin = 0;
      let grossLoss = 0;
      completed.forEach((t) => {
        const p = calculateTradePnL(t);
        pnl += p;
        if (p > 0.001) {
          wins++;
          grossWin += p;
        } else if (p < -0.001) {
          grossLoss += Math.abs(p);
        }
      });
      const winRate = completed.length > 0 ? (wins / completed.length) * 100 : 0;
      const pf = grossLoss > 0 ? grossWin / grossLoss : (grossWin > 0 ? 99.9 : 0);
      return { total: list.length, completed: completed.length, wins, pnl, winRate, pf };
    };

    return {
      long: calcDir(longTrades),
      short: calcDir(shortTrades)
    };
  }, [filteredTrades]);

  // Top Profit & Loss Symbols Ranking
  const { profitSymbols, lossSymbols, bestSymbol, worstSymbol } = useMemo(() => {
    const map: Record<string, { symbol: string; count: number; volume: number; pnl: number; wins: number }> = {};
    filteredTrades.forEach((t) => {
      const sym = t.symbol || 'OTHER';
      if (!map[sym]) {
        map[sym] = { symbol: sym, count: 0, volume: 0, pnl: 0, wins: 0 };
      }
      map[sym].count++;
      map[sym].volume += getTradeSize(t);
      const p = calculateTradePnL(t);
      map[sym].pnl += p;
      if (p > 0.001) map[sym].wins++;
    });

    const all = Object.values(map).map((item) => ({
      ...item,
      pnl: Math.round(item.pnl * 100) / 100,
      winRate: item.count > 0 ? (item.wins / item.count) * 100 : 0
    }));

    const profitList = all
      .filter((item) => item.pnl > 0.001)
      .sort((a, b) => b.pnl - a.pnl);

    const lossList = all
      .filter((item) => item.pnl < -0.001)
      .sort((a, b) => a.pnl - b.pnl);

    return {
      profitSymbols: profitList.slice(0, 5),
      lossSymbols: lossList.slice(0, 5),
      bestSymbol: profitList[0] || null,
      worstSymbol: lossList[0] || null
    };
  }, [filteredTrades]);

  // Trading Psychology & Mindset breakdown
  const psychologyStats = useMemo(() => {
    let totalRating = 0;
    let ratedCount = 0;
    let slAdherenceCount = 0;
    const sentiments: Record<string, number> = { Zen: 0, Composed: 0, Neutral: 0, Uneasy: 0, Nervous: 0 };

    filteredTrades.forEach((t) => {
      if (t.rating && t.rating > 0) {
        totalRating += t.rating;
        ratedCount++;
      }
      if (t.stop_loss || (t as any).stopLoss) {
        slAdherenceCount++;
      }
      const sent = t.sentiment || 'Neutral';
      if (sentiments[sent] !== undefined) {
        sentiments[sent]++;
      }
    });

    const avgRating = ratedCount > 0 ? totalRating / ratedCount : 4.8;
    const slRate = filteredTrades.length > 0 ? (slAdherenceCount / filteredTrades.length) * 100 : 92.5;

    return {
      avgRating,
      slRate,
      sentiments
    };
  }, [filteredTrades]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 dark:bg-[#070a13] flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-10 h-10 border-2 border-purple-600/20 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-mono font-semibold tracking-wider text-gray-500 uppercase">
            TradeZen 终端数据加载中...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#070a13] flex items-center justify-center p-4">
        <div className="text-center p-6 bg-white dark:bg-[#111827] rounded-2xl border border-rose-200 dark:border-rose-900/60 max-w-md shadow-xl">
          <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">数据获取异常</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => fetchDashboardData()}
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:shadow-md transition"
          >
            重新尝试连接
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="仪表盘 Dashboard"
        description="TradeZen 个人交易绩效仪表盘，包含关键绩效指标、收益分析、知行合一纪律评估、胜率与盈亏比透视。"
        keywords="TradeZen, 交易仪表盘, 绩效分析, 盈亏统计, 胜率, 盈亏比"
        url="https://tradezen.app/dashboard"
      />

      <div className="min-h-screen bg-gray-50/60 dark:bg-[#070a13] pb-16 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          
          {/* 1. Sleek TradeZella-Style Navigation & Filter Toolbar (Timeframe Selector & Actions) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-gray-200/70 dark:border-white/5">
            {/* Left: Time Range Filter Pills */}
            <div className="flex items-center overflow-x-auto no-scrollbar">
              <div className="h-[38px] inline-flex items-center bg-gray-100/80 dark:bg-[#070a13] rounded-xl p-1 border border-gray-200/80 dark:border-white/10 shadow-xs">
                {[
                  { key: 'today', label: '今日' },
                  { key: 'week', label: '本周' },
                  { key: 'month', label: '本月' },
                  { key: 'year', label: '今年' },
                  { key: 'all', label: '全部' }
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTimeRange(item.key as TimeRange)}
                    className={`h-full text-sm px-3.5 rounded-lg font-medium transition-all whitespace-nowrap flex items-center justify-center ${
                      timeRange === item.key
                        ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white font-semibold shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2.5">
              <Link
                to="/calendar"
                className="h-[38px] px-4 rounded-xl bg-white dark:bg-[#070a13] text-gray-700 dark:text-gray-200 border border-gray-200/80 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/40 text-sm font-medium transition shadow-xs flex items-center space-x-1.5 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <Calendar className="w-3.5 h-3.5 text-purple-500" />
                <span>日历看板</span>
              </Link>

              <button
                type="button"
                onClick={fetchDashboardData}
                title="刷新数据"
                disabled={loading}
                className="h-[38px] w-[38px] flex items-center justify-center rounded-xl bg-white dark:bg-[#070a13] text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white border border-gray-200/80 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-500/40 shadow-xs transition hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : ''}`} />
              </button>

              <Link
                to="/trades"
                className="h-[38px] px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium shadow-xs transition active:scale-95 flex items-center space-x-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>记录交易</span>
              </Link>
            </div>
          </div>

          {/* 2. TradeZella Signature Primary Metric Ribbon (4 Key Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            
            {/* Card 1: Net P&L */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-gray-200/80 dark:border-white/10 shadow-xs relative overflow-hidden group hover:border-purple-400/50 transition-all duration-300">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                <span>净利润 (Net P&L)</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  metrics.totalProfitLoss >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
                }`}>
                  {metrics.totalProfitLoss >= 0 ? '+PROFIT' : '-LOSS'}
                </span>
              </div>
              <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight mb-2 ${
                metrics.totalProfitLoss >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                {formatCurrency(metrics.totalProfitLoss)}
              </div>
              {/* Mini Profit/Loss Progress Bar */}
              <div className="w-full bg-gray-100 dark:bg-navy-900 h-1.5 rounded-full overflow-hidden flex mb-2.5">
                <div
                  style={{
                    width: `${metrics.grossProfit + metrics.grossLoss > 0 ? (metrics.grossProfit / (metrics.grossProfit + metrics.grossLoss)) * 100 : 50}%`
                  }}
                  className="bg-emerald-500 transition-all duration-300"
                />
                <div
                  style={{
                    width: `${metrics.grossProfit + metrics.grossLoss > 0 ? (metrics.grossLoss / (metrics.grossProfit + metrics.grossLoss)) * 100 : 50}%`
                  }}
                  className="bg-rose-500 transition-all duration-300"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2 font-mono">
                <span>毛利: <strong className="text-emerald-600 dark:text-emerald-400">+${Math.round(metrics.grossProfit)}</strong></span>
                <span>毛亏: <strong className="text-rose-600 dark:text-rose-400">-${Math.round(metrics.grossLoss)}</strong></span>
              </div>
            </div>

            {/* Card 2: Win Rate */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-gray-200/80 dark:border-white/10 shadow-xs group hover:border-purple-400/50 transition-all duration-300">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                <span>综合胜率 (Win Rate)</span>
                <span className="p-1 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Target className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline space-x-2 mb-2">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-gray-900 dark:text-white">
                  {metrics.winRate.toFixed(1)}%
                </span>
                <span className="text-xs font-mono font-semibold text-gray-400">
                  ({metrics.winningTrades}胜 / {metrics.losingTrades}负)
                </span>
              </div>
              {/* Win rate progress bar */}
              <div className="w-full bg-gray-100 dark:bg-navy-900 h-1.5 rounded-full overflow-hidden flex mb-2.5">
                <div
                  style={{ width: `${metrics.winRate}%` }}
                  className="bg-purple-500 transition-all duration-300"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2">
                <span>平均盈利: <span className="font-mono font-bold text-emerald-500">+${metrics.avgWin.toFixed(1)}</span></span>
                <span>平均亏损: <span className="font-mono font-bold text-rose-500">-${metrics.avgLoss.toFixed(1)}</span></span>
              </div>
            </div>

            {/* Card 3: Profit Factor & Expectancy */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-gray-200/80 dark:border-white/10 shadow-xs group hover:border-purple-400/50 transition-all duration-300">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                <span>盈亏比 (Profit Factor)</span>
                <span className="p-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <TrendingUp className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="flex items-baseline space-x-2 mb-2">
                <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-gray-900 dark:text-white">
                  {metrics.profitFactor >= 99 ? '∞' : metrics.profitFactor.toFixed(2)}
                </span>
                <span className="text-xs font-mono font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.5 rounded">
                  PF比率
                </span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 font-mono flex items-center justify-between">
                <span>系统数学期望:</span>
                <span className={`font-bold ${metrics.expectancy >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatCurrency(metrics.expectancy)} / 笔
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2">
                <span>赔率优势 (W/L): <strong className="font-mono text-gray-900 dark:text-white">{metrics.winLossRatio.toFixed(2)}x</strong></span>
                <span>已结算订单: <strong className="font-mono text-gray-900 dark:text-white">{metrics.completedTrades}</strong></span>
              </div>
            </div>

            {/* Card 4: Drawdown & Discipline */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl p-5 border border-gray-200/80 dark:border-white/10 shadow-xs group hover:border-purple-400/50 transition-all duration-300">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                <span>最大资金回撤 (Drawdown)</span>
                <span className="p-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-rose-600 dark:text-rose-400 mb-2">
                -${metrics.maxDrawdown.toFixed(2)}
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 font-mono flex items-center justify-between">
                <span>最佳单日回报:</span>
                <span className="font-bold text-emerald-500">
                  +${metrics.bestTrade.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-2">
                <span>总交易手数: <strong className="font-mono text-gray-900 dark:text-white">{metrics.totalVolume.toFixed(2)} 手</strong></span>
                <span>活跃交易日: <strong className="font-mono text-gray-900 dark:text-white">{metrics.tradingDaysCount} 天</strong></span>
              </div>
            </div>

          </div>

          {/* 3. TradeZella Signature Interactive Chart Engine */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 sm:p-6 shadow-xs mb-6">
            
            {/* Chart Engine Top Bar: Tab Switcher & Chart Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-100 dark:border-white/5 mb-4">
              {/* Chart Tabs */}
              <div className="flex items-center space-x-1 p-1 bg-gray-100/80 dark:bg-[#070a13] rounded-xl border border-gray-200/50 dark:border-white/5 text-xs">
                <button
                  type="button"
                  onClick={() => setChartTab('equity')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    chartTab === 'equity'
                      ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-purple-500 dark:text-purple-300" />
                  <span>资金净值走势 (Equity Curve)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChartTab('daily_pnl')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    chartTab === 'daily_pnl'
                      ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-300" />
                  <span>每日盈亏柱状 (Daily P&L)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChartTab('session')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center space-x-1.5 ${
                    chartTab === 'session'
                      ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-300" />
                  <span>时段透视 (Sessions)</span>
                </button>
              </div>

              {/* Chart Mode Controls (For Equity) */}
              {chartTab === 'equity' && (
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-gray-400 text-[11px]">显示模式:</span>
                  <div className="flex items-center bg-gray-100/80 dark:bg-[#070a13] rounded-lg p-0.5 border border-gray-200/50 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setEquityMode('pnl')}
                      className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition ${
                        equityMode === 'pnl' ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs font-bold' : 'text-gray-500'
                      }`}
                    >
                      累计净盈亏
                    </button>
                    <button
                      type="button"
                      onClick={() => setEquityMode('balance')}
                      className={`px-2.5 py-1 rounded-md font-mono text-[11px] transition ${
                        equityMode === 'balance' ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-xs font-bold' : 'text-gray-500'
                      }`}
                    >
                      资金总值 ($10k起)
                    </button>
                  </div>
                </div>
              )}

              {chartTab === 'daily_pnl' && (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs font-mono">
                  {/* Mode switcher: Zero centered dual vs Side by side */}
                  <div className="flex items-center bg-gray-100 dark:bg-white/5 p-0.5 rounded-lg border border-gray-200/60 dark:border-white/10 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setDailyBarLayout('zero_centered')}
                      className={`px-2 py-0.5 rounded-md transition font-medium ${
                        dailyBarLayout === 'zero_centered'
                          ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-2xs font-bold'
                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      零轴双柱 (上赢下亏)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDailyBarLayout('side_by_side')}
                      className={`px-2 py-0.5 rounded-md transition font-medium ${
                        dailyBarLayout === 'side_by_side'
                          ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white shadow-2xs font-bold'
                          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                      }`}
                    >
                      同向并排双柱
                    </button>
                  </div>

                  {/* Dual Bar Legend */}
                  <div className="hidden sm:flex items-center space-x-2 text-[11px]">
                    <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      <span>盈利柱</span>
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-bold">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
                      <span>亏损柱</span>
                    </span>
                  </div>

                  <span className="hidden sm:inline text-gray-300 dark:text-gray-700">|</span>

                  {/* Green / Red Days Ratio & Overall Win Rate */}
                  <div className="flex items-center space-x-2">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{dailyPnLData.greenDays} 绿日</span>
                    <span className="text-gray-300 dark:text-gray-700">/</span>
                    <span className="text-rose-600 dark:text-rose-400 font-bold">{dailyPnLData.redDays} 红日</span>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <span className="text-purple-600 dark:text-purple-400 font-bold">
                      胜率 {dailyPnLData.totalWins + dailyPnLData.totalLosses > 0
                        ? ((dailyPnLData.totalWins / (dailyPnLData.totalWins + dailyPnLData.totalLosses)) * 100).toFixed(0)
                        : 0}%
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* View 1: Equity Curve Chart */}
            {chartTab === 'equity' && (
              <div ref={equityContainerRef} className="relative w-full h-64 sm:h-72">
                {(() => {
                  const svgW = Math.max(320, chartDimensions.width);
                  const svgH = Math.max(200, chartDimensions.height);
                  const padLeft = 60;
                  const padRight = 20;
                  const padTop = 25;
                  const padBottom = 30;
                  const plotW = Math.max(10, svgW - padLeft - padRight);
                  const plotH = Math.max(10, svgH - padTop - padBottom);

                  const vals = equityPoints.map((p) => p.value);
                  const minVal = Math.min(...vals);
                  const maxVal = Math.max(...vals);
                  const pad = (maxVal - minVal) * 0.15 || 50;
                  const yMin = minVal - pad;
                  const yMax = maxVal + pad;
                  const yRange = yMax - yMin;

                  const getX = (i: number) => padLeft + (i / Math.max(1, equityPoints.length - 1)) * plotW;
                  const getY = (val: number) => padTop + plotH - ((val - yMin) / yRange) * plotH;

                  const pathD = equityPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.value).toFixed(1)}`).join(' ');
                  const areaD = `${pathD} L ${getX(equityPoints.length - 1).toFixed(1)} ${padTop + plotH} L ${padLeft} ${padTop + plotH} Z`;

                  // Peak high-water mark path
                  const peakD = equityPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(p.peak).toFixed(1)}`).join(' ');

                  const isPositive = equityPoints[equityPoints.length - 1]?.value >= equityPoints[0]?.value;
                  const activePoint = hoverIndex !== null ? equityPoints[hoverIndex] : equityPoints[equityPoints.length - 1];

                  return (
                    <div className="w-full h-full relative">
                      <svg
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        preserveAspectRatio="none"
                        className="w-full h-full block select-none"
                        onMouseLeave={() => setHoverIndex(null)}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const mouseX = e.clientX - rect.left;
                          const normX = (mouseX / rect.width) * svgW;
                          const clampedX = Math.max(padLeft, Math.min(padLeft + plotW, normX));
                          const ratio = (clampedX - padLeft) / plotW;
                          const idx = Math.round(ratio * (equityPoints.length - 1));
                          setHoverIndex(idx);
                        }}
                      >
                        <defs>
                          <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={isPositive ? '#8B5CF6' : '#F43F5E'} stopOpacity="0.25" />
                            <stop offset="100%" stopColor={isPositive ? '#8B5CF6' : '#F43F5E'} stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Horizontal Grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                          const y = padTop + plotH * pct;
                          const val = yMax - yRange * pct;
                          return (
                            <g key={i}>
                              <line
                                x1={padLeft}
                                y1={y}
                                x2={padLeft + plotW}
                                y2={y}
                                stroke="currentColor"
                                className="text-gray-100 dark:text-white/5"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={padLeft - 8}
                                y={y + 3.5}
                                textAnchor="end"
                                className="fill-gray-400 dark:fill-gray-500 font-mono text-[10px]"
                              >
                                {val >= 0 ? '+' : ''}${Math.round(val)}
                              </text>
                            </g>
                          );
                        })}

                        {/* High-Water Mark peak line */}
                        <path
                          d={peakD}
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="1.2"
                          strokeDasharray="4 4"
                          opacity="0.4"
                        />

                        {/* Area & Stroke */}
                        <path d={areaD} fill="url(#eqGradient)" />
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isPositive ? '#8B5CF6' : '#F43F5E'}
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Active hover crosshair */}
                        {hoverIndex !== null && (
                          <g>
                            <line
                              x1={getX(hoverIndex)}
                              y1={padTop}
                              x2={getX(hoverIndex)}
                              y2={padTop + plotH}
                              stroke="#8B5CF6"
                              strokeWidth="1.5"
                              strokeDasharray="2 2"
                            />
                            <circle
                              cx={getX(hoverIndex)}
                              cy={getY(equityPoints[hoverIndex].value)}
                              r="5"
                              fill="#ffffff"
                              stroke="#8B5CF6"
                              strokeWidth="2.5"
                            />
                          </g>
                        )}

                        {/* X-axis date labels */}
                        {equityPoints.length > 0 && (
                          <>
                            <text x={padLeft} y={svgH - 8} textAnchor="start" className="fill-gray-400 font-mono text-[10px]">
                              {equityPoints[0].date}
                            </text>
                            <text x={padLeft + plotW} y={svgH - 8} textAnchor="end" className="fill-gray-400 font-mono text-[10px]">
                              {equityPoints[equityPoints.length - 1].date}
                            </text>
                          </>
                        )}
                      </svg>

                      {/* Floating tooltip */}
                      {activePoint && hoverIndex !== null && (
                        <div
                          className="absolute top-2 bg-gray-900/95 text-white dark:bg-white dark:text-gray-900 px-3 py-2 rounded-xl shadow-xl text-xs font-mono pointer-events-none border border-white/10 dark:border-gray-200 transition-all duration-75"
                          style={{
                            left: `${Math.min(svgW - 140, Math.max(10, getX(hoverIndex) - 60))}px`
                          }}
                        >
                          <div className="font-semibold text-[11px] opacity-80">{activePoint.date}</div>
                          <div className="text-sm font-bold mt-0.5">
                            净值: {activePoint.value >= 0 ? '+' : ''}${activePoint.value.toFixed(2)}
                          </div>
                          {activePoint.pnl !== 0 && (
                            <div className={`text-[11px] font-semibold ${activePoint.pnl >= 0 ? 'text-emerald-400 dark:text-emerald-600' : 'text-rose-400 dark:text-rose-600'}`}>
                              本笔: {activePoint.pnl >= 0 ? '+' : ''}${activePoint.pnl.toFixed(2)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* View 2: TradeZella Daily P&L Bars */}
            {chartTab === 'daily_pnl' && (
              <div className="w-full">
                {dailyPnLData.list.length > 0 ? (
                  <div className="relative">
                    {(() => {
                      const maxProfit = Math.max(...dailyPnLData.list.map((d) => d.profit), 0);
                      const maxLoss = Math.max(...dailyPnLData.list.map((d) => d.loss), 0);
                      const maxDaily = Math.max(
                        ...dailyPnLData.list.map((d) => Math.max(d.profit, d.loss, Math.abs(d.pnl))),
                        50
                      );
                      const barMaxH = 75;

                      return (
                        <div ref={dailyBarContainerRef} className="pt-4 pb-2 relative">
                          {/* Subtitle indicator */}
                          <div className="flex items-center justify-between text-xs text-gray-400 mb-2 font-mono">
                            <span className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>最高盈利日: +${Math.round(maxProfit)}</span>
                            </span>
                            <span className="font-semibold text-gray-500 dark:text-gray-300 hidden sm:inline">
                              {dailyBarLayout === 'zero_centered'
                                ? '基准零轴 ($0.00) · 每天包含盈利(金额/单数)与亏损(金额/单数)两条柱子'
                                : '并排对比 · 每天包含盈利(金额/单数)与亏损(金额/单数)两条柱子'}
                            </span>
                            <span className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>最大亏损日: -${Math.round(maxLoss)}</span>
                            </span>
                          </div>

                          {/* 1. Layout: Zero-centered dual bars (零轴双向双柱) */}
                          {dailyBarLayout === 'zero_centered' && (
                            <div className="min-h-[340px] flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto border-t border-b border-gray-100 dark:border-white/5 py-3 px-1">
                              {dailyPnLData.list.map((item, idx) => {
                                const hasProfit = item.profit > 0.001;
                                const hasLoss = item.loss > 0.001;
                                const profitBarH = hasProfit ? Math.min(barMaxH, Math.max(6, (item.profit / maxDaily) * barMaxH)) : 0;
                                const lossBarH = hasLoss ? Math.min(barMaxH, Math.max(6, (item.loss / maxDaily) * barMaxH)) : 0;
                                const dayWinRate = item.count > 0 ? ((item.wins / item.count) * 100).toFixed(0) : '0';

                                return (
                                  <div
                                    key={idx}
                                    className="flex-1 min-w-[56px] sm:min-w-[68px] max-w-[84px] h-full flex flex-col items-center justify-between relative group cursor-pointer px-0.5 select-none"
                                    onMouseEnter={(e) => {
                                      if (!dailyBarContainerRef.current) return;
                                      const rect = dailyBarContainerRef.current.getBoundingClientRect();
                                      setHoverDailyBar({
                                        ...item,
                                        x: e.clientX - rect.left,
                                        y: e.clientY - rect.top
                                      });
                                    }}
                                    onMouseMove={(e) => {
                                      if (!dailyBarContainerRef.current) return;
                                      const rect = dailyBarContainerRef.current.getBoundingClientRect();
                                      setHoverDailyBar({
                                        ...item,
                                        x: e.clientX - rect.left,
                                        y: e.clientY - rect.top
                                      });
                                    }}
                                    onMouseLeave={() => setHoverDailyBar(null)}
                                  >
                                    {/* Upper half: Above Zero Line (盈利金额 & 盈利单数 + 盈利柱) */}
                                    <div className="h-[132px] w-full flex flex-col justify-end items-center">
                                      {/* 盈利数据文本: 金额 & 单数 */}
                                      <div className="h-[36px] flex flex-col items-center justify-end pb-1 w-full text-center">
                                        {hasProfit ? (
                                          <>
                                            <span className="text-[10px] sm:text-[11px] font-bold font-mono text-emerald-600 dark:text-emerald-400 leading-none">
                                              +${item.profit >= 1000 ? (item.profit / 1000).toFixed(1) + 'k' : item.profit.toFixed(0)}
                                            </span>
                                            <span className="text-[9px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/60 px-1 py-0.2 rounded-xs mt-0.5 leading-none shadow-2xs">
                                              {item.wins}单
                                            </span>
                                          </>
                                        ) : (
                                          <span className="text-[9px] text-gray-300 dark:text-gray-700">-</span>
                                        )}
                                      </div>

                                      {/* 柱子槽位 (左侧盈利柱，右侧占位留白) - 留足间距确保永不遮挡 */}
                                      <div className="h-[96px] w-full flex items-end justify-center gap-1 px-1">
                                        <div className="flex-1 max-w-[20px] h-full flex items-end justify-center">
                                          {hasProfit && (
                                            <div
                                              style={{ height: `${profitBarH}px`, maxHeight: `${barMaxH}px` }}
                                              className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 hover:brightness-110 transition-all group-hover:scale-x-110 shadow-xs"
                                              title={`盈利: +$${item.profit.toFixed(2)} (${item.wins}单)`}
                                            />
                                          )}
                                        </div>
                                        <div className="flex-1 max-w-[20px] h-full" />
                                      </div>
                                    </div>

                                    {/* Continuous Zero Line */}
                                    <div className="w-full h-[2px] bg-gray-200 dark:bg-white/15 my-1" />

                                    {/* Lower half: Below Zero Line (亏损柱 + 亏损单数 & 亏损金额) */}
                                    <div className="h-[132px] w-full flex flex-col justify-start items-center">
                                      {/* 柱子槽位 (左侧占位留白，右侧亏损柱) - 留足间距确保永不遮挡 */}
                                      <div className="h-[96px] w-full flex items-start justify-center gap-1 px-1">
                                        <div className="flex-1 max-w-[20px] h-full" />
                                        <div className="flex-1 max-w-[20px] h-full flex items-start justify-center">
                                          {hasLoss && (
                                            <div
                                              style={{ height: `${lossBarH}px`, maxHeight: `${barMaxH}px` }}
                                              className="w-full rounded-b-md bg-gradient-to-b from-rose-600 via-rose-500 to-rose-400 hover:brightness-110 transition-all group-hover:scale-x-110 shadow-xs"
                                              title={`亏损: -$${item.loss.toFixed(2)} (${item.losses}单)`}
                                            />
                                          )}
                                        </div>
                                      </div>

                                      {/* 亏损数据文本: 单数 & 金额 */}
                                      <div className="h-[36px] flex flex-col items-center justify-start pt-1 w-full text-center">
                                        {hasLoss ? (
                                          <>
                                            <span className="text-[9px] font-mono font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/70 border border-rose-200/80 dark:border-rose-800/60 px-1 py-0.2 rounded-xs mb-0.5 leading-none shadow-2xs">
                                              {item.losses}单
                                            </span>
                                            <span className="text-[10px] sm:text-[11px] font-bold font-mono text-rose-600 dark:text-rose-400 leading-none">
                                              -${item.loss >= 1000 ? (item.loss / 1000).toFixed(1) + 'k' : item.loss.toFixed(0)}
                                            </span>
                                          </>
                                        ) : (
                                          <span className="text-[9px] text-gray-300 dark:text-gray-700">-</span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Bottom Date, Net Badge & Win Rate */}
                                    <div className="flex flex-col items-center mt-1.5 space-y-0.5">
                                      <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">
                                        {item.date.substring(5)}
                                      </span>
                                      <span
                                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded-xs font-bold whitespace-nowrap shadow-2xs ${
                                          item.pnl > 0.001
                                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 border border-emerald-300/40 dark:border-emerald-800/50'
                                            : item.pnl < -0.001
                                            ? 'text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/70 border border-rose-300/40 dark:border-rose-800/50'
                                            : 'text-gray-500 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                                        }`}
                                        title={`当日净盈亏: ${item.pnl >= 0 ? '+' : ''}$${item.pnl.toFixed(2)}`}
                                      >
                                        净 {item.pnl >= 0 ? '+' : '-'}${Math.abs(item.pnl).toFixed(0)}
                                      </span>
                                      <span className="text-[9px] font-mono font-medium text-purple-600 dark:text-purple-400 mt-0.5">
                                        胜率 {dayWinRate}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* 2. Layout: Side-by-side dual bars (同向并排双柱) */}
                          {dailyBarLayout === 'side_by_side' && (
                            <div className="min-h-[340px] flex items-end justify-between gap-1 sm:gap-2 overflow-x-auto border-t border-b border-gray-100 dark:border-white/5 py-4 px-1">
                              {dailyPnLData.list.map((item, idx) => {
                                const hasProfit = item.profit > 0.001;
                                const hasLoss = item.loss > 0.001;
                                const maxSideH = 150;
                                const profitBarH = hasProfit ? Math.min(maxSideH, Math.max(8, (item.profit / maxDaily) * maxSideH)) : 0;
                                const lossBarH = hasLoss ? Math.min(maxSideH, Math.max(8, (item.loss / maxDaily) * maxSideH)) : 0;
                                const dayWinRate = item.count > 0 ? ((item.wins / item.count) * 100).toFixed(0) : '0';

                                return (
                                  <div
                                    key={idx}
                                    className="flex-1 min-w-[56px] sm:min-w-[68px] max-w-[84px] h-full flex flex-col items-center justify-end relative group cursor-pointer px-0.5 select-none"
                                    onMouseEnter={(e) => {
                                      if (!dailyBarContainerRef.current) return;
                                      const rect = dailyBarContainerRef.current.getBoundingClientRect();
                                      setHoverDailyBar({
                                        ...item,
                                        x: e.clientX - rect.left,
                                        y: e.clientY - rect.top
                                      });
                                    }}
                                    onMouseMove={(e) => {
                                      if (!dailyBarContainerRef.current) return;
                                      const rect = dailyBarContainerRef.current.getBoundingClientRect();
                                      setHoverDailyBar({
                                        ...item,
                                        x: e.clientX - rect.left,
                                        y: e.clientY - rect.top
                                      });
                                    }}
                                    onMouseLeave={() => setHoverDailyBar(null)}
                                  >
                                    {/* Dual Side-by-side Bars Area */}
                                    <div className="w-full h-[225px] flex items-end justify-center gap-1.5 px-0.5">
                                      {/* Left Bar: 盈利 (Green) */}
                                      <div className="flex-1 max-w-[22px] h-full flex flex-col justify-end items-center">
                                        {hasProfit ? (
                                          <>
                                            <div className="flex flex-col items-center mb-1 text-center leading-tight">
                                              <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                                +${item.profit >= 1000 ? (item.profit / 1000).toFixed(1) + 'k' : item.profit.toFixed(0)}
                                              </span>
                                              <span className="text-[9px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/60 px-1 py-0.2 rounded-xs mt-0.5">
                                                {item.wins}单
                                              </span>
                                            </div>
                                            <div
                                              style={{ height: `${profitBarH}px` }}
                                              className="w-full rounded-t-md bg-gradient-to-t from-emerald-600 via-emerald-500 to-emerald-400 hover:brightness-110 transition-all group-hover:scale-x-110 shadow-xs"
                                              title={`盈利: +$${item.profit.toFixed(2)} (${item.wins}单)`}
                                            />
                                          </>
                                        ) : (
                                          <div className="h-1 w-full bg-emerald-500/20 rounded-t" />
                                        )}
                                      </div>

                                      {/* Right Bar: 亏损 (Red) */}
                                      <div className="flex-1 max-w-[22px] h-full flex flex-col justify-end items-center">
                                        {hasLoss ? (
                                          <>
                                            <div className="flex flex-col items-center mb-1 text-center leading-tight">
                                              <span className="text-[10px] font-mono font-bold text-rose-600 dark:text-rose-400">
                                                -${item.loss >= 1000 ? (item.loss / 1000).toFixed(1) + 'k' : item.loss.toFixed(0)}
                                              </span>
                                              <span className="text-[9px] font-mono font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/70 border border-rose-200/80 dark:border-rose-800/60 px-1 py-0.2 rounded-xs mt-0.5">
                                                {item.losses}单
                                              </span>
                                            </div>
                                            <div
                                              style={{ height: `${lossBarH}px` }}
                                              className="w-full rounded-t-md bg-gradient-to-t from-rose-600 via-rose-500 to-rose-400 hover:brightness-110 transition-all group-hover:scale-x-110 shadow-xs"
                                              title={`亏损: -$${item.loss.toFixed(2)} (${item.losses}单)`}
                                            />
                                          </>
                                        ) : (
                                          <div className="h-1 w-full bg-rose-500/20 rounded-t" />
                                        )}
                                      </div>
                                    </div>

                                    {/* Baseline */}
                                    <div className="w-full h-[2px] bg-gray-200 dark:bg-white/15 my-1" />

                                    {/* Date, Net Badge & Win Rate */}
                                    <div className="flex flex-col items-center mt-1 space-y-0.5">
                                      <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 truncate">
                                        {item.date.substring(5)}
                                      </span>
                                      <span
                                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded-xs font-bold whitespace-nowrap shadow-2xs ${
                                          item.pnl > 0.001
                                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/70 border border-emerald-300/40 dark:border-emerald-800/50'
                                            : item.pnl < -0.001
                                            ? 'text-rose-700 dark:text-rose-300 bg-rose-100/70 dark:bg-rose-950/70 border border-rose-300/40 dark:border-rose-800/50'
                                            : 'text-gray-500 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10'
                                        }`}
                                      >
                                        净 {item.pnl >= 0 ? '+' : '-'}${Math.abs(item.pnl).toFixed(0)}
                                      </span>
                                      <span className="text-[9px] font-mono font-medium text-purple-600 dark:text-purple-400 mt-0.5">
                                        胜率 {dayWinRate}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Floating Tooltip Popup on Hover (Rich Dual-Bar Metrics) */}
                          {hoverDailyBar && (
                            <div
                              className="absolute z-40 pointer-events-none transition-all duration-75 ease-out"
                              style={{
                                left: `${Math.max(120, Math.min((dailyBarContainerRef.current?.clientWidth || 300) - 120, hoverDailyBar.x))}px`,
                                top: `${hoverDailyBar.y > 120 ? hoverDailyBar.y - 120 : hoverDailyBar.y + 20}px`,
                                transform: 'translateX(-50%)'
                              }}
                            >
                              {hoverDailyBar.y <= 120 && (
                                <div className="w-2.5 h-2.5 bg-gray-900/95 dark:bg-[#111827]/95 border-l border-t border-gray-700/80 dark:border-white/15 rotate-45 mx-auto -mb-1.5 z-10 relative" />
                              )}

                              <div className="bg-gray-900/95 dark:bg-[#111827]/95 text-white border border-gray-700/80 dark:border-white/15 rounded-xl px-3.5 py-2.5 shadow-2xl backdrop-blur-md text-xs font-mono min-w-[210px]">
                                <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1.5 border-b border-white/10 pb-1">
                                  <span className="font-semibold text-gray-200">{hoverDailyBar.date}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-gray-300 font-sans">
                                    总单数: {hoverDailyBar.count} 笔
                                  </span>
                                </div>

                                <div className="flex items-baseline justify-between mb-1.5">
                                  <span className="text-gray-400 text-[11px]">当日净盈亏:</span>
                                  <strong className={`text-sm font-bold ${hoverDailyBar.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {hoverDailyBar.pnl >= 0 ? '+' : ''}${hoverDailyBar.pnl.toFixed(2)}
                                  </strong>
                                </div>

                                {/* Dual Bar Breakdown */}
                                <div className="space-y-1 pt-1.5 border-t border-white/10 text-[11px]">
                                  <div className="flex items-center justify-between text-emerald-400">
                                    <span className="flex items-center space-x-1">
                                      <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
                                      <span>盈利柱:</span>
                                    </span>
                                    <span className="font-bold">
                                      +${hoverDailyBar.profit.toFixed(2)} ({hoverDailyBar.wins} 单)
                                    </span>
                                  </div>

                                  <div className="flex items-center justify-between text-rose-400">
                                    <span className="flex items-center space-x-1">
                                      <span className="w-2 h-2 rounded-xs bg-rose-500 inline-block" />
                                      <span>亏损柱:</span>
                                    </span>
                                    <span className="font-bold">
                                      -${hoverDailyBar.loss.toFixed(2)} ({hoverDailyBar.losses} 单)
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1.5 mt-1 border-t border-white/5">
                                  <span>胜负比: <strong className="text-gray-200">{hoverDailyBar.wins}W / {hoverDailyBar.losses}L</strong></span>
                                  <span>胜率: <strong className="text-gray-200">{hoverDailyBar.count > 0 ? ((hoverDailyBar.wins / hoverDailyBar.count) * 100).toFixed(0) : 0}%</strong></span>
                                </div>
                              </div>

                              {hoverDailyBar.y > 120 && (
                                <div className="w-2.5 h-2.5 bg-gray-900/95 dark:bg-[#111827]/95 border-r border-b border-gray-700/80 dark:border-white/15 rotate-45 mx-auto -mt-1.5" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="py-16 text-center text-gray-400 text-xs">
                    当前选定周期暂无交易日数据
                  </div>
                )}
              </div>
            )}

            {/* View 3: TradeSync Session Breakdown */}
            {chartTab === 'session' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                {sessionData.map((sess) => (
                  <div
                    key={sess.key}
                    className="p-4 rounded-xl bg-gray-50/80 dark:bg-[#070a13] border border-gray-200/70 dark:border-white/5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-xl">{sess.icon}</span>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">{sess.name}</h4>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                        sess.pnl >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60'
                      }`}>
                        {sess.pnl >= 0 ? '+' : ''}${sess.pnl.toFixed(1)}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between text-gray-500">
                        <span>胜率 (Win Rate):</span>
                        <strong className="text-gray-900 dark:text-white font-mono">{sess.winRate.toFixed(1)}%</strong>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-navy-900 h-1.5 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${sess.winRate}%` }}
                          className="bg-purple-500 h-full"
                        />
                      </div>
                      <div className="flex justify-between text-gray-500 text-[11px] pt-1">
                        <span>订单笔数: <strong className="text-gray-800 dark:text-gray-200 font-mono">{sess.count} 笔</strong></span>
                        <span>成交量: <strong className="text-gray-800 dark:text-gray-200 font-mono">{sess.volume.toFixed(1)} 手</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>

          {/* 4. Multi-Dimensional Deep Insights (TradeSync / TradeZella Style) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            
            {/* Module A: Long vs Short Breakdown */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <Sliders className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">多空方向深度透视</h3>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 uppercase">LONG / SHORT</span>
                </div>

                {/* Long stats */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                        <span>做多 BUY</span>
                        <span className="text-gray-400 font-normal">({directionStats.long.total}笔)</span>
                      </span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        {directionStats.long.pnl >= 0 ? '+' : ''}${directionStats.long.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono mb-1">
                      <span>胜率: {directionStats.long.winRate.toFixed(1)}%</span>
                      <span>盈亏比: {directionStats.long.pf.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-navy-900 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${directionStats.long.winRate}%` }}
                        className="bg-emerald-500 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Short stats */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                        <span>做空 SELL</span>
                        <span className="text-gray-400 font-normal">({directionStats.short.total}笔)</span>
                      </span>
                      <span className="font-mono font-bold text-gray-900 dark:text-white">
                        {directionStats.short.pnl >= 0 ? '+' : ''}${directionStats.short.pnl.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono mb-1">
                      <span>胜率: {directionStats.short.winRate.toFixed(1)}%</span>
                      <span>盈亏比: {directionStats.short.pf.toFixed(2)}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-navy-900 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${directionStats.short.winRate}%` }}
                        className="bg-rose-500 h-full rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-400 flex items-center justify-between">
                <span>多空分布比:</span>
                <span className="font-mono font-semibold text-gray-800 dark:text-gray-200">
                  {directionStats.long.total + directionStats.short.total > 0
                    ? `${Math.round((directionStats.long.total / (directionStats.long.total + directionStats.short.total)) * 100)}% 多 / ${Math.round((directionStats.short.total / (directionStats.long.total + directionStats.short.total)) * 100)}% 空`
                    : '50% / 50%'}
                </span>
              </div>
            </div>

            {/* Module B: Top Profit & Loss Symbols Ranking */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 mb-3">
                  <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-gray-100 dark:bg-white/5 border border-gray-200/60 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setSymbolRankingTab('profit')}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                        symbolRankingTab === 'profit'
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>盈利 Top</span>
                      {profitSymbols.length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          symbolRankingTab === 'profit' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                        }`}>
                          {profitSymbols.length}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSymbolRankingTab('loss')}
                      className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                        symbolRankingTab === 'loss'
                          ? 'bg-rose-500 text-white shadow-xs'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>亏损 Top</span>
                      {lossSymbols.length > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                          symbolRankingTab === 'loss' ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                        }`}>
                          {lossSymbols.length}
                        </span>
                      )}
                    </button>
                  </div>
                  <Link to="/trades" className="text-[11px] font-semibold text-purple-600 hover:text-purple-700">
                    明细
                  </Link>
                </div>

                <div className="space-y-2.5">
                  {(symbolRankingTab === 'profit' ? profitSymbols : lossSymbols).length > 0 ? (
                    (symbolRankingTab === 'profit' ? profitSymbols : lossSymbols).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50/60 dark:bg-[#070a13] border border-gray-100 dark:border-white/5"
                      >
                        <div className="flex items-center space-x-2.5">
                          <span
                            className={`w-6 h-6 rounded-lg font-mono font-bold text-[10px] flex items-center justify-center ${
                              symbolRankingTab === 'profit'
                                ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="font-bold text-xs text-gray-900 dark:text-white font-mono">
                              {item.symbol}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">
                              {item.count}笔 · {item.volume.toFixed(1)}手 · 胜率{item.winRate.toFixed(0)}%
                            </div>
                          </div>
                        </div>

                        <div
                          className={`text-xs font-mono font-bold ${
                            symbolRankingTab === 'profit'
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatCurrency(item.pnl)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-gray-400 text-xs">
                      {symbolRankingTab === 'profit' ? '暂无盈利标的' : '暂无亏损标的'}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-400 flex items-center justify-between">
                <span>{symbolRankingTab === 'profit' ? '最佳盈利标的:' : '最大亏损标的:'}</span>
                <span
                  className={`font-mono font-bold ${
                    symbolRankingTab === 'profit'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {symbolRankingTab === 'profit'
                    ? bestSymbol ? `${bestSymbol.symbol} (${formatCurrency(bestSymbol.pnl)})` : '-'
                    : worstSymbol ? `${worstSymbol.symbol} (${formatCurrency(worstSymbol.pnl)})` : '-'}
                </span>
              </div>
            </div>

            {/* Module C: Trading Psychology & Discipline (TradeZella Signature) */}
            <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 mb-3">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
                      <Sparkles className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">知行合一纪律与心智</h3>
                  </div>
                  <span className="text-[10px] font-mono text-gray-400 uppercase">MINDSET</span>
                </div>

                <div className="space-y-3.5">
                  {/* Discipline Score */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                    <div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block">综合纪律执行评分</span>
                      <div className="flex items-center space-x-1 mt-0.5">
                        <span className="text-xl font-black font-mono text-purple-700 dark:text-purple-300">
                          {psychologyStats.avgRating.toFixed(1)}
                        </span>
                        <span className="text-xs text-gray-400">/ 5.0</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        知行合一
                      </span>
                    </div>
                  </div>

                  {/* Stop Loss Adherence */}
                  <div>
                    <div className="flex justify-between text-xs mb-1 text-gray-500">
                      <span>止损点位设置执行率:</span>
                      <strong className="text-gray-900 dark:text-white font-mono">{psychologyStats.slRate.toFixed(1)}%</strong>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-navy-900 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${psychologyStats.slRate}%` }}
                        className="bg-emerald-500 h-full rounded-full"
                      />
                    </div>
                  </div>

                  {/* Sentiment distribution pills */}
                  <div className="pt-1">
                    <span className="text-xs text-gray-400 block mb-2">入场情绪状态分布:</span>
                    <div className="flex flex-wrap gap-1.5 text-xs font-mono">
                      <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 text-[11px]">
                        🧘 Zen ({psychologyStats.sentiments.Zen})
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 text-[11px]">
                        😌 淡定 ({psychologyStats.sentiments.Composed})
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/60 text-[11px]">
                        😰 焦虑 ({psychologyStats.sentiments.Nervous})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5 text-[11px] text-gray-400 flex items-center justify-between">
                <span>纪律建议:</span>
                <span className="text-gray-700 dark:text-gray-300 font-medium">严控单笔最大止损，拒绝追涨</span>
              </div>
            </div>

          </div>

          {/* 5. Live Recent Trades Feed */}
          <div className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 mb-4">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <Zap className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">最新实盘交易动态</h3>
              </div>
              <Link
                to="/trades"
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center space-x-0.5"
              >
                <span>查看全部交易明细</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-white/5 text-gray-400 text-left font-mono text-[11px]">
                    <th className="py-2.5 px-3">入场时间</th>
                    <th className="py-2.5 px-3">标的代码</th>
                    <th className="py-2.5 px-3">方向</th>
                    <th className="py-2.5 px-3">规模</th>
                    <th className="py-2.5 px-3">开仓价</th>
                    <th className="py-2.5 px-3">平仓价</th>
                    <th className="py-2.5 px-3">盈亏比 (R)</th>
                    <th className="py-2.5 px-3 text-right">净盈亏 (P/L)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5 font-mono">
                  {filteredTrades.slice(0, 6).map((trade) => {
                    const isLong = getTradeDirection(trade) === 'long';
                    const exit = getTradeExitPrice(trade);
                    const pnl = exit > 0 ? calculateTradePnL(trade) : null;
                    const rr = calculateTradeRR(trade);
                    const rawDate = getTradeEntryTime(trade);
                    const dateDisplay = formatDateTime(rawDate);

                    return (
                      <tr key={trade.id} className="hover:bg-purple-50/20 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 text-gray-500">{dateDisplay}</td>
                        <td className="py-3 px-3 font-bold text-gray-900 dark:text-white">{trade.symbol}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isLong
                              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200/60'
                          }`}>
                            {isLong ? '做多 BUY' : '做空 SELL'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{getTradeSize(trade)}手</td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{getTradeEntryPrice(trade)}</td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400">{exit > 0 ? exit : '-'}</td>
                        <td className="py-3 px-3 font-bold text-gray-700 dark:text-gray-300">
                          {rr !== null ? `${rr >= 0 ? '+' : ''}${rr.toFixed(1)}R` : '-'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {pnl !== null ? (
                            <span className={`font-bold ${pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-purple-50 text-purple-600 dark:bg-purple-950/60 font-bold">
                              持仓中
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTrades.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-gray-400">
                        当前条件下暂无交易数据，请切换时间筛选或新建交易
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
