import TradeDrawer from '../components/TradeDrawer';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Star, ChevronLeft, ChevronRight, RefreshCw, Upload, Database, CheckCircle2, BarChart2, Calendar, PenLine, Trash2, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Zap } from 'lucide-react';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import DateRangePicker from '../components/common/DateRangePicker';
import CSVUploader from '../components/CSVUploader';
import TradeExecutionChart from '../components/TradeExecutionChart';
import ErrorBoundary from '../components/common/ErrorBoundary';
import TradeRatingModal from '../components/TradeRatingModal';
import TradeRatingAnimationOverlay, { RatingAnimationData } from '../components/TradeRatingAnimationOverlay';
import { getUserTrades, updateTrade, clearAllTrades, SERVER_BASE_URL as API_BASE_URL } from '../services/api';
import { useRealtimeTrades, RealtimeTradeEvent } from '../services/realtime';

interface Trade {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryprice: number;
  exitprice?: number;
  notes?: string;
  trade_date?: string;
  tags?: string[];
  sentiment?: string;
  createdat: string;
  updatedat?: string;
  screenshots?: string[];
  entry_time?: string;
  exit_time?: string;
  stop_loss?: number;
  take_profit?: number;
  entry_conditions?: string[];
  rating?: number;
  leverage?: number;
  manual_pnl?: number;
  session?: 'Asia' | 'Europe' | 'US';
  final_trigger?: 'takeProfit' | 'stopLoss';
}

const formatDuration = (entryTime?: string, exitTime?: string): string => {
  if (!entryTime || !exitTime) return '-';
  const start = new Date(entryTime).getTime();
  const end = new Date(exitTime).getTime();
  const diff = end - start;
  if (isNaN(diff) || diff < 0) return '-';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
};

const calculateTradePnL = (trade: Trade): { pnl: number; pnlPercent: number; rr: number | null; targetRR: number | null; isManual: boolean } | null => {
  if (!trade.exitprice || !trade.entryprice || trade.size <= 0) return null;
  const leverage = trade.leverage && trade.leverage >= 1 ? trade.leverage : 1;
  const isManual = trade.manual_pnl !== undefined && trade.manual_pnl !== null && !isNaN(trade.manual_pnl);

  const diff = trade.direction === 'long'
    ? trade.exitprice - trade.entryprice
    : trade.entryprice - trade.exitprice;

  const pnl = isManual ? trade.manual_pnl! : diff * trade.size * leverage;
  const cost = trade.entryprice * trade.size;
  const pnlPercent = isManual
    ? (cost > 0 ? (pnl / cost) * 100 : 0)
    : (diff / trade.entryprice) * 100 * leverage;

  let rr: number | null = null;
  if (trade.stop_loss && trade.entryprice) {
    const riskPerUnit = Math.abs(trade.entryprice - trade.stop_loss);
    if (riskPerUnit > 0) {
      if (isManual && diff !== 0) {
        // 当存在券商实际净盈亏 (manual_pnl) 且有实际价差时：
        // 实际每点价值 (Point Value) = |pnl| / |diff|
        // 真实单笔风险金额 (Dollar Risk) = riskPerUnit * Point Value
        // 实现盈亏比 = pnl / Dollar Risk = Math.sign(pnl) * (|diff| / riskPerUnit)
        // 消除由于原油(100/1000)、黄金(100)、股指、外汇等不同合约乘数导致的量纲失真！
        const sign = pnl === 0 ? 0 : pnl > 0 ? 1 : -1;
        rr = sign * (Math.abs(diff) / riskPerUnit);
      } else {
        rr = diff / riskPerUnit;
      }
    }
  }

  return { pnl, pnlPercent, rr, targetRR: null, isManual };
};

const calculateTargetRR = (trade: Trade): number | null => {
  if (!trade.stop_loss || !trade.take_profit || !trade.entryprice) return null;
  const risk = Math.abs(trade.entryprice - trade.stop_loss);
  const reward = Math.abs(trade.take_profit - trade.entryprice);
  if (risk === 0) return null;
  return reward / risk;
};

type ExitMethodType = 'takeProfit' | 'stopLoss' | 'manual';
const SENTIMENT_EMOJI: Record<string, string> = { Nervous: '😰', Uneasy: '😟', Neutral: '😐', Composed: '😌', Zen: '🧘' };
const calculateExitMethod = (trade: Trade): ExitMethodType | null => {
  // 1. 优先使用终局触发标记 (例如 MT5 / 券商同步的 [tp] / [sl] 触发)
  if (trade.final_trigger === 'takeProfit') return 'takeProfit';
  if (trade.final_trigger === 'stopLoss') return 'stopLoss';

  // 2. 兼容历史数据在 notes 中带有 MT5 SL/TP 触发标记的情况
  if (trade.notes) {
    const lower = trade.notes.toLowerCase();
    if (lower.includes('[tp') || lower.includes('take profit')) return 'takeProfit';
    if (lower.includes('[sl') || lower.includes('stop loss')) return 'stopLoss';
  }

  // 3. 若未平仓，则无平仓方式
  if (trade.exitprice == null) return null;

  const exit = trade.exitprice;
  const sl = trade.stop_loss;
  const tp = trade.take_profit;

  // 4. 根据多空方向与止盈/止损价格推算
  if (trade.direction === 'long') {
    if (tp != null && exit >= tp) return 'takeProfit';
    if (sl != null && exit <= sl) return 'stopLoss';
    return 'manual';
  } else {
    if (tp != null && exit <= tp) return 'takeProfit';
    if (sl != null && exit >= sl) return 'stopLoss';
    return 'manual';
  }
};

// 后端返回的时间字符串视为本地时间（无时区），直接字符串处理避免时区偏移
// 数据库存什么显示什么，不做任何转换
const parseServerTime = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  // 将 "2026-08-09 11:13:00" 或 "2026-08-09T11:13:00" 转为 "2026-08-09T11:13"
  // 不加 Z 后缀，让 new Date() 按本地时区解析
  const normalized = dateStr.replace(' ', 'T').slice(0, 16);
  const d = new Date(normalized);
  return isNaN(d.getTime()) ? null : d;
};

const getTradeDurationMs = (entryTime?: string, exitTime?: string): number => {
  if (!entryTime || !exitTime) return -1;
  const start = parseServerTime(entryTime)?.getTime() ?? new Date(entryTime.replace(' ', 'T')).getTime();
  const end = parseServerTime(exitTime)?.getTime() ?? new Date(exitTime.replace(' ', 'T')).getTime();
  if (isNaN(start) || isNaN(end)) return -1;
  const diff = end - start;
  return diff >= 0 ? diff : -1;
};

const getTradePnlValue = (trade: Trade): number | null => {
  if (trade.manual_pnl !== undefined && trade.manual_pnl !== null && !isNaN(trade.manual_pnl)) {
    return trade.manual_pnl;
  }
  const calculated = calculateTradePnL(trade);
  if (calculated !== null && calculated.pnl !== undefined && !isNaN(calculated.pnl)) {
    return calculated.pnl;
  }
  return null;
};

const getTradeRatingValue = (trade: Trade): number => {
  return typeof trade.rating === 'number' && !isNaN(trade.rating) && trade.rating > 0 ? trade.rating : 0;
};

const getTradeSizeValue = (trade: Trade): number | null => {
  if (typeof trade.size === 'number' && !isNaN(trade.size)) {
    return trade.size;
  }
  return null;
};

const getTradeRRValue = (trade: Trade): number | null => {
  const calculated = calculateTradePnL(trade);
  if (calculated && calculated.rr != null && !isNaN(calculated.rr)) {
    return calculated.rr;
  }
  return null;
};

const formatLocalTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  // 直接字符串截取显示，不走 Date 对象避免任何时区转换
  const normalized = dateStr.replace(' ', 'T');
  // 格式 "2026-08-09T11:13" 或 "2026-08-09T11:13:00.000Z"
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return '-';
  return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
};

const formatLocalTimeFull = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const normalized = dateStr.replace(' ', 'T');
  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return '-';
  return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
};

interface TradeSourceInfo {
  type: 'synced' | 'manual';
  label: string;
}

const getTradeSource = (trade: Trade): TradeSourceInfo => {
  const tags = Array.isArray(trade.tags)
    ? trade.tags
    : typeof trade.tags === 'string'
    ? (() => {
        try {
          const parsed = JSON.parse(trade.tags);
          return Array.isArray(parsed) ? parsed : [trade.tags];
        } catch {
          return (trade.tags as string).split(',').map((s) => s.trim()).filter(Boolean);
        }
      })()
    : [];

  const tagsLower = tags.map((t: string) => String(t).toLowerCase());
  const notesLower = String(trade.notes || '').toLowerCase();

  if (tagsLower.some((t: string) => t.includes('mt5') || t.includes('metatrader 5'))) {
    return { type: 'synced', label: 'MT5 同步' };
  }
  if (tagsLower.some((t: string) => t.includes('mt4') || t.includes('metatrader 4'))) {
    return { type: 'synced', label: 'MT4 导入' };
  }
  if (tagsLower.some((t: string) => t.includes('ctrader'))) {
    return { type: 'synced', label: 'cTrader 导入' };
  }
  if (notesLower.includes('自动同步') || notesLower.includes('mt5') || notesLower.includes('mt4')) {
    return { type: 'synced', label: '实盘同步' };
  }
  if (notesLower.includes('导入') || notesLower.includes('ticket/id:') || notesLower.includes('ticket:')) {
    return { type: 'synced', label: '报表同步' };
  }
  if (tagsLower.some((t: string) => t === 'csv' || t === 'sync' || t === 'import')) {
    return { type: 'synced', label: '实盘同步' };
  }

  return { type: 'manual', label: '手动新增' };
};

const isToday = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const date = parseServerTime(dateStr);
  if (!date) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
};

const sortByEntryTimeDesc = (a: Trade, b: Trade): number => {
  const timeA = a.entry_time ? (parseServerTime(a.entry_time)?.getTime() || 0) : (parseServerTime(a.createdat)?.getTime() || 0);
  const timeB = b.entry_time ? (parseServerTime(b.entry_time)?.getTime() || 0) : (parseServerTime(b.createdat)?.getTime() || 0);
  return timeB - timeA;
};

const generatePageNumbers = (current: number, total: number): (number | string)[] => {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
};

type SortField = 'entry_time' | 'size' | 'duration' | 'pnl' | 'rr' | 'rating';
type SortOrder = 'asc' | 'desc';

const getSortFieldLabel = (field: SortField): string => {
  switch (field) {
    case 'size':
      return '手数';
    case 'duration':
      return '持仓时长';
    case 'pnl':
      return '平仓净盈亏';
    case 'rr':
      return '盈亏比';
    case 'rating':
      return '纪律评分';
    case 'entry_time':
    default:
      return '入场时间';
  }
};

const TradesPage: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('entry_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  const [chartModalTrade, setChartModalTrade] = useState<Trade | null>(null);
  const [ratingModalTrade, setRatingModalTrade] = useState<Trade | null>(null);
  const [ratingAnimationData, setRatingAnimationData] = useState<RatingAnimationData | null>(null);

  const [lightboxImage, setLightboxImage] = useState<{ urls: string[]; index: number } | null>(null);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchEntryDateStart, setSearchEntryDateStart] = useState('');
  const [searchEntryDateEnd, setSearchEntryDateEnd] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchDirection, setSearchDirection] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [searchExitMethod, setSearchExitMethod] = useState('');
  const [searchSource, setSearchSource] = useState('');
  const [quickFilter, setQuickFilter] = useState('today');
  const [showUploader, setShowUploader] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState<string | null>(null);
  const [importSuccessBanner, setImportSuccessBanner] = useState<{ message: string; count?: number; platform?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);
  const navigate = useNavigate();

  const handleUploadSuccess = async (info?: { count?: number; message?: string; platform?: string }) => {
    // 1. 自动切换为“全部”视图，重置分页到第 1 页，确保导入的各历史时间段交易立即可见
    setSearchEntryDateStart('');
    setSearchEntryDateEnd('');
    setQuickFilter('all');
    setCurrentPage(1);

    // 2. 重新调用交易明细接口获取最新数据
    await fetchTrades();

    // 3. 展现醒目的全局成功提示
    const msg = info?.message || (info?.count !== undefined && info.count > 0 
      ? `成功从 ${info.platform || '报表'} 导入 ${info.count} 笔交易，交易明细已自动刷新！` 
      : '交易报表解析导入完成，交易明细已自动刷新！');

    setImportSuccessBanner({
      message: msg,
      count: info?.count,
      platform: info?.platform,
    });

    // 8 秒后自动关闭全局 Banner
    setTimeout(() => {
      setImportSuccessBanner(null);
    }, 8000);
  };

  const handleClearAllTrades = async () => {
    try {
      setClearing(true);
      const res = await clearAllTrades();
      setShowClearModal(false);
      setClearSuccessMsg(res?.message || '全部历史交易订单已清空');
      setTimeout(() => setClearSuccessMsg(null), 4000);
      await fetchTrades();
    } catch (err: any) {
      alert(err.message || '清空历史订单失败');
    } finally {
      setClearing(false);
    }
  };

  // 实时订单推送状态与自动刷新
  const [livePushToast, setLivePushToast] = useState<{
    message: string;
    count?: number;
    source?: string;
    timestamp: number;
  } | null>(null);

  const handleRealtimeUpdate = useCallback((event: RealtimeTradeEvent) => {
    // 收到服务端推送后，毫秒级自动重新拉取订单列表更新页面数据
    fetchTrades();

    const src = event.source || (event.platform ? `${event.platform} 自动直推` : '实盘同步');
    const countText = event.count !== undefined && event.count > 0 ? ` (${event.count} 笔)` : '';
    const msg = event.message || `收到 ${src} 实时订单推送${countText}，明细列表已自动刷新！`;

    setLivePushToast({
      message: msg,
      count: event.count,
      source: src,
      timestamp: Date.now(),
    });

    setTimeout(() => {
      setLivePushToast(prev => (prev?.timestamp === event.timestamp ? null : prev));
    }, 6000);
  }, []);

  const { isConnected: isRealtimeConnected } = useRealtimeTrades(handleRealtimeUpdate);

  const handleAddClick = () => {
    setEditingTrade(null);
    setIsDrawerOpen(true);
  };

  const handleEditClick = (trade: Trade) => {
    setEditingTrade(trade);
    setIsDrawerOpen(true);
  };

  const handleDetailClick = (trade: Trade) => {
    setViewingTrade(trade);
  };

  const handleSaveRating = async (tradeId: number, newRating: number) => {
    const activeToken = localStorage.getItem('token');
    const targetTrade = trades.find((t) => t.id === tradeId) || ratingModalTrade;

    // 1. 点完星星后立即关闭弹窗
    setRatingModalTrade(null);

    // 2. 弹窗关闭后再出动效 (Rating > 0 时触发专属动效)
    if (newRating > 0 && targetTrade) {
      setRatingAnimationData({
        rating: newRating,
        symbol: targetTrade.symbol,
        tradeId: targetTrade.id,
      });
    }

    // 3. 立即响应式更新本地列表
    setTrades((prev) =>
      prev.map((t) => (t.id === tradeId ? { ...t, rating: newRating === 0 ? undefined : newRating } : t))
    );

    if (!activeToken) return;
    try {
      await updateTrade(activeToken, tradeId, { rating: newRating === 0 ? null : newRating });
    } catch (err) {
      console.error('Failed to update trade discipline rating:', err);
    }
  };

  const handleReset = () => {
    setSearchSymbol('');
    setSearchStatus('');
    setSearchDirection('');
    setSearchResult('');
    setSearchExitMethod('');
    setSearchSource('');
    setSearchEntryDateStart('');
    setSearchEntryDateEnd('');
    setSortField('entry_time');
    setSortOrder('desc');
    handleQuickFilter('today');
  };

  const handleQuickFilter = (filter: string) => {
    const now = new Date();
    const startDate = new Date();
    if (filter === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    } else if (filter === 'year') {
      startDate.setMonth(0, 1);
      startDate.setHours(0, 0, 0, 0);
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
    const endStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    setSearchEntryDateStart(startStr);
    setSearchEntryDateEnd(endStr);
    setQuickFilter(filter);
  };


  const fetchTrades = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found. Please log in.');
        setLoading(false);
        return;
      }

      const data = await getUserTrades(token);
      setTrades([...data].sort(sortByEntryTimeDesc));
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Failed to fetch trades.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const start = params.get('start');
    const end = params.get('end');
    const quick = params.get('quick');
    if (start && end) {
      setSearchEntryDateStart(start);
      setSearchEntryDateEnd(end);
      setQuickFilter('');
    } else if (quick === 'month' || quick === 'year') {
      handleQuickFilter(quick);
    } else if (quick === 'all') {
      setSearchEntryDateStart('');
      setSearchEntryDateEnd('');
      setQuickFilter('');
    } else {
      handleQuickFilter(quickFilter);
    }
    fetchTrades();
  }, []);

  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxImage(null);
      } else if (e.key === 'ArrowLeft' && lightboxImage.urls.length > 1) {
        setLightboxImage({ ...lightboxImage, index: (lightboxImage.index - 1 + lightboxImage.urls.length) % lightboxImage.urls.length });
      } else if (e.key === 'ArrowRight' && lightboxImage.urls.length > 1) {
        setLightboxImage({ ...lightboxImage, index: (lightboxImage.index + 1) % lightboxImage.urls.length });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxImage]);

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (searchSymbol && !trade.symbol.toLowerCase().includes(searchSymbol.toLowerCase())) return false;
      if (searchEntryDateStart || searchEntryDateEnd) {
        const entryDate = trade.entry_time || trade.createdat;
        if (!entryDate) return false;
        const entryDateStr = entryDate.substring(0, 10);
        if (searchEntryDateStart && entryDateStr < searchEntryDateStart) return false;
        if (searchEntryDateEnd && entryDateStr > searchEntryDateEnd) return false;
      }
      if (searchStatus) {
        const isCompleted = !!trade.exitprice;
        if (searchStatus === 'completed' && !isCompleted) return false;
        if (searchStatus === 'in_progress' && isCompleted) return false;
      }
      if (searchDirection && trade.direction !== searchDirection) return false;
      if (searchExitMethod) {
        const method = calculateExitMethod(trade);
        if (!method || method !== searchExitMethod) return false;
      }
      if (searchSource) {
        const src = getTradeSource(trade).type;
        if (searchSource !== src) return false;
      }
      if (searchResult) {
        if (!trade.exitprice) return false;
        const pnlValue = calculateTradePnL(trade)?.pnl || 0;
        if (searchResult === 'profit' && pnlValue <= 0) return false;
        if (searchResult === 'loss' && pnlValue >= 0) return false;
        if (searchResult === 'breakeven' && pnlValue !== 0) return false;
      }
      return true;
    });
  }, [trades, searchSymbol, searchEntryDateStart, searchEntryDateEnd, searchStatus, searchDirection, searchExitMethod, searchSource, searchResult]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-400/70 group-hover:text-gray-600 dark:text-gray-500/70 dark:group-hover:text-gray-300 transition-colors inline-block" />
      );
    }
    if (sortOrder === 'asc') {
      return (
        <ArrowUp className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5] inline-block" />
      );
    }
    return (
      <ArrowDown className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 stroke-[2.5] inline-block" />
    );
  };

  const availableSymbols = useMemo(() => {
    const symbols = new Set<string>();
    trades.forEach((t) => { if (t.symbol) symbols.add(t.symbol); });
    return Array.from(symbols).sort();
  }, [trades]);

  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));

  // 当筛选条件、排序或每页条数发生变动时，自动回退到第 1 页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchSymbol, searchEntryDateStart, searchEntryDateEnd, searchStatus, searchDirection, searchExitMethod, searchSource, searchResult, quickFilter, pageSize, sortField, sortOrder]);

  // 根据当前排序规则全量排序过滤后的交易订单
  const sortedTrades = useMemo(() => {
    const list = [...filteredTrades];
    return list.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'size') {
        const sizeA = getTradeSizeValue(a);
        const sizeB = getTradeSizeValue(b);
        if (sizeA === null && sizeB === null) {
          comparison = 0;
        } else if (sizeA === null) {
          return 1;
        } else if (sizeB === null) {
          return -1;
        } else {
          comparison = sortOrder === 'desc' ? sizeB - sizeA : sizeA - sizeB;
        }
      } else if (sortField === 'pnl') {
        const pnlA = getTradePnlValue(a);
        const pnlB = getTradePnlValue(b);
        if (pnlA === null && pnlB === null) {
          comparison = 0;
        } else if (pnlA === null) {
          return 1;
        } else if (pnlB === null) {
          return -1;
        } else {
          comparison = sortOrder === 'desc' ? pnlB - pnlA : pnlA - pnlB;
        }
      } else if (sortField === 'duration') {
        const durA = getTradeDurationMs(a.entry_time, a.exit_time);
        const durB = getTradeDurationMs(b.entry_time, b.exit_time);
        if (durA < 0 && durB < 0) {
          comparison = 0;
        } else if (durA < 0) {
          return 1;
        } else if (durB < 0) {
          return -1;
        } else {
          comparison = sortOrder === 'desc' ? durB - durA : durA - durB;
        }
      } else if (sortField === 'rr') {
        const rrA = getTradeRRValue(a);
        const rrB = getTradeRRValue(b);
        if (rrA === null && rrB === null) {
          comparison = 0;
        } else if (rrA === null) {
          return 1;
        } else if (rrB === null) {
          return -1;
        } else {
          comparison = sortOrder === 'desc' ? rrB - rrA : rrA - rrB;
        }
      } else if (sortField === 'rating') {
        const ratingA = getTradeRatingValue(a);
        const ratingB = getTradeRatingValue(b);
        if (ratingA === 0 && ratingB === 0) {
          comparison = 0;
        } else if (ratingA === 0) {
          return 1;
        } else if (ratingB === 0) {
          return -1;
        } else {
          comparison = sortOrder === 'desc' ? ratingB - ratingA : ratingA - ratingB;
        }
      } else {
        // 'entry_time' (默认入场时间排序)
        const timeA = a.entry_time ? (parseServerTime(a.entry_time)?.getTime() || 0) : (parseServerTime(a.createdat)?.getTime() || 0);
        const timeB = b.entry_time ? (parseServerTime(b.entry_time)?.getTime() || 0) : (parseServerTime(b.createdat)?.getTime() || 0);
        comparison = sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }

      if (comparison === 0) {
        return sortByEntryTimeDesc(a, b);
      }
      return comparison;
    });
  }, [filteredTrades, sortField, sortOrder]);

  // 根据当前页码与每页条数切片数据
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTrades.slice(start, start + pageSize);
  }, [sortedTrades, currentPage, pageSize]);

  if (loading && trades.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-purple-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading trades...</p>
      </div>
    );
  }

  if (error && trades.length === 0) {
    return <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-red-500">{error}</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* MT5 实盘订单同步 & CSV 导入 面板 */}
      {showUploader && (
        <div className="mb-6 p-5 sm:p-6 bg-white dark:bg-[#0b0f19] rounded-2xl shadow-xl border border-purple-200 dark:border-purple-800/70 animate-in fade-in duration-200 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-32 bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-white/10 relative">
            <div className="flex items-center space-x-2.5">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                实盘交易订单同步 (MQL EA 直推 / 离线报表导入)
              </h3>
            </div>
            <button 
              onClick={() => setShowUploader(false)} 
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition"
              title="收起订单同步面板"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <CSVUploader onUploadSuccess={handleUploadSuccess} />
        </div>
      )}

      {/* 导入成功全局醒目通知 Banner */}
      {importSuccessBanner && (
        <div className="mb-5 p-4 bg-emerald-50/95 dark:bg-emerald-950/50 border border-emerald-300/80 dark:border-emerald-700/70 rounded-2xl flex items-center justify-between text-sm text-emerald-900 dark:text-emerald-100 shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 rounded-xl text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base">{importSuccessBanner.message}</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                  交易明细已更新
                </span>
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300/90 mt-0.5">
                系统已自动切换至「全部历史」视图，最新导入的平仓交易已展示在下方表格中。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setImportSuccessBanner(null)}
            className="text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 p-1.5 rounded-lg hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40 transition cursor-pointer"
            title="关闭提示"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 实时自动推送更新通知 Banner */}
      {livePushToast && (
        <div className="mb-5 p-4 bg-gradient-to-r from-purple-50/95 via-indigo-50/95 to-emerald-50/95 dark:from-purple-950/60 dark:via-indigo-950/60 dark:to-emerald-950/60 border border-purple-300 dark:border-purple-700/80 rounded-2xl flex items-center justify-between text-sm text-purple-950 dark:text-purple-100 shadow-md animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start sm:items-center space-x-3">
            <div className="p-2 bg-purple-600 text-white rounded-xl shadow-xs animate-pulse">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-base text-gray-900 dark:text-white">
                  {livePushToast.message}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping mr-1.5" />
                  实时推送到屏已生效
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                来源: {livePushToast.source || '远程 EA / 终端直推'} • 页面已完成自动拉取与排序展示，无需手动刷新。
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLivePushToast(null)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
            title="关闭提示"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="relative z-30 mb-6 bg-white/90 dark:bg-[#0b0f19]/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-gray-200/80 dark:border-white/10 shadow-sm space-y-3.5">
        {/* Top Filter Controls: Search & Select Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[160px]">
            <input
              type="text"
              placeholder="搜索标的"
              value={searchSymbol}
              onChange={(e) => setSearchSymbol(e.target.value)}
              className="w-full h-[38px] px-3.5 text-sm border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 hover:border-purple-400 dark:hover:border-purple-500/80 bg-white dark:bg-[#070a13] text-gray-900 dark:text-white transition shadow-2xs"
            />
          </div>
          <div className="min-w-[130px]">
            <Select
              value={searchStatus}
              onChange={setSearchStatus}
              placeholder="全部状态"
              options={[
                { value: '', label: '全部状态' },
                { value: 'completed', label: '已平仓结算' },
                { value: 'in_progress', label: '持仓中' },
              ]}
              className="w-full"
            />
          </div>
          <div className="min-w-[130px]">
            <Select
              value={searchResult}
              onChange={setSearchResult}
              placeholder="全部盈亏"
              options={[
                { value: '', label: '全部盈亏' },
                { value: 'profit', label: '盈利' },
                { value: 'loss', label: '亏损' },
                { value: 'breakeven', label: '保本' },
              ]}
              className="w-full"
            />
          </div>
          <div className="min-w-[130px]">
            <Select
              value={searchSource}
              onChange={setSearchSource}
              placeholder="全部来源"
              options={[
                { value: '', label: '全部来源' },
                { value: 'manual', label: '手动新增' },
                { value: 'synced', label: '实盘/报表同步' },
              ]}
              className="w-full"
            />
          </div>
          <div className="min-w-[140px]">
            <Select
              value={searchExitMethod}
              onChange={setSearchExitMethod}
              placeholder="全部平仓方式"
              options={[
                { value: '', label: '全部平仓方式' },
                { value: 'takeProfit', label: '止盈触发' },
                { value: 'stopLoss', label: '止损触发' },
                { value: 'manual', label: '手动平仓' },
              ]}
              className="w-full"
            />
          </div>
        </div>

        {/* Bottom Bar: Time Range on Left, Action Buttons Fixed to the Right */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Time Filters: Quick Presets & Modern Date Range Picker */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Date Filters - Radio Style */}
            <div className="h-[38px] flex items-center gap-1 bg-gray-100/80 dark:bg-[#070a13] rounded-xl p-1 border border-gray-200/80 dark:border-white/10 shadow-2xs">
              {[
                { value: 'today', label: '今日' },
                { value: 'week', label: '本周' },
                { value: 'month', label: '本月' },
                { value: 'year', label: '今年' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleQuickFilter(option.value)}
                  className={`h-full text-sm px-3 rounded-lg font-medium transition-all flex items-center justify-center ${
                    quickFilter === option.value
                      ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white font-semibold shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setQuickFilter('');
                  setSearchEntryDateStart('');
                  setSearchEntryDateEnd('');
                }}
                className={`h-full text-sm px-3 rounded-lg font-medium transition-all flex items-center justify-center ${
                  quickFilter === '' && !searchEntryDateStart && !searchEntryDateEnd
                    ? 'bg-white dark:bg-purple-600 text-purple-700 dark:text-white font-semibold shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                全部
              </button>
            </div>

            {/* Modern Mainstream Date Range Picker */}
            <DateRangePicker
              startDate={searchEntryDateStart}
              endDate={searchEntryDateEnd}
              onChange={(start, end) => {
                setSearchEntryDateStart(start);
                setSearchEntryDateEnd(end);
                setQuickFilter('custom');
              }}
              onClear={() => {
                setSearchEntryDateStart('');
                setSearchEntryDateEnd('');
                setQuickFilter('');
              }}
            />
          </div>

          {/* Action Buttons: FIXED TO THE RIGHT (固定靠右) */}
          <div className="flex items-center gap-2.5 ml-auto">
            {/* Realtime Push Stream Status Badge */}
            <div 
              className={`hidden md:inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                isRealtimeConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-700/80 shadow-2xs'
                  : 'bg-gray-50 dark:bg-navy-900/40 text-gray-400 border-gray-200 dark:border-gray-700'
              }`}
              title={isRealtimeConnected ? '实时推送在线：EA 或终端有新订单平仓时，系统将通过 SSE 长连接即时自动推送到页面刷新，无需手工点击' : '实时推送通道连接中...'}
            >
              <span className="flex h-2 w-2 relative">
                {isRealtimeConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isRealtimeConnected ? 'bg-emerald-500' : 'bg-gray-400'}`}></span>
              </span>
              <span>{isRealtimeConnected ? '实时推送到屏: 在线' : '实时通道: 连接中'}</span>
            </div>

            <Button
              variant="outline"
              onClick={handleReset}
              className="h-[38px] px-4 rounded-xl text-sm font-medium"
            >
              重置
            </Button>
            <Button
              variant="primary"
              onClick={handleAddClick}
              className="h-[38px] px-4 rounded-xl text-sm font-medium"
            >
              + 新建交易
            </Button>
            <Button 
              variant="primary"
              onClick={() => setShowUploader(prev => !prev)} 
              className="h-[38px] px-4 rounded-xl text-sm font-medium flex items-center space-x-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>订单同步</span>
            </Button>
          </div>
        </div>
      </div>

      <TradeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={fetchTrades}
        onDelete={fetchTrades}
        trade={editingTrade}
        availableSymbols={availableSymbols}
      />


      {viewingTrade && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black opacity-50"
            onClick={() => setViewingTrade(null)}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 z-50 h-full w-full md:w-1/2 bg-white dark:bg-gray-800 shadow-2xl">
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <div className="flex items-center space-x-2.5">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">交易复盘详情</h3>
                  {(() => {
                    const src = getTradeSource(viewingTrade);
                    return (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium flex items-center space-x-1 ${
                        src.type === 'synced'
                          ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                          : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                      }`}>
                        {src.type === 'synced' ? <RefreshCw className="w-2.5 h-2.5 mr-1" /> : <PenLine className="w-2.5 h-2.5 mr-1" />}
                        <span>{src.label}</span>
                      </span>
                    );
                  })()}
                </div>
                <button onClick={() => setViewingTrade(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* TradingView Execution Plotter on K-Line */}
                <div>
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>K线买卖执行打点 (TradingView Plotter)</span>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-mono font-normal">ENTRY / EXIT MARKERS</span>
                  </h4>
                  <ErrorBoundary fallbackTitle="单笔订单K线买卖执行打点图表加载异常">
                    <TradeExecutionChart
                      symbol={viewingTrade.symbol}
                      direction={viewingTrade.direction}
                      entryPrice={viewingTrade.entryprice}
                      exitPrice={viewingTrade.exitprice}
                      stopLoss={viewingTrade.stop_loss}
                      takeProfit={viewingTrade.take_profit}
                      entryTime={viewingTrade.entry_time}
                      exitTime={viewingTrade.exit_time}
                      size={viewingTrade.size}
                      profit={calculateTradePnL(viewingTrade)?.pnl}
                      pnlPercent={calculateTradePnL(viewingTrade)?.pnlPercent}
                      notes={viewingTrade.notes}
                      sentiment={viewingTrade.sentiment}
                      tags={viewingTrade.tags}
                      session={viewingTrade.session}
                      exitReason={calculateExitMethod(viewingTrade) || undefined}
                      height={320}
                    />
                  </ErrorBoundary>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">交易标的:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.symbol}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">交易方向:</span> <span className={`text-sm font-medium ${viewingTrade.direction === 'long' ? 'text-green-600' : 'text-red-600'}`}>{viewingTrade.direction === 'long' ? '做多 (Long)' : '做空 (Short)'}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">交易规模/手数:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.size}</span></div>
                  <div className="flex items-center gap-2"><span className="text-sm text-gray-500 dark:text-gray-400">结算状态:</span> {(() => { const isCompleted = !!viewingTrade.exitprice; return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{isCompleted ? '已平仓结算' : '持仓中'}</span>; })()}</div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">入场价格:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.entryprice}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">出场价格:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.exitprice || '-'}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">止损点位 (SL):</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.stop_loss || '-'}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">止盈点位 (TP):</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.take_profit || '-'}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">入场时间:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTime(viewingTrade.entry_time)}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">出场时间:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTime(viewingTrade.exit_time)}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">持仓时长:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDuration(viewingTrade.entry_time, viewingTrade.exit_time)}</span></div>
                  {(() => { const p = calculateTradePnL(viewingTrade); return p ? <div><span className="text-sm text-gray-500 dark:text-gray-400">净盈亏:{p.isManual ? ' (手动指定)' : ''}</span> <span className={`text-sm font-semibold ${p.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)} ({p.pnlPercent.toFixed(2)}%)</span></div> : null; })()}
                  {(() => { const tr = calculateTargetRR(viewingTrade); return tr != null ? <div><span className="text-sm text-gray-500 dark:text-gray-400">目标盈亏比 (Target R/R):</span> <span className="text-sm font-medium text-gray-900 dark:text-white">1 : {tr.toFixed(1)}</span></div> : null; })()}
                  {(() => { const p = calculateTradePnL(viewingTrade); return p?.rr != null ? <div><span className="text-sm text-gray-500 dark:text-gray-400">实际盈亏比 (Actual R/R):</span> <span className={`text-sm font-semibold ${p.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>1 : {Math.abs(p.rr).toFixed(1)}</span></div> : null; })()}
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">创建时间:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTimeFull(viewingTrade.createdat)}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">更新时间:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTimeFull(viewingTrade.updatedat)}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">交易时段:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.session ? `${viewingTrade.session} 盘` : '-'}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">入场心智/情绪:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.sentiment ? `${SENTIMENT_EMOJI[viewingTrade.sentiment] || ''} ${viewingTrade.sentiment}` : '-'}</span></div>
                  {(() => { const method = calculateExitMethod(viewingTrade); if (!method) return <div><span className="text-sm text-gray-500 dark:text-gray-400">平仓方式:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">-</span></div>; const styles: Record<ExitMethodType, string> = { takeProfit: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', stopLoss: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', manual: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }; const labels: Record<ExitMethodType, string> = { takeProfit: '止盈触发', stopLoss: '止损触发', manual: '手动平仓' }; return <div className="flex items-center gap-2"><span className="text-sm text-gray-500 dark:text-gray-400">平仓方式:</span><span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${styles[method]}`}>{labels[method]}</span></div>; })()}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-500 dark:text-gray-400">盈亏结果:</span>
                    {(() => { const p = calculateTradePnL(viewingTrade); if (!viewingTrade.exitprice) return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">-</span>; if (!p) return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">-</span>; if (p.pnl > 0) return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">盈利</span>; if (p.pnl < 0) return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">亏损</span>; return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">保本</span>; })()}</div>
                  {(() => { const rating = viewingTrade.rating || 0; if (rating <= 0) return null; return <div className="flex items-center gap-1"><span className="text-sm text-gray-500 dark:text-gray-400">纪律评分:</span><div className="flex items-center">{[1, 2, 3, 4, 5].map((star) => (<Star key={star} size={16} className={rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'} />))}</div></div>; })()}
                </div>
                {viewingTrade.tags && viewingTrade.tags.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">策略战法标签:</span>
                    <div className="flex flex-wrap gap-2">
                      {viewingTrade.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {viewingTrade.entry_conditions && viewingTrade.entry_conditions.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">入场条件与信号:</span>
                    <div className="flex flex-wrap gap-2">
                      {viewingTrade.entry_conditions.map((condition, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{condition}</span>
                      ))}
                    </div>
                  </div>
                )}
                {viewingTrade.notes && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">复盘心得与笔记:</span>
                    <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">{viewingTrade.notes}</p>
                  </div>
                )}
                {viewingTrade.screenshots && viewingTrade.screenshots.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-2">行情与图表截图:</span>
                    <div className="grid grid-cols-3 gap-2">
                      {viewingTrade.screenshots.map((url, i) => {
                        const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
                        return (
                          <img
                            key={i}
                            src={fullUrl}
                            alt={`Screenshot ${i + 1}`}
                            onClick={() => setLightboxImage({
                              urls: viewingTrade.screenshots!.map(u => u.startsWith('http') ? u : `${API_BASE_URL}${u}`),
                              index: i
                            })}
                            className="w-full h-20 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end p-4 border-t dark:border-gray-700">
                <Button variant="gradient" onClick={() => setViewingTrade(null)}>关闭</Button>
              </div>
            </div>
          </div>
        </>
      )}

      {lightboxImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800/70 rounded-full p-2 z-10"
            onClick={() => setLightboxImage(null)}
          >
            <X size={24} />
          </button>
          {lightboxImage.urls.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800/70 rounded-full p-2 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage({ ...lightboxImage, index: (lightboxImage.index - 1 + lightboxImage.urls.length) % lightboxImage.urls.length });
                }}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-gray-800/50 hover:bg-gray-800/70 rounded-full p-2 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxImage({ ...lightboxImage, index: (lightboxImage.index + 1) % lightboxImage.urls.length });
                }}
              >
                <ChevronRight size={24} />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-gray-800/50 px-3 py-1 rounded-full z-10">
                {lightboxImage.index + 1} / {lightboxImage.urls.length}
              </div>
            </>
          )}
          <img
            src={lightboxImage.urls[lightboxImage.index]}
            alt="Screenshot"
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}

      <div className="flex items-center justify-between mb-2.5 px-1">
        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono tracking-tight flex items-center space-x-1.5 flex-wrap">
          <span>显示</span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{filteredTrades.length}</span>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <span>共</span>
          <span className="font-semibold text-gray-700 dark:text-gray-300">{trades.length}</span>
          <span>笔交易记录</span>
          {sortField !== 'entry_time' && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 ml-2">
              当前排序: {getSortFieldLabel(sortField)} ({sortOrder === 'desc' ? '降序 ↓' : '升序 ↑'})
              <button
                type="button"
                onClick={() => { setSortField('entry_time'); setSortOrder('desc'); }}
                className="ml-1 text-purple-500 hover:text-purple-700 dark:hover:text-purple-200 font-bold cursor-pointer"
                title="恢复默认时间降序"
              >
                ×
              </button>
            </span>
          )}
          {clearSuccessMsg && (
            <span className="ml-3 text-xs text-emerald-600 dark:text-emerald-400 font-sans font-medium animate-in fade-in">
              ✓ {clearSuccessMsg}
            </span>
          )}
        </div>

        {trades.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClearModal(true)}
            className="text-[11px] text-gray-400/80 dark:text-gray-500/80 hover:text-red-500 dark:hover:text-red-400 transition-colors flex items-center space-x-1 px-2 py-0.5 rounded hover:bg-red-50/50 dark:hover:bg-red-950/20 cursor-pointer"
            title="一键清空全部历史交易订单数据"
          >
            <Trash2 className="w-3 h-3 text-gray-400/70 hover:text-red-500" />
            <span>清空全部订单</span>
          </button>
        )}
      </div>

      {/* 清空历史订单二次确认弹窗 */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f1422] rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 dark:border-white/10 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 mx-auto flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-gray-900 dark:text-white">
              确定要清空全部历史订单吗？
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              此操作将永久清空您当前账户下的全部 <b>{trades.length}</b> 笔历史交易记录，且<b>不可恢复</b>。
            </p>
            <div className="mt-5 flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={clearing}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleClearAllTrades}
                disabled={clearing}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl transition shadow-md flex items-center space-x-1.5"
              >
                {clearing && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>{clearing ? '正在清空...' : '确认一键清空'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#0b0f19] border border-gray-200/80 dark:border-white/10 shadow-sm rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse leading-normal">
            <thead>
              <tr className="bg-gray-50/90 dark:bg-[#070a13] border-b border-gray-200/80 dark:border-white/10 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                <th
                  className="px-3.5 py-3 whitespace-nowrap cursor-pointer select-none group hover:bg-gray-100/70 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => handleSort('entry_time')}
                  title="点击按入场时间排序"
                >
                  <div className="flex items-center space-x-1.5">
                    <span className={sortField === 'entry_time' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>入场时间</span>
                    {renderSortIcon('entry_time')}
                  </div>
                </th>
                <th className="px-3 py-3 whitespace-nowrap">标的代码</th>
                <th className="px-3 py-3 whitespace-nowrap">多空方向</th>
                <th
                  className="px-3 py-3 whitespace-nowrap cursor-pointer select-none group hover:bg-gray-100/70 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => handleSort('size')}
                  title="点击按手数排序"
                >
                  <div className="flex items-center space-x-1.5">
                    <span className={sortField === 'size' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>手数</span>
                    {renderSortIcon('size')}
                  </div>
                </th>
                <th className="px-3 py-3 whitespace-nowrap">平仓方式</th>
                <th
                  className="px-3 py-3 whitespace-nowrap cursor-pointer select-none group hover:bg-gray-100/70 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => handleSort('duration')}
                  title="点击按持仓时长排序"
                >
                  <div className="flex items-center space-x-1.5">
                    <span className={sortField === 'duration' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>持仓时长</span>
                    {renderSortIcon('duration')}
                  </div>
                </th>
                <th
                  className="px-3 py-3 whitespace-nowrap cursor-pointer select-none group hover:bg-gray-100/70 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => handleSort('pnl')}
                  title="点击按平仓净盈亏排序"
                >
                  <div className="flex items-center space-x-1.5">
                    <span className={sortField === 'pnl' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>平仓净盈亏</span>
                    {renderSortIcon('pnl')}
                  </div>
                </th>
                <th
                  className="px-3 py-3 whitespace-nowrap cursor-pointer select-none group hover:bg-gray-100/70 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => handleSort('rr')}
                  title="点击按盈亏比排序"
                >
                  <div className="flex items-center space-x-1.5">
                    <span className={sortField === 'rr' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>盈亏比</span>
                    {renderSortIcon('rr')}
                  </div>
                </th>
                <th
                  className="px-3 py-3 whitespace-nowrap cursor-pointer select-none group hover:bg-gray-100/70 dark:hover:bg-white/[0.04] transition-colors"
                  onClick={() => handleSort('rating')}
                  title="点击按纪律评分排序"
                >
                  <div className="flex items-center space-x-1.5">
                    <span className={sortField === 'rating' ? 'text-purple-600 dark:text-purple-400 font-bold' : ''}>纪律评分</span>
                    {renderSortIcon('rating')}
                  </div>
                </th>
                <th className="px-3 py-3 whitespace-nowrap">状态</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-left">操作</th>
              </tr>
            </thead>
            <tbody className="text-gray-900 dark:text-white divide-y divide-gray-100 dark:divide-white/5">
              {(() => {
                if (paginatedTrades.length > 0) {
                  return paginatedTrades.map((trade) => {
                    const pnl = calculateTradePnL(trade);
                    const targetRR = calculateTargetRR(trade);
                    const isCompleted = !!trade.exitprice;
                    return (
                      <tr key={trade.id} className="bg-white dark:bg-[#0b0f19] hover:bg-purple-50/30 dark:hover:bg-white/[0.02] transition-colors whitespace-nowrap">
                        <td className="px-3.5 py-3 text-xs font-mono text-gray-600 dark:text-gray-400">{formatLocalTime(trade.entry_time)}</td>
                        <td className="px-3 py-3 text-sm font-bold font-mono tracking-wide text-gray-900 dark:text-white whitespace-nowrap">{trade.symbol}</td>
                        <td className="px-3 py-3 text-xs">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                            trade.direction === 'long' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          }`}>
                            {trade.direction === 'long' ? '做多 BUY' : '做空 SELL'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">
                          {trade.size != null ? trade.size : '-'}
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">
                          {(() => {
                            const method = calculateExitMethod(trade);
                            if (!method) return <span className="text-gray-400">-</span>;
                            const styles: Record<ExitMethodType, string> = {
                              takeProfit: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50',
                              stopLoss: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50',
                              manual: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50',
                            };
                            const labels: Record<ExitMethodType, string> = {
                              takeProfit: '止盈触发',
                              stopLoss: '止损触发',
                              manual: '手动平仓',
                            };
                            return <span className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded-md ${styles[method]}`}>{labels[method]}</span>;
                          })()}
                        </td>
                        <td className="px-3 py-3 text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">
                          {formatDuration(trade.entry_time, trade.exit_time)}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {pnl ? (
                            <div className={`font-mono font-bold text-sm ${pnl.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {pnl.pnl >= 0 ? '+' : ''}${pnl.pnl.toFixed(2)}
                              <span className="text-[11px] font-normal opacity-75 block">({pnl.pnlPercent.toFixed(2)}%)</span>
                            </div>
                          ) : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="px-3 py-3 text-xs font-mono font-semibold text-gray-700 dark:text-gray-300">
                          {pnl?.rr != null ? `${pnl.rr.toFixed(1)}R` : '-'}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          <button
                            type="button"
                            onClick={() => setRatingModalTrade(trade)}
                            className="group/rating flex items-center p-1 -m-1 rounded-lg hover:bg-amber-500/10 dark:hover:bg-amber-500/20 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                            title="点击设置交易纪律评分"
                          >
                            <div className="flex items-center space-x-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={13}
                                  className={`transition-all duration-150 group-hover/rating:scale-110 ${
                                    (trade.rating || 0) >= star 
                                      ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_2px_rgba(251,191,36,0.5)]' 
                                      : 'text-gray-200 dark:text-gray-700'
                                  }`}
                                />
                              ))}
                            </div>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                            isCompleted 
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60' 
                              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isCompleted ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                            {isCompleted ? '已平仓' : '持仓中'}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-xs text-left">
                          <div className="flex items-center justify-start space-x-1.5">
                            <button
                              type="button"
                              onClick={() => setChartModalTrade(trade)}
                              className="px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg transition flex items-center space-x-1"
                              title="在 TradingView K 线上查看买卖打点"
                            >
                              <BarChart2 className="w-3 h-3" />
                              <span>K线</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDetailClick(trade)}
                              className="px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/60 rounded-lg transition"
                            >
                              详情
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditClick(trade)}
                              className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg transition"
                            >
                              编辑
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                }
                return (
                  <tr>
                    <td colSpan={11} className="text-center py-12 text-gray-500 dark:text-gray-400">
                      {loading ? '正在加载交易数据...' : (
                        <div className="flex flex-col items-center justify-center space-y-2.5">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">暂无交易记录</p>
                          <p className="text-xs text-gray-400 max-w-md">
                            当前筛选条件下暂无交易数据，您可以通过 MQL EA 插件自动推送，或上传 MT5 / MT4 报表文件。
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowUploader(true)}
                            className="mt-1 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl shadow-sm transition flex items-center space-x-1.5"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>立即同步实盘订单 / 导入 CSV 报表</span>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>

        {/* 分页控制栏 (默认每页 50 条) */}
        {filteredTrades.length > 0 && (
          <div className="px-4 py-3 bg-gray-50/70 dark:bg-[#070a13]/80 border-t border-gray-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
            {/* 左侧：条数显示与每页大小切换 */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="flex items-center space-x-1 font-mono">
                <span>显示第</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {(currentPage - 1) * pageSize + 1}
                </span>
                <span>-</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {Math.min(currentPage * pageSize, filteredTrades.length)}
                </span>
                <span>条，共</span>
                <span className="font-semibold text-purple-600 dark:text-purple-400">
                  {filteredTrades.length}
                </span>
                <span>条数据</span>
              </div>

              {/* 每页条数选择器 */}
              <div className="flex items-center space-x-1.5 pl-2 sm:pl-3 border-l border-gray-200 dark:border-white/10">
                <span>每页</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white dark:bg-[#0b0f19] border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 font-mono cursor-pointer"
                  title="选择每页显示条数"
                >
                  <option value={20}>20 条</option>
                  <option value={50}>50 条 (默认)</option>
                  <option value={100}>100 条</option>
                  <option value={200}>200 条</option>
                </select>
              </div>
            </div>

            {/* 右侧：页码导航与翻页操作 */}
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center space-x-0.5"
                title="上一页"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs">上一页</span>
              </button>

              {/* 页码按钮 */}
              <div className="flex items-center space-x-1 px-1">
                {generatePageNumbers(currentPage, totalPages).map((p, idx) => {
                  if (p === '...') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1.5 py-0.5 text-gray-400 select-none">
                        ...
                      </span>
                    );
                  }
                  const pageNum = Number(p);
                  const isActive = pageNum === currentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`min-w-[28px] h-7 px-2 text-xs font-mono font-medium rounded-lg transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white font-bold shadow-sm'
                          : 'border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center space-x-0.5"
                title="下一页"
              >
                <span className="hidden sm:inline text-xs">下一页</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Trade Execution Chart Modal (TradingView 独立弹窗) */}
      {chartModalTrade && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setChartModalTrade(null)}
          />
          <div className="fixed inset-4 sm:inset-10 lg:inset-20 z-50 flex flex-col bg-white dark:bg-[#0b0f19] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center space-x-3">
                <span className="p-2 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                  <BarChart2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                    <span>{chartModalTrade.symbol} 交易执行打点与行情走势</span>
                    <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                      #{chartModalTrade.id}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    入场: {chartModalTrade.entryprice} | 出场: {chartModalTrade.exitprice || '-'} | 规模: {chartModalTrade.size}手
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChartModalTrade(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
              <ErrorBoundary fallbackTitle="交易执行打点与行情走势图表加载异常">
                <TradeExecutionChart
                  symbol={chartModalTrade.symbol}
                  direction={chartModalTrade.direction}
                  entryPrice={chartModalTrade.entryprice}
                  exitPrice={chartModalTrade.exitprice}
                  stopLoss={chartModalTrade.stop_loss}
                  takeProfit={chartModalTrade.take_profit}
                  entryTime={chartModalTrade.entry_time}
                  exitTime={chartModalTrade.exit_time}
                  size={chartModalTrade.size}
                  profit={calculateTradePnL(chartModalTrade)?.pnl}
                  pnlPercent={calculateTradePnL(chartModalTrade)?.pnlPercent}
                  notes={chartModalTrade.notes}
                  sentiment={chartModalTrade.sentiment}
                  tags={chartModalTrade.tags}
                  session={chartModalTrade.session}
                  exitReason={calculateExitMethod(chartModalTrade) || undefined}
                  height={520}
                  className="h-full"
                />
              </ErrorBoundary>
            </div>
          </div>
        </>
      )}
      {/* Quick Trade Discipline Rating Modal */}
      <TradeRatingModal
        isOpen={!!ratingModalTrade}
        trade={ratingModalTrade}
        onClose={() => setRatingModalTrade(null)}
        onSelectRating={handleSaveRating}
      />

      {/* Post-Rating Animation Overlay (点完星星之后关闭弹窗后再出动效) */}
      <TradeRatingAnimationOverlay
        data={ratingAnimationData}
        onClose={() => setRatingAnimationData(null)}
      />
    </div>
  );
};

export default TradesPage;