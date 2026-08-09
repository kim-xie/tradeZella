import CSVUploader from '../components/CSVUploader';
import TradeDrawer from '../components/TradeDrawer';
import React, { useState, useEffect } from 'react';
import Button from '../components/common/Button';
import { getUserTrades, deleteTrade } from '../services/api';

interface Trade {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryprice: number;
  exitprice?: number;
  notes?: string;
  createdat: string;
  screenshots?: string[];
  entry_time?: string;
  exit_time?: string;
  stop_loss?: number;
  take_profit?: number;
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

const calculateTradePnL = (trade: Trade): { pnl: number; pnlPercent: number; rr: number | null } | null => {
  if (!trade.exitprice || !trade.entryprice || trade.size <= 0) return null;
  const diff = trade.direction === 'long'
    ? trade.exitprice - trade.entryprice
    : trade.entryprice - trade.exitprice;
  const pnl = diff * trade.size;
  const pnlPercent = (diff / trade.entryprice) * 100;
  let rr: number | null = null;
  if (trade.stop_loss && trade.entryprice) {
    const riskPerUnit = Math.abs(trade.entryprice - trade.stop_loss);
    if (riskPerUnit > 0) {
      const maxRisk = riskPerUnit * trade.size;
      rr = pnl / maxRisk;
    }
  }
  return { pnl, pnlPercent, rr };
};

const isToday = (dateStr?: string): boolean => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
};

const sortByEntryTimeDesc = (a: Trade, b: Trade): number => {
  const timeA = a.entry_time ? new Date(a.entry_time).getTime() : new Date(a.createdat).getTime();
  const timeB = b.entry_time ? new Date(b.entry_time).getTime() : new Date(b.createdat).getTime();
  return timeB - timeA;
};

const TradesPage: React.FC = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleAddClick = () => {
    setEditingTrade(null);
    setIsDrawerOpen(true);
  };

  const handleEditClick = (trade: Trade) => {
    setEditingTrade(trade);
    setIsDrawerOpen(true);
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

  if (loading && trades.length === 0) { // Only show full page loader on initial load
    return <div className="container mx-auto p-4">Loading trades...</div>;
  }

  if (error && trades.length === 0) {
    return <div className="container mx-auto p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Trades</h1>
        <Button variant="primary" onClick={handleAddClick}>Add New Trade</Button>
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

      {/* CSV Uploader Component */}
      <div className="mb-6">
        <CSVUploader onUploadSuccess={fetchTrades} />
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Direction</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Size</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Entry Price</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Exit Price</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Entry Time</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Exit Time</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Duration</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">P/L</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">R/R</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-900 dark:text-white">
            {trades.length > 0 ? (
              trades.map((trade) => {
                const pnl = calculateTradePnL(trade);
                const isCompleted = !!trade.exitprice;
                return (
                <tr key={trade.id}>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${isCompleted ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                      {isCompleted ? 'Completed' : 'In Progress'}
                    </span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.symbol}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                    <span className={trade.direction === 'long' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>{trade.direction}</span>
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.size}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.entryprice}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.exitprice || '-'}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.entry_time ? new Date(trade.entry_time).toLocaleString() : '-'}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.exit_time ? new Date(trade.exit_time).toLocaleString() : '-'}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{formatDuration(trade.entry_time, trade.exit_time)}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                    {pnl ? (
                      <span className={`font-semibold ${pnl.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {pnl.pnl >= 0 ? '+' : ''}{pnl.pnl.toFixed(2)}<br /><span className="text-xs font-normal">({pnl.pnlPercent.toFixed(2)}%)</span>
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                    {pnl?.rr != null ? (
                      <span className={`font-semibold ${pnl.rr >= 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>1:{pnl.rr.toFixed(2)}</span>
                    ) : '-'}
                  </td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                    <Button variant="primary" className="mr-2 text-sm px-3 py-1" onClick={() => handleEditClick(trade)}>Edit</Button>
                    <Button variant="gradient" className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700" onClick={() => handleDeleteClick(trade.id)}>Delete</Button>
                  </td>
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={12} className="text-center py-10 text-gray-500 dark:text-gray-400">No trades found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradesPage;