import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Button from './common/Button';
import { createTrade, updateTrade, uploadScreenshot, deleteTrade, CreateTradeData, SERVER_BASE_URL as API_BASE_URL } from '../services/api';
import { X, Upload, Trash2, Star, ChevronLeft, ChevronRight, ChevronDown, Layers, Target, Compass, FileText, Maximize2, Minimize2 } from 'lucide-react';
import DateTimePicker from './common/DateTimePicker';
import Select from './common/Select';
import { calculateMarketSession } from './calendar/calendarUtils';
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
    onDelete?: () => void;
    trade?: Trade | null;
    availableSymbols?: string[];
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

const SENTIMENT_OPTIONS = [
    { value: 'Nervous', label: '紧张焦虑', emoji: '😰', selectedClass: 'bg-red-600 text-white border-red-600' },
    { value: 'Uneasy', label: '忐忑不安', emoji: '😟', selectedClass: 'bg-orange-500 text-white border-orange-500' },
    { value: 'Neutral', label: '平和理性', emoji: '😐', selectedClass: 'bg-gray-600 text-white border-gray-600' },
    { value: 'Composed', label: '从容自信', emoji: '😌', selectedClass: 'bg-blue-600 text-white border-blue-600' },
    { value: 'Zen', label: '知行合一', emoji: '🧘', selectedClass: 'bg-emerald-600 text-white border-emerald-600' },
];

const TradeDrawer: React.FC<TradeDrawerProps> = ({ isOpen, onClose, onSuccess, onDelete, trade, availableSymbols }) => {
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
        sentiment: undefined,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [entryTimeError, setEntryTimeError] = useState<string>('');
    const [exitTimeError, setExitTimeError] = useState<string>('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<{ urls: string[]; index: number } | null>(null);
    const [symbolSuggestions, setSymbolSuggestions] = useState<string[]>([]);
    const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
    const [activeTab, setActiveTab] = useState<'all' | 'details' | 'strategy' | 'journal'>('all');
    const [isMaximized, setIsMaximized] = useState(false);
    const symbolInputRef = useRef<HTMLInputElement>(null);
    const symbolDropdownRef = useRef<HTMLDivElement>(null);

    // Prevent background scrolling while drawer is open
    useEffect(() => {
        if (isOpen && typeof document !== 'undefined') {
            const originalBodyOverflow = document.body.style.overflow;
            const originalHtmlOverflow = document.documentElement.style.overflow;
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = originalBodyOverflow;
                document.documentElement.style.overflow = originalHtmlOverflow;
            };
        }
    }, [isOpen]);

    // Handle Escape key to close drawer
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (lightboxImage) {
                    setLightboxImage(null);
                } else if (showDeleteConfirm) {
                    setShowDeleteConfirm(false);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, lightboxImage, showDeleteConfirm, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        const symbols = new Set<string>();
        (availableSymbols || []).forEach((s) => { if (s) symbols.add(s); });
        setSymbolSuggestions(Array.from(symbols).sort());
    }, [isOpen, availableSymbols]);

    useEffect(() => {
        if (!showSymbolDropdown) return;
        const handleClick = (e: MouseEvent) => {
            if (
                symbolDropdownRef.current && !symbolDropdownRef.current.contains(e.target as Node) &&
                symbolInputRef.current && !symbolInputRef.current.contains(e.target as Node)
            ) {
                setShowSymbolDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showSymbolDropdown]);

    const filteredSymbolSuggestions = useMemo(() => {
        const current = formData.symbol.trim().toUpperCase();
        if (!current) return symbolSuggestions;
        return symbolSuggestions.filter((s) => s.includes(current) && s !== current);
    }, [symbolSuggestions, formData.symbol]);

    const ENTRY_CONDITION_OPTIONS = [
        'CHOCH', 'BOS', 'OB', 'MB', 'FVG', 'Sweep Liquidity', 'Breakout', 'Pullback', 'Reject', 'Reversal',
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
                session: (trade as any).session || calculateMarketSession(trade.entry_time || trade.createdat) || undefined,
                finalTrigger: (trade as any).final_trigger,
                sentiment: (trade as any).sentiment,
            });
        } else {
            const initialEntryTime = nowLocalISO();
            setFormData({
                symbol: '',
                direction: 'long',
                size: 0,
                entryPrice: 0,
                exitPrice: undefined,
                notes: '',
                entryTime: initialEntryTime,
                exitTime: '',
                stopLoss: undefined,
                takeProfit: undefined,
                screenshots: [],
                entryConditions: [],
                rating: 0,
                leverage: 1,
                manualPnl: undefined,
                session: calculateMarketSession(initialEntryTime) || undefined,
                finalTrigger: undefined,
                sentiment: undefined,
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

    // Calculate target risk-reward ratio (基于设定的止损与止盈)
    const calculateTargetRR = (): number | null => {
        const ep = Number(formData.entryPrice || 0);
        const sl = Number(formData.stopLoss || 0);
        const tp = Number(formData.takeProfit || 0);
        if (ep <= 0 || sl <= 0 || tp <= 0) return null;
        const dir = formData.direction === 'short' || formData.direction === ('sell' as any) ? 'short' : 'long';
        const risk = dir === 'long' ? ep - sl : sl - ep;
        const reward = dir === 'long' ? tp - ep : ep - tp;
        if (risk <= 0.0000001 || reward <= 0.0000001) return null;
        const rr = reward / risk;
        return isFinite(rr) && rr > 0 ? rr : null;
    };

    // Calculate actual risk-reward ratio (基于实际平仓出场)
    const calculateActualRR = (): number | null => {
        const pnl = calculatePnL();
        const ep = Number(formData.entryPrice || 0);
        const sl = Number(formData.stopLoss || 0);
        const size = Number(formData.size || 0);
        if (!pnl || ep <= 0 || sl <= 0 || size <= 0) return null;
        const dir = formData.direction === 'short' || formData.direction === ('sell' as any) ? 'short' : 'long';
        const riskPerUnit = dir === 'long' ? ep - sl : sl - ep;
        if (riskPerUnit <= 0.0000001) return null;

        const xp = formData.exitPrice ? Number(formData.exitPrice) : 0;
        if (xp <= 0) return null;

        const diff = formData.direction === 'long'
            ? xp - ep
            : ep - xp;

        if (pnl.isManual && diff !== 0) {
            const sign = pnl.pnl === 0 ? 0 : pnl.pnl > 0 ? 1 : -1;
            const rr = sign * (Math.abs(diff) / riskPerUnit);
            return isFinite(rr) ? rr : null;
        }
        const rr = diff / riskPerUnit;
        return isFinite(rr) ? rr : null;
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
            setError('请先登录账号后再上传图片。');
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
            setError(err.response?.data?.message || '上传图片失败。');
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
        const autoSession = calculateMarketSession(value);
        setFormData(prev => ({ 
            ...prev, 
            entryTime: value,
            session: autoSession || prev.session,
        }));
        if (!value) { setEntryTimeError(''); return; }
        const t = new Date(value);
        if (t > now) { setEntryTimeError('入场时间不能晚于当前时间。'); return; }
        if (formData.exitTime) {
            const exitT = new Date(formData.exitTime);
            if (exitT < t) { setEntryTimeError('出场时间必须晚于入场时间。'); return; }
        }
        setEntryTimeError('');
    };

    const validateExitTime = (value: string) => {
        setFormData(prev => ({ ...prev, exitTime: value }));
        if (!value) { setExitTimeError(''); return; }
        const t = new Date(value);
        if (t > now) { setExitTimeError('出场时间不能晚于当前时间。'); return; }
        if (formData.entryTime) {
            const entryT = new Date(formData.entryTime);
            if (t < entryT) { setExitTimeError('出场时间必须晚于入场时间。'); return; }
        }
        setExitTimeError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        if (!token) {
            setError('请先登录账号后保存交易记录。');
            setLoading(false);
            return;
        }

        if (entryTimeError || exitTimeError) {
            setLoading(false);
            return;
        }

        if (!formData.entryConditions || formData.entryConditions.length === 0) {
            setActiveTab('strategy');
            setError('请至少选择一个入场形态或信号条件（已为您定位至「信号与心智」分类）。');
            setLoading(false);
            return;
        }

        // Validate exit time cannot be in the future
        if (formData.exitTime) {
            const exitTime = new Date(formData.exitTime);
            const now = new Date();
            if (exitTime > now) {
                setError('出场时间不能晚于当前时间。');
                setLoading(false);
                return;
            }
        }

        // Validate entry time cannot be in the future
        if (formData.entryTime) {
            const entryTime = new Date(formData.entryTime);
            const now = new Date();
            if (entryTime > now) {
                setError('入场时间不能晚于当前时间。');
                setLoading(false);
                return;
            }
        }

        // Validate exit time must be after entry time
        if (formData.entryTime && formData.exitTime) {
            const entryTime = new Date(formData.entryTime);
            const exitTime = new Date(formData.exitTime);
            if (exitTime < entryTime) {
                setError('出场时间必须晚于入场时间。');
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

    if (typeof document === 'undefined') return null;

    return createPortal(
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 z-[999] bg-black/60 backdrop-blur-xs transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.preventDefault()}
            />

            {/* Error modal */}
            {error && (
                <div
                    className="fixed inset-0 z-[1010] flex items-center justify-center px-4 bg-black/50 dark:bg-black/60"
                    onClick={() => setError(null)}
                    onWheel={(e) => e.stopPropagation()}
                >
                    <div
                        className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">An error occurred</h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Could not save your trade</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setError(null)}
                                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                aria-label="Close error dialog"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="px-5 py-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300 break-words">
                            {error}
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                            <button
                                type="button"
                                onClick={() => setError(null)}
                                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Drawer Panel */}
            <aside
                aria-label={isEditMode ? '编辑交易记录抽屉' : '新建交易记录抽屉'}
                className={`fixed top-0 right-0 bottom-0 z-[1000] ${
                    isMaximized ? 'w-full' : 'w-full md:w-3/5 lg:w-1/2'
                } bg-white dark:bg-[#0f172a] border-l border-gray-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
                }`}
                onWheel={(e) => e.stopPropagation()}
            >
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Header */}
                    <div
                        className="p-4 sm:p-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/60 dark:bg-navy-950/60 shrink-0 select-none"
                        onTouchMove={(e) => e.preventDefault()}
                    >
                        <div>
                            <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">
                                <Layers className="w-3.5 h-3.5 text-purple-500" />
                                <span>{isEditMode ? '订单档案编辑 (Trade Order & Journal)' : '手动记录与风控录入 (New Trade Journal)'}</span>
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                                <span>{isEditMode ? '编辑交易记录' : '新建交易记录'}</span>
                                {isEditMode && formData.symbol && (
                                    <span className="text-xs font-normal font-mono text-purple-600 dark:text-purple-400">
                                        ({formData.symbol})
                                    </span>
                                )}
                            </h2>
                        </div>

                        <div className="flex items-center space-x-2">
                            {(() => {
                                const p = calculatePnL();
                                if (!p) return null;
                                return (
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-mono font-bold ${
                                            p.pnl >= 0
                                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800'
                                        }`}
                                    >
                                        {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                                    </span>
                                );
                            })()}
                            <button
                                type="button"
                                onClick={() => setIsMaximized((prev) => !prev)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-800 transition"
                                title={isMaximized ? '还原抽屉宽度' : '全屏铺满抽屉'}
                                aria-label={isMaximized ? '还原抽屉宽度' : '全屏铺满抽屉'}
                            >
                                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-navy-800 transition"
                                title="Close drawer"
                                aria-label="关闭抽屉"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Navigation Filter Tabs */}
                    <div className="px-6 py-2.5 bg-gray-50/80 dark:bg-navy-900/40 border-b border-gray-200 dark:border-white/10 flex items-center space-x-2 shrink-0 select-none overflow-x-auto no-scrollbar">
                        {[
                            { id: 'all' as const, label: '全部内容', icon: Layers },
                            { id: 'details' as const, label: '订单参数', icon: Target },
                            { id: 'strategy' as const, label: '信号与心智', icon: Compass },
                            { id: 'journal' as const, label: '复盘与笔记', icon: FileText },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1.5 shrink-0 ${
                                    activeTab === tab.id
                                        ? 'bg-purple-600 text-white shadow-xs'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-gray-700/60'
                                }`}
                            >
                                <tab.icon className="w-3.5 h-3.5" />
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Form (scrollable) */}
                    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-6 space-y-6">

                        {/* Card 1: 订单基础核心参数 */}
                        {(activeTab === 'all' || activeTab === 'details') && (
                            <div className="bg-gray-50/70 dark:bg-gray-900/40 border border-gray-200/80 dark:border-gray-700/70 rounded-2xl p-5 sm:p-6 space-y-5">
                                <div className="flex items-center justify-between pb-3 border-b border-gray-200/60 dark:border-gray-700/60">
                                    <div className="flex items-center space-x-2.5">
                                        <div className="p-1.5 bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-lg">
                                            <Target className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">订单核心参数</h3>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">标的、多空方向、点位与仓位执行</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
                                        Execution
                                    </span>
                                </div>

                                {/* 交易标的 */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                        交易标的 (Symbol) <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative" ref={symbolDropdownRef}>
                                        <input
                                            ref={symbolInputRef}
                                            type="text"
                                            required
                                            value={formData.symbol}
                                            onChange={(e) => {
                                                const newSymbol = e.target.value.toUpperCase();
                                                setFormData({ ...formData, symbol: newSymbol });
                                                setShowSymbolDropdown(true);
                                            }}
                                            onFocus={() => setShowSymbolDropdown(true)}
                                            className="w-full pl-3.5 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-800 dark:text-white transition-all"
                                            placeholder="例如 BTCUSD, XAUUSD, EURUSD"
                                            autoComplete="off"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowSymbolDropdown((v) => !v);
                                                symbolInputRef.current?.focus();
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-md transition-colors"
                                            tabIndex={-1}
                                        >
                                            <ChevronDown size={18} />
                                        </button>
                                        {showSymbolDropdown && filteredSymbolSuggestions.length > 0 && (
                                            <div className="absolute z-20 mt-1.5 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-xl py-1.5 max-h-60 overflow-auto">
                                                {filteredSymbolSuggestions.map((s) => (
                                                    <button
                                                        key={s}
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData({ ...formData, symbol: s });
                                                            setShowSymbolDropdown(false);
                                                        }}
                                                        className="w-full text-left px-3.5 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-purple-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                                                    >
                                                        <span className="font-semibold">{s}</span>
                                                        <span className="text-xs text-gray-400">选择标的</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 多空方向 & 仓位手数 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                            多空方向 (Direction) <span className="text-red-500">*</span>
                                        </label>
                                        <Select
                                            value={formData.direction}
                                            onChange={(v) => setFormData({ ...formData, direction: v as CreateTradeData['direction'] })}
                                            options={[
                                                { value: 'long', label: '做多 (BUY / LONG)' },
                                                { value: 'short', label: '做空 (SELL / SHORT)' },
                                            ]}
                                            placeholder="选择方向"
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                            仓位手数 / 规模 (Size) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.01"
                                            value={formData.size}
                                            onChange={(e) => setFormData({ ...formData, size: parseFloat(e.target.value) })}
                                            className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-800 dark:text-white transition-all"
                                        />
                                    </div>
                                </div>

                                {/* 入场价格 & 出场价格 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="min-w-0">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                            入场价格 (Entry Price) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="0"
                                            step="0.00001"
                                            value={formData.entryPrice}
                                            onChange={(e) => setFormData({ ...formData, entryPrice: parseFloat(e.target.value) })}
                                            className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-800 dark:text-white transition-all"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                            出场价格 (Exit Price，选填)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.00001"
                                            value={formData.exitPrice || ''}
                                            onChange={(e) =>
                                                setFormData({ ...formData, exitPrice: e.target.value ? parseFloat(e.target.value) : undefined })
                                            }
                                            className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-800 dark:text-white transition-all"
                                            placeholder="持仓中可留空"
                                        />
                                    </div>
                                </div>

                                {/* 止损点位 & 止盈点位 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                            止损点位 (Stop Loss)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.00001"
                                            value={formData.stopLoss || ''}
                                            onChange={(e) =>
                                                setFormData({ ...formData, stopLoss: e.target.value ? parseFloat(e.target.value) : undefined })
                                            }
                                            className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-800 dark:text-white transition-all"
                                            placeholder="SL 价格"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                            止盈点位 (Take Profit)
                                        </label>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.00001"
                                            value={formData.takeProfit || ''}
                                            onChange={(e) =>
                                                setFormData({ ...formData, takeProfit: e.target.value ? parseFloat(e.target.value) : undefined })
                                            }
                                            className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-800 dark:text-white transition-all"
                                            placeholder="TP 价格"
                                        />
                                    </div>
                                </div>

                                {/* 入场时间 & 出场时间 */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="min-w-0">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                            入场时间 (Entry Time)
                                        </label>
                                        <DateTimePicker
                                            value={formData.entryTime || ''}
                                            onChange={(v) => validateEntryTime(v)}
                                            max={nowLocal}
                                            error={entryTimeError}
                                            placeholder="选择入场时间"
                                            className="w-full"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                            出场时间 (Exit Time)
                                        </label>
                                        <DateTimePicker
                                            value={formData.exitTime || ''}
                                            onChange={(v) => validateExitTime(v)}
                                            max={nowLocal}
                                            error={exitTimeError}
                                            placeholder="选择出场时间 (选填)"
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                                {/* 平仓净盈亏金额 */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                        平仓净盈亏金额 (Final P/L)
                                    </label>
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
                                        placeholder="留空则按入离场价格自动测算"
                                        className="w-full px-3.5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-800 dark:text-white transition-all"
                                    />
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                        {(() => {
                                            const auto = calculateAutoPnL();
                                            if (!auto) return `杠杆倍数: ${formData.leverage ?? 1}x`;
                                            return `自动测算: ${auto.pnl >= 0 ? '+' : ''}${auto.pnl.toFixed(2)} (${auto.pnlPercent.toFixed(2)}%) | 杠杆: ${formData.leverage ?? 1}x`;
                                        })()}
                                    </p>
                                </div>

                                {/* 实时测算与盈亏汇总 */}
                                <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-4 border border-gray-200/60 dark:border-gray-700/60 space-y-2.5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="font-medium text-gray-500 dark:text-gray-400">交易状态</span>
                                        {(() => {
                                            const status = getTradeStatus();
                                            return (
                                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${status === 'completed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'}`}>
                                                    {status === 'completed' ? '已平仓结算' : '持仓中'}
                                                </span>
                                            );
                                        })()}
                                    </div>
                                    {(() => {
                                        const autoPnl = calculateAutoPnL();
                                        if (autoPnl) {
                                            return (
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="font-medium text-gray-500 dark:text-gray-400">系统估算盈亏</span>
                                                    <span className={`font-bold font-mono ${autoPnl.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                        {autoPnl.pnl >= 0 ? '+' : ''}${autoPnl.pnl.toFixed(2)} ({autoPnl.pnlPercent.toFixed(2)}%)
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
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="font-medium text-gray-500 dark:text-gray-400">目标盈亏比 (Target R/R)</span>
                                                    <span className="font-bold font-mono text-gray-900 dark:text-white">1 : {targetRR.toFixed(2)}</span>
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
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="font-medium text-gray-500 dark:text-gray-400">实际盈亏比 (Actual R/R)</span>
                                                    <span className={`font-bold font-mono ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>1 : {Math.abs(actualRR).toFixed(2)}</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Card 2: 策略信号与交易心智 */}
                        {(activeTab === 'all' || activeTab === 'strategy') && (
                            <div className="bg-gray-50/70 dark:bg-gray-900/40 border border-gray-200/80 dark:border-gray-700/70 rounded-2xl p-5 sm:p-6 space-y-6">
                                <div className="flex items-center justify-between pb-3 border-b border-gray-200/60 dark:border-gray-700/60">
                                    <div className="flex items-center space-x-2.5">
                                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                            <Compass className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">策略信号与交易心智</h3>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">入场形态、交易时段与心理情绪量化</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                                        Strategy & Mindset
                                    </span>
                                </div>

                                {/* 交易时段 */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                        交易时段 (Market Session)
                                    </label>
                                    <div className="flex flex-wrap gap-2.5">
                                        {[
                                            { value: 'Asia' as const, label: '亚盘时段 (Asia)', time: '08:00 - 15:00' },
                                            { value: 'Europe' as const, label: '欧盘时段 (Europe)', time: '15:00 - 21:00' },
                                            { value: 'US' as const, label: '美盘时段 (US)', time: '21:00 - 次日 08:00' },
                                        ].map((option) => {
                                            const selected = formData.session === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, session: selected ? undefined : option.value })}
                                                    className={`px-3.5 py-2 text-xs font-medium rounded-xl border transition-all ${
                                                        selected
                                                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-gray-750'
                                                    }`}
                                                >
                                                    <span>{option.label}</span>
                                                    <span className={`ml-1.5 font-mono text-[10px] ${selected ? 'text-purple-200' : 'text-gray-400 dark:text-gray-500'}`}>
                                                        {option.time}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">已根据开仓时间自动推算交易时段 (支持手动微调切换)</p>
                                </div>

                                {/* 入场信号与条件 */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                            入场信号与条件 (Entry Conditions) <span className="text-red-500">*</span>
                                        </label>
                                        {(formData.entryConditions || []).length > 0 && (
                                            <span className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                                                已选 {(formData.entryConditions || []).length} 项
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {ENTRY_CONDITION_OPTIONS.map((condition) => {
                                            const selected = (formData.entryConditions || []).includes(condition);
                                            return (
                                                <button
                                                    key={condition}
                                                    type="button"
                                                    onClick={() => toggleEntryCondition(condition)}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                                        selected
                                                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-gray-750'
                                                    }`}
                                                >
                                                    {condition}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">请至少选择一个入场形态或信号条件（多选）</p>
                                </div>

                                {/* 入场心理 / 情绪状态 */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                        入场心理 / 情绪状态 (Sentiment)
                                    </label>
                                    <div className="flex flex-wrap gap-2.5">
                                        {SENTIMENT_OPTIONS.map((option) => {
                                            const selected = formData.sentiment === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, sentiment: selected ? undefined : option.value })}
                                                    className={`px-3.5 py-2 text-xs font-medium rounded-xl border transition-all flex items-center space-x-1.5 ${
                                                        selected
                                                            ? option.selectedClass + ' shadow-xs'
                                                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-gray-750'
                                                    }`}
                                                >
                                                    <span>{option.emoji}</span>
                                                    <span>{option.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">记录入场时的心智状态，从焦虑、冲动到知行合一心流 (选填)</p>
                                </div>
                            </div>
                        )}

                        {/* Card 3: 复盘反思与执行评估 */}
                        {(activeTab === 'all' || activeTab === 'journal') && (
                            <div className="bg-gray-50/70 dark:bg-gray-900/40 border border-gray-200/80 dark:border-gray-700/70 rounded-2xl p-5 sm:p-6 space-y-6">
                                <div className="flex items-center justify-between pb-3 border-b border-gray-200/60 dark:border-gray-700/60">
                                    <div className="flex items-center space-x-2.5">
                                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">复盘反思与执行评估</h3>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">纪律打分、离场触发机制、笔记与图表走势</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                                        Journal
                                    </span>
                                </div>

                                {isEditMode && (
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                            执行纪律评分 (Rating，选填)
                                        </label>
                                        <div className="flex items-center gap-2">
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
                                                        title={`${star} 星`}
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
                                                    className="ml-3 text-xs text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    清空
                                                </button>
                                            )}
                                        </div>
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">给这笔交易的计划执行力与纪律度打分 (1~5 星)</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                        最终价格走势 (选填)
                                    </label>
                                    <div className="flex flex-wrap gap-2.5">
                                        {[
                                            { value: 'takeProfit' as const, label: '达止盈 (TP)' },
                                            { value: 'stopLoss' as const, label: '达止损 (SL)' },
                                        ].map((option) => {
                                            const selected = formData.finalTrigger === option.value;
                                            const activeStyles = option.value === 'takeProfit'
                                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                                : 'bg-rose-600 text-white border-rose-600 shadow-xs';
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, finalTrigger: selected ? undefined : option.value })}
                                                    className={`px-4 py-2 text-xs font-medium rounded-xl border transition-all ${selected ? activeStyles : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-purple-400'}`}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">手动平仓订单可标记后续行情最终价格是达止盈还是达止损离场</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                        复盘心得与笔记 (Notes，选填)
                                    </label>
                                    <textarea
                                        value={formData.notes || ''}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        rows={4}
                                        className="w-full px-3.5 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 dark:bg-gray-800 dark:text-white transition-all leading-relaxed"
                                        placeholder="记录这笔交易的思考、犯错原因或心理总结..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                                        行情走势与执行截图 (Screenshots，选填)
                                    </label>
                                    <div className="flex items-center justify-center w-full">
                                        <label
                                            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer hover:bg-white dark:hover:bg-gray-800 bg-white/50 dark:bg-gray-800/50 transition-colors ${uploadingImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <Upload className="w-8 h-8 mb-2 text-gray-400" />
                                                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                                                    {uploadingImage ? '正在上传图片...' : '点击上传图表截图'}
                                                </p>
                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">支持 PNG, JPG, GIF, WEBP (单张最大 5MB)</p>
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
                                        <div className="grid grid-cols-3 gap-3 mt-3">
                                            {formData.screenshots.map((url, index) => (
                                                <div key={index} className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-xs">
                                                    <img
                                                        src={url.startsWith('http') ? url : `${API_BASE_URL}${url}`}
                                                        alt={`Screenshot ${index + 1}`}
                                                        onClick={() => setLightboxImage({
                                                            urls: (formData.screenshots || []).map(u => u.startsWith('http') ? u : `${API_BASE_URL}${u}`),
                                                            index
                                                        })}
                                                        className="w-full h-24 object-cover cursor-pointer hover:scale-105 transition-transform"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveImage(index)}
                                                        className="absolute top-1.5 right-1.5 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </form>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/60 dark:bg-navy-950/60 shrink-0">
                        <div>
                            {isEditMode && (
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={loading || deleting}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-600 hover:text-white hover:bg-red-600 dark:text-red-400 dark:hover:text-white dark:hover:bg-red-600 border border-red-200 dark:border-red-800 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Trash2 size={14} />
                                    删除此交易
                                </button>
                            )}
                        </div>
                        <div className="flex space-x-3">
                            <Button variant="gradient" onClick={onClose} disabled={loading || deleting}>
                                取消
                            </Button>
                            <Button variant="primary" disabled={loading || deleting} onClick={handleSubmit}>
                                {loading ? '正在保存...' : isEditMode ? '保存修改' : '创建记录'}
                            </Button>
                        </div>
                    </div>

                    {/* Delete confirmation */}
                    {showDeleteConfirm && (
                        <div
                            className="absolute inset-0 z-40 flex items-center justify-center px-4 bg-black/50 dark:bg-black/60 backdrop-blur-sm"
                            onClick={() => !deleting && setShowDeleteConfirm(false)}
                        >
                            <div
                                className="w-full max-w-md bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">删除交易确认</h3>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">确定要删除这笔交易记录吗？删除后将无法恢复。</p>
                                </div>
                                <div className="flex justify-end gap-2 px-5 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
                                    <Button variant="gradient" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                                        取消
                                    </Button>
                                    <Button
                                        variant="primary"
                                        className="bg-red-600 hover:bg-red-700"
                                        disabled={deleting}
                                        onClick={async () => {
                                            if (!trade) return;
                                            const token = localStorage.getItem('token');
                                            if (!token) {
                                                setError('请登录后操作删除。');
                                                setShowDeleteConfirm(false);
                                                return;
                                            }
                                            try {
                                                setDeleting(true);
                                                await deleteTrade(token, trade.id);
                                                onDelete?.();
                                                onClose();
                                            } catch (err: any) {
                                                setError(err.response?.data?.message || '删除交易失败。');
                                            } finally {
                                                setDeleting(false);
                                                setShowDeleteConfirm(false);
                                            }
                                        }}
                                    >
                                        {deleting ? '正在删除...' : '确认删除'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-[1010] flex items-center justify-center bg-black/80 p-4"
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
        </>,
        document.body
    );
};

export default TradeDrawer;