import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, Pause, SkipForward, RotateCcw, TrendingUp, TrendingDown, 
  DollarSign, CheckCircle2, AlertCircle, Save, Download, 
  Settings, Eye, BarChart2, ShieldAlert, Award,
  Calculator, Target, Shield, Percent, Sparkles, Sliders, Check,
  MousePointer, Minus, MoveDiagonal, Trash2, Layers, Crosshair
} from 'lucide-react';
import { fetchCandles, CandleItem, createTrade, createBulkTrades } from '../services/api';
import SymbolSearchSelect from './common/SymbolSearchSelect';

interface OpenPosition {
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  entryTime: string;
  entryBarIndex: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskAmount?: number;
  targetProfit?: number;
  rrRatio?: number;
}

interface ReplayTrade {
  id: number;
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: string;
  exitTime: string;
  profit: number;
  pnlPercent: number;
  exitReason: 'Stop Loss' | 'Take Profit' | 'Manual Close';
  rrRatio?: number;
}

interface ManualBarReplayProps {
  initialSymbol?: string;
  popularSymbols?: string[];
  allSymbols?: string[];
}

const formatPriceNumber = (price: number, basePrice?: number): string => {
  if (isNaN(price)) return '0.00';
  const ref = basePrice || price;
  if (ref > 500) return price.toFixed(2);
  if (ref > 50) return price.toFixed(3);
  return price.toFixed(5);
};

const formatPips = (priceDiff: number, basePrice: number): string => {
  if (isNaN(priceDiff) || priceDiff <= 0) return '0 点';
  if (basePrice > 500) {
    return `${priceDiff.toFixed(2)} 点`;
  }
  if (basePrice > 50) {
    return `${(priceDiff * 100).toFixed(1)} 点`;
  }
  return `${(priceDiff * 10000).toFixed(1)} 点`;
};

function drawRoundedRect(
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

export default function ManualBarReplay({ 
  initialSymbol = 'EURUSD', 
  popularSymbols = [],
  allSymbols = [] 
}: ManualBarReplayProps) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState('H1');
  const [allCandles, setAllCandles] = useState<CandleItem[]>([]);
  const [contractSize, setContractSize] = useState<number>(100000);
  const [currentIndex, setCurrentIndex] = useState<number>(50); // Start showing first 50 bars
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1000); // ms per bar

  // TradingView Style Position & Risk Sizer State
  const [accountCapital, setAccountCapital] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(1); // 1%
  const [orderDirection, setOrderDirection] = useState<'long' | 'short'>('long');
  const [riskRewardRatio, setRiskRewardRatio] = useState<number>(2.0); // 1:2
  const [slPrice, setSlPrice] = useState<string>('');
  const [tpPrice, setTpPrice] = useState<string>('');
  const [lotSize, setLotSize] = useState<string>('0.1');
  const [autoSizing, setAutoSizing] = useState<boolean>(true);
  const [showTvVisuals, setShowTvVisuals] = useState<boolean>(true);

  // Manual Chart Drawing State (手动画线系统)
  type DrawingTool = 'pointer' | 'long' | 'short' | 'horizontal' | 'trendline';
  const [activeTool, setActiveTool] = useState<DrawingTool>('pointer');
  const [horizontalLines, setHorizontalLines] = useState<Array<{ id: string; price: number; label?: string }>>([]);
  const [trendLines, setTrendLines] = useState<Array<{ id: string; x1: number; y1: number; price1: number; x2: number; y2: number; price2: number }>>([]);
  const [dragTarget, setDragTarget] = useState<{ type: 'tp' | 'sl' | 'entry' | 'horizontal'; lineId?: string; startY: number } | null>(null);
  const [hoverHandle, setHoverHandle] = useState<string | null>(null);
  const [isDrawingTrend, setIsDrawingTrend] = useState<boolean>(false);
  const [trendStart, setTrendStart] = useState<{ x: number; y: number; price: number } | null>(null);
  const [trendCurrent, setTrendCurrent] = useState<{ x: number; y: number; price: number } | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  // Position & Replay Trades
  const [position, setPosition] = useState<OpenPosition | null>(null);
  const [replayTrades, setReplayTrades] = useState<ReplayTrade[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<any>(null);
  const scaleRef = useRef<{
    w: number;
    h: number;
    chartPadding: { top: number; right: number; bottom: number; left: number };
    chartW: number;
    chartH: number;
    minPrice: number;
    maxPrice: number;
    priceRange: number;
    priceToY: (price: number) => number;
    yToPrice: (y: number) => number;
    tvVisuals?: {
      entryY: number;
      slY: number;
      tpY: number | null;
      boxLeft: number;
      boxRight: number;
      boxW: number;
    };
  } | null>(null);

  // Load candle data
  const loadCandleData = useCallback(async () => {
    try {
      setLoading(true);
      setIsPlaying(false);
      setPosition(null);
      setReplayTrades([]);
      const data = await fetchCandles({
        symbol,
        timeframe,
        count: 400,
      });

      if (data.candles && data.candles.length > 50) {
        setAllCandles(data.candles);
        setContractSize(data.contractSize || 100000);
        setCurrentIndex(50); // Cut off past 50 bars
      } else {
        alert('未获取到足够的 K 线数据');
      }
    } catch (err: any) {
      alert(`获取行情失败: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    loadCandleData();
  }, [loadCandleData]);

  // Current visible candles
  const visibleCandles = allCandles.slice(0, currentIndex + 1);
  const currentCandle = visibleCandles[visibleCandles.length - 1];

  // Reset SL & TP to defaults based on direction and current candle
  const resetSlTpToDefaults = useCallback((dir: 'long' | 'short', candle?: CandleItem) => {
    const c = candle || currentCandle;
    if (!c) return;
    const entry = c.close;
    
    // Look back last 10 bars to estimate typical volatility
    const recentBars = allCandles.slice(Math.max(0, currentIndex - 10), currentIndex + 1);
    const avgRange = recentBars.length > 0 
      ? recentBars.reduce((acc, bar) => acc + (bar.high - bar.low), 0) / recentBars.length
      : entry * 0.003;
    
    const slDist = Math.max(avgRange * 1.2, entry * (entry > 500 ? 0.001 : 0.0015));
    
    let defaultSl: number;
    let defaultTp: number;

    if (dir === 'long') {
      defaultSl = entry - slDist;
      defaultTp = entry + slDist * riskRewardRatio;
    } else {
      defaultSl = entry + slDist;
      defaultTp = entry - slDist * riskRewardRatio;
    }

    setSlPrice(formatPriceNumber(defaultSl, entry));
    setTpPrice(formatPriceNumber(defaultTp, entry));
  }, [allCandles, currentIndex, currentCandle, riskRewardRatio]);

  // Initial and candle-change sync
  useEffect(() => {
    if (!position && currentCandle && (!slPrice || !tpPrice)) {
      resetSlTpToDefaults(orderDirection, currentCandle);
    }
  }, [currentIndex, orderDirection, position, currentCandle, slPrice, tpPrice, resetSlTpToDefaults]);

  // Dynamic Position Sizing & Risk Calculations
  const entryPrice = currentCandle?.close || 0;
  const parsedSl = parseFloat(slPrice);
  const parsedTp = parseFloat(tpPrice);

  const slDistance = (entryPrice > 0 && !isNaN(parsedSl)) ? Math.abs(entryPrice - parsedSl) : 0;
  const tpDistance = (entryPrice > 0 && !isNaN(parsedTp)) ? Math.abs(entryPrice - parsedTp) : 0;

  // Dollar Risk Budget
  const riskAmount = Math.round(accountCapital * (riskPercent / 100) * 100) / 100;

  // Calculated Lots based on Risk Budget and SL distance
  const calculatedLots = useMemo(() => {
    if (slDistance <= 0 || contractSize <= 0) return 0.1;
    const rawLots = riskAmount / (slDistance * contractSize);
    const rounded = Math.round(rawLots * 100) / 100;
    return Math.max(0.01, rounded);
  }, [riskAmount, slDistance, contractSize]);

  // Keep lotSize in sync if autoSizing is on
  useEffect(() => {
    if (autoSizing && calculatedLots > 0) {
      setLotSize(calculatedLots.toString());
    }
  }, [autoSizing, calculatedLots]);

  const activeLots = autoSizing ? calculatedLots : (parseFloat(lotSize) || 0.1);

  // Projected Dollar Loss & Profit
  const projectedLoss = slDistance > 0 ? Math.round(slDistance * activeLots * contractSize * 100) / 100 : riskAmount;
  const projectedProfit = tpDistance > 0 ? Math.round(tpDistance * activeLots * contractSize * 100) / 100 : 0;
  const currentRR = slDistance > 0 && tpDistance > 0 ? Math.round((tpDistance / slDistance) * 100) / 100 : riskRewardRatio;

  // Handlers for switching direction, quick SL, and applying R:R
  const handleSwitchDirection = (dir: 'long' | 'short') => {
    setOrderDirection(dir);
    if (currentCandle) {
      resetSlTpToDefaults(dir, currentCandle);
    }
  };

  const handleApplyRR = (rr: number) => {
    setRiskRewardRatio(rr);
    if (!currentCandle) return;
    const entry = currentCandle.close;
    const sl = parseFloat(slPrice);
    if (!isNaN(sl)) {
      const slDist = Math.abs(entry - sl);
      if (slDist > 0) {
        const newTp = orderDirection === 'long' 
          ? entry + slDist * rr 
          : entry - slDist * rr;
        setTpPrice(formatPriceNumber(newTp, entry));
      }
    }
  };

  const handleQuickSL = (type: 'bar' | 'swing3' | 'swing5' | 'pips20' | 'pips50') => {
    if (!currentCandle) return;
    const entry = currentCandle.close;
    let targetSl = entry;

    if (type === 'bar') {
      targetSl = orderDirection === 'long' ? currentCandle.low : currentCandle.high;
    } else if (type === 'swing3') {
      const slice = visibleCandles.slice(-3);
      targetSl = orderDirection === 'long' 
        ? Math.min(...slice.map(c => c.low)) 
        : Math.max(...slice.map(c => c.high));
    } else if (type === 'swing5') {
      const slice = visibleCandles.slice(-5);
      targetSl = orderDirection === 'long' 
        ? Math.min(...slice.map(c => c.low)) 
        : Math.max(...slice.map(c => c.high));
    } else if (type === 'pips20') {
      const diff = entry > 500 ? 5 : (entry > 50 ? 0.20 : 0.0020);
      targetSl = orderDirection === 'long' ? entry - diff : entry + diff;
    } else if (type === 'pips50') {
      const diff = entry > 500 ? 15 : (entry > 50 ? 0.50 : 0.0050);
      targetSl = orderDirection === 'long' ? entry - diff : entry + diff;
    }

    setSlPrice(formatPriceNumber(targetSl, entry));

    // Update TP based on current R:R
    const slDist = Math.abs(entry - targetSl);
    if (slDist > 0) {
      const newTp = orderDirection === 'long' 
        ? entry + slDist * riskRewardRatio 
        : entry - slDist * riskRewardRatio;
      setTpPrice(formatPriceNumber(newTp, entry));
    }
  };

  // Advance 1 bar forward
  const stepForward = useCallback(() => {
    if (currentIndex >= allCandles.length - 1) {
      setIsPlaying(false);
      return;
    }

    const nextIdx = currentIndex + 1;
    const nextBar = allCandles[nextIdx];

    // Check position exit against next bar's high/low
    if (position) {
      let exitPrice: number | null = null;
      let exitReason: 'Stop Loss' | 'Take Profit' | 'Manual Close' | null = null;

      if (position.direction === 'long') {
        if (position.stopLoss && nextBar.low <= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'Stop Loss';
        } else if (position.takeProfit && nextBar.high >= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'Take Profit';
        }
      } else {
        // short
        if (position.stopLoss && nextBar.high >= position.stopLoss) {
          exitPrice = position.stopLoss;
          exitReason = 'Stop Loss';
        } else if (position.takeProfit && nextBar.low <= position.takeProfit) {
          exitPrice = position.takeProfit;
          exitReason = 'Take Profit';
        }
      }

      if (exitPrice !== null && exitReason !== null) {
        const diff = position.direction === 'long' 
          ? exitPrice - position.entryPrice 
          : position.entryPrice - exitPrice;
        const profit = diff * position.size * contractSize;
        const pnlPct = (diff / position.entryPrice) * 100;

        const closedTrade: ReplayTrade = {
          id: replayTrades.length + 1,
          symbol: position.symbol,
          direction: position.direction,
          size: position.size,
          entryPrice: position.entryPrice,
          exitPrice: exitPrice,
          entryTime: position.entryTime,
          exitTime: nextBar.time,
          profit: Math.round(profit * 100) / 100,
          pnlPercent: Math.round(pnlPct * 100) / 100,
          exitReason,
          rrRatio: position.rrRatio,
        };

        setReplayTrades(prev => [closedTrade, ...prev]);
        setPosition(null);
      }
    }

    setCurrentIndex(nextIdx);
  }, [currentIndex, allCandles, position, contractSize, replayTrades.length]);

  // Keyboard shortcut: Space or ArrowRight to step forward
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        stepForward();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        stepForward();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stepForward]);

  // Auto-play timer
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        stepForward();
      }, playSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playSpeed, stepForward]);

  // Open position with TradingView risk sizing
  const openOrder = (direction: 'long' | 'short') => {
    if (!currentCandle) return;
    if (position) {
      alert('当前已有持仓，请先平仓或等待止盈止损触发后再开新仓');
      return;
    }

    const currentEntry = currentCandle.close;
    const sl = slPrice ? parseFloat(slPrice) : null;
    const tp = tpPrice ? parseFloat(tpPrice) : null;

    if (sl !== null && !isNaN(sl)) {
      if (direction === 'long' && sl >= currentEntry) {
        alert('多头看涨止损价必须低于当前入场价！');
        return;
      }
      if (direction === 'short' && sl <= currentEntry) {
        alert('空头看跌止损价必须高于当前入场价！');
        return;
      }
    }

    if (tp !== null && !isNaN(tp)) {
      if (direction === 'long' && tp <= currentEntry) {
        alert('多头看涨止盈价必须高于当前入场价！');
        return;
      }
      if (direction === 'short' && tp >= currentEntry) {
        alert('空头看跌止盈价必须低于当前入场价！');
        return;
      }
    }

    setPosition({
      symbol,
      direction,
      size: activeLots,
      entryPrice: currentEntry,
      entryTime: currentCandle.time,
      entryBarIndex: currentIndex,
      stopLoss: sl,
      takeProfit: tp,
      riskAmount: projectedLoss,
      targetProfit: projectedProfit,
      rrRatio: currentRR,
    });
  };

  // Close position manually
  const closePosition = () => {
    if (!position || !currentCandle) return;
    const exitPrice = currentCandle.close;
    const diff = position.direction === 'long' 
      ? exitPrice - position.entryPrice 
      : position.entryPrice - exitPrice;
    const profit = diff * position.size * contractSize;
    const pnlPct = (diff / position.entryPrice) * 100;

    const closedTrade: ReplayTrade = {
      id: replayTrades.length + 1,
      symbol: position.symbol,
      direction: position.direction,
      size: position.size,
      entryPrice: position.entryPrice,
      exitPrice,
      entryTime: position.entryTime,
      exitTime: currentCandle.time,
      profit: Math.round(profit * 100) / 100,
      pnlPercent: Math.round(pnlPct * 100) / 100,
      exitReason: 'Manual Close',
      rrRatio: position.rrRatio,
    };

    setReplayTrades(prev => [closedTrade, ...prev]);
    setPosition(null);
  };

  // Calculate floating PnL
  let floatingProfit = 0;
  let floatingPct = 0;
  if (position && currentCandle) {
    const diff = position.direction === 'long' 
      ? currentCandle.close - position.entryPrice 
      : position.entryPrice - currentCandle.close;
    floatingProfit = Math.round(diff * position.size * contractSize * 100) / 100;
    floatingPct = Math.round((diff / position.entryPrice) * 10000) / 100;
  }

  // Canvas Mouse Down Handler for Drawing & Dragging
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const scale = scaleRef.current;
    if (!scale) return;

    const clickedPrice = scale.yToPrice(mouseY);

    // 1. Tool: Horizontal Support/Resistance Line
    if (activeTool === 'horizontal') {
      setHorizontalLines(prev => [
        ...prev,
        {
          id: 'hl_' + Date.now(),
          price: clickedPrice,
          label: `支撑/阻力 ${formatPriceNumber(clickedPrice, clickedPrice)}`
        }
      ]);
      setActiveTool('pointer');
      return;
    }

    // 2. Tool: Long Position Sizing Tool placement
    if (activeTool === 'long') {
      setOrderDirection('long');
      const entry = clickedPrice;
      const typicalDist = (scale.maxPrice - scale.minPrice) * 0.12;
      const newSl = entry - typicalDist;
      const newTp = entry + typicalDist * riskRewardRatio;
      setSlPrice(formatPriceNumber(newSl, entry));
      setTpPrice(formatPriceNumber(newTp, entry));
      setActiveTool('pointer');
      return;
    }

    // 3. Tool: Short Position Sizing Tool placement
    if (activeTool === 'short') {
      setOrderDirection('short');
      const entry = clickedPrice;
      const typicalDist = (scale.maxPrice - scale.minPrice) * 0.12;
      const newSl = entry + typicalDist;
      const newTp = entry - typicalDist * riskRewardRatio;
      setSlPrice(formatPriceNumber(newSl, entry));
      setTpPrice(formatPriceNumber(newTp, entry));
      setActiveTool('pointer');
      return;
    }

    // 4. Tool: Trendline Drawing Start
    if (activeTool === 'trendline') {
      setIsDrawingTrend(true);
      setTrendStart({ x: mouseX, y: mouseY, price: clickedPrice });
      setTrendCurrent({ x: mouseX, y: mouseY, price: clickedPrice });
      return;
    }

    // 5. Tool: Pointer mode - Check for handles on TP, SL, or Horizontal Lines
    if (showTvVisuals && scale.tvVisuals) {
      const { tpY, slY, entryY, boxLeft, boxRight } = scale.tvVisuals;
      if (mouseX >= boxLeft - 15 && mouseX <= boxRight + 40) {
        if (tpY !== null && Math.abs(mouseY - tpY) <= 14) {
          setDragTarget({ type: 'tp', startY: mouseY });
          return;
        }
        if (Math.abs(mouseY - slY) <= 14) {
          setDragTarget({ type: 'sl', startY: mouseY });
          return;
        }
        if (Math.abs(mouseY - entryY) <= 10 && !position) {
          setDragTarget({ type: 'entry', startY: mouseY });
          return;
        }
      }
    }

    // Check horizontal lines
    for (const hl of horizontalLines) {
      const ly = scale.priceToY(hl.price);
      if (Math.abs(mouseY - ly) <= 10) {
        setDragTarget({ type: 'horizontal', lineId: hl.id, startY: mouseY });
        return;
      }
    }
  };

  // Canvas Mouse Move Handler
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const scale = scaleRef.current;
    if (!scale) return;

    const currentPrice = scale.yToPrice(mouseY);
    setHoverPrice(currentPrice);

    // If currently dragging TP, SL, or Horizontal Line
    if (dragTarget) {
      const currentEntry = position ? position.entryPrice : entryPrice;
      const minStep = (scale.maxPrice - scale.minPrice) * 0.005;

      if (dragTarget.type === 'tp') {
        let newTp = currentPrice;
        if (orderDirection === 'long') {
          newTp = Math.max(newTp, currentEntry + minStep);
        } else {
          newTp = Math.min(newTp, currentEntry - minStep);
        }
        setTpPrice(formatPriceNumber(newTp, currentEntry));
        if (slDistance > 0) {
          const newTpDist = Math.abs(newTp - currentEntry);
          setRiskRewardRatio(Math.max(0.1, Math.round((newTpDist / slDistance) * 100) / 100));
        }
      } else if (dragTarget.type === 'sl') {
        let newSl = currentPrice;
        if (orderDirection === 'long') {
          newSl = Math.min(newSl, currentEntry - minStep);
        } else {
          newSl = Math.max(newSl, currentEntry + minStep);
        }
        setSlPrice(formatPriceNumber(newSl, currentEntry));
        const newSlDist = Math.abs(currentEntry - newSl);
        if (newSlDist > 0 && tpDistance > 0) {
          setRiskRewardRatio(Math.max(0.1, Math.round((tpDistance / newSlDist) * 100) / 100));
        }
      } else if (dragTarget.type === 'horizontal' && dragTarget.lineId) {
        setHorizontalLines(prev =>
          prev.map(l => (l.id === dragTarget.lineId ? { ...l, price: currentPrice } : l))
        );
      }
      return;
    }

    // If currently drawing trendline preview
    if (isDrawingTrend) {
      setTrendCurrent({ x: mouseX, y: mouseY, price: currentPrice });
      return;
    }

    // Hover detection for interactive feedback
    if (showTvVisuals && scale.tvVisuals) {
      const { tpY, slY, entryY, boxLeft, boxRight } = scale.tvVisuals;
      if (mouseX >= boxLeft - 15 && mouseX <= boxRight + 40) {
        if (tpY !== null && Math.abs(mouseY - tpY) <= 14) {
          setHoverHandle('tp');
          return;
        }
        if (Math.abs(mouseY - slY) <= 14) {
          setHoverHandle('sl');
          return;
        }
        if (Math.abs(mouseY - entryY) <= 10 && !position) {
          setHoverHandle('entry');
          return;
        }
      }
    }

    for (const hl of horizontalLines) {
      const ly = scale.priceToY(hl.price);
      if (Math.abs(mouseY - ly) <= 10) {
        setHoverHandle('h_' + hl.id);
        return;
      }
    }

    setHoverHandle(null);
  };

  // Canvas Mouse Up Handler
  const handleCanvasMouseUp = () => {
    if (isDrawingTrend && trendStart && trendCurrent) {
      const dist = Math.hypot(trendCurrent.x - trendStart.x, trendCurrent.y - trendStart.y);
      if (dist > 15) {
        setTrendLines(prev => [
          ...prev,
          {
            id: 'tl_' + Date.now(),
            x1: trendStart.x,
            y1: trendStart.y,
            price1: trendStart.price,
            x2: trendCurrent.x,
            y2: trendCurrent.y,
            price2: trendCurrent.price,
          }
        ]);
      }
      setIsDrawingTrend(false);
      setTrendStart(null);
      setTrendCurrent(null);
      setActiveTool('pointer');
    }
    setDragTarget(null);
  };

  // Global window mouseup for fluid drag experience outside canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragTarget) setDragTarget(null);
      if (isDrawingTrend) {
        setIsDrawingTrend(false);
        setTrendStart(null);
        setTrendCurrent(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragTarget, isDrawingTrend]);

  const getCanvasCursorClass = () => {
    if (activeTool === 'horizontal' || activeTool === 'long' || activeTool === 'short' || activeTool === 'trendline') {
      return 'cursor-crosshair';
    }
    if (dragTarget?.type === 'tp' || dragTarget?.type === 'sl' || hoverHandle === 'tp' || hoverHandle === 'sl') {
      return 'cursor-ns-resize';
    }
    if (dragTarget?.type === 'horizontal' || (hoverHandle && hoverHandle.startsWith('h_'))) {
      return 'cursor-row-resize';
    }
    return 'cursor-default';
  };

  // Draw Candlestick Chart on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || visibleCandles.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high-DPI retina display
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear background
    const isDark = document.documentElement.classList.contains('dark');
    ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Number of bars to display on chart (show last 65 bars)
    const displayCount = Math.min(65, visibleCandles.length);
    const sliceCandles = visibleCandles.slice(visibleCandles.length - displayCount);

    // Find min and max price including active or planned SL/TP and horizontal lines
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    sliceCandles.forEach(c => {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    });

    const activeOrPlannedSl = position ? position.stopLoss : (parsedSl > 0 ? parsedSl : null);
    const activeOrPlannedTp = position ? position.takeProfit : (parsedTp > 0 ? parsedTp : null);
    const activeOrPlannedEntry = position ? position.entryPrice : (currentCandle ? currentCandle.close : null);

    if (activeOrPlannedEntry && isFinite(activeOrPlannedEntry)) {
      if (activeOrPlannedEntry < minPrice) minPrice = activeOrPlannedEntry;
      if (activeOrPlannedEntry > maxPrice) maxPrice = activeOrPlannedEntry;
    }
    if (activeOrPlannedSl && isFinite(activeOrPlannedSl) && activeOrPlannedSl > 0) {
      if (activeOrPlannedSl < minPrice) minPrice = activeOrPlannedSl;
      if (activeOrPlannedSl > maxPrice) maxPrice = activeOrPlannedSl;
    }
    if (activeOrPlannedTp && isFinite(activeOrPlannedTp) && activeOrPlannedTp > 0) {
      if (activeOrPlannedTp < minPrice) minPrice = activeOrPlannedTp;
      if (activeOrPlannedTp > maxPrice) maxPrice = activeOrPlannedTp;
    }
    horizontalLines.forEach(hl => {
      if (hl.price < minPrice) minPrice = hl.price;
      if (hl.price > maxPrice) maxPrice = hl.price;
    });

    const pricePadding = (maxPrice - minPrice) * 0.08 || 0.001;
    minPrice -= pricePadding;
    maxPrice += pricePadding;
    const priceRange = maxPrice - minPrice;

    const chartPadding = { top: 25, right: 65, bottom: 25, left: 15 };
    const chartW = w - chartPadding.left - chartPadding.right;
    const chartH = h - chartPadding.top - chartPadding.bottom;

    const priceToY = (price: number) => {
      return chartPadding.top + chartH - ((price - minPrice) / priceRange) * chartH;
    };
    const yToPrice = (y: number) => {
      const norm = (chartPadding.top + chartH - y) / chartH;
      return minPrice + norm * priceRange;
    };

    // Draw grid lines
    ctx.strokeStyle = isDark ? '#1e293b' : '#f1f5f9';
    ctx.lineWidth = 1;
    const gridRows = 5;
    for (let i = 0; i <= gridRows; i++) {
      const y = chartPadding.top + (chartH / gridRows) * i;
      const price = maxPrice - (priceRange / gridRows) * i;
      ctx.beginPath();
      ctx.moveTo(chartPadding.left, y);
      ctx.lineTo(w - chartPadding.right, y);
      ctx.stroke();

      // Price labels on right axis
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(price.toFixed(price > 100 ? 2 : 4), w - chartPadding.right + 6, y + 3);
    }

    // Candle bar width
    const barSpacing = chartW / displayCount;
    const candleW = Math.max(2, barSpacing * 0.7);

    // 1. Pre-calculate TradingView Long/Short Tool Box & Render BACKGROUND SHADED ZONES FIRST
    // (Rendered BEFORE candles so the candles & wicks are 100% crisp on top and NEVER obscured!)
    let tvBoxState: { entryY: number; slY: number; tpY: number | null; boxLeft: number; boxRight: number; boxW: number } | undefined = undefined;

    if (showTvVisuals && activeOrPlannedEntry && activeOrPlannedSl) {
      const entryY = priceToY(activeOrPlannedEntry);
      const slY = priceToY(activeOrPlannedSl);
      const tpY = (activeOrPlannedTp && activeOrPlannedTp > 0) ? priceToY(activeOrPlannedTp) : null;

      let startIndex = Math.max(0, displayCount - 22);
      if (position) {
        const foundIdx = sliceCandles.findIndex(c => c.time === position.entryTime);
        if (foundIdx >= 0) startIndex = foundIdx;
      }
      const boxLeft = Math.max(chartPadding.left + startIndex * barSpacing, chartPadding.left);
      const boxRight = w - chartPadding.right;
      const boxW = Math.max(80, boxRight - boxLeft);

      tvBoxState = { entryY, slY, tpY, boxLeft, boxRight, boxW };

      // Background Loss / Risk Area (Ultra-light 0.08 / 0.05 opacity so it never blocks candles)
      const lossTop = Math.min(entryY, slY);
      const lossHeight = Math.max(2, Math.abs(entryY - slY));
      ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)';
      ctx.fillRect(boxLeft, lossTop, boxW, lossHeight);
      ctx.strokeStyle = isDark ? 'rgba(248, 113, 113, 0.35)' : 'rgba(220, 38, 38, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash?.([4, 2]);
      ctx.strokeRect(boxLeft, lossTop, boxW, lossHeight);
      ctx.setLineDash?.([]);

      // Background Profit / Target Area (Ultra-light 0.08 / 0.05 opacity so it never blocks candles)
      if (tpY !== null) {
        const profitTop = Math.min(entryY, tpY);
        const profitHeight = Math.max(2, Math.abs(entryY - tpY));
        ctx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)';
        ctx.fillRect(boxLeft, profitTop, boxW, profitHeight);
        ctx.strokeStyle = isDark ? 'rgba(52, 211, 153, 0.35)' : 'rgba(5, 150, 105, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash?.([4, 2]);
        ctx.strokeRect(boxLeft, profitTop, boxW, profitHeight);
        ctx.setLineDash?.([]);
      }
    }

    // 2. Draw Custom Horizontal Support/Resistance Lines
    horizontalLines.forEach((hl) => {
      const ly = priceToY(hl.price);
      if (ly < chartPadding.top || ly > h - chartPadding.bottom) return;

      const isHovered = hoverHandle === 'h_' + hl.id || dragTarget?.lineId === hl.id;

      ctx.save?.();
      ctx.strokeStyle = isHovered ? '#f59e0b' : (isDark ? 'rgba(245, 158, 11, 0.8)' : 'rgba(217, 119, 6, 0.8)');
      ctx.lineWidth = isHovered ? 2.2 : 1.5;
      ctx.setLineDash?.([5, 3]);
      ctx.beginPath();
      ctx.moveTo(chartPadding.left, ly);
      ctx.lineTo(w - chartPadding.right, ly);
      ctx.stroke();
      ctx.setLineDash?.([]);

      // Label on the line
      ctx.fillStyle = isHovered ? '#f59e0b' : (isDark ? '#fbbf24' : '#b45309');
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`— 支撑/阻力: ${formatPriceNumber(hl.price, hl.price)}${isHovered ? ' (按住拖拽)' : ''}`, chartPadding.left + 10, ly - 4);

      // Price Tag on Right Axis
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(w - chartPadding.right, ly - 8, 65, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(formatPriceNumber(hl.price, hl.price), w - chartPadding.right + 4, ly + 4);
      ctx.restore?.();
    });

    // 3. Draw Custom Trendlines
    trendLines.forEach((tl) => {
      ctx.save?.();
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tl.x1, tl.y1);
      ctx.lineTo(tl.x2, tl.y2);
      ctx.stroke();

      // Endpoints anchor handles
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc?.(tl.x1, tl.y1, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.arc?.(tl.x2, tl.y2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore?.();
    });

    // Draw Live Trendline Drawing Preview
    if (isDrawingTrend && trendStart && trendCurrent) {
      ctx.save?.();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.setLineDash?.([4, 3]);
      ctx.beginPath();
      ctx.moveTo(trendStart.x, trendStart.y);
      ctx.lineTo(trendCurrent.x, trendCurrent.y);
      ctx.stroke();
      ctx.setLineDash?.([]);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc?.(trendStart.x, trendStart.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc?.(trendCurrent.x, trendCurrent.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore?.();
    }

    // 4. Draw CANDLES AND WICKS ON TOP (Crystal-clear, sharp and 100% visible)
    sliceCandles.forEach((c, i) => {
      const x = chartPadding.left + i * barSpacing + barSpacing / 2;
      const isUp = c.close >= c.open;
      const color = isUp ? '#10B981' : '#EF4444';

      const highY = priceToY(c.high);
      const lowY = priceToY(c.low);
      const openY = priceToY(c.open);
      const closeY = priceToY(c.close);

      // Wick (shadow line)
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Candle body
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(openY - closeY));
      ctx.fillStyle = color;
      ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyHeight);
    });

    // Time label on bottom axis for first & last candle
    if (sliceCandles.length > 0) {
      ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(sliceCandles[0].time, chartPadding.left, h - 8);
      ctx.textAlign = 'right';
      ctx.fillText(sliceCandles[sliceCandles.length - 1].time, w - chartPadding.right, h - 8);
    }

    // 5. Draw TradingView Position Lines, Handles and Compact Badge
    if (showTvVisuals && tvBoxState && activeOrPlannedEntry && activeOrPlannedSl) {
      const { entryY, slY, tpY, boxLeft, boxRight, boxW } = tvBoxState;
      const activeOrPlannedDir = position ? position.direction : orderDirection;
      const activeOrPlannedLots = position ? position.size : activeLots;

      // Entry Horizontal Line
      ctx.strokeStyle = activeOrPlannedDir === 'long' ? '#10B981' : '#EF4444';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(chartPadding.left, entryY);
      ctx.lineTo(boxRight, entryY);
      ctx.stroke();

      // Stop Loss Horizontal Line (dashed)
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 1.4;
      ctx.setLineDash?.([3, 2]);
      ctx.beginPath();
      ctx.moveTo(boxLeft, slY);
      ctx.lineTo(boxRight, slY);
      ctx.stroke();
      ctx.setLineDash?.([]);

      // Take Profit Horizontal Line (dashed)
      if (tpY !== null) {
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.4;
        ctx.setLineDash?.([3, 2]);
        ctx.beginPath();
        ctx.moveTo(boxLeft, tpY);
        ctx.lineTo(boxRight, tpY);
        ctx.stroke();
        ctx.setLineDash?.([]);
      }

      // Draggable Interactive Handles on TP and SL Lines
      const handleX = boxLeft + boxW / 2;

      // TP Line Handle (Green Grip)
      if (tpY !== null) {
        const isTpActive = dragTarget?.type === 'tp' || hoverHandle === 'tp';
        ctx.save?.();
        if (isTpActive) {
          ctx.beginPath();
          ctx.arc?.(handleX, tpY, 12, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(16, 185, 129, 0.35)';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc?.(handleX, tpY, isTpActive ? 7 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc?.(handleX, tpY, 2, 0, Math.PI * 2);
        ctx.fill();

        // Drag Hint Tooltip
        if (isTpActive) {
          const text = `TP 止盈: ${formatPriceNumber(activeOrPlannedTp || 0, activeOrPlannedEntry || 0)} (按住上下拖拽)`;
          ctx.font = 'bold 10px monospace';
          const tw = ctx.measureText ? ctx.measureText(text).width : 80;
          ctx.fillStyle = 'rgba(16, 185, 129, 0.95)';
          drawRoundedRect(ctx, handleX - tw / 2 - 8, tpY - 26, tw + 16, 20, 4);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(text, handleX, tpY - 12);
        }
        ctx.restore?.();
      }

      // SL Line Handle (Red Grip)
      {
        const isSlActive = dragTarget?.type === 'sl' || hoverHandle === 'sl';
        ctx.save?.();
        if (isSlActive) {
          ctx.beginPath();
          ctx.arc?.(handleX, slY, 12, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc?.(handleX, slY, isSlActive ? 7 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc?.(handleX, slY, 2, 0, Math.PI * 2);
        ctx.fill();

        // Drag Hint Tooltip
        if (isSlActive) {
          const text = `SL 止损: ${formatPriceNumber(activeOrPlannedSl || 0, activeOrPlannedEntry || 0)} (按住上下拖拽)`;
          ctx.font = 'bold 10px monospace';
          const tw = ctx.measureText ? ctx.measureText(text).width : 80;
          ctx.fillStyle = 'rgba(239, 68, 68, 0.95)';
          drawRoundedRect(ctx, handleX - tw / 2 - 8, slY + 8, tw + 16, 20, 4);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.fillText(text, handleX, slY + 22);
        }
        ctx.restore?.();
      }

      // Compact Left-Pinned Tool Info Pill (Pinned to left boundary boxLeft + 8, leaving candles on right 100% unobstructed!)
      const slD = Math.abs(activeOrPlannedEntry - activeOrPlannedSl);
      const tpD = activeOrPlannedTp ? Math.abs(activeOrPlannedTp - activeOrPlannedEntry) : 0;
      const rRatio = (slD > 0 && tpD > 0) ? (tpD / slD) : 0;

      const badgeText = position 
        ? `● ${position.direction.toUpperCase()} (${position.size}手)` 
        : `${activeOrPlannedDir === 'long' ? '📈 BUY多' : '📉 SELL空'} 1:${rRatio.toFixed(2)}`;

      ctx.font = 'bold 9px monospace';
      const textW = ctx.measureText ? ctx.measureText(badgeText).width : 70;
      const badgeW = textW + 14;
      const badgeH = 18;
      const badgeX = boxLeft + 8; // Pinned to the left side so it NEVER covers current candles!
      const badgeY = Math.max(chartPadding.top + 2, entryY - badgeH - 3);

      ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
      ctx.strokeStyle = activeOrPlannedDir === 'long' ? '#10B981' : '#EF4444';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = activeOrPlannedDir === 'long' ? '#10B981' : '#EF4444';
      ctx.fillText(badgeText, badgeX + 7, badgeY + 12);

      // Right-Axis Price Tags
      ctx.fillStyle = activeOrPlannedDir === 'long' ? '#10B981' : '#EF4444';
      ctx.fillRect(w - chartPadding.right, entryY - 9, 65, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${activeOrPlannedDir === 'long' ? 'BUY' : 'SELL'} ${formatPriceNumber(activeOrPlannedEntry, activeOrPlannedEntry)}`, w - chartPadding.right + 4, entryY + 3);

      ctx.fillStyle = '#EF4444';
      ctx.fillRect(w - chartPadding.right, slY - 8, 65, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText(`SL ${formatPriceNumber(activeOrPlannedSl, activeOrPlannedEntry)}`, w - chartPadding.right + 4, slY + 3);

      if (tpY !== null && activeOrPlannedTp) {
        ctx.fillStyle = '#10B981';
        ctx.fillRect(w - chartPadding.right, tpY - 8, 65, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        ctx.fillText(`TP ${formatPriceNumber(activeOrPlannedTp, activeOrPlannedEntry)}`, w - chartPadding.right + 4, tpY + 3);
      }
    }

    // Latest price line
    if (currentCandle) {
      const currY = priceToY(currentCandle.close);
      ctx.strokeStyle = '#8B5CF6';
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(chartPadding.left, currY);
      ctx.lineTo(w - chartPadding.right, currY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#8B5CF6';
      ctx.fillRect(w - chartPadding.right, currY - 9, 60, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(currentCandle.close.toFixed(currentCandle.close > 100 ? 2 : 4), w - chartPadding.right + 30, currY + 4);
    }

    // Save current scale matrix for interactive mouse handlers
    scaleRef.current = {
      w,
      h,
      chartPadding,
      chartW,
      chartH,
      minPrice,
      maxPrice,
      priceRange,
      priceToY,
      yToPrice,
      tvVisuals: tvBoxState,
    };
  }, [
    visibleCandles, position, currentCandle, showTvVisuals, orderDirection, 
    parsedSl, parsedTp, activeLots, floatingProfit, floatingPct, 
    horizontalLines, trendLines, isDrawingTrend, trendStart, trendCurrent, 
    hoverHandle, dragTarget
  ]);

  // Save replay trades to TradeZen database
  const saveTradesToJournal = async () => {
    if (replayTrades.length === 0) {
      alert('当前复盘暂无已完成的交易记录');
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      alert('请先登录账号后保存复盘记录到交易日记');
      return;
    }

    try {
      setSaveLoading(true);
      const tradesPayload = replayTrades.map(t => ({
        symbol: t.symbol,
        direction: t.direction,
        size: t.size,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        tradeDate: t.entryTime,
        manualPnl: t.profit,
        notes: `手动K线复盘订单 | 原因: ${t.exitReason}`,
        tags: ['Bar-Replay', t.symbol],
        finalTrigger: t.exitReason === 'Stop Loss' ? ('stopLoss' as const) : (t.exitReason === 'Take Profit' ? ('takeProfit' as const) : undefined),
      }));

      await createBulkTrades(token, tradesPayload);
      setSaveSuccessMsg(`成功将 ${replayTrades.length} 笔复盘交易保存至 TradeZen 交易日记！`);
      setTimeout(() => setSaveSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(`保存失败: ${err.message}`);
    } finally {
      setSaveLoading(false);
    }
  };

  // Summary stats
  const totalTradesCount = replayTrades.length;
  const winningTrades = replayTrades.filter(t => t.profit > 0);
  const winRate = totalTradesCount > 0 ? ((winningTrades.length / totalTradesCount) * 100).toFixed(1) : '0.0';
  const totalNetProfit = replayTrades.reduce((acc, t) => acc + t.profit, 0);

  return (
    <div className="space-y-4">
      {/* 顶部控制栏 */}
      <div className="bg-gray-50 dark:bg-navy-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
        {/* 品种与周期切换 */}
        <div className="flex items-center space-x-3">
          <div className="w-52">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">复盘品种</label>
            <SymbolSearchSelect
              value={symbol}
              onChange={(s) => setSymbol(s)}
              symbols={allSymbols.length > 0 ? allSymbols : (popularSymbols.length > 0 ? popularSymbols : ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'])}
              popularSymbols={popularSymbols}
              placeholder="搜索复盘品种..."
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">K线周期</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-navy-700 dark:text-white font-semibold"
            >
              <option value="M1">1 分钟 (M1)</option>
              <option value="M5">5 分钟 (M5)</option>
              <option value="M15">15 分钟 (M15)</option>
              <option value="M30">30 分钟 (M30)</option>
              <option value="H1">1 小时 (H1)</option>
              <option value="H4">4 小时 (H4)</option>
              <option value="D1">日线 (D1)</option>
            </select>
          </div>

          <div className="self-end pb-0.5">
            <button
              onClick={loadCandleData}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 rounded-lg transition"
            >
              {loading ? '加载中...' : '重新加载'}
            </button>
          </div>
        </div>

        {/* 核心重播控制器 (Replay Player) */}
        <div className="flex items-center space-x-2 bg-white dark:bg-navy-700 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
          <button
            onClick={() => {
              setCurrentIndex(50);
              setPosition(null);
              setIsPlaying(false);
            }}
            title="重置到起点"
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-navy-600 rounded-md text-gray-600 dark:text-gray-300"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            title={isPlaying ? '暂停' : '自动播放'}
            className={`p-1.5 rounded-md font-medium text-xs flex items-center space-x-1 ${
              isPlaying ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40' : 'bg-purple-600 text-white'
            }`}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-amber-700" /> : <Play className="w-4 h-4 fill-white" />}
          </button>

          <button
            onClick={stepForward}
            title="前进一根 K 线 (快捷键: 空格或右方向键)"
            className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-navy-600 dark:hover:bg-navy-500 rounded-md text-xs font-semibold text-gray-800 dark:text-gray-200 flex items-center space-x-1"
          >
            <span>前进一根</span>
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          <select
            value={playSpeed}
            onChange={(e) => setPlaySpeed(parseInt(e.target.value))}
            className="text-[11px] px-1.5 py-1 border border-gray-200 dark:border-gray-600 rounded bg-transparent text-gray-700 dark:text-gray-300"
          >
            <option value={2000}>0.5x 慢速</option>
            <option value={1000}>1x 正常</option>
            <option value={500}>2x 快速</option>
            <option value={200}>5x 极速</option>
          </select>
        </div>

        {/* 进度提示 */}
        <div className="text-right text-xs">
          <span className="font-semibold text-purple-600 dark:text-purple-400">
            进度: {currentIndex + 1} / {allCandles.length} 根
          </span>
          <p className="text-[11px] text-gray-400 mt-0.5">
            当前时间: {currentCandle?.time || '-'}
          </p>
        </div>
      </div>

      {/* TradingView 风格手动画线工具栏 (Drawing Toolbar) */}
      <div className="bg-white dark:bg-navy-800 rounded-t-xl border border-b-0 border-gray-200 dark:border-gray-700 px-3 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center space-x-1 mr-1 text-[11px] font-bold text-gray-500 dark:text-gray-400">
            <Layers className="w-3.5 h-3.5 text-purple-600" />
            <span>手动画线工具:</span>
          </div>

          {/* 1. 指针/手柄拖拽 */}
          <button
            type="button"
            onClick={() => setActiveTool('pointer')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTool === 'pointer'
                ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-navy-700 dark:text-gray-200'
            }`}
            title="指针模式：在图表上直接按住绿色止盈手柄或红色止损手柄上下拖动，实时修改价格"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>指针 / 拖动手柄</span>
          </button>
          <span className="text-[11px] text-gray-400 hidden lg:inline">
            (可按住鼠标上下拖拽手柄调价)
          </span>

          {/* 2. 做多画线标尺 */}
          <button
            type="button"
            onClick={() => {
              setActiveTool('long');
              setOrderDirection('long');
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTool === 'long'
                ? 'bg-green-600 text-white shadow-sm ring-2 ring-green-300'
                : 'bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300 border border-green-200 dark:border-green-800'
            }`}
            title="点击图表任意K线或价格位置，放置做多画线标尺（支持拖动手柄调整止盈止损）"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>做多画线标尺</span>
          </button>

          {/* 3. 做空画线标尺 */}
          <button
            type="button"
            onClick={() => {
              setActiveTool('short');
              setOrderDirection('short');
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTool === 'short'
                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-300'
                : 'bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-800'
            }`}
            title="点击图表任意K线或价格位置，放置做空画线标尺（支持拖动手柄调整止盈止损）"
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>做空画线标尺</span>
          </button>

          {/* 4. 水平支撑阻力线 */}
          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'horizontal' ? 'pointer' : 'horizontal')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTool === 'horizontal'
                ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
            title="点击图表任意价格位置，画出一条水平支撑/阻力线，支持拖动调整"
          >
            <Minus className="w-3.5 h-3.5" />
            <span>水平支撑阻力线</span>
          </button>

          {/* 5. 趋势线 */}
          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'trendline' ? 'pointer' : 'trendline')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTool === 'trendline'
                ? 'bg-sky-500 text-white shadow-sm ring-2 ring-sky-300'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
            }`}
            title="在图表上按住鼠标左键并拖动到终点，绘制倾斜趋势线"
          >
            <MoveDiagonal className="w-3.5 h-3.5" />
            <span>趋势线</span>
          </button>
        </div>

        {/* 顶部右侧：以当前画线下单 + 画线数量统计与清空 */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {!position && showTvVisuals && currentCandle && (
            <button
              type="button"
              onClick={() => openOrder(orderDirection)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs hover:shadow transition flex items-center space-x-1.5 active:scale-95 ${
                orderDirection === 'long'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700'
                  : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700'
              }`}
              title="以当前画线位置的止损价、止盈价和计算手数直接下单"
            >
              <span>⚡ 以当前画线下单 ({orderDirection === 'long' ? 'BUY 做多' : 'SELL 做空'} {activeLots}手 | 1:{currentRR.toFixed(1)})</span>
            </button>
          )}

          {(horizontalLines.length > 0 || trendLines.length > 0) && (
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              已画: {horizontalLines.length > 0 ? `${horizontalLines.length}条水平线 ` : ''}{trendLines.length > 0 ? `${trendLines.length}条趋势线` : ''}
            </span>
          )}

          {(horizontalLines.length > 0 || trendLines.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setHorizontalLines([]);
                setTrendLines([]);
              }}
              className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-md text-[11px] font-medium flex items-center space-x-1 transition"
              title="清除所有已画的水平支撑阻力线和趋势线"
            >
              <Trash2 className="w-3 h-3" />
              <span>清空画线</span>
            </button>
          )}
        </div>
      </div>

      {/* 实时持仓状态栏 (位于图表外部正上方，清晰醒目，绝不遮挡K线与图表) */}
      {position && currentCandle && (
        <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 dark:from-navy-800 dark:via-purple-950/30 dark:to-navy-800 border-x border-b border-purple-200 dark:border-purple-800/60 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold text-white shadow-xs ${
              position.direction === 'long' ? 'bg-green-600' : 'bg-red-600'
            }`}>
              持仓中: {position.direction.toUpperCase()} ({position.size} 手)
            </span>
            <span className="text-gray-600 dark:text-gray-300">
              开仓价: <b className="font-mono text-gray-900 dark:text-white">{position.entryPrice}</b>
            </span>
            <span className="text-gray-600 dark:text-gray-300">
              最新价: <b className="font-mono text-gray-900 dark:text-white">{currentCandle.close}</b>
            </span>
            <span className="font-bold">
              浮动盈亏: <span className={`font-mono text-sm ml-1 ${floatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {floatingProfit >= 0 ? `+$${floatingProfit}` : `-$${Math.abs(floatingProfit)}`} ({floatingPct}%)
              </span>
            </span>
          </div>
          <button
            onClick={closePosition}
            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xs shadow-sm hover:shadow transition active:scale-95"
          >
            立即平仓
          </button>
        </div>
      )}

      {/* K线画板区 (100% 干净透明，无任何多余浮层遮挡K线) */}
      <div className="relative bg-white dark:bg-navy-900 rounded-b-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <canvas
          ref={canvasRef}
          className={`w-full h-96 block select-none ${getCanvasCursorClass()}`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => setHoverHandle(null)}
        />

        {/* 仅在激活画线工具时显示操作指引，正常指针复盘时不遮挡图表 */}
        {activeTool !== 'pointer' && (
          <div className="absolute top-2 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-white/95 pointer-events-none flex items-center space-x-2 shadow-sm border border-white/10">
            {activeTool === 'long' ? (
              <span className="text-green-300 font-semibold flex items-center space-x-1">
                <Crosshair className="w-3.5 h-3.5 text-green-400" />
                <span>📍 做多标尺已就绪：点击图表任意位置放置标尺，可直接上下拖拽绿色止盈/红色止损手柄</span>
              </span>
            ) : activeTool === 'short' ? (
              <span className="text-red-300 font-semibold flex items-center space-x-1">
                <Crosshair className="w-3.5 h-3.5 text-red-400" />
                <span>📍 做空标尺已就绪：点击图表任意位置放置标尺，可直接上下拖拽绿色止盈/红色止损手柄</span>
              </span>
            ) : activeTool === 'horizontal' ? (
              <span className="text-amber-300 font-semibold flex items-center space-x-1">
                <Minus className="w-3.5 h-3.5 text-amber-400" />
                <span>📍 水平线工具已就绪：点击图表任意价格位置画出支撑/阻力线，支持按住拖动调价</span>
              </span>
            ) : activeTool === 'trendline' ? (
              <span className="text-sky-300 font-semibold flex items-center space-x-1">
                <MoveDiagonal className="w-3.5 h-3.5 text-sky-400" />
                <span>✏️ 趋势线工具已就绪：按住鼠标左键并拖动到终点松开，绘制倾斜趋势线</span>
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* TradingView 风格多空标尺与仓位计算下单控制台 */}
      <div className="bg-white dark:bg-navy-800 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-4">
        
        {/* 顶部：多空模式切换 + 标尺显示开关 + 实时复盘统计 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            {/* 多空工具切换 */}
            <div className="inline-flex p-1 bg-gray-100 dark:bg-navy-900 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => handleSwitchDirection('long')}
                className={`px-3.5 py-1.5 rounded-md flex items-center space-x-1.5 transition-all ${
                  orderDirection === 'long' 
                    ? 'bg-green-600 text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-green-600'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>📈 看涨做多 (Long Tool)</span>
              </button>

              <button
                type="button"
                onClick={() => handleSwitchDirection('short')}
                className={`px-3.5 py-1.5 rounded-md flex items-center space-x-1.5 transition-all ${
                  orderDirection === 'short' 
                    ? 'bg-red-600 text-white shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-red-600'
                }`}
              >
                <TrendingDown className="w-3.5 h-3.5" />
                <span>📉 看跌做空 (Short Tool)</span>
              </button>
            </div>

            {/* TradingView 标尺色块开关 */}
            <label className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={showTvVisuals}
                onChange={(e) => setShowTvVisuals(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span>图表显示多空盈亏标尺</span>
            </label>
          </div>

          {/* 实时复盘战报统计 & 保存日记 */}
          <div className="flex items-center space-x-4 text-xs bg-gray-50 dark:bg-navy-700/60 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
            <div>
              <span className="text-gray-400 text-[10px]">复盘交易: </span>
              <span className="font-bold text-gray-900 dark:text-white">{totalTradesCount} 笔</span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px]">胜率: </span>
              <span className="font-bold text-gray-900 dark:text-white">{winRate}%</span>
            </div>
            <div>
              <span className="text-gray-400 text-[10px]">累计净利: </span>
              <span className={`font-bold font-mono ${totalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalNetProfit >= 0 ? `+$${totalNetProfit.toFixed(2)}` : `-$${Math.abs(totalNetProfit).toFixed(2)}`}
              </span>
            </div>
            <button
              onClick={saveTradesToJournal}
              disabled={saveLoading || replayTrades.length === 0}
              className={`px-2.5 py-1 text-xs font-medium rounded-md text-white shadow-sm transition flex items-center space-x-1 ${
                replayTrades.length === 0 ? 'bg-gray-300 dark:bg-navy-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              <Save className="w-3 h-3" />
              <span>{saveLoading ? '保存中...' : '保存至交易日记'}</span>
            </button>
          </div>
        </div>

        {/* 核心参数配置区：账户资金 + 风险模型 + 止损止盈 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          
          {/* 1. 账户本金与单笔风险 */}
          <div className="space-y-1.5 p-3 rounded-lg bg-gray-50 dark:bg-navy-700/40 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-1">
                <DollarSign className="w-3.5 h-3.5 text-purple-600" />
                <span>账户资金 (Capital)</span>
              </span>
              <span className="text-[10px] text-gray-400">虚拟复盘本金</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                step="1000"
                value={accountCapital}
                onChange={(e) => setAccountCapital(Math.max(100, parseFloat(e.target.value) || 10000))}
                className="w-full px-2 py-1 text-xs font-mono font-semibold border border-gray-300 dark:border-gray-600 rounded dark:bg-navy-800 dark:text-white"
              />
            </div>
            {/* 快捷本金预设 */}
            <div className="flex items-center space-x-1 pt-1">
              {[5000, 10000, 50000, 100000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAccountCapital(amt)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                    accountCapital === amt ? 'bg-purple-600 text-white font-bold' : 'bg-gray-200 dark:bg-navy-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  ${amt >= 1000 ? `${amt / 1000}k` : amt}
                </button>
              ))}
            </div>
          </div>

          {/* 2. 单笔承受风险比例 */}
          <div className="space-y-1.5 p-3 rounded-lg bg-gray-50 dark:bg-navy-700/40 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 text-amber-500" />
                <span>单笔风险比例 (Risk %)</span>
              </span>
              <span className="text-[10px] font-bold text-amber-600 font-mono">
                风险额: ${riskAmount.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <input
                type="number"
                step="0.5"
                min="0.1"
                max="10"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Math.max(0.1, parseFloat(e.target.value) || 1))}
                className="w-full px-2 py-1 text-xs font-mono font-semibold border border-gray-300 dark:border-gray-600 rounded dark:bg-navy-800 dark:text-white"
              />
              <span className="text-gray-400 font-bold">%</span>
            </div>
            {/* 快捷风险比例预设 */}
            <div className="flex items-center space-x-1 pt-1">
              {[0.5, 1.0, 2.0, 3.0].map(pct => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setRiskPercent(pct)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                    riskPercent === pct ? 'bg-amber-600 text-white font-bold' : 'bg-gray-200 dark:bg-navy-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* 3. 止损价格设置 (SL) */}
          <div className="space-y-1.5 p-3 rounded-lg bg-gray-50 dark:bg-navy-700/40 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-medium text-red-600 dark:text-red-400 flex items-center space-x-1">
                <Target className="w-3.5 h-3.5" />
                <span>止损价格 (Stop Loss)</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {formatPips(slDistance, entryPrice)}
              </span>
            </div>
            <input
              type="number"
              step="any"
              value={slPrice}
              onChange={(e) => {
                setSlPrice(e.target.value);
                const newSl = parseFloat(e.target.value);
                if (!isNaN(newSl) && entryPrice > 0) {
                  const dist = Math.abs(entryPrice - newSl);
                  if (dist > 0) {
                    const newTp = orderDirection === 'long' 
                      ? entryPrice + dist * riskRewardRatio 
                      : entryPrice - dist * riskRewardRatio;
                    setTpPrice(formatPriceNumber(newTp, entryPrice));
                  }
                }
              }}
              placeholder="0.00"
              className="w-full px-2 py-1 text-xs font-mono font-bold text-red-600 border border-gray-300 dark:border-gray-600 rounded dark:bg-navy-800"
            />
            {/* 快捷止损辅助 */}
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <button
                type="button"
                onClick={() => handleQuickSL('bar')}
                className="px-1.5 py-0.5 bg-gray-200 dark:bg-navy-600 hover:bg-gray-300 text-[10px] rounded"
                title="以当前K线最高/最低价为止损"
              >
                当前K极值
              </button>
              <button
                type="button"
                onClick={() => handleQuickSL('swing5')}
                className="px-1.5 py-0.5 bg-gray-200 dark:bg-navy-600 hover:bg-gray-300 text-[10px] rounded"
                title="前5根K线极值"
              >
                前5根极值
              </button>
              <button
                type="button"
                onClick={() => handleQuickSL('pips20')}
                className="px-1.5 py-0.5 bg-gray-200 dark:bg-navy-600 hover:bg-gray-300 text-[10px] rounded font-mono"
              >
                20点
              </button>
            </div>
          </div>

          {/* 4. 止盈价格与盈亏比 (TP & R:R) */}
          <div className="space-y-1.5 p-3 rounded-lg bg-gray-50 dark:bg-navy-700/40 border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="font-medium text-green-600 dark:text-green-400 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>止盈价格 (Take Profit)</span>
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                {formatPips(tpDistance, entryPrice)}
              </span>
            </div>
            <input
              type="number"
              step="any"
              value={tpPrice}
              onChange={(e) => {
                setTpPrice(e.target.value);
                const newTp = parseFloat(e.target.value);
                if (!isNaN(newTp) && entryPrice > 0 && slDistance > 0) {
                  const newTpDist = Math.abs(newTp - entryPrice);
                  setRiskRewardRatio(Math.round((newTpDist / slDistance) * 100) / 100);
                }
              }}
              placeholder="0.00"
              className="w-full px-2 py-1 text-xs font-mono font-bold text-green-600 border border-gray-300 dark:border-gray-600 rounded dark:bg-navy-800"
            />
            {/* 快捷盈亏比预设 (TradingView 经典预设) */}
            <div className="flex items-center space-x-1 pt-0.5">
              {[1.0, 1.5, 2.0, 3.0].map(rr => (
                <button
                  key={rr}
                  type="button"
                  onClick={() => handleApplyRR(rr)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                    Math.abs(riskRewardRatio - rr) < 0.05 ? 'bg-green-600 text-white font-bold' : 'bg-gray-200 dark:bg-navy-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300'
                  }`}
                >
                  1:{rr}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* 下单确认与仓位计算看板 (TradingView Position Metrics) */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 via-indigo-50 to-purple-50 dark:from-navy-900 dark:via-purple-950/20 dark:to-navy-900 border border-purple-200 dark:border-purple-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* 左侧计算指标 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 text-xs">
            <div>
              <div className="flex items-center justify-between text-gray-400 mb-0.5">
                <span>推荐开仓手数:</span>
                <label className="text-[10px] text-purple-600 cursor-pointer flex items-center space-x-0.5">
                  <input
                    type="checkbox"
                    checked={autoSizing}
                    onChange={(e) => setAutoSizing(e.target.checked)}
                    className="w-3 h-3 text-purple-600 rounded"
                  />
                  <span>自动控仓</span>
                </label>
              </div>
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  step="0.01"
                  disabled={autoSizing}
                  value={activeLots}
                  onChange={(e) => setLotSize(e.target.value)}
                  className={`w-20 px-2 py-0.5 text-sm font-mono font-bold rounded border ${
                    autoSizing ? 'bg-transparent border-transparent text-purple-700 dark:text-purple-300' : 'border-purple-300 bg-white dark:bg-navy-800'
                  }`}
                />
                <span className="text-[11px] font-semibold text-gray-500">手 (Lots)</span>
              </div>
            </div>

            <div>
              <span className="text-gray-400 block mb-0.5">预估止损亏损:</span>
              <span className="text-sm font-mono font-bold text-red-600">
                -${projectedLoss.toFixed(2)}
                <span className="text-[10px] font-normal text-gray-400 ml-1">
                  (-{((projectedLoss / accountCapital) * 100).toFixed(1)}%)
                </span>
              </span>
            </div>

            <div>
              <span className="text-gray-400 block mb-0.5">预估止盈收益:</span>
              <span className="text-sm font-mono font-bold text-green-600">
                +${projectedProfit.toFixed(2)}
                <span className="text-[10px] font-normal text-gray-400 ml-1">
                  (+{((projectedProfit / accountCapital) * 100).toFixed(1)}%)
                </span>
              </span>
            </div>

            <div>
              <span className="text-gray-400 block mb-0.5">设定盈亏比 (R:R):</span>
              <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400">
                1 : {currentRR.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 右侧：看涨 / 看跌 下单执行按钮 */}
          <div className="flex items-center space-x-3 self-end lg:self-center">
            {position ? (
              <div className="flex items-center space-x-2">
                <div className="text-right text-xs">
                  <span className={`font-mono font-bold ${floatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    浮盈: {floatingProfit >= 0 ? `+$${floatingProfit}` : `-$${Math.abs(floatingProfit)}`}
                  </span>
                  <p className="text-[10px] text-gray-400">{position.direction.toUpperCase()} {position.size}手</p>
                </div>
                <button
                  type="button"
                  onClick={closePosition}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition flex items-center space-x-1.5 active:scale-95"
                >
                  <span>市价平仓当前持仓</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => openOrder(orderDirection)}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs text-white shadow-md hover:shadow-lg transition flex items-center space-x-2 active:scale-95 ${
                  orderDirection === 'long'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700'
                    : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700'
                }`}
              >
                {orderDirection === 'long' ? (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    <span>看涨做多下单 (BUY {activeLots}手 | 1:{currentRR.toFixed(1)})</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4" />
                    <span>看跌做空下单 (SELL {activeLots}手 | 1:{currentRR.toFixed(1)})</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>

        {saveSuccessMsg && (
          <div className="text-xs text-green-600 dark:text-green-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

      </div>

      {/* 复盘交易流水记录 */}
      {replayTrades.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-navy-900">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-900 dark:text-white">本轮手动复盘交易记录</span>
            <span className="text-gray-400">共 {replayTrades.length} 笔已平仓订单</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-xs">
              <thead className="bg-gray-50 dark:bg-navy-800 text-gray-400 text-[11px]">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">开仓时间</th>
                  <th className="px-4 py-2 text-left">平仓时间</th>
                  <th className="px-4 py-2 text-left">方向</th>
                  <th className="px-4 py-2 text-left">手数</th>
                  <th className="px-4 py-2 text-left">开仓价</th>
                  <th className="px-4 py-2 text-left">平仓价</th>
                  <th className="px-4 py-2 text-left">触发原因</th>
                  <th className="px-4 py-2 text-right">净盈亏 ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {replayTrades.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 dark:hover:bg-navy-800/40">
                    <td className="px-4 py-2 text-gray-400">{t.id}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{t.entryTime}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{t.exitTime}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.direction === 'long' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {t.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{t.size}</td>
                    <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300">{t.entryPrice}</td>
                    <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300">{t.exitPrice}</td>
                    <td className="px-4 py-2">
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.exitReason}</span>
                    </td>
                    <td className={`px-4 py-2 text-right font-mono font-bold ${t.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {t.profit >= 0 ? `+$${t.profit.toFixed(2)}` : `-$${Math.abs(t.profit).toFixed(2)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
