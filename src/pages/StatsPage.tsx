import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { getUserTrades } from '../services/api';
import { useRealtimeTrades } from '../services/realtime';
import { Trade } from '../components/calendar/calendarTypes';
import {
  computeDayStats,
  formatCurrency,
  getTradeDirection,
  getTradeEntryPrice,
  getTradeExitPrice,
  getTradeSize,
  getTradeEntryTime,
  getTradeTradingDate,
  getCurrentTradingDate,
  getTradeExitTime,
  getTradeStopLoss,
  getTradeTakeProfit,
  calculateTradePnL,
  isTradeMistake,
} from '../components/calendar/calendarUtils';
import { CalendarDayDrawer } from '../components/calendar/CalendarDayDrawer';
import { CalendarWeekModal } from '../components/calendar/CalendarWeekModal';
import { CalendarYearMonthMatrix } from '../components/calendar/CalendarYearMonthMatrix';
import { CalendarDailyPnLBarChart } from '../components/calendar/CalendarDailyPnLBarChart';
import TradeExecutionChart from '../components/TradeExecutionChart';
import Select, { SelectOption } from '../components/common/Select';
import {
  ChevronLeft,
  ChevronRight,
  LineChart,
  X,
  AlertTriangle,
  Star,
} from 'lucide-react';

const WEEKDAYS = [
  { short: 'Mon', label: '周一' },
  { short: 'Tue', label: '周二' },
  { short: 'Wed', label: '周三' },
  { short: 'Thu', label: '周四' },
  { short: 'Fri', label: '周五' },
  { short: 'Sat', label: '周六' },
  { short: 'Sun', label: '周日' },
];

const MONTH_OPTIONS: SelectOption[] = [
  { value: '0', label: '1月' },
  { value: '1', label: '2月' },
  { value: '2', label: '3月' },
  { value: '3', label: '4月' },
  { value: '4', label: '5月' },
  { value: '5', label: '6月' },
  { value: '6', label: '7月' },
  { value: '7', label: '8月' },
  { value: '8', label: '9月' },
  { value: '9', label: '10月' },
  { value: '10', label: '11月' },
  { value: '11', label: '12月' },
];

const StatsPage: React.FC = () => {
  const [searchParams] = useSearchParams();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const calendarCardRef = useRef<HTMLDivElement>(null);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(() => {
    const qDate = searchParams.get('date');
    if (qDate) {
      const parsed = new Date(qDate);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });

  // Interactive Drawers / Modals
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<{ index: number; dates: string[] } | null>(null);
  const [chartModalTrade, setChartModalTrade] = useState<Trade | null>(null);
  const [notesRevision, setNotesRevision] = useState(0);

  // 监听复盘日记打分与笔记更新，实时刷新日历卡片状态
  useEffect(() => {
    const handleNotesUpdate = () => {
      setNotesRevision((v) => v + 1);
    };
    window.addEventListener('tradezella_daily_notes_updated', handleNotesUpdate);
    window.addEventListener('storage', handleNotesUpdate);
    return () => {
      window.removeEventListener('tradezella_daily_notes_updated', handleNotesUpdate);
      window.removeEventListener('storage', handleNotesUpdate);
    };
  }, []);

  // Prevent background scrolling while standalone chart modal is open
  useEffect(() => {
    if (chartModalTrade && typeof document !== 'undefined') {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [chartModalTrade]);

  const fetchTrades = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('请登录后查看交易日历与统计数据。');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getUserTrades(token);
      setTrades(data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || '加载交易数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  // 监听实时订单推送，日历与统计数据秒级自动同步刷新
  useRealtimeTrades(() => {
    fetchTrades();
  });

  // 交易日切日模式：默认美盘 06:00 切日（与 MT5 服务器结算一致），支持切换 MT5 原生自然日
  const [cutoffMode, setCutoffMode] = useState<'trading' | 'natural'>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem('tradezella_trading_day_cutoff');
        if (saved === '0') return 'natural';
      }
    } catch {}
    return 'trading';
  });

  const handleCutoffChange = (mode: 'trading' | 'natural') => {
    setCutoffMode(mode);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('tradezella_trading_day_cutoff', mode === 'trading' ? '6' : '0');
        window.dispatchEvent(new Event('tradezella_cutoff_changed'));
      }
    } catch {}
  };

  // 监听全平台切日口径变动事件 (如在仪表盘切换设置时，日历秒级联动响应)
  useEffect(() => {
    const onCutoffChange = () => {
      try {
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem('tradezella_trading_day_cutoff');
          setCutoffMode(saved === '0' ? 'natural' : 'trading');
        }
      } catch {}
    };
    window.addEventListener('tradezella_cutoff_changed', onCutoffChange);
    return () => window.removeEventListener('tradezella_cutoff_changed', onCutoffChange);
  }, []);

  // Group trades by trading day: "YYYY-MM-DD"
  const tradesByDay = useMemo(() => {
    const map: Record<string, Trade[]> = {};
    const cutoff = cutoffMode === 'trading' ? 6 : 0;
    trades.forEach((trade) => {
      const dateStr = getTradeTradingDate(trade, cutoff);
      if (!dateStr || dateStr.length < 10) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(trade);
    });
    return map;
  }, [trades, cutoffMode]);

  // Calendar Days (Monday first)
  const calendarRows = useMemo<(string | null)[][]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay();
    const mondayOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (string | null)[] = [];
    for (let i = 0; i < mondayOffset; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(dateStr);
    }

    while (cells.length % 7 !== 0) {
      cells.push(null);
    }

    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [currentDate]);

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };
  const goToday = () => {
    setCurrentDate(new Date());
  };
  const handleMonthChange = (monthIdx: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), monthIdx, 1));
  };

  const todayStr = useMemo(() => {
    return getCurrentTradingDate();
  }, []);

  const isCurrentMonthAndYear = useMemo(() => {
    const today = new Date();
    return (
      currentDate.getFullYear() === today.getFullYear() &&
      currentDate.getMonth() === today.getMonth()
    );
  }, [currentDate]);

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0b0f19] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Unified Calendar Container (Daily P&L Bar Chart + Month Nav + 8-Column Grid) */}
        <div ref={calendarCardRef} className="bg-white dark:bg-[#111827] rounded-2xl border border-gray-200 dark:border-white/10 shadow-xs overflow-hidden">
          {/* 1. 当月每日盈亏柱形图 (Monthly Daily P&L Bar Chart) */}
          <CalendarDailyPnLBarChart
            currentYear={currentDate.getFullYear()}
            currentMonth={currentDate.getMonth()}
            tradesByDay={tradesByDay}
            onSelectDay={(dateStr) => setSelectedDay(dateStr)}
          />

          {/* 2. Month Navigator Bar (Left/Right Aligned Arrows, Centered Month/Year & Today) */}
          <div className="relative z-20 px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-navy-950/30">
            {/* Left: Previous Month Arrow */}
            <button
              onClick={prevMonth}
              className="w-[38px] h-[38px] flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#070a13] text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-400 dark:hover:border-purple-500/80 transition-all shadow-2xs shrink-0"
              title="上个月"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Center: Month Selector & Back to Today */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-gray-900 dark:text-white font-mono px-1">
                {currentDate.getFullYear()}年
              </span>

              <div className="w-[90px] sm:w-[100px]">
                <Select
                  value={String(currentDate.getMonth())}
                  onChange={(val) => handleMonthChange(Number(val))}
                  options={MONTH_OPTIONS}
                  aria-label="选择月份"
                  className="w-full"
                />
              </div>

              {!isCurrentMonthAndYear && (
                <button
                  onClick={goToday}
                  className="h-[38px] px-3.5 rounded-xl bg-white dark:bg-[#070a13] hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-semibold text-purple-700 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 hover:border-purple-400 dark:hover:border-purple-500 transition-all whitespace-nowrap shrink-0 shadow-2xs animate-in fade-in duration-150"
                  title="回到当前月份"
                >
                  回到今日
                </button>
              )}
            </div>

            {/* Right: Cutoff Mode Switch & Next Month Arrow */}
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center p-0.5 bg-gray-100 dark:bg-[#070a13] rounded-xl border border-gray-200/80 dark:border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => handleCutoffChange('trading')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    cutoffMode === 'trading'
                      ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white font-semibold shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="美盘交易日（默认）：以美盘结算（北京时间 06:00）作为切日点，00:00~06:00 归属前一交易日（跨夜单合并）"
                >
                  美盘交易日 (06:00)
                </button>
                <button
                  type="button"
                  onClick={() => handleCutoffChange('natural')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    cutoffMode === 'natural'
                      ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white font-semibold shadow-xs'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="MT5 自然日：与 MT5 客户端历史记录日期完全 1:1 精确对齐，严格按 00:00~23:59 统计"
                >
                  MT5 自然日 (00:00)
                </button>
              </div>

              <button
                onClick={nextMonth}
                className="w-[38px] h-[38px] flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#070a13] text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-400 dark:hover:border-purple-500/80 transition-all shadow-2xs shrink-0"
                title="下个月"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3. Calendar Grid (Weekdays Header + Days with Unified Metrics) */}
          <div className="p-4 sm:p-5">
            {/* Weekday Column Headers */}
            <div className="grid grid-cols-8 gap-2 mb-2 text-center text-xs font-bold text-gray-500 dark:text-gray-400">
              {WEEKDAYS.map((wd) => (
                <div key={wd.short} className="py-2 rounded-lg bg-gray-50/70 dark:bg-navy-900/50">
                  <span>{wd.label}</span>
                  <span className="text-[10px] text-gray-400 block font-normal">{wd.short}</span>
                </div>
              ))}
              <div className="py-2 rounded-lg bg-purple-50/60 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 font-bold border border-purple-200/50 dark:border-purple-800/40">
                <span>周汇总</span>
                <span className="text-[10px] block font-mono">Week</span>
              </div>
            </div>

            {/* Calendar Rows */}
            <div className="space-y-2">
              {calendarRows.map((row, rowIdx) => {
                const weekDateStrs = row.filter((d): d is string => !!d);
                const weekTrades = weekDateStrs.flatMap((d) => tradesByDay[d] || []);
                const weekStats = computeDayStats(weekTrades);
                const weekHasTrades = weekTrades.length > 0;

                return (
                  <div key={`row-${rowIdx}`} className="grid grid-cols-8 gap-2">
                    {/* Days 1 to 7 (Mon to Sun) */}
                    {row.map((dateStr, colIdx) => {
                      if (!dateStr) {
                        return (
                          <div
                            key={`empty-${rowIdx}-${colIdx}`}
                            className="min-h-[135px] rounded-xl border border-dashed border-gray-100 dark:border-white/5 bg-gray-50/30 dark:bg-navy-950/20"
                          />
                        );
                      }

                      const dayTrades = tradesByDay[dateStr] || [];
                      const stats = computeDayStats(dayTrades, dateStr);
                      const dayNum = parseInt(dateStr.split('-')[2], 10);
                      const isToday = dateStr === todayStr;
                      const hasTrades = dayTrades.length > 0;
                      const isLowScore = stats.journalScore !== null && stats.journalScore <= 2;
                      const hasScore = stats.journalScore !== null;

                      // Cell Background Style
                      let bgClasses = 'bg-white dark:bg-navy-900/40 border-gray-200/80 dark:border-white/10';
                      if (hasTrades) {
                        if (stats.pnl > 0.001) {
                          bgClasses = 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30 dark:border-emerald-800/60 hover:border-emerald-500 dark:hover:border-emerald-500';
                        } else if (stats.pnl < -0.001) {
                          bgClasses = 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/30 dark:border-rose-800/60 hover:border-rose-500 dark:hover:border-rose-500';
                        } else {
                          bgClasses = 'bg-gray-100 dark:bg-navy-800 border-gray-300 dark:border-navy-700';
                        }
                      }

                      // 分数低的重点突出 (Low Score Prominent Warning Outline & Ring)
                      const lowScoreClasses = isLowScore
                        ? 'border-rose-500! dark:border-rose-500! ring-2 ring-rose-500/80 shadow-md shadow-rose-500/20'
                        : '';

                      return (
                        <div
                          key={dateStr}
                          onClick={() => setSelectedDay(dateStr)}
                          className={`min-h-[135px] p-2.5 rounded-xl border text-xs cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-md flex flex-col justify-between ${bgClasses} ${lowScoreClasses} ${
                            isToday ? 'border-purple-500 dark:border-purple-400 ring-2 ring-purple-500/25 shadow-md' : ''
                          }`}
                          title="点击查看日内复盘、笔记与每笔交易 K 线打点"
                        >
                          {/* Top: Date Number & Badges */}
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={`text-xs font-mono font-bold ${
                                isToday
                                  ? 'text-purple-600 dark:text-purple-400 font-extrabold'
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {dayNum}
                            </span>

                            <div className="flex items-center space-x-1">
                              {isToday && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  TODAY
                                </span>
                              )}
                              {/* Daily Review Discipline Score Badge (分数低的重点突出) */}
                              {hasScore && (
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold flex items-center space-x-0.5 ${
                                    isLowScore
                                      ? 'bg-rose-600 text-white shadow-xs animate-pulse ring-1 ring-rose-400'
                                      : stats.journalScore === 3
                                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800'
                                      : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                  }`}
                                  title={`日内复盘打分: ${stats.journalScore}分 ${
                                    isLowScore
                                      ? '(严重违规/执行欠佳，重点突出复盘)'
                                      : stats.journalScore === 3
                                      ? '(基本合格)'
                                      : '(自律良好/知行合一)'
                                  }`}
                                >
                                  {isLowScore && <span className="text-[8px]">⚠️</span>}
                                  <span>{stats.journalScore}分</span>
                                </span>
                              )}
                              {stats.mistakesCount > 0 && (
                                <span
                                  className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500 text-white flex items-center space-x-0.5"
                                  title={`发现 ${stats.mistakesCount} 笔失误/违规`}
                                >
                                  <span>⚠️</span>
                                  <span>{stats.mistakesCount}</span>
                                </span>
                              )}
                              {hasTrades && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-gray-600 dark:text-gray-300 bg-black/5 dark:bg-white/10">
                                  {stats.count}单
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Unified Center & Body Metrics */}
                          {hasTrades ? (
                            <div className="flex-1 flex flex-col justify-between py-1">
                              {/* 1. Hero: Net P&L (净利润) */}
                              <div className="text-center my-auto">
                                <div
                                  className={`text-sm sm:text-base font-black font-mono tracking-tight ${
                                    stats.pnl >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {formatCurrency(stats.pnl)}
                                </div>
                                {isLowScore && (
                                  <div className="mt-1 py-0.5 px-1 rounded bg-rose-500/15 dark:bg-rose-950/50 border border-rose-500/40 text-[9px] font-bold text-rose-600 dark:text-rose-400 text-center truncate">
                                    ⚠️ 重点复盘日 ({stats.journalScore}分)
                                  </div>
                                )}
                              </div>


                              {/* 2. Unified Sub-metrics: 订单胜负, 手数, R倍数 */}
                              <div className="space-y-0.5 text-[10px] font-mono border-t border-black/5 dark:border-white/5 pt-1.5">
                                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                                  <span className="font-sans text-gray-500 dark:text-gray-400">胜负:</span>
                                  <span className="font-bold">
                                    {stats.wins}W - {stats.losses}L ({stats.winRate.toFixed(0)}%)
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                                  <span className="font-sans text-gray-500 dark:text-gray-400">手数:</span>
                                  <span className="font-bold">
                                    {stats.totalVolume.toFixed(2)} Lots
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                                  <span className="font-sans text-gray-500 dark:text-gray-400">R倍数:</span>
                                  <span
                                    className={`font-bold ${
                                      stats.totalR >= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {stats.totalR >= 0 ? '+' : ''}
                                    {stats.totalR.toFixed(1)}R
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="my-auto text-center">
                              {isLowScore ? (
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/15 px-1.5 py-0.5 rounded border border-rose-500/40">
                                  ⚠️ 重点复盘 ({stats.journalScore}分)
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-300 dark:text-gray-600">-</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* 8th Column: Week Summary Cell (Unified Metrics) */}
                    <div
                      onClick={() => {
                        if (weekHasTrades) {
                          setSelectedWeek({ index: rowIdx, dates: weekDateStrs });
                        }
                      }}
                      className={`min-h-[135px] p-2.5 rounded-xl border text-xs cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-md flex flex-col justify-between ${
                        weekHasTrades
                          ? weekStats.pnl >= 0
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/30 border-emerald-500/30 dark:border-emerald-800/60 hover:border-emerald-500 dark:hover:border-emerald-500'
                            : 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/30 dark:border-rose-800/60 hover:border-rose-500 dark:hover:border-rose-500'
                          : 'bg-gray-50 dark:bg-navy-950/40 border-gray-200/80 dark:border-white/5 opacity-60'
                      }`}
                      title="点击查看周度全面汇总复盘"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-bold ${
                          !weekHasTrades 
                            ? 'text-gray-500 dark:text-gray-400' 
                            : weekStats.pnl >= 0 
                              ? 'text-emerald-700 dark:text-emerald-400' 
                              : 'text-rose-700 dark:text-rose-400'
                        }`}>
                          第 {rowIdx + 1} 周
                        </span>
                        {weekHasTrades && (
                          <span className="text-[10px] font-mono text-gray-400">
                            {weekStats.count}单
                          </span>
                        )}
                      </div>

                      {weekHasTrades ? (
                        <div className="flex-1 flex flex-col justify-between py-1">
                          {/* Week Net P&L */}
                          <div className="text-center my-auto">
                            <div
                              className={`text-xs sm:text-sm font-black font-mono ${
                                weekStats.pnl >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {formatCurrency(weekStats.pnl)}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                              胜率: {weekStats.winRate.toFixed(0)}%
                            </div>
                          </div>

                          {/* Week Sub-metrics */}
                          <div className="space-y-0.5 text-[10px] font-mono border-t border-black/5 dark:border-white/5 pt-1.5">
                            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                              <span className="font-sans text-gray-500 dark:text-gray-400">胜负:</span>
                              <span className="font-bold">{weekStats.wins}W - {weekStats.losses}L</span>
                            </div>

                            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                              <span className="font-sans text-gray-500 dark:text-gray-400">手数:</span>
                              <span className="font-bold">{weekStats.totalVolume.toFixed(2)}</span>
                            </div>

                            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                              <span className="font-sans text-gray-500 dark:text-gray-400">PF:</span>
                              <span className="font-bold">
                                {weekStats.profitFactor >= 99 ? '∞' : weekStats.profitFactor.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="my-auto text-center text-[10px] text-gray-400">
                          休市
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Performance Breakdown & Yearly Archive Data */}
          <div className="border-t border-gray-200 dark:border-white/10 p-4 sm:p-5 bg-gray-50/50 dark:bg-navy-950/40">
            <CalendarYearMonthMatrix
              trades={trades}
              currentYear={currentDate.getFullYear()}
              currentMonth={currentDate.getMonth()}
              notesRevision={notesRevision}
              onSelectMonth={(year, month) => {
                setCurrentDate(new Date(year, month, 1));
                calendarCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              onSelectYear={(year) => {
                setCurrentDate(new Date(year, currentDate.getMonth(), 1));
                calendarCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            />
          </div>
        </div>

        {/* 3. Slide-over Day Review Drawer */}
        <CalendarDayDrawer
          dateStr={selectedDay}
          trades={selectedDay ? tradesByDay[selectedDay] || [] : []}
          onClose={() => setSelectedDay(null)}
          onOpenChart={(trade) => setChartModalTrade(trade)}
          cutoffMode={cutoffMode}
        />

        {/* 4. Week Summary Modal */}
        {selectedWeek && (
          <CalendarWeekModal
            weekIndex={selectedWeek.index}
            weekDates={selectedWeek.dates}
            tradesByDay={tradesByDay}
            onClose={() => setSelectedWeek(null)}
            onSelectDay={(dateStr) => setSelectedDay(dateStr)}
          />
        )}

        {/* 5. TradingView Candlestick Execution Chart Modal */}
        {chartModalTrade && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[1010] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setChartModalTrade(null)}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.preventDefault()}
          >
            <div
              className="bg-white dark:bg-[#0f172a] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 z-[1020]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50 dark:bg-navy-950 shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <LineChart className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                      <span>{chartModalTrade.symbol} 订单图表回放</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                          getTradeDirection(chartModalTrade) === 'long'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                        }`}
                      >
                        {getTradeDirection(chartModalTrade).toUpperCase()}
                      </span>
                    </h3>
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center space-x-2 mt-0.5 font-mono">
                      <span>入场: {getTradeEntryPrice(chartModalTrade)}</span>
                      <span>·</span>
                      <span>出场: {getTradeExitPrice(chartModalTrade) || '持仓中'}</span>
                      <span>·</span>
                      <span
                        className={`font-bold ${
                          calculateTradePnL(chartModalTrade) >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {formatCurrency(calculateTradePnL(chartModalTrade))}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setChartModalTrade(null)}
                  className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-navy-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Chart Body */}
              <div className="flex-1 p-4 overflow-y-auto min-h-0 bg-white dark:bg-[#0b0f19]">
                <TradeExecutionChart
                  symbol={chartModalTrade.symbol}
                  direction={getTradeDirection(chartModalTrade)}
                  entryPrice={getTradeEntryPrice(chartModalTrade)}
                  exitPrice={getTradeExitPrice(chartModalTrade) || undefined}
                  entryTime={getTradeEntryTime(chartModalTrade)}
                  exitTime={getTradeExitTime(chartModalTrade) || undefined}
                  stopLoss={getTradeStopLoss(chartModalTrade)}
                  takeProfit={getTradeTakeProfit(chartModalTrade)}
                  pnl={calculateTradePnL(chartModalTrade)}
                  height={450}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default StatsPage;
