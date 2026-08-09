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
}

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
      setTrades(data);
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
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Symbol</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Direction</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Size</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Entry Price</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Exit Price</th>
              <th className="px-5 py-3 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="text-gray-900 dark:text-white">
            {trades.length > 0 ? (
              trades.map((trade) => (
                <tr key={trade.id}>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{new Date(trade.createdat).toLocaleDateString()}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.symbol}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.direction}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.size}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.entryprice}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">{trade.exitprice || '-'}</td>
                  <td className="px-5 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm">
                    <Button variant="primary" className="mr-2 text-sm px-3 py-1" onClick={() => handleEditClick(trade)}>Edit</Button>
                    <Button variant="gradient" className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700" onClick={() => handleDeleteClick(trade.id)}>Delete</Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-500 dark:text-gray-400">No trades found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradesPage;