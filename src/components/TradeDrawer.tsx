import React, { useState, useEffect } from 'react';
import Button from './common/Button';
import { createTrade, updateTrade, uploadScreenshot, CreateTradeData, SERVER_BASE_URL as API_BASE_URL } from '../services/api';
import { X, Upload, Trash2, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import DateTimePicker from './common/DateTimePicker';
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
    rating?: number;
    leverage?: number;
    manual_pnl?: number;
    session?: 'Asia' | 'Europe' | 'US';
    final_trigger?: 'takeProfit' | 'stopLoss';
}

interface TradeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    trade?: Trade | null;
}

const toDatetimeLocal = (dateStr?: string) => {
    if (!dateStr) return '';
    // 后端返回的时间字符串视为本地时间（无时区）
    // 直接截取前 16 位作为 datetime-local 值，避免任何 Date 转换导致时区偏移
    // 支持格式："2026-08-09 11:13:00" / "2026-08-09T11:13:00" / "2026-08-09T11:13:00.000Z"
    const normalized = dateStr.replace(' ', 'T');
    return normalized.slice(0, 16);
};

const nowLocalISO = (): string => {
    const d = new Date();
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
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
        entryTime: nowLocalISO(),
        exitTime: '',
        stopLoss: undefined,
        takeProfit: undefined,
        screenshots: [],
        entryConditions: [],
        rating: 0,
        leverage: 1,
        manualPnl: undefined,
        session: undefined,
        finalTrigger: undefined,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [entryTimeError, setEntryTimeError] = useState<string>('');
    const [exitTimeError, setExitTimeError] = useState<string>('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<{ urls: string[]; index: number } | null>(null);

    const ENTRY_CONDITION_OPTIONS = [
        'CHOCH', 'BOS', 'OB', 'MB', 'FVG', 'Sweep Liquidity', 'Breakout', 'Pullback', 'Reversal',
        'Support', 'Resistance', 'UPTrend', 'DownTrend'
    ];

    const toggleEntryCondition = (condition: string) => {
        const current = formData.entryConditions || [];
        if (current.includes(condition)) {
            setFormData({ ...formData, entryConditions: current.filter(c => c !== condition) });
        } else {
            setFormData({ ...formData, entryConditions: [...current, condition] });
        }
    };

    useEffect(() => {
        if (trade) {
            setFormData({
                symbol: trade.symbol,
                direction: trade.direction,
                size: trade.size,
                entryPrice: trade.entryprice,
                exitPrice: trade.exitprice,
                notes: trade.notes || '',
                entryTime: toDatetimeLocal(trade.entry_time || trade.createdat),
                exitTime: trade.exit_time ? toDatetimeLocal(trade.exit_time) : '',
                stopLoss: trade.stop_loss,
                takeProfit: trade.take_profit,
                screenshots: trade.screenshots || [],
                entryConditions: (trade as any).entry_conditions || [],
                rating: trade.rating || 0,
                leverage: trade.leverage || 1,
                manualPnl: (trade as any).manual_pnl,
                session: (trade as any).session,
                finalTrigger: (trade as any).final_trigger,
            });
        } else {
            setFormData({
                symbol: '',
                direction: 'long',
                size: 0,
                entryPrice: 0,
                exitPrice: undefined,
                notes: '',
                entryTime: nowLocalISO(),
                exitTime: '',
                stopLoss: undefined,
                takeProfit: undefined,
                screenshots: [],
                entryConditions: [],
                rating: 0,
                leverage: 1,
                manualPnl: undefined,
                session: undefined,
                finalTrigger: undefined,
            });
        }
        setError(null);
    }, [trade, isOpen]);

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

    // Auto P/L: 始终基于进出场价格与 size × leverage 计算，不受 manualPnl 影响
    const calculateAutoPnL = (): { pnl: number; pnlPercent: number } | null => {
        if (!formData.exitPrice || !formData.entryPrice || formData.size <= 0) return null;
        const leverage = formData.leverage && formData.leverage >= 1 ? formData.leverage : 1;
        const diff = formData.direction === 'long'
            ? formData.exitPrice - formData.entryPrice
            : formData.entryPrice - formData.exitPrice;
        const pnl = diff * formData.size * leverage;
        const pnlPercent = (diff / formData.entryPrice) * 100 * leverage;
        return { pnl, pnlPercent };
    };

    // Final P/L: manual 优先，否则回落到 Auto P/L（供 Actual R/R 计算使用）
    const calculatePnL = (): { pnl: number; pnlPercent: number; isManual: boolean } | null => {
        if (!formData.exitPrice || !formData.entryPrice || formData.size <= 0) return null;
        if (formData.manualPnl !== undefined && formData.manualPnl !== null && !isNaN(formData.manualPnl)) {
            const cost = formData.entryPrice * formData.size;
            const pnlPercent = cost > 0 ? (formData.manualPnl / cost) * 100 : 0;
            return { pnl: formData.manualPnl, pnlPercent, isManual: true };
        }
        const auto = calculateAutoPnL()!;
        return { ...auto, isManual: false };
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

    const nowLocal = nowLocalISO();

    const validateEntryTime = (value: string) => {
        setFormData(prev => ({ ...prev, entryTime: value }));
        if (!value) { setEntryTimeError(''); return; }
        const t = new Date(value);
        if (t > now) { setEntryTimeError('Entry time cannot be later than the current time.'); return; }
        if (formData.exitTime) {
            const exitT = new Date(formData.exitTime);
            if (exitT < t) { setEntryTimeError('Exit time must be after entry time.'); return; }
        }
        setEntryTimeError('');
    };

    const validateExitTime = (value: string) => {
        setFormData(prev => ({ ...prev, exitTime: value }));
        if (!value) { setExitTimeError(''); return; }
        const t = new Date(value);
        if (t > now) { setExitTimeError('Exit time cannot be later than the current time.'); return; }
        if (formData.entryTime) {
            const entryT = new Date(formData.entryTime);
            if (t < entryT) { setExitTimeError('Exit time must be after entry time.'); return; }
        }
        setExitTimeError('');
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

        if (entryTimeError || exitTimeError) {
            setLoading(false);
            return;
        }

        if (!formData.entryConditions || formData.entryConditions.length === 0) {
            setError('Please select at least one entry condition.');
            setLoading(false);
            return;
        }

        // Validate exit time cannot be in the future
        if (formData.exitTime) {
            const exitTime = new Date(formData.exitTime);
            const now = new Date();
            if (exitTime > now) {
                setError('Exit time cannot be later than the current time.');
                setLoading(false);
                return;
            }
        }

        // Validate entry time cannot be in the future
        if (formData.entryTime) {
            const entryTime = new Date(formData.entryTime);
            const now = new Date();
            if (entryTime > now) {
                setError('Entry time cannot be later than the current time.');
                setLoading(false);
                return;
            }
        }

        // Validate exit time must be after entry time
        if (formData.entryTime && formData.exitTime) {
            const entryTime = new Date(formData.entryTime);
            const exitTime = new Date(formData.exitTime);
            if (exitTime < entryTime) {
                setError('Exit time must be after entry time.');
                setLoading(false);
                return;
            }
        }

        // Clean up empty strings - convert to undefined to avoid validation errors
        const cleanData: CreateTradeData = { ...formData };
        (Object.keys(cleanData) as Array<keyof CreateTradeData>).forEach((key) => {
            const value = cleanData[key];
            if (value === '' || value === null) {
                (cleanData as any)[key] = undefined;
            }
        });

        // datetime-local 字符串格式为 "2026-08-09T11:13"（无时区、无秒）
        // 补全秒为 "2026-08-09T11:13:00"，确保严格通过后端 isISO8601 校验
        // 直接传给后端，PostgreSQL TIMESTAMP (without time zone) 字段原样存储
        // 显示时原样返回，不做任何时区转换，避免 ±8 小时偏移
        // 重要：空值必须为 undefined，不能是空字符串，否则 isISO8601 校验失败
        if (cleanData.entryTime && typeof cleanData.entryTime === 'string' && cleanData.entryTime.length === 16) {
            cleanData.entryTime = cleanData.entryTime + ':00';
        }
        if (cleanData.exitTime && typeof cleanData.exitTime === 'string' && cleanData.exitTime.length === 16) {
            cleanData.exitTime = cleanData.exitTime + ':00';
        }
        // 双保险：确保空字符串转为 undefined
        if (cleanData.entryTime === '' || cleanData.entryTime === null) {
            cleanData.entryTime = undefined;
        }
        if (cleanData.exitTime === '' || cleanData.exitTime === null) {
            cleanData.exitTime = undefined;
        }
        // rating 为 0 表示未评分，发送 null 让后端将 rating 列更新为 NULL（编辑时支持 Clear）
        if (!cleanData.rating) {
            cleanData.rating = null;
        }
        // leverage 小于 1 或空则不发，后端用默认值 1
        if (!cleanData.leverage || cleanData.leverage < 1) {
            cleanData.leverage = undefined;
        }
        // manualPnl 为空/NaN 转为 undefined，让后端跳过（使用自动计算）
        if (cleanData.manualPnl === undefined || cleanData.manualPnl === null || isNaN(cleanData.manualPnl)) {
            cleanData.manualPnl = undefined;
        }

        try {
            if (isEditMode && trade) {
                await updateTrade(token, trade.id, cleanData);
            } else {
                await createTrade(token, cleanData);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            const errData = err.response?.data;
            let msg = `Failed to ${isEditMode ? 'update' : 'create'} trade.`;
            if (errData?.errors && Array.isArray(errData.errors)) {
                msg = errData.errors.map((e: any) => Object.values(e)[0]).join('; ');
            } else if (errData?.message) {
                msg = errData.message;
            } else if (errData?.error) {
                msg = errData.error;
            }
            setError(msg);
            console.error('Trade save error:', errData || err);
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
                className={`fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
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
                                onChange={(e) => {
                                    const newSymbol = e.target.value.toUpperCase();
                                    setFormData({ ...formData, symbol: newSymbol });
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                placeholder="e.g., AAPL"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Session</label>
                            <div className="flex flex-wrap gap-2">
                                {(['Asia', 'Europe', 'US'] as const).map((option) => {
                                    const selected = formData.session === option;
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, session: selected ? undefined : option })}
                                            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${selected ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400'}`}
                                        >
                                            {option} session
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-1 text-xs text-gray-400">Tag this trade with its trading market session (optional)</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Entry Conditions <span className="text-red-500">*</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {ENTRY_CONDITION_OPTIONS.map((condition) => {
                                    const selected = (formData.entryConditions || []).includes(condition);
                                    return (
                                        <button
                                            key={condition}
                                            type="button"
                                            onClick={() => toggleEntryCondition(condition)}
                                            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${selected ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400'}`}
                                        >
                                            {condition}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-1 text-xs text-gray-400">Please select at least one entry condition</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
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
                        </div>



                        <div className="grid grid-cols-2 gap-3">
                            <div className="min-w-0">
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
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exit Price (Optional)</label>
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
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stop Loss</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.stopLoss || ''}
                                    onChange={(e) =>
                                        setFormData({ ...formData, stopLoss: e.target.value ? parseFloat(e.target.value) : undefined })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Take Profit</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={formData.takeProfit || ''}
                                    onChange={(e) =>
                                        setFormData({ ...formData, takeProfit: e.target.value ? parseFloat(e.target.value) : undefined })
                                    }
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Final P/L</label>
                            <input
                                type="number"
                                step="0.01"
                                value={(() => {
                                    if (formData.manualPnl !== undefined && formData.manualPnl !== null && !isNaN(formData.manualPnl)) {
                                        return formData.manualPnl;
                                    }
                                    const auto = calculateAutoPnL();
                                    return auto ? auto.pnl : '';
                                })()}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, manualPnl: val === '' ? undefined : parseFloat(val) });
                                }}
                                placeholder="Auto"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                {(() => {
                                    const auto = calculateAutoPnL();
                                    if (!auto) return `Leverage: ${formData.leverage ?? 1}x`;
                                    return `Auto: ${auto.pnl >= 0 ? '+' : ''}${auto.pnl.toFixed(2)} (${auto.pnlPercent.toFixed(2)}%) | Leverage: ${formData.leverage ?? 1}x`;
                                })()}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Entry Time</label>
                                <DateTimePicker
                                    value={formData.entryTime || ''}
                                    onChange={(v) => validateEntryTime(v)}
                                    max={nowLocal}
                                    error={entryTimeError}
                                    placeholder="Select entry time"
                                    className="w-full"
                                />
                            </div>
                            <div className="min-w-0">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Exit Time</label>
                                <DateTimePicker
                                    value={formData.exitTime || ''}
                                    onChange={(v) => validateExitTime(v)}
                                    max={nowLocal}
                                    error={exitTimeError}
                                    placeholder="Select exit time"
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Trade Summary */}
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</span>
                                {(() => {
                                    const status = getTradeStatus();
                                    return (
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                            {status === 'completed' ? 'Completed' : 'In Progress'}
                                        </span>
                                    );
                                })()}
                            </div>
                            {(() => {
                                const autoPnl = calculateAutoPnL();
                                if (autoPnl) {
                                    return (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Auto P/L</span>
                                            <span className={`text-sm font-semibold ${autoPnl.pnl >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {autoPnl.pnl >= 0 ? '+' : ''}{autoPnl.pnl.toFixed(2)} ({autoPnl.pnlPercent.toFixed(2)}%)
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            {(() => {
                                const targetRR = calculateTargetRR();
                                if (targetRR) {
                                    return (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Target R/R</span>
                                            <span className="text-sm font-semibold text-gray-900 dark:text-white">1 : {targetRR.toFixed(2)}</span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                            {(() => {
                                const actualRR = calculateActualRR();
                                const pnl = calculatePnL();
                                if (actualRR) {
                                    const isProfit = (pnl?.pnl ?? 0) >= 0;
                                    return (
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Actual R/R</span>
                                            <span className={`text-sm font-semibold ${isProfit ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>1 : {Math.abs(actualRR).toFixed(2)}</span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </div>

                        {isEditMode && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Rating (Optional)
                                </label>
                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => {
                                        const filled = (formData.rating || 0) >= star;
                                        return (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => {
                                                    const current = formData.rating || 0;
                                                    setFormData({
                                                        ...formData,
                                                        rating: current === star ? 0 : star,
                                                    });
                                                }}
                                                className="p-1 hover:scale-110 transition-transform"
                                                title={`${star} star${star > 1 ? 's' : ''}`}
                                            >
                                                <Star
                                                    size={24}
                                                    className={filled
                                                        ? 'text-yellow-400 fill-yellow-400'
                                                        : 'text-gray-300 dark:text-gray-600'}
                                                />
                                            </button>
                                        );
                                    })}
                                    {(formData.rating || 0) > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, rating: 0 })}
                                            className="ml-2 text-xs text-gray-400 hover:text-red-500"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-gray-400">Rate this trade from 1 to 5 stars</p>
                            </div>
                        )}

                             {isEditMode && (<div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Final Trigger (Optional)
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {(['takeProfit', 'stopLoss'] as const).map((option) => {
                                    const selected = formData.finalTrigger === option;
                                    const activeStyles = option === 'takeProfit'
                                        ? 'bg-green-600 text-white border-green-600'
                                        : 'bg-red-600 text-white border-red-600';
                                    const label = option === 'takeProfit' ? 'Take Profit' : 'Stop Loss';
                                    return (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, finalTrigger: selected ? undefined : option })}
                                            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${selected ? activeStyles : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400'}`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-1 text-xs text-gray-400">Mark whether the trade finally triggered take profit or stop loss</p>
                        </div>)}

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
                                                onClick={() => setLightboxImage({
                                                    urls: (formData.screenshots || []).map(u => u.startsWith('http') ? u : `${API_BASE_URL}${u}`),
                                                    index
                                                })}
                                                className="w-full h-20 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
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

            {/* Lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <button
                        type="button"
                        onClick={() => setLightboxImage(null)}
                        className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors z-10"
                    >
                        <X size={24} />
                    </button>
                    {lightboxImage.urls.length > 1 && (
                        <>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxImage({ ...lightboxImage, index: (lightboxImage.index - 1 + lightboxImage.urls.length) % lightboxImage.urls.length });
                                }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors z-10"
                            >
                                <ChevronLeft size={24} />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxImage({ ...lightboxImage, index: (lightboxImage.index + 1) % lightboxImage.urls.length });
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/30 text-white rounded-full p-2 transition-colors z-10"
                            >
                                <ChevronRight size={24} />
                            </button>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-white/20 px-3 py-1 rounded-full z-10">
                                {lightboxImage.index + 1} / {lightboxImage.urls.length}
                            </div>
                        </>
                    )}
                    <img
                        src={lightboxImage.urls[lightboxImage.index]}
                        alt="Screenshot preview"
                        onClick={(e) => e.stopPropagation()}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                </div>
            )}
        </>
    );
};

export default TradeDrawer;