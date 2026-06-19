import React, { useState } from 'react';
import Button from './common/Button';
import { createTrade, CreateTradeData } from '../services/api';
import { X } from 'lucide-react';

interface AddTradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const AddTradeModal: React.FC<AddTradeModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState<CreateTradeData>({
        symbol: '',
        direction: 'buy',
        size: 0,
        entryPrice: 0,
        exitPrice: undefined,
        notes: '',
        tradeDate: new Date().toISOString().split('T')[0],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
            setError('Please log in to add a trade.');
            setLoading(false);
            return;
        }

        try {
            await createTrade(token, formData);
            onSuccess();
            onClose();
            setFormData({
                symbol: '',
                direction: 'buy',
                size: 0,
                entryPrice: 0,
                exitPrice: undefined,
                notes: '',
                tradeDate: new Date().toISOString().split('T')[0],
            });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create trade.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
                <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Trade</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    {error && <p className="text-red-500 text-center">{error}</p>}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Symbol</label>
                        <input
                            type="text"
                            required
                            value={formData.symbol}
                            onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="e.g., AAPL"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Direction</label>
                        <select
                            required
                            value={formData.direction}
                            onChange={(e) => setFormData({ ...formData, direction: e.target.value as CreateTradeData['direction'] })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                            <option value="buy">Buy</option>
                            <option value="sell">Sell</option>
                            <option value="short">Short</option>
                            <option value="cover">Cover</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Size</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={formData.size}
                            onChange={(e) => setFormData({ ...formData, size: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Entry Price</label>
                        <input
                            type="number"
                            required
                            min="0"
                            step="0.01"
                            value={formData.entryPrice}
                            onChange={(e) => setFormData({ ...formData, entryPrice: parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exit Price (Optional)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.exitPrice || ''}
                            onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trade Date</label>
                        <input
                            type="date"
                            value={formData.tradeDate}
                            onChange={(e) => setFormData({ ...formData, tradeDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (Optional)</label>
                        <textarea
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Add any notes about this trade..."
                        />
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button variant="gradient" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button variant="primary" disabled={loading}>
                            {loading ? 'Adding...' : 'Add Trade'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddTradeModal;