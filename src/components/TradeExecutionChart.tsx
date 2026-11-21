import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  createChart, 
  CandlestickSeries, 
  createSeriesMarkers,
  ColorType, 
  LineStyle, 
  IChartApi, 
  ISeriesApi,
  ISeriesMarkersPluginApi
} from 'lightweight-charts';
import { fetchCandles, CandleItem } from '../services/api';
import { 
  Play, Pause, RotateCcw, ChevronLeft, ChevronRight, FastForward,
  TrendingUp, TrendingDown, Target, Shield, AlertCircle, RefreshCw,
  Sliders, Award, Zap, ArrowUpRight, ArrowDownRight, Compass,
  Eye, CheckCircle2, AlertTriangle, Sparkles, HelpCircle
} from 'lucide-react';

export interface TradeExecutionChartProps {
  symbol: string;
  direction: 'long' | 'short' | 'buy' | 'sell';
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  entryTime?: string;
  exitTime?: string;
  size?: number;
  profit?: number;
  pnl?: number; // fallback support for pnl
  pnlPercent?: number;
  height?: number;
  className?: string;
  // TraderSync-style enriched metadata
  notes?: string;
  sentiment?: string;
  tags?: string[];
  session?: string;
  exitReason?: string;
  contractSize?: number;
  initialTimeframe?: string;
}

// Format price with appropriate decimals
const formatPriceNumber = (price: number, basePrice?: number): string => {
  if (isNaN(price)) return '0.00';
  const ref = basePrice || price;
  if (ref > 500) return price.toFixed(2);
  if (ref > 50) return price.toFixed(3);
  return price.toFixed(5);
};

// Calculate pips or points
const formatPipsOrPoints = (diff: number, basePrice: number): string => {
  if (isNaN(diff)) return '0 点';
  if (basePrice > 500) {
    return `${diff.toFixed(1)} 点`;
  }
  if (basePrice > 50) {
    return `${(diff * 100).toFixed(1)} 点`;
  }
  return `${(diff * 10000).toFixed(1)} 点`;
};

// Normalize symbol name: handles Chinese labels and strips broker suffixes (.cash, .raw, .ecn, .pro, etc.)
export function normalizeSymbol(raw?: string): string {
  if (!raw) return 'EURUSD';
  const s = String(raw).trim();
  if (/原油|USOIL|WTI|XTI/i.test(s)) return 'USOIL';
  if (/布伦特|UKOIL|BRENT|XBR/i.test(s)) return 'UKOIL';
  if (/纳斯达克|NAS100|US100|USTEC|NDX/i.test(s)) return 'NAS100';
  if (/道琼斯|US30|DJ30|WS30/i.test(s)) return 'US30';
  if (/标普|US500|SPX|SP500/i.test(s)) return 'US500';
  if (/黄金|XAU|GOLD/i.test(s)) return 'XAUUSD';
  if (/白银|XAG|SILVER/i.test(s)) return 'XAGUSD';
  if (/比特币|BTC/i.test(s)) return 'BTCUSD';
  if (/以太坊|ETH/i.test(s)) return 'ETHUSD';
  if (/德指|GER40|DAX/i.test(s)) return 'GER40';
  if (/日经|JP225|N225/i.test(s)) return 'JP225';
  if (/恒生|HK50|HSI/i.test(s)) return 'HK50';
  const stripped = s.replace(/\.(cash|raw|ecn|pro|m|std|i)$/i, '').replace(/[_.-]$/, '').toUpperCase();
  return stripped || 'EURUSD';
}

// Consistent UTC seconds parser for strings to avoid timezone discrepancy
function parseTimeToUTCSeconds(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return val > 1e11 ? Math.floor(val / 1000) : val;
  }
  const s = String(val).trim().replace(/\//g, '-').replace(' ', 'T');
  const match = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:T(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const hh = match[4] ? parseInt(match[4], 10) : 0;
    const mm = match[5] ? parseInt(match[5], 10) : 0;
    const ss = match[6] ? parseInt(match[6], 10) : 0;
    return Math.floor(Date.UTC(y, m, d, hh, mm, ss) / 1000);
  }
  const parsed = new Date(s).getTime();
  return isNaN(parsed) ? null : Math.floor(parsed / 1000);
}

// Determine default contract size by symbol
const getSymbolContractSize = (sym: string, customSize?: number): number => {
  if (customSize && customSize > 0) return customSize;
  const s = sym.toUpperCase();
  if (s.includes('BTC') || s.includes('ETH') || s.includes('SOL') || s.includes('CRYPTO')) return 1;
  if (s.includes('US30') || s.includes('NAS100') || s.includes('SPX500') || s.includes('GER30') || s.includes('USOIL') || s.includes('原油')) return 1;
  if (s.includes('XAU') || s.includes('GOLD')) return 100;
  if (['EUR', 'GBP', 'AUD', 'USD', 'JPY', 'CAD', 'CHF', 'NZD'].some(c => s.includes(c)) && s.length <= 7) {
    return 100000;
  }
  return 1;
};

export const TradeExecutionChart: React.FC<TradeExecutionChartProps> = ({
  symbol,
  direction,
  entryPrice,
  exitPrice,
  stopLoss,
  takeProfit,
  entryTime,
  exitTime,
  size = 1,
  profit,
  pnl,
  pnlPercent,
  height = 380,
  className = '',
  notes,
  sentiment,
  tags,
  session,
  exitReason,
  contractSize: customContractSize,
  initialTimeframe = 'M5',
}) => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);
  const seriesInstanceRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const markersPluginRef = useRef<ISeriesMarkersPluginApi<any> | null>(null);

  // Price lines references
  const entryLineRef = useRef<any>(null);
  const exitLineRef = useRef<any>(null);
  const slLineRef = useRef<any>(null);
  const tpLineRef = useRef<any>(null);
  const maeLineRef = useRef<any>(null);
  const mfeLineRef = useRef<any>(null);

  const [timeframe, setTimeframe] = useState<string>(initialTimeframe);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [candles, setCandles] = useState<CandleItem[]>([]);

  // TraderSync Modes: 'overview' (静态全景打点) vs 'replay' (逐帧动态复盘)
  const [viewMode, setViewMode] = useState<'overview' | 'replay'>('overview');

  // Replay playback states
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(800); // ms per step
  const timerRef = useRef<any>(null);

  const finalProfit = profit !== undefined ? profit : (pnl !== undefined ? pnl : 0);
  const isLong = typeof direction === 'string' 
    ? (direction.toLowerCase() === 'long' || direction.toLowerCase() === 'buy')
    : true;
  const effectiveContractSize = getSymbolContractSize(symbol || 'EURUSD', customContractSize);

  // 1. Fetch candles from API based on symbol, timeframe, and trade date
  const loadCandles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsPlaying(false);

      const cleanSymbol = normalizeSymbol(symbol);
      const tfMinutes = {
        'M1': 1, '1M': 1,
        'M5': 5, '5M': 5,
        'M15': 15, '15M': 15,
        'M30': 30, '30M': 30,
        'H1': 60, '1H': 60,
        'H4': 240, '4H': 240,
        'D1': 1440, '1D': 1440,
      }[String(timeframe).toUpperCase()] || 5;

      let startParam: string | undefined = undefined;
      let endParam: string | undefined = undefined;
      let countParam = 260;

      if (entryTime) {
        try {
          const eSec = parseTimeToUTCSeconds(entryTime);
          if (eSec) {
            const eMs = eSec * 1000;
            const xSec = exitTime ? parseTimeToUTCSeconds(exitTime) : null;
            const xMs = xSec ? xSec * 1000 : eMs;

            const pad = (n: number) => String(n).padStart(2, '0');
            const formatYMDHMS = (d: Date) => 
              `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

            // Context: 入场前至少加载 120 根 K 线，确保有足够的前瞻背景、形态分析及盘整空间
            // 满足用户“入场前K线至少应该多60根/多6根”的要求
            const preBars = 120;
            const postBars = 80;
            const preBufferMs = preBars * tfMinutes * 60 * 1000;
            const postBufferMs = postBars * tfMinutes * 60 * 1000;

            startParam = formatYMDHMS(new Date(eMs - preBufferMs));
            endParam = formatYMDHMS(new Date(xMs + postBufferMs));
            
            const tradeBars = Math.ceil((xMs - eMs) / (tfMinutes * 60 * 1000));
            countParam = Math.max(300, tradeBars + preBars + postBars);
          }
        } catch {
          // ignore date parse errors
        }
      }

      // 1. Query candles using normalized symbol (e.g. USOIL, NAS100, XAUUSD) which backend maps to MT5 broker aliases
      const querySymbol = cleanSymbol || symbol;
      let res = await fetchCandles({
        symbol: querySymbol,
        timeframe,
        count: countParam,
        start: startParam,
        end: endParam,
        price: entryPrice || exitPrice,
      });

      // If querySymbol didn't return candles and cleanSymbol is different, try cleanSymbol as fallback
      if ((!res.candles || res.candles.length === 0) && cleanSymbol !== querySymbol) {
        try {
          const fallbackRes = await fetchCandles({
            symbol: cleanSymbol,
            timeframe,
            count: countParam,
            start: startParam,
            end: endParam,
            price: entryPrice || exitPrice,
          });
          if (fallbackRes.candles && fallbackRes.candles.length > 0) {
            res = fallbackRes;
          }
        } catch {}
      }

      if (res.candles && res.candles.length > 0) {
        setCandles(res.candles);
      } else {
        setError('未获取到该交易时段的行情数据');
      }
    } catch (err: any) {
      console.warn('Failed to load trade chart candles:', err);
      setError(err.message || '加载行情失败');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, entryTime, exitTime, entryPrice, exitPrice]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  // Format and sort candles ensuring non-NaN, strictly monotonically increasing times
  const formattedData = useMemo(() => {
    if (!candles || candles.length === 0) return [];
    const mapped = candles.map((c, i) => {
      // Prioritize time string so candles and trade entry/exit markers share the exact same
      // unified Beijing time representation, eliminating timezone offset mismatches
      let t: number | null = null;
      if (c.time) {
        t = parseTimeToUTCSeconds(c.time);
      }
      if ((!t || isNaN(t)) && typeof c.timestamp === 'number' && !isNaN(c.timestamp) && c.timestamp > 0) {
        t = c.timestamp > 1e11 ? Math.floor(c.timestamp / 1000) : c.timestamp;
      }
      if (!t || isNaN(t)) {
        t = 1700000000 + i * 300;
      }
      return {
        time: t as any,
        open: Number(c.open) || 0,
        high: Number(c.high) || 0,
        low: Number(c.low) || 0,
        close: Number(c.close) || 0,
        rawTime: c.time || '',
      };
    });

    mapped.sort((a, b) => (a.time as number) - (b.time as number));

    const deduped: typeof mapped = [];
    let lastTime = 0;
    for (const bar of mapped) {
      let t = bar.time as number;
      if (t <= lastTime) {
        t = lastTime + 60;
        bar.time = t as any;
      }
      lastTime = t;
      deduped.push(bar);
    }
    return deduped;
  }, [candles]);

  // Locate Entry and Exit candle indices
  const { entryBarIndex, exitBarIndex, preEntryIndex, postExitIndex } = useMemo(() => {
    if (formattedData.length === 0) {
      return { entryBarIndex: 0, exitBarIndex: 0, preEntryIndex: 0, postExitIndex: 0 };
    }

    let eTimestamp: number | null = null;
    if (entryTime) {
      eTimestamp = parseTimeToUTCSeconds(entryTime);
    }

    let xTimestamp: number | null = null;
    if (exitTime) {
      xTimestamp = parseTimeToUTCSeconds(exitTime);
    }

    const findClosestIndex = (targetTs: number, targetPrice?: number): number => {
      let closestIdx = 0;
      let minDiff = Math.abs((formattedData[0].time as number) - targetTs);
      for (let i = 0; i < formattedData.length; i++) {
        const diff = Math.abs((formattedData[i].time as number) - targetTs);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }

      // Fine-tune: check if closestIdx touches targetPrice first
      if (targetPrice && targetPrice > 0) {
        const currentBar = formattedData[closestIdx];
        if (currentBar && targetPrice >= currentBar.low && targetPrice <= currentBar.high) {
          return closestIdx;
        }
        // If current bar doesn't touch, scan closest neighboring bars in order of distance (+1, -1, +2, -2, etc.)
        for (const offset of [1, -1, 2, -2, 3, -3, 4, -4, 5, -5]) {
          const testIdx = closestIdx + offset;
          if (testIdx >= 0 && testIdx < formattedData.length) {
            const bar = formattedData[testIdx];
            if (targetPrice >= bar.low && targetPrice <= bar.high) {
              return testIdx;
            }
          }
        }
      }

      return closestIdx;
    };

    let eIdx = eTimestamp !== null ? findClosestIndex(eTimestamp, entryPrice) : Math.max(0, formattedData.length - 25);
    let xIdx = xTimestamp !== null ? findClosestIndex(xTimestamp, exitPrice) : formattedData.length - 1;

    // Safety bounds
    eIdx = Math.max(0, Math.min(formattedData.length - 1, eIdx));
    xIdx = Math.max(0, Math.min(formattedData.length - 1, xIdx));

    // Safety check: exit cannot be before entry
    if (xIdx < eIdx) {
      xIdx = eIdx;
    }

    const preIdx = Math.max(0, eIdx - 10); // 逐帧复盘在入场前 10 根 K 线开始推演观察
    const postIdx = Math.min(formattedData.length - 1, xIdx + 20); // 平仓后保留 20 根 K 线观察行情反弹/延续

    return {
      entryBarIndex: eIdx,
      exitBarIndex: xIdx,
      preEntryIndex: preIdx,
      postExitIndex: postIdx,
    };
  }, [formattedData, entryTime, exitTime, entryPrice, exitPrice]);

  // Track last viewed replay time (in seconds) so switching timeframes maintains the exact chronological replay position
  const lastReplayTimeRef = useRef<number | null>(null);

  // Update lastReplayTimeRef when replayIndex or formattedData changes
  useEffect(() => {
    if (formattedData.length > 0 && formattedData[replayIndex]) {
      const t = formattedData[replayIndex].time as number;
      if (typeof t === 'number' && !isNaN(t)) {
        lastReplayTimeRef.current = t;
      }
    }
  }, [replayIndex, formattedData]);

  // Synchronize replay index when switching to replay mode, switching timeframe, or when data loads
  useEffect(() => {
    if (viewMode === 'replay' && formattedData.length > 0) {
      if (lastReplayTimeRef.current !== null) {
        // Map previous timestamp to the closest bar in the new timeframe
        const targetTs = lastReplayTimeRef.current;
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < formattedData.length; i++) {
          const diff = Math.abs((formattedData[i].time as number) - targetTs);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = i;
          }
        }
        setReplayIndex(Math.max(preEntryIndex, Math.min(postExitIndex, closestIdx)));
      } else {
        setReplayIndex(preEntryIndex);
      }
    }
  }, [viewMode, timeframe, preEntryIndex, postExitIndex, formattedData]);

  // Replay playback timer loop
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setReplayIndex(prev => {
        if (prev >= postExitIndex) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playSpeed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playSpeed, postExitIndex]);

  // Real-time metrics calculation at current slice
  const liveStats = useMemo(() => {
    if (formattedData.length === 0) return null;

    const currentBarIdx = viewMode === 'overview' ? exitBarIndex : replayIndex;
    const currentBar = formattedData[currentBarIdx] || formattedData[formattedData.length - 1];
    const currentPrice = currentBar.close;

    const isPreEntry = currentBarIdx < entryBarIndex;
    const isInPosition = currentBarIdx >= entryBarIndex && currentBarIdx <= exitBarIndex;
    const isPostExit = currentBarIdx > exitBarIndex;

    // Calculate MAE and MFE between entry and currentBar (or exitBar if post-exit)
    let mfePrice = entryPrice;
    let maePrice = entryPrice;
    let mfeAmount = 0;
    let maeAmount = 0;

    if (currentBarIdx >= entryBarIndex) {
      const activeEndIdx = Math.min(currentBarIdx, exitBarIndex);
      const heldCandles = formattedData.slice(entryBarIndex, activeEndIdx + 1);

      if (heldCandles.length > 0) {
        if (isLong) {
          const maxHigh = Math.max(...heldCandles.map(c => c.high));
          const minLow = Math.min(...heldCandles.map(c => c.low));
          mfePrice = maxHigh;
          maePrice = minLow;
        } else {
          const minLow = Math.min(...heldCandles.map(c => c.low));
          const maxHigh = Math.max(...heldCandles.map(c => c.high));
          mfePrice = minLow;
          maePrice = maxHigh;
        }
      }

      // Logical bounds check: if trade is exited, MFE must reach at least the exit price
      if (exitPrice && exitPrice > 0 && currentBarIdx >= exitBarIndex) {
        if (isLong) {
          mfePrice = Math.max(mfePrice, exitPrice);
        } else {
          mfePrice = Math.min(mfePrice, exitPrice);
        }
      }
    }

    // Points calculations
    const effectiveExitPrice = exitPrice || currentPrice;
    const actualPoints = isLong
      ? effectiveExitPrice - entryPrice
      : entryPrice - effectiveExitPrice;

    const mfePoints = isLong
      ? Math.max(0, mfePrice - entryPrice)
      : Math.max(0, entryPrice - mfePrice);

    const maePoints = isLong
      ? Math.max(0, entryPrice - maePrice)
      : Math.max(0, maePrice - entryPrice);

    // Compute effective profit per point from finalProfit if available to prevent contract size/multiplier distortion
    let profitPerPoint = size * effectiveContractSize;
    if (finalProfit && Math.abs(finalProfit) > 0 && Math.abs(actualPoints) > 0.00001) {
      const impliedPpp = Math.abs(finalProfit) / Math.abs(actualPoints);
      if (impliedPpp > 0) {
        profitPerPoint = impliedPpp;
      }
    }

    mfeAmount = mfePoints * profitPerPoint;
    maeAmount = maePoints * profitPerPoint;

    // Current floating PnL
    let floatingPnL = 0;
    let floatingPercent = 0;
    let floatingPips = 0;

    if (isInPosition && entryPrice > 0) {
      const priceDiff = isLong ? currentPrice - entryPrice : entryPrice - currentPrice;
      floatingPnL = priceDiff * profitPerPoint;
      floatingPercent = (priceDiff / entryPrice) * 100;
      floatingPips = Math.abs(priceDiff);
    } else if (isPostExit) {
      floatingPnL = finalProfit !== 0 ? finalProfit : actualPoints * profitPerPoint;
      floatingPercent = pnlPercent || (entryPrice > 0 ? (actualPoints / entryPrice) * 100 : 0);
    }

    // TraderSync Signature: Exit Efficiency based on favorable excursion points captured
    let exitEfficiency = 0;
    if (mfePoints > 0) {
      exitEfficiency = Math.max(0, Math.min(100, Math.round((Math.max(0, actualPoints) / mfePoints) * 100)));
    }

    // Post-exit excursion (Did market keep running in trade direction?)
    let leftOnTableAmount = 0;
    let leftOnTablePips = 0;
    let reversalAvoidedAmount = 0;

    if (isPostExit && exitBarIndex < formattedData.length - 1) {
      const postCandles = formattedData.slice(exitBarIndex, currentBarIdx + 1);
      const exitRefPrice = exitPrice || (formattedData[exitBarIndex] ? formattedData[exitBarIndex].close : (entryPrice || 0));
      if (postCandles.length > 0) {
        if (isLong) {
          const highestPost = Math.max(...postCandles.map(c => c.high));
          if (highestPost > exitRefPrice) {
            leftOnTablePips = highestPost - exitRefPrice;
            leftOnTableAmount = leftOnTablePips * profitPerPoint;
          }
          const lowestPost = Math.min(...postCandles.map(c => c.low));
          if (lowestPost < exitRefPrice) {
            reversalAvoidedAmount = (exitRefPrice - lowestPost) * profitPerPoint;
          }
        } else {
          const lowestPost = Math.min(...postCandles.map(c => c.low));
          if (lowestPost < exitRefPrice) {
            leftOnTablePips = exitRefPrice - lowestPost;
            leftOnTableAmount = leftOnTablePips * profitPerPoint;
          }
          const highestPost = Math.max(...postCandles.map(c => c.high));
          if (highestPost > exitRefPrice) {
            reversalAvoidedAmount = (highestPost - exitRefPrice) * profitPerPoint;
          }
        }
      }
    }

    return {
      currentPrice,
      currentBarTime: currentBar.rawTime || '',
      isPreEntry,
      isInPosition,
      isPostExit,
      barsToEntry: Math.max(0, entryBarIndex - currentBarIdx),
      barsHeld: Math.max(0, currentBarIdx - entryBarIndex),
      floatingPnL,
      floatingPercent,
      floatingPips,
      mfePrice,
      mfeAmount,
      maePrice,
      maeAmount,
      profitPerPoint,
      exitEfficiency,
      leftOnTableAmount,
      leftOnTablePips,
      reversalAvoidedAmount,
    };
  }, [formattedData, viewMode, replayIndex, entryBarIndex, exitBarIndex, entryPrice, exitPrice, isLong, size, effectiveContractSize, finalProfit, pnlPercent]);

  // Build AI Coach Insights based on metrics
  const coachInsights = useMemo(() => {
    if (!liveStats) return null;
    const tips: { title: string; desc: string; type: 'success' | 'warning' | 'info' | 'danger' }[] = [];

    if (liveStats.isPreEntry) {
      tips.push({
        title: '形态观察与计划准备',
        desc: `当前处于入场前第 ${liveStats.barsToEntry} 根K线，请关注关键阻力/支撑位突破，耐心等待交易信号确认。`,
        type: 'info',
      });
      return tips;
    }

    // Exit efficiency review
    if (liveStats.isPostExit) {
      if (liveStats.exitEfficiency >= 75) {
        tips.push({
          title: '卓越离场落袋效率',
          desc: `此单锁定了 ${liveStats.exitEfficiency}% 的潜在顺行空间 (MFE)，出场果断，在利润回吐前锁定了收益。`,
          type: 'success',
        });
      } else if (liveStats.exitEfficiency < 45 && liveStats.mfeAmount > 50) {
        tips.push({
          title: '利润回吐较多 / 出场过晚',
          desc: `持仓期间曾达到 +$${liveStats.mfeAmount.toFixed(1)} 的最高浮盈，但最终仅落袋 ${liveStats.exitEfficiency}%，建议考虑分批移动止损。`,
          type: 'warning',
        });
      }

      // Left on table analysis
      if (liveStats.leftOnTableAmount > 60) {
        tips.push({
          title: '留在桌上的利润 (Left on Table)',
          desc: `平仓后行情继续朝交易方向顺行了 ${formatPipsOrPoints(liveStats.leftOnTablePips, entryPrice)}，潜在额外利润达 $${liveStats.leftOnTableAmount.toFixed(1)}，可配合保本跟踪止损让利润奔跑。`,
          type: 'info',
        });
      } else if (liveStats.reversalAvoidedAmount > 50) {
        tips.push({
          title: '顶底精准止盈 / 规避反转',
          desc: `平仓后行情立刻反转，成功规避了 $${liveStats.reversalAvoidedAmount.toFixed(1)} 的逆行反噬风险，离场点位堪称教科书级别！`,
          type: 'success',
        });
      }
    }

    // Drawdown / Bag holding review
    const riskThreshold = stopLoss
      ? Math.abs(entryPrice - stopLoss) * liveStats.profitPerPoint * 1.3
      : 80;
    if (liveStats.maeAmount > riskThreshold) {
      tips.push({
        title: '警惕扛单风险 (MAE 过深)',
        desc: `持仓期间经历的最大逆行回撤达到 -$${liveStats.maeAmount.toFixed(1)}，已超过安全风险边界，需严格坚守止损纪律。`,
        type: 'danger',
      });
    } else {
      tips.push({
        title: '风险控制稳健',
        desc: `最大逆行回撤控制在 -$${liveStats.maeAmount.toFixed(1)} 以内，持仓过程心态稳定，未承受过度无效敞口。`,
        type: 'info',
      });
    }

    return tips;
  }, [liveStats, stopLoss, entryPrice, size, effectiveContractSize]);

  // 2. Initialize and render lightweight chart
  useEffect(() => {
    if (!chartContainerRef.current || formattedData.length === 0) return;

    const isDark = document.documentElement.classList.contains('dark');

    // Clean previous chart instance
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
      seriesInstanceRef.current = null;
      markersPluginRef.current = null;
      entryLineRef.current = null;
      slLineRef.current = null;
      tpLineRef.current = null;
      maeLineRef.current = null;
      mfeLineRef.current = null;
    }

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      width: container.clientWidth || 600,
      height,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#0b0f19' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, monospace, sans-serif',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)' },
      },
      crosshair: {
        vertLine: {
          color: isDark ? '#818cf8' : '#6366f1',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: isDark ? '#818cf8' : '#6366f1',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        scaleMargins: {
          top: 0.15,
          bottom: 0.15,
        },
        autoScale: true,
      },
    });

    chartInstanceRef.current = chart;

    // Add Candlestick Series with dynamic autoscale covering entry, exit, SL, and TP
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10B981',
      downColor: '#EF4444',
      borderVisible: false,
      wickUpColor: '#10B981',
      wickDownColor: '#EF4444',
      autoscaleInfoProvider: (original: () => any) => {
        const res = typeof original === 'function' ? original() : null;
        if (!res || !res.priceRange) return res;
        let min = res.priceRange.minValue;
        let max = res.priceRange.maxValue;
        if (entryPrice && entryPrice > 0) {
          min = Math.min(min, entryPrice);
          max = Math.max(max, entryPrice);
        }
        if (exitPrice && exitPrice > 0) {
          min = Math.min(min, exitPrice);
          max = Math.max(max, exitPrice);
        }
        if (stopLoss && stopLoss > 0) {
          min = Math.min(min, stopLoss);
          max = Math.max(max, stopLoss);
        }
        if (takeProfit && takeProfit > 0) {
          min = Math.min(min, takeProfit);
          max = Math.max(max, takeProfit);
        }
        return {
          ...res,
          priceRange: {
            minValue: min,
            maxValue: max,
          },
        };
      },
    });
    seriesInstanceRef.current = candleSeries;

    // Create Series Markers Plugin
    markersPluginRef.current = createSeriesMarkers(candleSeries, []);

    // Set initial data
    const initialSlice = viewMode === 'overview' 
      ? formattedData 
      : formattedData.slice(0, Math.min(formattedData.length, Math.max(1, replayIndex + 1)));
    
    candleSeries.setData(initialSlice);

    // Frame the trade in the viewport
    if (viewMode === 'overview') {
      const fromIdx = Math.max(0, entryBarIndex - 20);
      const toIdx = Math.min(formattedData.length - 1, exitBarIndex + 20);
      if (toIdx > fromIdx && formattedData.length > 0 && typeof chart.timeScale().setVisibleLogicalRange === 'function') {
        chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
      } else {
        chart.timeScale().fitContent();
      }
    } else {
      chart.timeScale().fitContent();
    }

    // Responsive resize observer
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(entries => {
        if (!entries || entries.length === 0) return;
        const { width: newWidth } = entries[0].contentRect;
        if (newWidth > 0 && chartInstanceRef.current) {
          chartInstanceRef.current.applyOptions({ width: newWidth });
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (chartInstanceRef.current) {
        chartInstanceRef.current.remove();
        chartInstanceRef.current = null;
        seriesInstanceRef.current = null;
        markersPluginRef.current = null;
      }
    };
  }, [formattedData, height]); // Re-create on data change or height change

  // 3. Update Chart Slicing, Markers, and Price Lines when replayIndex or viewMode changes
  useEffect(() => {
    const series = seriesInstanceRef.current;
    const markersPlugin = markersPluginRef.current;
    if (!series || !markersPlugin || formattedData.length === 0) return;

    // Determine displayed candles
    const currentLimitIdx = viewMode === 'overview' ? formattedData.length - 1 : replayIndex;
    const displayedCandles = formattedData.slice(0, currentLimitIdx + 1);

    try {
      series.setData(displayedCandles);

      // Dynamic Markers
      const markers: any[] = [];

      // Entry Marker
      if (entryPrice > 0 && currentLimitIdx >= entryBarIndex && formattedData[entryBarIndex]) {
        const entryBar = formattedData[entryBarIndex];
        markers.push({
          time: entryBar.time,
          position: isLong ? 'belowBar' : 'aboveBar',
          color: isLong ? '#10B981' : '#F43F5E',
          shape: isLong ? 'arrowUp' : 'arrowDown',
          text: `${isLong ? 'BUY' : 'SELL'} @ ${formatPriceNumber(entryPrice)} (${size || 1}L)`,
        });
      }

      // Exit Marker
      if (exitPrice && exitPrice > 0 && currentLimitIdx >= exitBarIndex && formattedData[exitBarIndex]) {
        const exitBar = formattedData[exitBarIndex];
        const isWin = finalProfit >= 0;
        const pnlText = finalProfit !== 0 ? `| ${finalProfit >= 0 ? '+' : ''}$${finalProfit.toFixed(1)}` : '';

        markers.push({
          time: exitBar.time,
          position: isLong ? 'aboveBar' : 'belowBar',
          color: isWin ? '#10B981' : '#EF4444',
          shape: isLong ? 'arrowDown' : 'arrowUp',
          text: `EXIT @ ${formatPriceNumber(exitPrice)} ${pnlText}`,
        });
      }

      markers.sort((a, b) => (a.time as number) - (b.time as number));
      markersPlugin.setMarkers(markers);
    } catch (err) {
      console.warn('Failed to update series data or markers:', err);
    }

    // Manage Dynamic Price Lines
    // 1. Remove old price lines safely
    try {
      if (entryLineRef.current) {
        series.removePriceLine(entryLineRef.current);
        entryLineRef.current = null;
      }
      if (exitLineRef.current) {
        series.removePriceLine(exitLineRef.current);
        exitLineRef.current = null;
      }
      if (slLineRef.current) {
        series.removePriceLine(slLineRef.current);
        slLineRef.current = null;
      }
      if (tpLineRef.current) {
        series.removePriceLine(tpLineRef.current);
        tpLineRef.current = null;
      }
      if (maeLineRef.current) {
        series.removePriceLine(maeLineRef.current);
        maeLineRef.current = null;
      }
      if (mfeLineRef.current) {
        series.removePriceLine(mfeLineRef.current);
        mfeLineRef.current = null;
      }
    } catch {
      // ignore line removal edge case
    }

    // 2. Add Price lines (Entry, Exit, SL, TP are ALWAYS displayed as key trade reference lines)
    if (entryPrice > 0) {
      entryLineRef.current = series.createPriceLine({
        price: entryPrice,
        color: '#3B82F6',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `Entry ${formatPriceNumber(entryPrice)}`,
      });

      if (exitPrice && exitPrice > 0) {
        exitLineRef.current = series.createPriceLine({
          price: exitPrice,
          color: '#F59E0B',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `Exit ${formatPriceNumber(exitPrice)}`,
        });
      }

      if (stopLoss && stopLoss > 0) {
        slLineRef.current = series.createPriceLine({
          price: stopLoss,
          color: '#EF4444',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `SL ${formatPriceNumber(stopLoss)}`,
        });
      }

      if (takeProfit && takeProfit > 0) {
        tpLineRef.current = series.createPriceLine({
          price: takeProfit,
          color: '#10B981',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: `TP ${formatPriceNumber(takeProfit)}`,
        });
      }

      // Add dynamic MAE / MFE lines when in position or post-exit
      if (liveStats && (liveStats.isInPosition || liveStats.isPostExit)) {
        if (liveStats.maePrice && liveStats.maePrice !== entryPrice) {
          maeLineRef.current = series.createPriceLine({
            price: liveStats.maePrice,
            color: 'rgba(239, 68, 68, 0.65)',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `MAE -$${liveStats.maeAmount.toFixed(0)}`,
          });
        }

        if (liveStats.mfePrice && liveStats.mfePrice !== entryPrice) {
          mfeLineRef.current = series.createPriceLine({
            price: liveStats.mfePrice,
            color: 'rgba(16, 185, 129, 0.65)',
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
            title: `MFE +$${liveStats.mfeAmount.toFixed(0)}`,
          });
        }
      }
    }

    // Ensure viewport frames the trade when in overview or advancing replay
    const chart = chartInstanceRef.current;
    if (chart) {
      if (viewMode === 'overview') {
        const fromIdx = Math.max(0, entryBarIndex - 20);
        const toIdx = Math.min(formattedData.length - 1, exitBarIndex + 20);
        if (toIdx > fromIdx && typeof chart.timeScale().setVisibleLogicalRange === 'function') {
          chart.timeScale().setVisibleLogicalRange({ from: fromIdx, to: toIdx });
        } else if (typeof chart.timeScale().fitContent === 'function') {
          chart.timeScale().fitContent();
        }
      } else if (viewMode === 'replay' && typeof chart.timeScale().scrollToPosition === 'function') {
        chart.timeScale().scrollToPosition(0, false);
      }
    }
  }, [viewMode, replayIndex, formattedData, entryPrice, exitPrice, stopLoss, takeProfit, entryBarIndex, exitBarIndex, isLong, size, finalProfit, liveStats]);

  // Handle Play / Pause toggle
  const togglePlay = () => {
    if (replayIndex >= postExitIndex) {
      setReplayIndex(preEntryIndex);
    }
    setIsPlaying(prev => !prev);
  };

  const handleStepBack = () => {
    setIsPlaying(false);
    setReplayIndex(prev => Math.max(preEntryIndex, prev - 1));
  };

  const handleStepForward = () => {
    setIsPlaying(false);
    setReplayIndex(prev => Math.min(postExitIndex, prev + 1));
  };

  const handleReset = () => {
    setIsPlaying(false);
    setReplayIndex(preEntryIndex);
  };

  const handleJumpToExit = () => {
    setIsPlaying(false);
    setReplayIndex(exitBarIndex);
  };

  return (
    <div className={`bg-white dark:bg-[#0b0f19] rounded-2xl border border-gray-200 dark:border-white/10 overflow-hidden shadow-xs ${className}`}>
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between p-3.5 border-b border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.02] gap-3">
        <div className="flex items-center space-x-2.5">
          <span className="font-mono font-black text-sm text-gray-900 dark:text-white">
            {symbol || 'EURUSD'}
          </span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
            isLong
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}>
            {(direction || (isLong ? 'LONG' : 'SHORT')).toUpperCase()} {size || 1}手
          </span>

          {finalProfit !== undefined && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
              finalProfit >= 0
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
            }`}>
              {finalProfit >= 0 ? `+` : ''}${finalProfit.toFixed(2)} {pnlPercent ? `(${pnlPercent.toFixed(1)}%)` : ''}
            </span>
          )}

          {session && (
            <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-navy-800 text-gray-500 dark:text-gray-400 rounded">
              {session} 盘
            </span>
          )}
        </div>

        {/* View Mode Toggle & Timeframes */}
        <div className="flex items-center space-x-2">
          {/* TraderSync Replay Mode Switch */}
          <div className="flex items-center bg-gray-200/80 dark:bg-navy-900/80 p-0.5 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => { setViewMode('overview'); setIsPlaying(false); }}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 ${
                viewMode === 'overview'
                  ? 'bg-white dark:bg-purple-600 text-gray-900 dark:text-white shadow-xs font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>全景打点</span>
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('replay'); setReplayIndex(preEntryIndex); }}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center space-x-1 ${
                viewMode === 'replay'
                  ? 'bg-purple-600 text-white shadow-xs font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>逐帧复盘 (Replay)</span>
            </button>
          </div>

          {/* Timeframe Switcher */}
          <div className="flex items-center space-x-1">
            {(['M1', 'M5', 'M15', 'H1', 'H4', 'D1'] as const).map(tf => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 text-xs font-mono font-semibold rounded transition-all ${
                  timeframe === tf
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-navy-950'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-navy-800'
                }`}
              >
                {tf}
              </button>
            ))}

            <button
              type="button"
              onClick={loadCandles}
              disabled={loading}
              title="刷新 K 线"
              className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. TraderSync Replay Controls & Live Status HUD (When Replay Mode is active) */}
      {viewMode === 'replay' && liveStats && (
        <div className="p-3 bg-purple-50/50 dark:bg-[#0e1424] border-b border-purple-100 dark:border-white/5 space-y-2.5">
          
          {/* Top HUD Row: Floating PnL, MAE, MFE, Stage */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-3">
              {/* Phase Badge */}
              <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] flex items-center space-x-1 ${
                liveStats.isPreEntry
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  : liveStats.isInPosition
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700 animate-pulse'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
              }`}>
                <span>●</span>
                <span>
                  {liveStats.isPreEntry 
                    ? `入场前准备期 (距入场 ${liveStats.barsToEntry} 根K线 · 计划入场: ${formatPriceNumber(entryPrice)})` 
                    : liveStats.isInPosition 
                    ? `持仓中 (第 ${liveStats.barsHeld} 根K线)` 
                    : '已结算平仓 (复盘出场推演)'}
                </span>
              </span>

              {/* Live Floating P&L */}
              {liveStats.isInPosition && (
                <div className="flex items-center space-x-1.5 font-mono">
                  <span className="text-gray-500 dark:text-gray-400">实时浮盈亏:</span>
                  <span className={`font-bold text-sm ${
                    liveStats.floatingPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {liveStats.floatingPnL >= 0 ? '+' : ''}${liveStats.floatingPnL.toFixed(2)}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    ({formatPipsOrPoints(liveStats.floatingPips, entryPrice)})
                  </span>
                </div>
              )}
            </div>

            {/* MFE & MAE Counters */}
            <div className="flex items-center space-x-4 font-mono text-[11px]">
              <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>MFE(最大顺行):</span>
                <span className="font-bold">+${liveStats.mfeAmount.toFixed(1)}</span>
              </div>
              <div className="flex items-center space-x-1 text-rose-600 dark:text-rose-400">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>MAE(最大逆行):</span>
                <span className="font-bold">-${liveStats.maeAmount.toFixed(1)}</span>
              </div>
              {liveStats.isPostExit && (
                <div className="flex items-center space-x-1 text-purple-600 dark:text-purple-400 font-semibold">
                  <Award className="w-3.5 h-3.5" />
                  <span>离场效率: {liveStats.exitEfficiency}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Controls Row: Play/Pause/Scrubber */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleReset}
                title="重置到入场前"
                className="p-1.5 rounded-lg bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-700 border border-gray-200 dark:border-white/10 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleStepBack}
                title="单步后退一根"
                className="p-1.5 rounded-lg bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-700 border border-gray-200 dark:border-white/10 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={togglePlay}
                title={isPlaying ? "暂停播放" : "开始复盘播放"}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1 shadow-xs ${
                  isPlaying 
                    ? 'bg-amber-500 hover:bg-amber-600 text-white' 
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? '暂停' : '播放'}</span>
              </button>
              <button
                type="button"
                onClick={handleStepForward}
                title="单步前进一根"
                className="p-1.5 rounded-lg bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-700 border border-gray-200 dark:border-white/10 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleJumpToExit}
                title="快速跳到出场"
                className="p-1.5 rounded-lg bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-700 border border-gray-200 dark:border-white/10 transition"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>

              {/* Quick Jump Buttons */}
              <div className="flex items-center space-x-1 pl-1">
                <button
                  type="button"
                  onClick={() => { setIsPlaying(false); setReplayIndex(preEntryIndex); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition border ${
                    replayIndex < entryBarIndex
                      ? 'bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800 font-bold'
                      : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-100'
                  }`}
                  title="跳转到入场前准备期"
                >
                  入场前
                </button>
                <button
                  type="button"
                  onClick={() => { setIsPlaying(false); setReplayIndex(entryBarIndex); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition border ${
                    replayIndex === entryBarIndex
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold'
                      : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-100'
                  }`}
                  title="跳转到精准入场点"
                >
                  入场点
                </button>
                <button
                  type="button"
                  onClick={() => { setIsPlaying(false); setReplayIndex(exitBarIndex); }}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition border ${
                    replayIndex >= exitBarIndex
                      ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-bold'
                      : 'bg-white dark:bg-navy-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-100'
                  }`}
                  title="跳转到平仓出场点"
                >
                  出场点
                </button>
              </div>

              {/* Playback speed buttons */}
              <div className="flex items-center pl-2 space-x-1">
                {[
                  { label: '0.5x', speed: 1200 },
                  { label: '1x', speed: 800 },
                  { label: '2x', speed: 400 },
                  { label: '5x', speed: 150 },
                ].map(s => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setPlaySpeed(s.speed)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition ${
                      playSpeed === s.speed
                        ? 'bg-purple-600 text-white'
                        : 'bg-white dark:bg-navy-800 text-gray-500 dark:text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrubber slider */}
            <div className="flex-1 max-w-sm flex items-center space-x-2">
              <span className="text-[10px] font-mono text-gray-400">入场前</span>
              <input
                type="range"
                min={preEntryIndex}
                max={postExitIndex}
                value={replayIndex}
                onChange={e => {
                  setIsPlaying(false);
                  setReplayIndex(parseInt(e.target.value, 10));
                }}
                className="w-full h-1.5 bg-gray-200 dark:bg-navy-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <span className="text-[10px] font-mono text-gray-400">出场后</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Chart Canvas Area */}
      <div className="relative w-full" style={{ height }}>
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-[#0b0f19]/60 backdrop-blur-xs">
            <div className="flex items-center space-x-2 text-xs font-mono text-purple-600 dark:text-purple-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>正在拉取逐根高精度 K 线...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 bg-white/80 dark:bg-[#0b0f19]/80 text-center">
            <AlertCircle className="w-6 h-6 text-amber-500 mb-1.5" />
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{error}</p>
            <button
              onClick={loadCandles}
              className="mt-2.5 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition"
            >
              重新加载
            </button>
          </div>
        )}

        <div ref={chartContainerRef} className="w-full h-full" />
      </div>

      {/* 4. TraderSync Style Review & Attribution Metrics Cards */}
      {liveStats && (
        <div className="p-3.5 border-t border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.01] space-y-3">
          
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white dark:bg-navy-800/80 p-2.5 rounded-xl border border-gray-200/80 dark:border-white/5 shadow-2xs">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>出场落袋效率</span>
                <Award className="w-3.5 h-3.5 text-purple-500" />
              </div>
              <div className="text-base font-black font-mono mt-0.5 text-gray-900 dark:text-white">
                {liveStats.exitEfficiency}%
              </div>
              <div className="w-full bg-gray-100 dark:bg-navy-700 h-1 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className={`h-full ${liveStats.exitEfficiency >= 70 ? 'bg-emerald-500' : liveStats.exitEfficiency >= 40 ? 'bg-blue-500' : 'bg-amber-500'}`}
                  style={{ width: `${Math.min(100, liveStats.exitEfficiency)}%` }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-navy-800/80 p-2.5 rounded-xl border border-gray-200/80 dark:border-white/5 shadow-2xs">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>最大顺行 (MFE)</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              </div>
              <div className="text-base font-black font-mono mt-0.5 text-emerald-600 dark:text-emerald-400">
                +${liveStats.mfeAmount.toFixed(1)}
              </div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                极值: {formatPriceNumber(liveStats.mfePrice)}
              </div>
            </div>

            <div className="bg-white dark:bg-navy-800/80 p-2.5 rounded-xl border border-gray-200/80 dark:border-white/5 shadow-2xs">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>最大逆行 (MAE)</span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
              </div>
              <div className="text-base font-black font-mono mt-0.5 text-rose-600 dark:text-rose-400">
                -${liveStats.maeAmount.toFixed(1)}
              </div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                深探: {formatPriceNumber(liveStats.maePrice)}
              </div>
            </div>

            <div className="bg-white dark:bg-navy-800/80 p-2.5 rounded-xl border border-gray-200/80 dark:border-white/5 shadow-2xs">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center justify-between">
                <span>留在桌上的利润</span>
                <Zap className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-base font-black font-mono mt-0.5 text-amber-600 dark:text-amber-400">
                {liveStats.leftOnTableAmount > 0 ? `+$${liveStats.leftOnTableAmount.toFixed(1)}` : '$0.00'}
              </div>
              <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate">
                {liveStats.leftOnTablePips > 0 ? `卖飞 ${formatPipsOrPoints(liveStats.leftOnTablePips, entryPrice)}` : '无卖飞 / 适时离场'}
              </div>
            </div>
          </div>

          {/* AI Coach Insights Pill */}
          {coachInsights && coachInsights.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {coachInsights.map((ci, idx) => (
                <div 
                  key={idx}
                  className={`p-2 rounded-xl text-xs flex items-start space-x-2 border ${
                    ci.type === 'success' 
                      ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/20' 
                      : ci.type === 'warning'
                      ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20'
                      : ci.type === 'danger'
                      ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/20'
                      : 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/20'
                  }`}
                >
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-purple-600 dark:text-purple-400" />
                  <div>
                    <span className="font-bold mr-1.5">{ci.title}:</span>
                    <span className="opacity-90">{ci.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Legend Footer */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] text-[11px] font-mono text-gray-500 dark:text-gray-400">
        <div className="flex items-center space-x-3 flex-wrap gap-y-1">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>入场: {formatPriceNumber(entryPrice)}</span>
          </div>
          {stopLoss && stopLoss > 0 && (
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span>止损: {formatPriceNumber(stopLoss)}</span>
            </div>
          )}
          {takeProfit && takeProfit > 0 && (
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>止盈: {formatPriceNumber(takeProfit)}</span>
            </div>
          )}
          {exitPrice && exitPrice > 0 && (
            <div className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
              <span>出场: {formatPriceNumber(exitPrice)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradeExecutionChart;
