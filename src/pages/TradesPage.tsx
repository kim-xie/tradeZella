import TradeDrawer from '../components/TradeDrawer';
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import { getUserTrades, deleteTrade, SERVER_BASE_URL as API_BASE_URL } from '../services/api';

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
  // 优先使用手动输入的 PnL
  if (trade.manual_pnl !== undefined && trade.manual_pnl !== null && !isNaN(trade.manual_pnl)) {
    const cost = trade.entryprice * trade.size;
    const pnlPercent = cost > 0 ? (trade.manual_pnl / cost) * 100 : 0;
    let rr: number | null = null;
    if (trade.stop_loss && trade.entryprice) {
      const riskPerUnit = Math.abs(trade.entryprice - trade.stop_loss);
      if (riskPerUnit > 0) {
        const maxRisk = riskPerUnit * trade.size;
        rr = trade.manual_pnl / maxRisk;
      }
    }
    return { pnl: trade.manual_pnl, pnlPercent, rr, targetRR: null, isManual: true };
  }
  const diff = trade.direction === 'long'
    ? trade.exitprice - trade.entryprice
    : trade.entryprice - trade.exitprice;
  const pnl = diff * trade.size * leverage;
  const pnlPercent = (diff / trade.entryprice) * 100 * leverage;
  let rr: number | null = null;
  if (trade.stop_loss && trade.entryprice) {
    const riskPerUnit = Math.abs(trade.entryprice - trade.stop_loss);
    if (riskPerUnit > 0) {
      const maxRisk = riskPerUnit * trade.size * leverage;
      rr = pnl / maxRisk;
    }
  }
  return { pnl, pnlPercent, rr, targetRR: null, isManual: false };
};

const calculateTargetRR = (trade: Trade): number | null => {
  if (!trade.stop_loss || !trade.take_profit || !trade.entryprice) return null;
  const risk = Math.abs(trade.entryprice - trade.stop_loss);
  const reward = Math.abs(trade.take_profit - trade.entryprice);
  if (risk === 0) return null;
  return reward / risk;
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

const TradesPage: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [viewingTrade, setViewingTrade] = useState<Trade | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ urls: string[]; index: number } | null>(null);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchEntryDateStart, setSearchEntryDateStart] = useState('');
  const [searchEntryDateEnd, setSearchEntryDateEnd] = useState('');
  const [searchStatus, setSearchStatus] = useState('');
  const [searchDirection, setSearchDirection] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [searchSession, setSearchSession] = useState('');
  const [quickFilter, setQuickFilter] = useState('');
  const navigate = useNavigate();

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

  const handleReset = () => {
    setSearchSymbol('');
    setSearchEntryDateStart('');
    setSearchEntryDateEnd('');
    setSearchStatus('');
    setSearchDirection('');
    setSearchResult('');
    setSearchSession('');
    setQuickFilter('');
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

  const handleDeleteClick = async (tradeId: number) => {
    setDeletingId(tradeId);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please log in to delete a trade.');
      setDeletingId(null);
      return;
    }
    try {
      await deleteTrade(token, deletingId);
      fetchTrades();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete trade.');
    } finally {
      setDeletingId(null);
    }
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
      if (searchSession && trade.session !== searchSession) return false;
      if (searchResult) {
        if (!trade.exitprice) return false;
        const pnlValue = calculateTradePnL(trade)?.pnl || 0;
        if (searchResult === 'profit' && pnlValue <= 0) return false;
        if (searchResult === 'loss' && pnlValue >= 0) return false;
        if (searchResult === 'breakeven' && pnlValue !== 0) return false;
      }
      return true;
    });
  }, [trades, searchSymbol, searchEntryDateStart, searchEntryDateEnd, searchStatus, searchDirection, searchSession, searchResult]);

  if (loading && trades.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-purple-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading trades...</p>
      </div>
    );
  }

  if (error && trades.length === 0) {
    return <div className="container mx-auto p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      {/* CSV Uploader */}
      {/* <div className="mb-4">
        <CSVUploader onUploadSuccess={fetchTrades} />
      </div> */}

      {/* Search Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white dark:bg-gray-800 p-4 px-0 rounded-lg shadow-sm">
        {/* Quick Date Filters */}

        <div className="flex-1 min-w-[150px]">
          <input
            type="text"
            placeholder="Search by symbol..."
            value={searchSymbol}
            onChange={(e) => setSearchSymbol(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div className="min-w-[140px]">
          <Select
            value={searchStatus}
            onChange={setSearchStatus}
            placeholder="All Status"
            options={[
              { value: '', label: 'All Status' },
              { value: 'completed', label: 'Completed' },
              { value: 'in_progress', label: 'In Progress' },
            ]}
            className="w-full"
          />
        </div>
        {/* <div className="min-w-[140px]">
          <Select
            value={searchDirection}
            onChange={setSearchDirection}
            placeholder="All Direction"
            options={[
              { value: '', label: 'All Direction' },
              { value: 'long', label: 'Long' },
              { value: 'short', label: 'Short' },
            ]}
            className="w-full"
          />
        </div> */}
        <div className="min-w-[140px]">
          <Select
            value={searchResult}
            onChange={setSearchResult}
            placeholder="All Result"
            options={[
              { value: '', label: 'All Result' },
              { value: 'profit', label: 'Profit' },
              { value: 'loss', label: 'Loss' },
              { value: 'breakeven', label: 'Break Even' },
            ]}
            className="w-full"
          />
        </div>
        <div className="min-w-[140px]">
          <Select
            value={searchSession}
            onChange={setSearchSession}
            placeholder="All Sessions"
            options={[
              { value: '', label: 'All Sessions' },
              { value: 'Asia', label: 'Asia' },
              { value: 'Europe', label: 'Europe' },
              { value: 'US', label: 'US' },
            ]}
            className="w-full"
          />
        </div>
        {/* Quick Date Filters - Radio Style */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This Week' },
            { value: 'month', label: 'This Month' },
            { value: 'year', label: 'This Year' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleQuickFilter(option.value)}
              className={`text-xs py-1.5 px-3 rounded-md transition-colors ${quickFilter === option.value ? 'bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 font-semibold shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setQuickFilter(''); setSearchEntryDateStart(''); setSearchEntryDateEnd(''); }}
            className={`text-xs py-1.5 px-3 rounded-md transition-colors ${quickFilter === '' ? 'bg-white dark:bg-gray-900 text-purple-600 dark:text-purple-400 font-semibold shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
          >
            All
          </button>
        </div>
        <Button variant="gradient" onClick={handleReset} className="text-sm py-2">Reset</Button>
        <Button variant="primary" onClick={handleAddClick} className="text-sm py-2">Add New Trade</Button>
        <Button variant="primary" onClick={() => navigate('/stats')} className="text-sm py-2">Statistics</Button>
      </div>

      <TradeDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSuccess={fetchTrades}
        trade={editingTrade}
      />

      {deletingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Delete Trade</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Are you sure you want to delete this trade? This action cannot be undone.</p>
            <div className="flex justify-end space-x-3">
              <Button variant="gradient" onClick={() => setDeletingId(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</Button>
            </div>
          </div>
        </div>
      )}

      {viewingTrade && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black opacity-50"
            onClick={() => setViewingTrade(null)}
          />
          {/* Drawer */}
          <div className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl">
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Trade Details</h3>
                <button onClick={() => setViewingTrade(null)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                  <X size={24} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Symbol:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.symbol}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Direction:</span> <span className={`text-sm font-medium ${viewingTrade.direction === 'long' ? 'text-green-600' : 'text-red-600'}`}>{viewingTrade.direction}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Size:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.size} * {(viewingTrade.leverage && viewingTrade.leverage >= 1 ? viewingTrade.leverage : 1)}x</span></div>
                  <div className="flex items-center gap-2"><span className="text-sm text-gray-500 dark:text-gray-400">Status:</span> {(() => { const isCompleted = !!viewingTrade.exitprice; return <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>{isCompleted ? 'Completed' : 'In Progress'}</span>; })()}</div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Entry Price:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.entryprice}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Exit Price:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.exitprice || '-'}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Stop Loss:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.stop_loss || '-'}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Take Profit:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.take_profit || '-'}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Entry Time:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTime(viewingTrade.entry_time)}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Exit Time:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTime(viewingTrade.exit_time)}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Duration:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatDuration(viewingTrade.entry_time, viewingTrade.exit_time)}</span></div>
                  {(() => { const p = calculateTradePnL(viewingTrade); return p ? <div><span className="text-sm text-gray-500 dark:text-gray-400">P/L:{p.isManual ? ' (manual)' : ''}</span> <span className={`text-sm font-semibold ${p.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(2)} ({p.pnlPercent.toFixed(2)}%)</span></div> : null; })()}
                  {(() => { const tr = calculateTargetRR(viewingTrade); return tr != null ? <div><span className="text-sm text-gray-500 dark:text-gray-400">Target R/R:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{tr.toFixed(1)}</span></div> : null; })()}
                  {(() => { const p = calculateTradePnL(viewingTrade); return p?.rr != null ? <div><span className="text-sm text-gray-500 dark:text-gray-400">Actual R/R:</span> <span className={`text-sm font-semibold ${p.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>{Math.abs(p.rr).toFixed(1)}</span></div> : null; })()}
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Created At:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTimeFull(viewingTrade.createdat)}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Updated At:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{formatLocalTimeFull(viewingTrade.updatedat)}</span></div>
                  <div><span className="text-sm text-gray-500 dark:text-gray-400">Session:</span> <span className="text-sm font-medium text-gray-900 dark:text-white">{viewingTrade.session || '-'}</span></div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Result:</span>
                    {(() => { const p = calculateTradePnL(viewingTrade); if (!viewingTrade.exitprice) return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">-</span>; if (!p) return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">-</span>; if (p.pnl > 0) return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Profit</span>; if (p.pnl < 0) return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Loss</span>; return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">Break Even</span>; })()}</div>
                  {(() => { const rating = viewingTrade.rating || 0; if (rating <= 0) return null; return <div className="flex items-center gap-1"><span className="text-sm text-gray-500 dark:text-gray-400">Rating:</span><div className="flex items-center">{[1, 2, 3, 4, 5].map((star) => (<Star key={star} size={16} className={rating >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'} />))}</div></div>; })()}
                </div>
                {viewingTrade.tags && viewingTrade.tags.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Tags:</span>
                    <div className="flex flex-wrap gap-2">
                      {viewingTrade.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {viewingTrade.entry_conditions && viewingTrade.entry_conditions.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Entry Conditions:</span>
                    <div className="flex flex-wrap gap-2">
                      {viewingTrade.entry_conditions.map((condition, i) => (
                        <span key={i} className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">{condition}</span>
                      ))}
                    </div>
                  </div>
                )}
                {viewingTrade.notes && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-1">Notes:</span>
                    <p className="text-sm text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md">{viewingTrade.notes}</p>
                  </div>
                )}
                {viewingTrade.screenshots && viewingTrade.screenshots.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400 block mb-2">Screenshots:</span>
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
                <Button variant="gradient" onClick={() => setViewingTrade(null)}>Close</Button>
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

      <div className="flex items-center justify-between mb-3 px-1">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing <span className="font-semibold text-gray-900 dark:text-white">{filteredTrades.length}</span> of <span className="font-semibold text-gray-900 dark:text-white">{trades.length}</span> trade{trades.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal whitespace-nowrap">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Entry Time</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Session</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Direction</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Result</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Size</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Duration</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">P/L</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actual R/R</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Rating</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-900 dark:text-white">
            {(() => {
              if (filteredTrades.length > 0) {
                return filteredTrades.map((trade) => {
                  const pnl = calculateTradePnL(trade);
                  const targetRR = calculateTargetRR(trade);
                  const isCompleted = !!trade.exitprice;
                  const todayEntry = isToday(trade.entry_time || trade.createdat);
                  const rowBg = todayEntry
                    ? 'bg-purple-100 dark:bg-purple-900/40'
                    : 'bg-white dark:bg-gray-800';
                  return (
                    <tr key={trade.id} className={rowBg}>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>{formatLocalTime(trade.entry_time)}</td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>{trade.symbol}</td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>
                        {trade.session ? (
                          <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">{trade.session}</span>
                        ) : '-'}
                      </td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>
                        <span className={trade.direction === 'long' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{trade.direction}</span>
                      </td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>
                        {(() => {
                          if (!trade.exitprice) {
                            return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-300" title="In Progress">–</span>;
                          }
                          const pnlValue = calculateTradePnL(trade)?.pnl || 0;
                          if (pnlValue > 0) {
                            return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-bold" title="Profit">↑</span>;
                          }
                          if (pnlValue < 0) {
                            return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold" title="Loss">↓</span>;
                          }
                          return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500" title="Break Even">=</span>;
                        })()}
                      </td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>{trade.size}</td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>{formatDuration(trade.entry_time, trade.exit_time)}</td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>
                        {pnl ? (
                          <span className={`font-semibold ${pnl.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {pnl.pnl >= 0 ? '+' : ''}{pnl.pnl.toFixed(2)}<br /><span className="text-xs font-normal">({pnl.pnlPercent.toFixed(2)}%)</span>
                          </span>
                        ) : '-'}
                      </td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>
                        {pnl?.rr != null ? (
                          <span className={`font-semibold ${pnl.rr >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{pnl.rr.toFixed(1)}</span>
                        ) : '-'}
                      </td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={14}
                              className={(trade.rating || 0) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}
                            />
                          ))}
                        </div>
                      </td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm whitespace-nowrap`}>
                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${isCompleted ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                          {isCompleted ? 'Completed' : 'In Progress'}
                        </span>
                      </td>
                      <td className={`px-5 py-5 border-b border-gray-200 dark:border-gray-700 ${rowBg} text-sm`}>
                        <div className="flex items-center justify-start">
                          <Button variant="primary" className="mx-1 text-xs w-16 py-1 px-0 flex items-center justify-center" onClick={() => handleDetailClick(trade)}>Detail</Button>
                          <Button variant="primary" className="mx-1 text-xs w-16 py-1 px-0 flex items-center justify-center" onClick={() => handleEditClick(trade)}>Edit</Button>
                          <Button variant="gradient" className="mx-1 text-xs w-16 py-1 px-0 flex items-center justify-center bg-red-600 hover:bg-red-700" onClick={() => handleDeleteClick(trade.id)}>Delete</Button>
                        </div>
                      </td>
                    </tr>
                  );
                });
              }
              return (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-gray-500 dark:text-gray-400">No trades found.</td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradesPage;