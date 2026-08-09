import React, { useState, useEffect } from 'react';
import Button from './common/Button';
import { createTrade, updateTrade, uploadScreenshot, CreateTradeData } from '../services/api';
import { X, Upload, Trash2 } from 'lucide-react';

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

interface TradeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    trade?: Trade | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5000';

const toDatetimeLocal = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const TradeDrawer: React.FC<TradeDrawerProps> = ({ isOpen, onClose, onSuccess, trade }) => {
    const isEditMode = !!trade;
    const [formData, setFormData] = useState<CreateTradeData>({
        symbol: '',
        direction: 'long',
        size: 0,
        entryPrice: 0,
        exitPrice: undefined,
        notes: '',
        tradeDate: toDatetimeLocal(new Date().toISOString()),
        entryTime: toDatetimeLocal(new Date().toISOString()),
        exitTime: '',
        stopLoss: undefined,
        takeProfit: undefined,
        screenshots: [],
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);

    useEffect(() => {
        if (trade) {
            setFormData({
                symbol: trade.symbol,
                direction: trade.direction,
                size: trade.size,
                entryPrice: trade.entryprice,
                exitPrice: trade.exitprice,
                notes: trade.notes || '',
                tradeDate: toDatetimeLocal(trade.createdat),
                entryTime: toDatetimeLocal(trade.entry_time || trade.createdat),
                exitTime: trade.exit_time ? toDatetimeLocal(trade.exit_time) : '',
                stopLoss: trade.stop_loss,
                takeProfit: trade.take_profit,
                screenshots: trade.screenshots || [],
            });
        } else {
            setFormData({
                symbol: '',
                direction: 'long',
                size: 0,
                entryPrice: 0,
                exitPrice: undefined,
                notes: '',
                tradeDate: toDatetimeLocal(new Date().toISOString()),
                entryTime: toDatetimeLocal(new Date().toISOString()),
                exitTime: '',
                stopLoss: undefined,
                takeProfit: undefined,
                screenshots: [],
            });
        }
        setError(null);
    }, [trade, isOpen]);

    // Calculate profit/loss
    const calculatePnL = (): { pnl: number; pnlPercent: number } | null => {
        if (!formData.exitPrice || !formData.entryPrice || formData.size <= 0) return null;
        const diff = formData.direction === 'long'
            ? formData.exitPrice - formData.entryPrice
            : formData.entryPrice - formData.exitPrice;
        const pnl = diff * formData.size;
        const pnlPercent = (diff / formData.entryPrice) * 100;
        return { pnl, pnlPercent };
    };

    // Calculate target risk-reward ratio
    const calculateTargetRR = (): number | null => {
        if (!formData.stopLoss || !formData.takeProfit || !formData.entryPrice || formData.entryPrice <= 0) return null;
        const risk = Math.abs(formData.entryPrice - formData.stopLoss);
        const reward = Math.abs(formData.takeProfit - formData.entryPrice);
        if (risk === 0) return null;
        return reward / risk;
    };

    // Calculate actual risk-reward ratio
    const calculateActualRR = (): number | null => {
        const pnl = calculatePnL();
        if (!pnl || !formData.stopLoss || !formData.entryPrice || formData.size <= 0) return null;
        const riskPerUnit = Math.abs(formData.entryPrice - formData.stopLoss);
        if (riskPerUnit === 0) return null;
        const maxRisk = riskPerUnit * formData.size;
        const actualReward = pnl.pnl;
        if (actualReward < 0) return null;
        return actualReward / maxRisk;
    };

    // Determine trade status
    const getTradeStatus = (): 'in_progress' | 'completed' => {
        return formData.exitPrice ? 'completed' : 'in_progress';
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const token = localStorage.getItem('token');
        if (!token) {
            setError('Please log in to upload images.');
            return;
        }

        setUploadingImage(true);
        try {
            const uploadedUrls: string[] = [];
            for (const file of Array.from(files)) {
                const url = await uploadScreenshot(token, file);
                uploadedUrls.push(url);
            }
            setFormData({
                ...formData,
                screenshots: [...(formData.screenshots || []), ...uploadedUrls],
            });
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to upload image.');
        } finally {
            setUploadingImage(false);
            e.target.value = '';
        }
    };

    const handleRemoveImage = (index: number) => {
        setFormData({
            ...formData,
            screenshots: formData.screenshots?.filter((_, i) => i !== index),
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
            setError('Please log in to save the trade.');
            setLoading(false);
            return;
        }

        try {
            if (isEditMode && trade) {
                await updateTrade(token, trade.id, formData);
            } else {
                await createTrade(token, formData);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} trade.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 z-40 bg-black transition-opacity duration-300 ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {isEditMode ? 'Edit Trade' : 'Add New Trade'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Form (scrollable) */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
                        {error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-md text-sm">
                                {error}
                            </div>
                        )}

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
                                <option value="long">Long</option>
                                <option value="short">Short</option>
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
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Exit Price (Optional)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.exitPrice || ''}
                                onChange={(e) =>
                                    setFormData({ ...formData, exitPrice: e.target.value ? parseFloat(e.target.value) : undefined })
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Trade Date & Time</label>
                            <input
                                type="datetime-local"
                                value={formData.tradeDate}
                                onChange={(e) => setFormData({ ...formData, tradeDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Notes (Optional)
                            </label>
                            <textarea
                                value={formData.notes || ''}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                rows={4}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="Add any notes about this trade..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Screenshots (Optional)
                            </label>
                            <div className="flex items-center justify-center w-full">
                                <label
                                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {uploadingImage ? 'Uploading...' : 'Click to upload screenshots'}
                                        </p>
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPG, GIF, WEBP (max 5MB)</p>
                                    </div>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/jpeg,image/png,image/gif,image/webp"
                                        onChange={handleImageUpload}
                                        disabled={uploadingImage}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            {formData.screenshots && formData.screenshots.length > 0 && (
                                <div className="grid grid-cols-3 gap-2 mt-3">
                                    {formData.screenshots.map((url, index) => (
                                        <div key={index} className="relative group">
                                            <img
                                                src={url.startsWith('http') ? url : `${API_BASE_URL}${url}`}
                                                alt={`Screenshot ${index + 1}`}
                                                className="w-full h-20 object-cover rounded-md"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveImage(index)}
                                                className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </form>

                    {/* Footer */}
                    <div className="flex justify-end space-x-3 p-4 border-t dark:border-gray-700">
                        <Button variant="gradient" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button variant="primary" disabled={loading} onClick={handleSubmit}>
                            {loading ? 'Saving...' : isEditMode ? 'Update Trade' : 'Add Trade'}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TradeDrawer;