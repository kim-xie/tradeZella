import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trade, DayStats } from './calendarTypes';
import {
  computeDayStats,
  formatCurrency,
  getTradeDirection,
  getTradeEntryPrice,
  getTradeExitPrice,
  getTradeSize,
  getTradeEntryTime,
  getTradeExitTime,
  calculateTradePnL,
  getTradeDurationMinutes,
  formatDurationShort,
  isTradeMistake,
  getTradeTags,
} from './calendarUtils';
import {
  X,
  Calendar,
  TrendingUp,
  Clock,
  Layers,
  AlertTriangle,
  FileText,
  Save,
  CheckCircle,
  ExternalLink,
  LineChart,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface CalendarDayDrawerProps {
  dateStr: string | null;
  trades: Trade[];
  onClose: () => void;
  onOpenChart: (trade: Trade) => void;
}

const QUICK_TAGS = [
  '遵守风控计划',
  '顺势突破',
  '区间高抛低吸',
  '追高FOMO',
  '提前止盈离场',
  '报复性交易',
  '重仓抗单',
  '移动止损保本',
];

export const CalendarDayDrawer: React.FC<CalendarDayDrawerProps> = ({
  dateStr,
  trades,
  onClose,
  onOpenChart,
}) => {
  const [dailyNote, setDailyNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Prevent background scrolling and hide page scrollbars while drawer is active
  useEffect(() => {
    if (dateStr && typeof document !== 'undefined') {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [dateStr]);

  // Load existing notes for this day
  useEffect(() => {
    if (!dateStr) return;
    try {
      const stored = localStorage.getItem(`tradezella_daily_notes_${dateStr}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        setDailyNote(parsed.note || '');
        setSelectedTags(parsed.tags || []);
      } else {
        // Fallback to first trade's notes if available
        const firstWithNote = trades.find((t) => t.notes && t.notes.trim().length > 0);
        setDailyNote(firstWithNote?.notes || '');
        setSelectedTags([]);
      }
    } catch {
      setDailyNote('');
      setSelectedTags([]);
    }
  }, [dateStr, trades]);

  if (!dateStr) return null;

  const stats = computeDayStats(trades, dateStr);

  const handleSaveNotes = () => {
    if (!dateStr) return;
    try {
      localStorage.setItem(
        `tradezella_daily_notes_${dateStr}`,
        JSON.stringify({
          note: dailyNote,
          tags: selectedTags,
          updatedAt: new Date().toISOString(),
        })
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (e) {
      console.error('Failed to save daily notes', e);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // Format date readable
  const dateObj = new Date(`${dateStr}T12:00:00`);
  const formattedDate = dateObj.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.preventDefault()}
      />

      {/* Drawer Panel */}
      <aside
        aria-label="日内交易复盘抽屉"
        className={`fixed top-0 right-0 bottom-0 z-[1000] ${
          isMaximized ? 'w-full' : 'w-full md:w-3/5 lg:w-1/2'
        } bg-white dark:bg-[#0f172a] border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out`}
        onWheel={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 sm:p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/60 dark:bg-navy-950/60 shrink-0 select-none"
          onTouchMove={(e) => e.preventDefault()}
        >
          <div>
            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
              <Calendar className="w-3.5 h-3.5 text-purple-500" />
              <span>日内交易复盘 (Daily Journal & Execution)</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
              <span>{dateStr}</span>
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">({formattedDate})</span>
            </h2>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                stats.pnl >= 0
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
              }`}
            >
              {formatCurrency(stats.pnl)}
            </span>
            <button
              onClick={() => setIsMaximized((prev) => !prev)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-800 transition"
              title={isMaximized ? '还原抽屉宽度' : '全屏铺满抽屉'}
              aria-label={isMaximized ? '还原抽屉宽度' : '全屏铺满抽屉'}
            >
              {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-800 transition"
              title="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-5 space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-gray-100 dark:border-white/5 min-w-0">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 truncate">当日净利润</div>
              <div className={`text-base font-bold font-mono truncate ${stats.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(stats.pnl)}
              </div>
              <div className="text-[10px] text-gray-400 mt-1 truncate">毛盈: +${Math.round(stats.grossProfit)} / 毛亏: -${Math.round(stats.grossLoss)}</div>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-gray-100 dark:border-white/5 min-w-0">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 truncate">胜率与订单</div>
              <div className="text-base font-bold font-mono text-gray-900 dark:text-white truncate">
                {stats.winRate.toFixed(0)}%
              </div>
              <div className="text-[10px] text-gray-400 mt-1 truncate">{stats.wins}胜 / {stats.losses}负 / {stats.breakevens}平 ({stats.count}单)</div>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-gray-100 dark:border-white/5 min-w-0">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 truncate">盈亏比 / 均R</div>
              <div className="text-base font-bold font-mono text-gray-900 dark:text-white truncate">
                {stats.profitFactor >= 99 ? '∞' : stats.profitFactor.toFixed(2)} PF
              </div>
              <div className="text-[10px] text-gray-400 mt-1 truncate">累积 R: {stats.totalR >= 0 ? '+' : ''}{stats.totalR.toFixed(2)}R</div>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-navy-900/50 border border-gray-100 dark:border-white/5 min-w-0">
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1 truncate">总手数 / 均持仓</div>
              <div className="text-base font-bold font-mono text-gray-900 dark:text-white truncate">
                {stats.totalVolume.toFixed(2)} Lots
              </div>
              <div className="text-[10px] text-gray-400 mt-1 truncate">赢: {formatDurationShort(stats.avgWinDuration)} | 输: {formatDurationShort(stats.avgLossDuration)}</div>
            </div>
          </div>

          {/* Discipline Mistakes Warning Banner */}
          {stats.mistakesCount > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs">
                <span className="font-bold text-amber-800 dark:text-amber-300">
                  发现 {stats.mistakesCount} 笔失误或风控纪律违规
                </span>
                <p className="text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                  当日存在情绪化交易、追高、提前平仓或未遵守止损等违纪行为。请在下方写下复盘心得，避免在后续交易日重蹈覆辙。
                </p>
              </div>
            </div>
          )}

          {/* Daily Journal & Notes Section */}
          <div className="bg-gray-50/70 dark:bg-navy-900/40 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-gray-800 dark:text-gray-200">
                <FileText className="w-4 h-4 text-purple-500" />
                <span>TradeZen 知行合一日内笔记与交易反思</span>
              </div>
              {saveSuccess && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1 animate-in fade-in">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>笔记已保存</span>
                </span>
              )}
            </div>

            {/* Quick Tags Selection */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition ${
                      active
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/10 hover:border-purple-300'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            {/* Textarea */}
            <textarea
              rows={3}
              value={dailyNote}
              onChange={(e) => setDailyNote(e.target.value)}
              placeholder="记录当天的市场行情（如单边趋势/震荡磨损）、个人心态与心理状态、是否严格执行计划..."
              className="w-full text-xs p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-navy-950 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500 resize-none font-sans"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveNotes}
                className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>保存日记</span>
              </button>
            </div>
          </div>

          {/* Day Trades List Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-purple-500" />
                <span>当日执行订单明细 ({trades.length} 笔)</span>
              </h3>
              <span className="text-[11px] text-gray-400">点击「K线打点」查看入出场位置</span>
            </div>

            {trades.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400 dark:text-gray-500 rounded-xl border border-dashed border-gray-200 dark:border-white/10">
                当日无交易记录 (Rest Day)
              </div>
            ) : (
              <div className="space-y-2">
                {trades.map((t, idx) => {
                  const pnl = calculateTradePnL(t);
                  const dir = getTradeDirection(t);
                  const entry = getTradeEntryPrice(t);
                  const exit = getTradeExitPrice(t);
                  const size = getTradeSize(t);
                  const isMistake = isTradeMistake(t);
                  const tags = getTradeTags(t);

                  return (
                    <div
                      key={t.id || `trade-${idx}`}
                      className="p-3 rounded-xl bg-white dark:bg-navy-900/60 border border-gray-200 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-600/50 transition-all shadow-2xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                            {t.symbol}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${
                              dir === 'long'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {dir.toUpperCase()}
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            {size} Lots
                          </span>
                          {isMistake && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center space-x-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>失误</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center space-x-2">
                          <span
                            className={`font-mono font-bold text-sm ${
                              pnl >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {formatCurrency(pnl)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onOpenChart(t)}
                            className="px-2 py-1 rounded bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 text-[11px] font-semibold flex items-center space-x-1 transition active:scale-95"
                            title="在 TradingView K 线上回放买卖打点"
                          >
                            <LineChart className="w-3 h-3 text-purple-500" />
                            <span>K线打点</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-[11px] text-gray-500 dark:text-gray-400 font-mono border-t border-gray-100 dark:border-white/5 pt-1.5 min-w-0">
                        <div className="truncate">入场: <span className="text-gray-800 dark:text-gray-200 font-bold">{entry || '-'}</span></div>
                        <div className="truncate">出场: <span className="text-gray-800 dark:text-gray-200 font-bold">{exit || '-'}</span></div>
                        <div className="truncate">时间: <span className="text-gray-600 dark:text-gray-300">{getTradeEntryTime(t).substring(11, 16) || '-'}</span></div>
                        <div className="truncate">持仓: <span className="text-gray-600 dark:text-gray-300">{formatDurationShort(getTradeDurationMinutes(t) || 0)}</span></div>
                      </div>

                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {tags.map((tag, tagIdx) => (
                            <span
                              key={tagIdx}
                              className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-navy-800 text-[10px] text-gray-600 dark:text-gray-400 font-mono"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
};
