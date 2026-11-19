import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  Play, Pause, SkipForward, RotateCcw, TrendingUp, TrendingDown, 
  DollarSign, CheckCircle2, AlertCircle, Save, Download, 
  Settings, Eye, BarChart2, ShieldAlert, Award,
  Calculator, Target, Shield, Percent, Sparkles, Sliders, Check,
  MousePointer, Minus, MoveDiagonal, Trash2, Layers, Crosshair,
  Scissors, X, ArrowUpRight, ArrowDownRight, Filter,
  Square, Maximize2, Minimize2, Activity, ChevronDown
} from 'lucide-react';
import { fetchCandles, CandleItem, createTrade, createBulkTrades } from '../services/api';
import SymbolSearchSelect from './common/SymbolSearchSelect';
import TradeExecutionChart from './TradeExecutionChart';

interface ChartRectangle {
  id: string;
  x1: number;
  x2: number;
  price1: number;
  price2: number;
  label?: string;
}

// Indicator Calculation Helpers
function calculateSMA(candles: CandleItem[], period: number): Array<number | null> {
  const result: Array<number | null> = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j].close;
      }
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(candles: CandleItem[], period: number): Array<number | null> {
  const result: Array<number | null> = [];
  const k = 2 / (period + 1);
  let prevEma: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (prevEma === null) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j].close;
      }
      prevEma = sum / period;
      result.push(prevEma);
    } else {
      prevEma = candles[i].close * k + prevEma * (1 - k);
      result.push(prevEma);
    }
  }
  return result;
}

function calculateBollingerBands(candles: CandleItem[], period: number = 20, multiplier: number = 2): {
  upper: Array<number | null>;
  middle: Array<number | null>;
  lower: Array<number | null>;
} {
  const upper: Array<number | null> = [];
  const middle: Array<number | null> = [];
  const lower: Array<number | null> = [];

  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) {
      upper.push(null);
      middle.push(null);
      lower.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += candles[i - j].close;
      }
      const mean = sum / period;
      let varianceSum = 0;
      for (let j = 0; j < period; j++) {
        varianceSum += Math.pow(candles[i - j].close - mean, 2);
      }
      const stdDev = Math.sqrt(varianceSum / period);
      middle.push(mean);
      upper.push(mean + multiplier * stdDev);
      lower.push(mean - multiplier * stdDev);
    }
  }
  return { upper, middle, lower };
}

function calculateRSI(candles: CandleItem[], period: number = 14): Array<number | null> {
  const rsi: Array<number | null> = [];
  if (candles.length <= period) {
    return candles.map(() => null);
  }
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = 0; i < period; i++) {
    rsi.push(null);
  }
  rsi.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change >= 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  }
  return rsi;
}

function parseTimestamp(timeStr: string | number | undefined): number {
  if (!timeStr) return 0;
  if (typeof timeStr === 'number') return timeStr;
  const parsed = Date.parse(timeStr.includes('T') ? timeStr : timeStr.replace(' ', 'T'));
  return isNaN(parsed) ? 0 : parsed;
}

function generateClientFallbackCandles(sym: string, tf: string, count: number = 400): CandleItem[] {
  const tfMinutes: Record<string, number> = {
    M1: 1, '1M': 1,
    M5: 5, '5M': 5,
    M15: 15, '15M': 15,
    M30: 30, '30M': 30,
    H1: 60, '1H': 60,
    H4: 240, '4H': 240,
    D1: 1440, '1D': 1440,
  };
  const stepMin = tfMinutes[tf.toUpperCase()] || 5;

  let basePrice = 1.0850;
  if (sym.includes('JPY')) basePrice = 155.0;
  else if (sym.includes('XAU') || sym.includes('黄金')) basePrice = 2350.0;
  else if (sym.includes('BTC') || sym.includes('比特币')) basePrice = 67000.0;
  else if (sym.includes('纳斯达克') || sym.includes('US100') || sym.includes('NAS')) basePrice = 20500.0;

  const candles: CandleItem[] = [];
  const nowMs = Date.now();
  let currentClose = basePrice;

  for (let i = count; i >= 0; i--) {
    const timeMs = nowMs - i * stepMin * 60 * 1000;
    const d = new Date(timeMs);
    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    
    const changePct = (Math.random() - 0.495) * 0.003;
    const open = currentClose;
    const close = open * (1 + changePct);
    const high = Math.max(open, close) * (1 + Math.random() * 0.0015);
    const low = Math.min(open, close) * (1 - Math.random() * 0.0015);
    currentClose = close;

    candles.push({
      time: timeStr,
      timestamp: Math.floor(timeMs / 1000),
      open: parseFloat(open.toFixed(basePrice > 100 ? 2 : 5)),
      high: parseFloat(high.toFixed(basePrice > 100 ? 2 : 5)),
      low: parseFloat(low.toFixed(basePrice > 100 ? 2 : 5)),
      close: parseFloat(close.toFixed(basePrice > 100 ? 2 : 5)),
      volume: Math.floor(Math.random() * 800) + 200,
    });
  }
  return candles;
}

function aggregateCandles(candles: CandleItem[], targetTf: string, baseTf: string = 'M5'): CandleItem[] {
  if (!candles || candles.length === 0) return [];
  if (targetTf === baseTf) return candles;

  const tfMinutes: Record<string, number> = {
    M1: 1,
    M5: 5,
    M15: 15,
    M30: 30,
    H1: 60,
    H4: 240,
    D1: 1440,
  };

  const baseMin = tfMinutes[baseTf] || 5;
  const targetMin = tfMinutes[targetTf] || 15;
  const ratio = Math.max(1, Math.round(targetMin / baseMin));

  if (ratio <= 1) return candles;

  const result: CandleItem[] = [];
  for (let i = 0; i < candles.length; i += ratio) {
    const chunk = candles.slice(i, i + ratio);
    if (chunk.length === 0) continue;
    const open = chunk[0].open;
    const close = chunk[chunk.length - 1].close;
    let high = -Infinity;
    let low = Infinity;
    let volume = 0;
    chunk.forEach(c => {
      if (c.high > high) high = c.high;
      if (c.low < low) low = c.low;
      volume += c.volume || 0;
    });
    result.push({
      time: chunk[0].time,
      timestamp: chunk[0].timestamp || (i * 300000),
      open,
      high,
      low,
      close,
      volume,
    });
  }
  return result;
}

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
  stopLoss?: number | null;
  takeProfit?: number | null;
}

interface ManualBarReplayProps {
  initialSymbol?: string;
  initialTimeframe?: string;
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

// Interactive SVG Equity Curve Component for Strategy Tester
const ReplayEquityCurve: React.FC<{
  data: Array<{ tradeIndex: number; time: string; capital: number; profit: number; drawdown: number; drawdownPct: number }>;
  initialCapital: number;
}> = ({ data, initialCapital }) => {
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);

  if (!data || data.length < 2) {
    return (
      <div className="h-64 flex flex-col items-center justify-center bg-gray-50/50 dark:bg-navy-800/40 rounded-xl border border-gray-200 dark:border-gray-700">
        <BarChart2 className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">暂无资金曲线数据</p>
        <p className="text-[11px] text-gray-400 mt-0.5">完成第 1 笔回测交易后将在此自动绘制策略资产净值与回撤曲线</p>
      </div>
    );
  }

  const capitals = data.map(d => d.capital);
  const minVal = Math.min(...capitals, initialCapital * 0.96);
  const maxVal = Math.max(...capitals, initialCapital * 1.04);
  const range = maxVal - minVal || 1;

  const width = 800;
  const height = 260;
  const padding = { top: 25, right: 35, bottom: 35, left: 65 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.capital - minVal) / range) * chartH;
    return { x, y, ...d };
  });

  const pathD = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaD = `${pathD} L ${padding.left + chartW},${padding.top + chartH} L ${padding.left},${padding.top + chartH} Z`;

  const baselineY = padding.top + chartH - ((initialCapital - minVal) / range) * chartH;
  const finalCapital = data[data.length - 1].capital;
  const isProfitable = finalCapital >= initialCapital;
  const strokeColor = isProfitable ? '#10B981' : '#EF4444';

  return (
    <div className="w-full bg-white dark:bg-navy-800/80 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex flex-wrap justify-between items-center mb-3 px-1 text-xs">
        <div className="flex items-center space-x-3">
          <span className="font-medium text-gray-500 dark:text-gray-400">
            初始本金: <b className="font-mono text-gray-900 dark:text-white">${initialCapital.toLocaleString()}</b>
          </span>
          <span className={`font-bold font-mono ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
            最终净值: ${finalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
            isProfitable ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
          }`}>
            {isProfitable ? '+' : ''}{(((finalCapital - initialCapital) / initialCapital) * 100).toFixed(2)}%
          </span>
        </div>
        <div className="text-[11px] text-gray-400">
          共 {data.length - 1} 笔已平仓交易
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 overflow-visible">
          <defs>
            <linearGradient id="replayEquityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padding.top + chartH * pct;
            const val = maxVal - pct * range;
            return (
              <g key={idx}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" className="text-gray-100 dark:text-gray-700/60" strokeDasharray="3 3" />
                <text x={padding.left - 8} y={y + 3.5} textAnchor="end" className="text-[10px] fill-gray-400 font-mono">
                  ${Math.round(val).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Initial Capital Baseline */}
          <line
            x1={padding.left}
            y1={baselineY}
            x2={width - padding.right}
            y2={baselineY}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />
          <text x={width - padding.right - 4} y={baselineY - 4} textAnchor="end" className="text-[9px] fill-gray-400 font-mono">
            基准 ${initialCapital.toLocaleString()}
          </text>

          {/* Area under curve */}
          <path d={areaD} fill="url(#replayEquityGrad)" />

          {/* Curve line */}
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Trade point dots */}
          {points.map((p, idx) => (
            <circle
              key={idx}
              cx={p.x}
              cy={p.y}
              r={idx === 0 || idx === points.length - 1 ? 4.5 : 3}
              fill={idx === 0 ? '#94a3b8' : (p.profit >= 0 ? '#10B981' : '#EF4444')}
              stroke="#ffffff"
              strokeWidth="1.5"
              className="cursor-pointer transition-transform hover:scale-150"
              onMouseEnter={() => setHoveredPoint(p)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div 
            className="absolute z-10 bg-gray-900/95 text-white text-[11px] p-2.5 rounded-lg pointer-events-none shadow-xl border border-gray-700/80 -translate-x-1/2 -translate-y-full"
            style={{ 
              left: `${(hoveredPoint.x / width) * 100}%`, 
              top: `${(hoveredPoint.y / height) * 100}%`,
              marginTop: '-10px'
            }}
          >
            <div className="font-bold text-gray-200">
              {hoveredPoint.tradeIndex === 0 ? '初始状态' : `交易 #${hoveredPoint.tradeIndex}`}
            </div>
            {hoveredPoint.tradeIndex > 0 && (
              <div className={hoveredPoint.profit >= 0 ? 'text-emerald-400 font-mono font-bold' : 'text-rose-400 font-mono font-bold'}>
                盈亏: {hoveredPoint.profit >= 0 ? `+$${hoveredPoint.profit}` : `-$${Math.abs(hoveredPoint.profit)}`}
              </div>
            )}
            <div className="font-mono text-gray-300">
              结余净值: ${hoveredPoint.capital.toLocaleString()}
            </div>
            {hoveredPoint.drawdown > 0 && (
              <div className="text-red-400 text-[10px]">
                峰值回撤: -${hoveredPoint.drawdown} (-{hoveredPoint.drawdownPct}%)
              </div>
            )}
            <div className="text-[10px] text-gray-400 mt-0.5">
              时间: {hoveredPoint.time}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function ManualBarReplay({ 
  initialSymbol = 'EURUSD', 
  initialTimeframe = 'M5',
  popularSymbols = [],
  allSymbols = [] 
}: ManualBarReplayProps) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
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
  type DrawingTool = 'pointer' | 'jump' | 'long' | 'short' | 'horizontal' | 'trendline' | 'rectangle';
  const [activeTool, setActiveTool] = useState<DrawingTool>('pointer');
  const [horizontalLines, setHorizontalLines] = useState<Array<{ id: string; price: number; label?: string }>>([]);
  const [trendLines, setTrendLines] = useState<Array<{ id: string; x1: number; y1: number; price1: number; x2: number; y2: number; price2: number }>>([]);
  const [rectangles, setRectangles] = useState<ChartRectangle[]>([]);
  const [isDrawingRect, setIsDrawingRect] = useState<boolean>(false);
  const [rectStart, setRectStart] = useState<{ x: number; y: number; price: number } | null>(null);
  const [rectCurrent, setRectCurrent] = useState<{ x: number; y: number; price: number } | null>(null);

  const [dragTarget, setDragTarget] = useState<{ type: 'tp' | 'sl' | 'entry' | 'horizontal'; lineId?: string; startY: number } | null>(null);
  const [hoverHandle, setHoverHandle] = useState<string | null>(null);
  const [isDrawingTrend, setIsDrawingTrend] = useState<boolean>(false);
  const [trendStart, setTrendStart] = useState<{ x: number; y: number; price: number } | null>(null);
  const [trendCurrent, setTrendCurrent] = useState<{ x: number; y: number; price: number } | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Indicators State (TradingView-Lite 技术指标)
  const [showMa20, setShowMa20] = useState<boolean>(true);
  const [showMa50, setShowMa50] = useState<boolean>(false);
  const [showMa200, setShowMa200] = useState<boolean>(false);
  const [showEma9, setShowEma9] = useState<boolean>(false);
  const [showBollinger, setShowBollinger] = useState<boolean>(false);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showRsi, setShowRsi] = useState<boolean>(false);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState<boolean>(false);

  // Fullscreen State (全屏沉浸式操作)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(prev => !prev);
        });
        setIsFullscreen(true);
      } else {
        setIsFullscreen(prev => !prev);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      } else {
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Position & Replay Trades & Strategy Tester
  const [position, setPosition] = useState<OpenPosition | null>(null);
  const [replayTrades, setReplayTrades] = useState<ReplayTrade[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [reviewTrade, setReviewTrade] = useState<ReplayTrade | null>(null);
  const [statsTab, setStatsTab] = useState<'summary' | 'curve' | 'trades'>('summary');
  const [tradeFilter, setTradeFilter] = useState<'all' | 'win' | 'loss'>('all');

  // Multi-Timeframe Linked Windows State (最多4个周期窗口联动)
  const [windowCount, setWindowCount] = useState<number>(1); // 1, 2, 3, 4
  const [activeWindowIndex, setActiveWindowIndex] = useState<number>(0);
  const [windowTimeframes, setWindowTimeframes] = useState<string[]>(['M5', 'M15', 'H1', 'H4']);
  const [windowCandles, setWindowCandles] = useState<Record<number, CandleItem[]>>({});
  const [syncHoverTime, setSyncHoverTime] = useState<string | null>(null);

  // References for up to 4 canvas windows
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null]);
  const scaleRefs = useRef<any[]>([null, null, null, null]);
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
        const fallback = generateClientFallbackCandles(symbol, timeframe, 400);
        setAllCandles(fallback);
        setContractSize(symbol.includes('JPY') || symbol.includes('XAU') || symbol.includes('BTC') ? 1.0 : 100000);
        setCurrentIndex(50);
      }
    } catch (err: any) {
      console.warn('获取行情接口失败，自动启用前端高保真本地仿真行情备用引擎:', err);
      const fallback = generateClientFallbackCandles(symbol, timeframe, 400);
      setAllCandles(fallback);
      setContractSize(symbol.includes('JPY') || symbol.includes('XAU') || symbol.includes('BTC') ? 1.0 : 100000);
      setCurrentIndex(50);
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    loadCandleData();
  }, [loadCandleData]);

  // Keep windowTimeframes[0] in sync with primary timeframe
  useEffect(() => {
    setWindowTimeframes(prev => {
      if (prev[0] === timeframe) return prev;
      const next = [...prev];
      next[0] = timeframe;
      return next;
    });
  }, [timeframe]);

  // Fetch secondary window candles when multi-window is enabled
  const loadWindowCandles = useCallback(async (winIdx: number, tf: string) => {
    if (winIdx === 0) return;
    try {
      const data = await fetchCandles({
        symbol,
        timeframe: tf,
        count: 400,
      });
      if (data.candles && data.candles.length > 0) {
        setWindowCandles(prev => ({
          ...prev,
          [winIdx]: data.candles,
        }));
      }
    } catch {
      // aggregateCandles automatically provides aggregated fallback bars
    }
  }, [symbol]);

  useEffect(() => {
    for (let i = 1; i < windowCount; i++) {
      if (!windowCandles[i] || windowCandles[i].length === 0) {
        loadWindowCandles(i, windowTimeframes[i]);
      }
    }
  }, [windowCount, windowTimeframes, loadWindowCandles, windowCandles]);

  const handleWindowTimeframeChange = (winIdx: number, newTf: string) => {
    setWindowTimeframes(prev => {
      const next = [...prev];
      next[winIdx] = newTf;
      return next;
    });
    if (winIdx === 0) {
      setTimeframe(newTf);
    } else {
      loadWindowCandles(winIdx, newTf);
    }
  };

  // Current visible candles for master window 0
  const visibleCandles = allCandles.slice(0, currentIndex + 1);
  const currentCandle = visibleCandles[visibleCandles.length - 1];

  // Get all candles for window i (either direct MT5 candles or aggregated from base)
  const getWindowCandles = useCallback((winIdx: number): CandleItem[] => {
    if (winIdx === 0) return allCandles;
    const directCandles = windowCandles[winIdx];
    if (directCandles && directCandles.length > 20) return directCandles;
    return aggregateCandles(allCandles, windowTimeframes[winIdx], timeframe);
  }, [allCandles, windowCandles, windowTimeframes, timeframe]);

  // Get linked visible slice for window i (synchronized to currentMasterTimestamp)
  const getWindowVisibleSlice = useCallback((winIdx: number): CandleItem[] => {
    if (winIdx === 0) return visibleCandles;
    const winAll = getWindowCandles(winIdx);
    if (!winAll || winAll.length === 0) return [];
    if (!currentCandle) return winAll.slice(0, Math.min(50, winAll.length));

    const masterTs = currentCandle.timestamp || parseTimestamp(currentCandle.time);
    if (masterTs > 0) {
      let endIdx = winAll.findIndex(c => {
        const ts = c.timestamp || parseTimestamp(c.time);
        return ts > masterTs;
      });
      if (endIdx === -1) endIdx = winAll.length;
      return winAll.slice(0, Math.max(1, endIdx));
    } else {
      const ratio = (currentIndex + 1) / Math.max(1, allCandles.length);
      const targetCount = Math.max(1, Math.round(ratio * winAll.length));
      return winAll.slice(0, targetCount);
    }
  }, [getWindowCandles, visibleCandles, currentCandle, currentIndex, allCandles.length]);

  // Technical Indicators calculations on visible history
  const ma20Data = useMemo(() => {
    if (!showMa20) return [];
    return calculateSMA(visibleCandles, 20);
  }, [visibleCandles, showMa20]);

  const ma50Data = useMemo(() => {
    if (!showMa50) return [];
    return calculateSMA(visibleCandles, 50);
  }, [visibleCandles, showMa50]);

  const ma200Data = useMemo(() => {
    if (!showMa200) return [];
    return calculateSMA(visibleCandles, 200);
  }, [visibleCandles, showMa200]);

  const ema9Data = useMemo(() => {
    if (!showEma9) return [];
    return calculateEMA(visibleCandles, 9);
  }, [visibleCandles, showEma9]);

  const bbData = useMemo(() => {
    if (!showBollinger) return null;
    return calculateBollingerBands(visibleCandles, 20, 2);
  }, [visibleCandles, showBollinger]);

  const rsiData = useMemo(() => {
    if (!showRsi) return [];
    return calculateRSI(visibleCandles, 14);
  }, [visibleCandles, showRsi]);

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
          stopLoss: position.stopLoss,
          takeProfit: position.takeProfit,
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
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
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

  // Window Mouse Down Handler for Drawing & Dragging (支持多窗口联动交互)
  const handleWindowMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, winIdx: number) => {
    setActiveWindowIndex(winIdx);
    const canvas = canvasRefs.current[winIdx] || canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const scale = scaleRefs.current[winIdx] || scaleRef.current;
    if (!scale) return;

    const clickedPrice = scale.yToPrice(mouseY);

    // 0. Tool: Jump to Bar / Cut-in Replay point (TradingView Scissors)
    if (activeTool === 'jump') {
      const winVisible = getWindowVisibleSlice(winIdx);
      const displayCount = Math.min(65, winVisible.length);
      const barSpacing = scale.chartW / displayCount;
      const clickedCol = Math.floor((mouseX - scale.chartPadding.left) / barSpacing);
      const sliceCandles = winVisible.slice(winVisible.length - displayCount);
      if (clickedCol >= 0 && clickedCol < sliceCandles.length) {
        const targetCandle = sliceCandles[clickedCol];
        const targetTs = targetCandle.timestamp || parseTimestamp(targetCandle.time);
        let targetIdx = allCandles.findIndex(c => c.time === targetCandle.time);
        if (targetIdx < 0 && targetTs > 0) {
          targetIdx = allCandles.findIndex(c => (c.timestamp || parseTimestamp(c.time)) >= targetTs);
        }
        if (targetIdx >= 0) {
          setCurrentIndex(targetIdx);
          setPosition(null);
          setIsPlaying(false);
          setActiveTool('pointer');
        }
      }
      return;
    }

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

    // 4.5. Tool: Rectangle Drawing Start (供求区间 / 矩形区域)
    if (activeTool === 'rectangle') {
      setIsDrawingRect(true);
      setRectStart({ x: mouseX, y: mouseY, price: clickedPrice });
      setRectCurrent({ x: mouseX, y: mouseY, price: clickedPrice });
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

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => handleWindowMouseDown(e, 0);

  // Window Mouse Move Handler
  const handleWindowMouseMove = (e: React.MouseEvent<HTMLCanvasElement>, winIdx: number) => {
    const canvas = canvasRefs.current[winIdx] || canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const scale = scaleRefs.current[winIdx] || scaleRef.current;
    if (!scale) return;

    const currentPrice = scale.yToPrice(mouseY);
    setHoverPrice(currentPrice);
    setMousePos({ x: mouseX, y: mouseY });

    // Multi-window crosshair synchronization timestamp
    const winVisible = getWindowVisibleSlice(winIdx);
    const displayCount = Math.min(65, winVisible.length);
    const barSpacing = scale.chartW / displayCount;
    const col = Math.floor((mouseX - scale.chartPadding.left) / barSpacing);
    const sliceCandles = winVisible.slice(winVisible.length - displayCount);
    if (col >= 0 && col < sliceCandles.length) {
      setSyncHoverTime(sliceCandles[col].time);
    } else {
      setSyncHoverTime(null);
    }

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

    // If currently drawing rectangle preview
    if (isDrawingRect && rectStart) {
      setRectCurrent({ x: mouseX, y: mouseY, price: currentPrice });
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

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => handleWindowMouseMove(e, 0);

  // Window Mouse Up Handler
  const handleWindowMouseUp = (winIdx: number) => {
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

    if (isDrawingRect && rectStart && rectCurrent) {
      const dx = Math.abs(rectCurrent.x - rectStart.x);
      const dy = Math.abs(rectCurrent.y - rectStart.y);
      if (dx > 5 || dy > 5) {
        setRectangles(prev => [
          ...prev,
          {
            id: 'rect_' + Date.now(),
            x1: Math.min(rectStart.x, rectCurrent.x),
            y1: Math.min(rectStart.y, rectCurrent.y),
            price1: Math.max(rectStart.price, rectCurrent.price),
            x2: Math.max(rectStart.x, rectCurrent.x),
            y2: Math.max(rectStart.y, rectCurrent.y),
            price2: Math.min(rectStart.price, rectCurrent.price),
          }
        ]);
      }
      setIsDrawingRect(false);
      setRectStart(null);
      setRectCurrent(null);
      setActiveTool('pointer');
    }

    setDragTarget(null);
  };

  const handleCanvasMouseUp = () => handleWindowMouseUp(0);

  const handleWindowMouseLeave = (winIdx: number) => {
    if (activeWindowIndex === winIdx) {
      setHoverHandle(null);
      setMousePos(null);
      setSyncHoverTime(null);
    }
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
      if (isDrawingRect) {
        setIsDrawingRect(false);
        setRectStart(null);
        setRectCurrent(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragTarget, isDrawingTrend, isDrawingRect]);

  const getCanvasCursorClass = () => {
    if (activeTool === 'jump' || activeTool === 'horizontal' || activeTool === 'long' || activeTool === 'short' || activeTool === 'trendline' || activeTool === 'rectangle') {
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

  // Hovered candle for live TradingView OHLC ticker bar
  const hoveredCandle = useMemo(() => {
    if (!mousePos || !scaleRef.current) return null;
    const scale = scaleRef.current;
    const displayCount = Math.min(65, visibleCandles.length);
    const barSpacing = scale.chartW / displayCount;
    const col = Math.floor((mousePos.x - scale.chartPadding.left) / barSpacing);
    const sliceCandles = visibleCandles.slice(visibleCandles.length - displayCount);
    if (col >= 0 && col < sliceCandles.length) {
      return sliceCandles[col];
    }
    return null;
  }, [mousePos, visibleCandles]);

  // Draw Candlestick Chart on Canvas (支持最多4个周期窗口联动渲染)
  useEffect(() => {
    // Keep canvasRef.current assigned to window 0 canvas
    if (canvasRefs.current[0]) {
      canvasRef.current = canvasRefs.current[0];
    }

    const isDark = document.documentElement.classList.contains('dark');

    for (let winIdx = 0; winIdx < windowCount; winIdx++) {
      const canvas = canvasRefs.current[winIdx] || (winIdx === 0 ? canvasRef.current : null);
      if (!canvas) continue;

      const winVisibleCandles = getWindowVisibleSlice(winIdx);
      if (winVisibleCandles.length === 0) continue;

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;

      // 1. Clear background
      ctx.fillStyle = isDark ? '#0f172a' : '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // 2. TradingView-Lite subtle watermark
      ctx.save?.();
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.035)';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const winLabel = winIdx === 0 ? '主控窗口' : `联动窗口 ${winIdx + 1}`;
      ctx.fillText(`${symbol} • ${windowTimeframes[winIdx] || timeframe} • ${winLabel}`, w / 2, h / 2);
      ctx.restore?.();

      // 3. Visible candles for this window (up to last 65 bars)
      const displayCount = Math.min(65, winVisibleCandles.length);
      const sliceCandles = winVisibleCandles.slice(winVisibleCandles.length - displayCount);

      // 4. Calculate min and max price
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
      rectangles.forEach(rect => {
        if (rect.price1 < minPrice) minPrice = rect.price1;
        if (rect.price1 > maxPrice) maxPrice = rect.price1;
        if (rect.price2 < minPrice) minPrice = rect.price2;
        if (rect.price2 > maxPrice) maxPrice = rect.price2;
      });

      const pricePadding = (maxPrice - minPrice) * 0.08 || 0.001;
      minPrice -= pricePadding;
      maxPrice += pricePadding;
      const priceRange = maxPrice - minPrice;

      const chartPadding = { top: 20, right: 62, bottom: 22, left: 12 };
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
      const gridRows = 4;
      for (let i = 0; i <= gridRows; i++) {
        const y = chartPadding.top + (chartH / gridRows) * i;
        const price = maxPrice - (priceRange / gridRows) * i;
        ctx.beginPath();
        ctx.moveTo(chartPadding.left, y);
        ctx.lineTo(w - chartPadding.right, y);
        ctx.stroke();

        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = '9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(price.toFixed(price > 100 ? 2 : 4), w - chartPadding.right + 5, y + 3);
      }

      const barSpacing = chartW / displayCount;
      const candleW = Math.max(2, barSpacing * 0.7);

      // Draw TV Visuals Shaded Box
      let tvBoxState: any = undefined;
      if (showTvVisuals && activeOrPlannedEntry && activeOrPlannedSl) {
        const entryY = priceToY(activeOrPlannedEntry);
        const slY = priceToY(activeOrPlannedSl);
        const tpY = (activeOrPlannedTp && activeOrPlannedTp > 0) ? priceToY(activeOrPlannedTp) : null;
        let startIndex = Math.max(0, displayCount - 20);
        if (position) {
          const foundIdx = sliceCandles.findIndex(c => c.time === position.entryTime);
          if (foundIdx >= 0) startIndex = foundIdx;
        }
        const boxLeft = Math.max(chartPadding.left + startIndex * barSpacing, chartPadding.left);
        const boxRight = w - chartPadding.right;
        const boxW = Math.max(70, boxRight - boxLeft);
        tvBoxState = { entryY, slY, tpY, boxLeft, boxRight, boxW };

        const lossTop = Math.min(entryY, slY);
        const lossHeight = Math.max(2, Math.abs(entryY - slY));
        ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.05)';
        ctx.fillRect(boxLeft, lossTop, boxW, lossHeight);
        ctx.strokeStyle = isDark ? 'rgba(248, 113, 113, 0.35)' : 'rgba(220, 38, 38, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash?.([4, 2]);
        ctx.strokeRect(boxLeft, lossTop, boxW, lossHeight);
        ctx.setLineDash?.([]);

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

      // Draw Horizontal Lines (Global across all windows)
      horizontalLines.forEach((hl) => {
        const ly = priceToY(hl.price);
        if (ly < chartPadding.top || ly > h - chartPadding.bottom) return;
        const isHovered = activeWindowIndex === winIdx && (hoverHandle === 'h_' + hl.id || dragTarget?.lineId === hl.id);

        ctx.save?.();
        ctx.strokeStyle = isHovered ? '#f59e0b' : (isDark ? 'rgba(245, 158, 11, 0.8)' : 'rgba(217, 119, 6, 0.8)');
        ctx.lineWidth = isHovered ? 2 : 1.3;
        ctx.setLineDash?.([5, 3]);
        ctx.beginPath();
        ctx.moveTo(chartPadding.left, ly);
        ctx.lineTo(w - chartPadding.right, ly);
        ctx.stroke();
        ctx.setLineDash?.([]);

        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(w - chartPadding.right, ly - 7, 62, 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(formatPriceNumber(hl.price, hl.price), w - chartPadding.right + 3, ly + 3);
        ctx.restore?.();
      });

      // Draw Rectangles (Global across all windows)
      rectangles.forEach((rect) => {
        const topY = priceToY(rect.price1);
        const bottomY = priceToY(rect.price2);
        const rectY = Math.min(topY, bottomY);
        const rectH = Math.max(2, Math.abs(topY - bottomY));
        const rectX = Math.max(chartPadding.left, Math.min(rect.x1, rect.x2));
        const rectW = Math.max(20, Math.abs(rect.x2 - rect.x1));

        ctx.save?.();
        ctx.fillStyle = isDark ? 'rgba(168, 85, 247, 0.15)' : 'rgba(168, 85, 247, 0.12)';
        ctx.fillRect(rectX, rectY, rectW, rectH);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.3;
        ctx.setLineDash?.([4, 2]);
        ctx.strokeRect(rectX, rectY, rectW, rectH);
        ctx.setLineDash?.([]);
        ctx.restore?.();
      });

      // Live rectangle drawing preview on active window
      if (activeWindowIndex === winIdx && isDrawingRect && rectStart && rectCurrent) {
        const minX = Math.min(rectStart.x, rectCurrent.x);
        const maxX = Math.max(rectStart.x, rectCurrent.x);
        const minY = Math.min(rectStart.y, rectCurrent.y);
        const maxY = Math.max(rectStart.y, rectCurrent.y);
        ctx.save?.();
        ctx.fillStyle = 'rgba(168, 85, 247, 0.2)';
        ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.5;
        ctx.setLineDash?.([4, 2]);
        ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
        ctx.setLineDash?.([]);
        ctx.restore?.();
      }

      // Draw Trendlines (on active window)
      if (activeWindowIndex === winIdx) {
        trendLines.forEach((tl) => {
          ctx.save?.();
          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tl.x1, tl.y1);
          ctx.lineTo(tl.x2, tl.y2);
          ctx.stroke();
          ctx.restore?.();
        });

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
          ctx.restore?.();
        }
      }

      // Draw Volume
      if (showVolume) {
        const maxVol = Math.max(...sliceCandles.map(c => c.volume || 1), 1);
        const volAreaHeight = chartH * 0.16;
        const volBaseY = chartPadding.top + chartH;
        sliceCandles.forEach((c, i) => {
          const x = chartPadding.left + i * barSpacing + barSpacing / 2;
          const v = c.volume || 0;
          const barH = (v / maxVol) * volAreaHeight;
          const isBarUp = c.close >= c.open;
          ctx.fillStyle = isBarUp
            ? (isDark ? 'rgba(16, 185, 129, 0.25)' : 'rgba(16, 185, 129, 0.2)')
            : (isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)');
          ctx.fillRect(x - candleW / 2, volBaseY - barH, candleW, barH);
        });
      }

      // Draw Candles
      sliceCandles.forEach((c, i) => {
        const x = chartPadding.left + i * barSpacing + barSpacing / 2;
        const isUp = c.close >= c.open;
        const color = isUp ? '#10B981' : '#EF4444';
        const highY = priceToY(c.high);
        const lowY = priceToY(c.low);
        const openY = priceToY(c.open);
        const closeY = priceToY(c.close);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x, highY);
        ctx.lineTo(x, lowY);
        ctx.stroke();

        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(2, Math.abs(openY - closeY));
        ctx.fillStyle = color;
        ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyHeight);
      });

      // Time labels on bottom
      if (sliceCandles.length > 0) {
        ctx.fillStyle = isDark ? '#94a3b8' : '#64748b';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(sliceCandles[0].time, chartPadding.left, h - 6);
        ctx.textAlign = 'right';
        ctx.fillText(sliceCandles[sliceCandles.length - 1].time, w - chartPadding.right, h - 6);
      }

      // Draw Indicators on this window's visible slice
      if (showBollinger) {
        const winBb = calculateBollingerBands(winVisibleCandles, 20, 2);
        if (winBb) {
          const sliceBb = winBb.slice(winVisibleCandles.length - displayCount);
          ctx.save?.();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          let started = false;
          sliceBb.forEach((bb, i) => {
            if (!bb) return;
            const x = chartPadding.left + i * barSpacing + barSpacing / 2;
            const yUpper = priceToY(bb.upper);
            if (!started) { ctx.moveTo(x, yUpper); started = true; } else { ctx.lineTo(x, yUpper); }
          });
          ctx.stroke();

          ctx.beginPath();
          started = false;
          sliceBb.forEach((bb, i) => {
            if (!bb) return;
            const x = chartPadding.left + i * barSpacing + barSpacing / 2;
            const yLower = priceToY(bb.lower);
            if (!started) { ctx.moveTo(x, yLower); started = true; } else { ctx.lineTo(x, yLower); }
          });
          ctx.stroke();
          ctx.restore?.();
        }
      }

      const drawIndLine = (data: Array<number | null>, color: string, lineWidth = 1.3) => {
        const sliceData = data.slice(winVisibleCandles.length - displayCount);
        ctx.save?.();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        let started = false;
        sliceData.forEach((val, i) => {
          if (val === null || isNaN(val)) return;
          const x = chartPadding.left + i * barSpacing + barSpacing / 2;
          const y = priceToY(val);
          if (!started) { ctx.moveTo(x, y); started = true; } else { ctx.lineTo(x, y); }
        });
        if (started) ctx.stroke();
        ctx.restore?.();
      };

      if (showMa20) drawIndLine(calculateSMA(winVisibleCandles, 20), '#f59e0b');
      if (showMa50) drawIndLine(calculateSMA(winVisibleCandles, 50), '#06b6d4');
      if (showMa200) drawIndLine(calculateSMA(winVisibleCandles, 200), '#a855f7');
      if (showEma9) drawIndLine(calculateEMA(winVisibleCandles, 9), '#38bdf8');

      // Draw TradingView position lines & draggable handles
      if (showTvVisuals && tvBoxState && activeOrPlannedEntry && activeOrPlannedSl) {
        const { entryY, slY, tpY, boxLeft, boxRight, boxW } = tvBoxState;
        const activeOrPlannedDir = position ? position.direction : orderDirection;

        ctx.strokeStyle = activeOrPlannedDir === 'long' ? '#10B981' : '#EF4444';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(chartPadding.left, entryY);
        ctx.lineTo(boxRight, entryY);
        ctx.stroke();

        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 1.3;
        ctx.setLineDash?.([3, 2]);
        ctx.beginPath();
        ctx.moveTo(boxLeft, slY);
        ctx.lineTo(boxRight, slY);
        ctx.stroke();
        ctx.setLineDash?.([]);

        if (tpY !== null) {
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 1.3;
          ctx.setLineDash?.([3, 2]);
          ctx.beginPath();
          ctx.moveTo(boxLeft, tpY);
          ctx.lineTo(boxRight, tpY);
          ctx.stroke();
          ctx.setLineDash?.([]);
        }

        // Draggable interactive handles
        const handleX = boxLeft + boxW / 2;
        if (tpY !== null) {
          const isTpActive = activeWindowIndex === winIdx && (dragTarget?.type === 'tp' || hoverHandle === 'tp');
          ctx.beginPath();
          ctx.arc?.(handleX, tpY, isTpActive ? 6.5 : 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#10B981';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        {
          const isSlActive = activeWindowIndex === winIdx && (dragTarget?.type === 'sl' || hoverHandle === 'sl');
          ctx.beginPath();
          ctx.arc?.(handleX, slY, isSlActive ? 6.5 : 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#EF4444';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Draw latest price line
      const latestBar = sliceCandles[sliceCandles.length - 1];
      if (latestBar) {
        const currY = priceToY(latestBar.close);
        ctx.strokeStyle = '#8B5CF6';
        ctx.setLineDash?.([2, 2]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chartPadding.left, currY);
        ctx.lineTo(w - chartPadding.right, currY);
        ctx.stroke();
        ctx.setLineDash?.([]);

        ctx.fillStyle = '#8B5CF6';
        ctx.fillRect(w - chartPadding.right, currY - 8, 62, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(latestBar.close.toFixed(latestBar.close > 100 ? 2 : 4), w - chartPadding.right + 31, currY + 3);
      }

      // Crosshair tracking on this window
      if (activeWindowIndex === winIdx && mousePos && mousePos.x >= chartPadding.left && mousePos.x <= w - chartPadding.right) {
        ctx.save?.();
        ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(100, 116, 139, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash?.([3, 3]);

        ctx.beginPath();
        ctx.moveTo(chartPadding.left, mousePos.y);
        ctx.lineTo(w - chartPadding.right, mousePos.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(mousePos.x, chartPadding.top);
        ctx.lineTo(mousePos.x, h - chartPadding.bottom);
        ctx.stroke();
        ctx.setLineDash?.([]);

        const hoverP = yToPrice(mousePos.y);
        ctx.fillStyle = isDark ? '#334155' : '#475569';
        ctx.fillRect(w - chartPadding.right, mousePos.y - 8, 62, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(formatPriceNumber(hoverP, hoverP), w - chartPadding.right + 3, mousePos.y + 4);
        ctx.restore?.();
      }

      // Synchronized Vertical Crosshair Line from another window
      if (activeWindowIndex !== winIdx && syncHoverTime) {
        const syncCol = sliceCandles.findIndex(c => c.time === syncHoverTime);
        if (syncCol >= 0) {
          const syncX = chartPadding.left + syncCol * barSpacing + barSpacing / 2;
          ctx.save?.();
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1.2;
          ctx.setLineDash?.([2, 2]);
          ctx.beginPath();
          ctx.moveTo(syncX, chartPadding.top);
          ctx.lineTo(syncX, h - chartPadding.bottom);
          ctx.stroke();
          ctx.setLineDash?.([]);
          ctx.restore?.();
        }
      }

      // Save scale matrix
      scaleRefs.current[winIdx] = {
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

      if (winIdx === 0) {
        scaleRef.current = scaleRefs.current[0];
      }
    }
  }, [
    visibleCandles, windowCount, windowTimeframes, windowCandles, 
    position, currentCandle, showTvVisuals, orderDirection, 
    parsedSl, parsedTp, activeLots, floatingProfit, floatingPct, 
    horizontalLines, trendLines, rectangles, isDrawingTrend, trendStart, trendCurrent, 
    isDrawingRect, rectStart, rectCurrent, hoverHandle, dragTarget, activeTool, mousePos,
    showMa20, showMa50, showMa200, showEma9, showBollinger, showVolume, showRsi,
    syncHoverTime, activeWindowIndex, getWindowVisibleSlice
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

  // TradingView Style Strategy Tester & Results Statistics Calculations
  const totalTradesCount = replayTrades.length;
  const winningTrades = replayTrades.filter(t => t.profit > 0);
  const losingTrades = replayTrades.filter(t => t.profit < 0);
  const breakEvenTrades = replayTrades.filter(t => t.profit === 0);

  const winRate = totalTradesCount > 0 
    ? ((winningTrades.length / totalTradesCount) * 100).toFixed(1) 
    : '0.0';

  const totalGrossProfit = winningTrades.reduce((acc, t) => acc + t.profit, 0);
  const totalGrossLoss = Math.abs(losingTrades.reduce((acc, t) => acc + t.profit, 0));
  const totalNetProfit = totalGrossProfit - totalGrossLoss;
  const netProfitPercent = accountCapital > 0 ? ((totalNetProfit / accountCapital) * 100).toFixed(2) : '0.00';
  const currentEquity = accountCapital + totalNetProfit;

  const profitFactor = totalGrossLoss > 0 
    ? (totalGrossProfit / totalGrossLoss).toFixed(2) 
    : (totalGrossProfit > 0 ? '99.9' : '0.00');

  const avgTradeProfit = totalTradesCount > 0 ? (totalNetProfit / totalTradesCount).toFixed(2) : '0.00';
  const avgWin = winningTrades.length > 0 ? (totalGrossProfit / winningTrades.length).toFixed(2) : '0.00';
  const avgLoss = losingTrades.length > 0 ? (totalGrossLoss / losingTrades.length).toFixed(2) : '0.00';
  const ratioAvgWinLoss = parseFloat(avgLoss) > 0 ? (parseFloat(avgWin) / parseFloat(avgLoss)).toFixed(2) : (parseFloat(avgWin) > 0 ? '99.9' : '0.00');

  const maxWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.profit)).toFixed(2) : '0.00';
  const maxLoss = losingTrades.length > 0 ? Math.abs(Math.min(...losingTrades.map(t => t.profit))).toFixed(2) : '0.00';

  const tradesWithRR = replayTrades.filter(t => t.rrRatio && t.rrRatio > 0);
  const avgRR = tradesWithRR.length > 0 
    ? (tradesWithRR.reduce((acc, t) => acc + (t.rrRatio || 0), 0) / tradesWithRR.length).toFixed(2) 
    : riskRewardRatio.toFixed(2);

  // Consecutive wins & losses and Equity Curve
  const chronologicalTrades = [...replayTrades].reverse();
  let currentWins = 0;
  let maxConsecutiveWins = 0;
  let currentLosses = 0;
  let maxConsecutiveLosses = 0;

  let runningCap = accountCapital;
  let peakCapital = accountCapital;
  let maxDrawdownAmount = 0;
  let maxDrawdownPercent = 0;

  const equityCurveData: Array<{
    tradeIndex: number;
    time: string;
    capital: number;
    profit: number;
    drawdown: number;
    drawdownPct: number;
  }> = [
    { tradeIndex: 0, time: '初始', capital: accountCapital, profit: 0, drawdown: 0, drawdownPct: 0 }
  ];

  chronologicalTrades.forEach((t, idx) => {
    if (t.profit > 0) {
      currentWins += 1;
      currentLosses = 0;
      if (currentWins > maxConsecutiveWins) maxConsecutiveWins = currentWins;
    } else if (t.profit < 0) {
      currentLosses += 1;
      currentWins = 0;
      if (currentLosses > maxConsecutiveLosses) maxConsecutiveLosses = currentLosses;
    }

    runningCap += t.profit;
    if (runningCap > peakCapital) peakCapital = runningCap;
    const ddAmount = peakCapital - runningCap;
    const ddPct = peakCapital > 0 ? (ddAmount / peakCapital) * 100 : 0;
    if (ddAmount > maxDrawdownAmount) maxDrawdownAmount = ddAmount;
    if (ddPct > maxDrawdownPercent) maxDrawdownPercent = ddPct;

    equityCurveData.push({
      tradeIndex: idx + 1,
      time: t.exitTime || t.entryTime,
      capital: Math.round(runningCap * 100) / 100,
      profit: t.profit,
      drawdown: Math.round(ddAmount * 100) / 100,
      drawdownPct: Math.round(ddPct * 10) / 10,
    });
  });

  const sharpeRatio = useMemo(() => {
    if (replayTrades.length < 3) return '0.00';
    const returns = replayTrades.map(t => t.profit / accountCapital);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return '0.00';
    return ((mean / stdDev) * Math.sqrt(252)).toFixed(2);
  }, [replayTrades, accountCapital]);

  const exportTradesCSV = () => {
    if (replayTrades.length === 0) {
      alert('当前暂无可导出的复盘交易记录');
      return;
    }
    const headers = "序号,开仓时间,平仓时间,品种,方向,手数,开仓价,平仓价,止损价,止盈价,盈亏比,净盈亏,盈亏比例,平仓原因\n";
    const rows = replayTrades.map(t => 
      `${t.id},${t.entryTime},${t.exitTime},${t.symbol},${t.direction},${t.size},${t.entryPrice},${t.exitPrice},${t.stopLoss || ''},${t.takeProfit || ''},${t.rrRatio || ''},${t.profit},${t.pnlPercent}%,${t.exitReason}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tradezen_backtest_${symbol}_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResetBacktestSession = () => {
    if (replayTrades.length === 0) return;
    if (window.confirm('确定要清空本轮所有已完成的回测交易记录并重置吗？')) {
      setReplayTrades([]);
      setPosition(null);
      setSaveSuccessMsg(null);
    }
  };

  const filteredTrades = useMemo(() => {
    if (tradeFilter === 'win') return replayTrades.filter(t => t.profit > 0);
    if (tradeFilter === 'loss') return replayTrades.filter(t => t.profit < 0);
    return replayTrades;
  }, [replayTrades, tradeFilter]);

  const displayCandle = hoveredCandle || currentCandle;
  const candleChange = displayCandle ? displayCandle.close - displayCandle.open : 0;
  const candleChangePct = displayCandle && displayCandle.open > 0 
    ? ((candleChange / displayCandle.open) * 100).toFixed(2) 
    : '0.00';
  const isUp = candleChange >= 0;

  // Render individual chart window for multi-timeframe linkage
  const renderWindow = (winIdx: number) => {
    const winVisible = getWindowVisibleSlice(winIdx);
    const winLastCandle = winVisible[winVisible.length - 1];
    const isBarUp = winLastCandle ? winLastCandle.close >= winLastCandle.open : true;
    const isPrimary = winIdx === 0;
    const isActive = activeWindowIndex === winIdx;

    let canvasHeight = 'h-96';
    if (windowCount === 1) {
      canvasHeight = isFullscreen ? 'h-[520px] sm:h-[600px]' : 'h-96';
    } else if (windowCount === 2) {
      canvasHeight = isFullscreen ? 'h-[440px] sm:h-[500px]' : 'h-80 sm:h-96';
    } else {
      canvasHeight = isFullscreen ? 'h-[300px] sm:h-[350px]' : 'h-72 sm:h-80';
    }

    return (
      <div
        key={winIdx}
        onClick={() => setActiveWindowIndex(winIdx)}
        className={`rounded-xl border transition-all overflow-hidden bg-white dark:bg-navy-900 shadow-sm flex flex-col ${
          isActive 
            ? 'border-purple-500 ring-2 ring-purple-500/25 shadow-md' 
            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
        }`}
      >
        {/* Window Sub-Header Bar (周期选择与当前窗口状态) */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-navy-800 border-b border-gray-200 dark:border-gray-700 text-xs">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
              isActive 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 dark:bg-navy-700 text-gray-700 dark:text-gray-300'
            }`}>
              {isPrimary ? '主控窗口' : `联动窗口 ${winIdx + 1}`}
            </span>

            {/* Timeframe Select */}
            <select
              aria-label={isPrimary ? '窗口1周期' : `窗口${winIdx + 1}周期`}
              value={windowTimeframes[winIdx] || timeframe}
              onChange={(e) => handleWindowTimeframeChange(winIdx, e.target.value)}
              className="text-xs px-2 py-0.5 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-700 dark:text-white font-semibold cursor-pointer"
            >
              <option value="M1">1 分钟 (M1)</option>
              <option value="M5">5 分钟 (M5)</option>
              <option value="M15">15 分钟 (M15)</option>
              <option value="M30">30 分钟 (M30)</option>
              <option value="H1">1 小时 (H1)</option>
              <option value="H4">4 小时 (H4)</option>
              <option value="D1">日线 (D1)</option>
            </select>

            {winLastCandle && (
              <span className="hidden sm:inline font-mono text-[11px] text-gray-500 dark:text-gray-400">
                最新: <b className={isBarUp ? 'text-emerald-500' : 'text-rose-500'}>{winLastCandle.close}</b>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-gray-400 font-mono">
              {winVisible.length} 根
            </span>
            {isActive ? (
              <span className="text-[10px] text-purple-600 dark:text-purple-400 font-semibold flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                <span>当前绘制窗口</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveWindowIndex(winIdx);
                }}
                className="text-[10px] text-gray-400 hover:text-purple-600 transition"
              >
                点击激活
              </button>
            )}
          </div>
        </div>

        {/* Canvas Pane */}
        <div className="relative flex-1 bg-white dark:bg-navy-900 overflow-hidden">
          <canvas
            ref={(el) => {
              canvasRefs.current[winIdx] = el;
              if (winIdx === 0) canvasRef.current = el;
            }}
            className={`w-full ${canvasHeight} block select-none ${getCanvasCursorClass()}`}
            onMouseDown={(e) => handleWindowMouseDown(e, winIdx)}
            onMouseMove={(e) => handleWindowMouseMove(e, winIdx)}
            onMouseUp={() => handleWindowMouseUp(winIdx)}
            onMouseLeave={() => handleWindowMouseLeave(winIdx)}
          />

          {/* Active drawing tool guidance in active window */}
          {isActive && activeTool !== 'pointer' && (
            <div className="absolute top-2 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-white/95 pointer-events-none flex items-center space-x-2 shadow-sm border border-white/10">
              {activeTool === 'jump' ? (
                <span className="text-amber-300 font-semibold flex items-center space-x-1">
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  <span>✂️ 切片复盘已就绪：点击此窗口任意K线切入复盘起点 (多屏联动同步)</span>
                </span>
              ) : activeTool === 'long' ? (
                <span className="text-green-300 font-semibold flex items-center space-x-1">
                  <Crosshair className="w-3.5 h-3.5 text-green-400" />
                  <span>📍 做多标尺已就绪：点击放置，多周期视窗同步显示</span>
                </span>
              ) : activeTool === 'short' ? (
                <span className="text-red-300 font-semibold flex items-center space-x-1">
                  <Crosshair className="w-3.5 h-3.5 text-red-400" />
                  <span>📍 做空标尺已就绪：点击放置，多周期视窗同步显示</span>
                </span>
              ) : activeTool === 'horizontal' ? (
                <span className="text-amber-300 font-semibold flex items-center space-x-1">
                  <Minus className="w-3.5 h-3.5 text-amber-400" />
                  <span>📍 水平线工具已就绪：在当前周期画线，所有关联周期同步呈现关键价位</span>
                </span>
              ) : activeTool === 'trendline' ? (
                <span className="text-sky-300 font-semibold flex items-center space-x-1">
                  <MoveDiagonal className="w-3.5 h-3.5 text-sky-400" />
                  <span>✏️ 趋势线工具已就绪：按住鼠标左键并拖动到终点</span>
                </span>
              ) : activeTool === 'rectangle' ? (
                <span className="text-purple-300 font-semibold flex items-center space-x-1">
                  <Square className="w-3.5 h-3.5 text-purple-400" />
                  <span>🔲 矩形供求区已就绪：在当前周期标记震荡箱体，全周期同步呈现</span>
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`space-y-4 ${
        isFullscreen
          ? 'fixed inset-0 z-50 bg-white dark:bg-[#0b0f19] p-4 sm:p-6 overflow-y-auto'
          : ''
      }`}
    >
      {/* 顶部控制栏 */}
      <div className="bg-gray-50 dark:bg-navy-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* 品种与周期切换 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48 sm:w-52">
            <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">回测标的品种</label>
            <SymbolSearchSelect
              value={symbol}
              onChange={(s) => setSymbol(s)}
              symbols={allSymbols.length > 0 ? allSymbols : (popularSymbols.length > 0 ? popularSymbols : ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'])}
              popularSymbols={popularSymbols}
              placeholder="搜索复盘品种..."
            />
          </div>

          <div>
            <label htmlFor="manual-replay-timeframe" className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">K线周期</label>
            <select
              id="manual-replay-timeframe"
              aria-label="K线周期"
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

          {/* 重新加载 */}
          <div className="self-end pb-0.5">
            <button
              onClick={loadCandleData}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 rounded-lg transition font-medium"
            >
              {loading ? '加载中...' : '重新加载'}
            </button>
          </div>
        </div>

        {/* 核心 TradingView 重播控制器 (Replay Player) */}
        <div className="flex items-center space-x-1.5 bg-white dark:bg-navy-700 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 shadow-2xs">
          {/* 切片起点 (Scissors) */}
          <button
            onClick={() => setActiveTool(activeTool === 'jump' ? 'pointer' : 'jump')}
            title="选择切片复盘起点 (点击图表任意K线切入)"
            className={`p-1.5 rounded-md font-medium text-xs flex items-center space-x-1 transition ${
              activeTool === 'jump' 
                ? 'bg-amber-500 text-white shadow-sm ring-1 ring-amber-300' 
                : 'hover:bg-gray-100 dark:hover:bg-navy-600 text-gray-600 dark:text-gray-300'
            }`}
          >
            <Scissors className="w-4 h-4" />
          </button>

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

          {/* 全屏操作切换按钮 */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-navy-600 rounded-md text-gray-600 dark:text-gray-300 transition"
            title={isFullscreen ? '退出全屏 (Esc)' : '全屏操作 (F11)'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-purple-600" /> : <Maximize2 className="w-4 h-4 text-purple-600" />}
          </button>
        </div>

        {/* 多周期联动分屏布局选择器 (1图 / 2联屏 / 3联屏 / 4宫格) */}
        <div className="flex items-center space-x-1 bg-white dark:bg-navy-700 p-1 rounded-lg border border-gray-200 dark:border-gray-600 shadow-2xs text-xs">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 px-1 hidden md:inline">
            多周期联动:
          </span>
          {[1, 2, 3, 4].map(num => (
            <button
              key={num}
              type="button"
              onClick={() => {
                setWindowCount(num);
                if (activeWindowIndex >= num) setActiveWindowIndex(0);
              }}
              className={`px-2 py-1 rounded text-xs font-semibold transition ${
                windowCount === num 
                  ? 'bg-purple-600 text-white shadow-xs' 
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-navy-600'
              }`}
              title={num === 1 ? '单图模式 (专注单周期复盘)' : `${num} 周期窗口分屏联动回测 (时间/十字线/画线同步)`}
            >
              {num === 1 ? '1 图' : num === 4 ? '4 宫格' : `${num} 联屏`}
            </button>
          ))}
        </div>

        {/* 进度与当前时间 */}
        <div className="text-right text-xs">
          <span className="font-semibold text-purple-600 dark:text-purple-400">
            进度: {currentIndex + 1} / {allCandles.length} 根
          </span>
          <p className="text-[11px] text-gray-400 mt-0.5">
            当前时间: {currentCandle?.time || '-'}
          </p>
        </div>
      </div>

      {/* TradingView 风格实时 OHLC 报价状态条 */}
      <div className="bg-gray-900 text-white px-3 py-1.5 rounded-lg flex flex-wrap items-center justify-between text-xs font-mono shadow-xs border border-gray-800">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-purple-400 flex items-center space-x-1">
            <span>{symbol}</span>
            <span className="text-[10px] bg-purple-900/60 text-purple-300 px-1.5 py-0.5 rounded border border-purple-700/60">{timeframe}</span>
          </span>
          {displayCandle && (
            <>
              <span className="text-gray-400">时间: <b className="text-gray-200">{displayCandle.time}</b></span>
              <span>开: <b className="text-gray-200">{displayCandle.open}</b></span>
              <span>高: <b className="text-emerald-400">{displayCandle.high}</b></span>
              <span>低: <b className="text-rose-400">{displayCandle.low}</b></span>
              <span>收: <b className={isUp ? 'text-emerald-400' : 'text-rose-400'}>{displayCandle.close}</b></span>
              <span className={`font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? '+' : ''}{candleChangePct}%
              </span>
              <span className="text-gray-400 hidden sm:inline">量: {displayCandle.volume}</span>
            </>
          )}
        </div>
        <div className="text-[11px] text-gray-400 flex items-center space-x-2">
          {hoveredCandle ? (
            <span className="text-amber-300 font-sans">● 悬停预览K线</span>
          ) : (
            <span className="text-emerald-400 font-sans">● 当前最新复盘K线</span>
          )}
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

          {/* 切片起点 */}
          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'jump' ? 'pointer' : 'jump')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTool === 'jump'
                ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
            }`}
            title="切片起点：点击图表任意K线，跳转到该K线作为回测起点"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>切片起点</span>
          </button>

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

          {/* 6. 矩形区域 (Supply/Demand Zones) */}
          <button
            type="button"
            onClick={() => setActiveTool(activeTool === 'rectangle' ? 'pointer' : 'rectangle')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
              activeTool === 'rectangle'
                ? 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-300'
                : 'bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
            }`}
            title="按住鼠标左键并拖动绘制供求区间矩形框，直观标记震荡/突破区间"
          >
            <Square className="w-3.5 h-3.5" />
            <span>矩形区域</span>
          </button>

          {/* 7. 技术指标下拉菜单 */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                (showMa20 || showMa50 || showMa200 || showEma9 || showBollinger || showVolume || showRsi)
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-navy-700 dark:text-gray-200'
              }`}
              title="技术指标配置：MA移动均线、EMA、布林带、成交量柱、RSI等"
            >
              <Activity className="w-3.5 h-3.5 text-purple-600" />
              <span>指标</span>
              <span className="text-[10px] px-1 py-0.2 rounded-full bg-purple-600 text-white">
                {[showMa20, showMa50, showMa200, showEma9, showBollinger, showVolume, showRsi].filter(Boolean).length}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {showIndicatorMenu && (
              <div className="absolute left-0 mt-1 w-56 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-2.5 z-50 text-xs space-y-1.5">
                <div className="font-semibold text-gray-400 text-[10px] uppercase px-1 pb-1 border-b border-gray-100 dark:border-gray-700">
                  技术指标叠加 (TradingView Lite)
                </div>
                <label className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-navy-700 cursor-pointer">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span>MA(20) 均线</span>
                  </span>
                  <input type="checkbox" checked={showMa20} onChange={(e) => setShowMa20(e.target.checked)} className="rounded text-purple-600" />
                </label>
                <label className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-navy-700 cursor-pointer">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    <span>MA(50) 均线</span>
                  </span>
                  <input type="checkbox" checked={showMa50} onChange={(e) => setShowMa50(e.target.checked)} className="rounded text-purple-600" />
                </label>
                <label className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-navy-700 cursor-pointer">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span>MA(200) 牛熊线</span>
                  </span>
                  <input type="checkbox" checked={showMa200} onChange={(e) => setShowMa200(e.target.checked)} className="rounded text-purple-600" />
                </label>
                <label className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-navy-700 cursor-pointer">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                    <span>EMA(9) 快速均线</span>
                  </span>
                  <input type="checkbox" checked={showEma9} onChange={(e) => setShowEma9(e.target.checked)} className="rounded text-purple-600" />
                </label>
                <label className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-navy-700 cursor-pointer">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                    <span>布林带 Bollinger Bands</span>
                  </span>
                  <input type="checkbox" checked={showBollinger} onChange={(e) => setShowBollinger(e.target.checked)} className="rounded text-purple-600" />
                </label>
                <label className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-navy-700 cursor-pointer">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>成交量柱 (Volume)</span>
                  </span>
                  <input type="checkbox" checked={showVolume} onChange={(e) => setShowVolume(e.target.checked)} className="rounded text-purple-600" />
                </label>
                <label className="flex items-center justify-between px-1.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-navy-700 cursor-pointer">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
                    <span>RSI(14) 强弱指标</span>
                  </span>
                  <input type="checkbox" checked={showRsi} onChange={(e) => setShowRsi(e.target.checked)} className="rounded text-purple-600" />
                </label>
              </div>
            )}
          </div>
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

          {(horizontalLines.length > 0 || trendLines.length > 0 || rectangles.length > 0) && (
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              已画: {horizontalLines.length > 0 ? `${horizontalLines.length}条水平线 ` : ''}{trendLines.length > 0 ? `${trendLines.length}条趋势线 ` : ''}{rectangles.length > 0 ? `${rectangles.length}个矩形` : ''}
            </span>
          )}

          {(horizontalLines.length > 0 || trendLines.length > 0 || rectangles.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setHorizontalLines([]);
                setTrendLines([]);
                setRectangles([]);
              }}
              className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-md text-[11px] font-medium flex items-center space-x-1 transition"
              title="清除所有已画的水平支撑阻力线、趋势线和矩形区域"
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

      {/* 周期窗口网格容器 (支持 1图 / 2联屏 / 3联屏 / 4宫格 联动) */}
      <div className={`grid gap-3 ${
        windowCount === 1 
          ? 'grid-cols-1' 
          : windowCount === 2 
          ? 'grid-cols-1 lg:grid-cols-2' 
          : windowCount === 3 
          ? 'grid-cols-1 md:grid-cols-3' 
          : 'grid-cols-1 md:grid-cols-2'
      }`}>
        {Array.from({ length: windowCount }, (_, i) => renderWindow(i))}
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
              <button
                type="button"
                onClick={() => {
                  if (horizontalLines.length > 0) {
                    const closest = [...horizontalLines].sort((a, b) => Math.abs(a.price - entryPrice) - Math.abs(b.price - entryPrice))[0];
                    setSlPrice(formatPriceNumber(closest.price, entryPrice));
                  } else if (rectangles.length > 0) {
                    const lastRect = rectangles[rectangles.length - 1];
                    const chosenPrice = orderDirection === 'long' ? lastRect.price2 : lastRect.price1;
                    setSlPrice(formatPriceNumber(chosenPrice, entryPrice));
                  }
                }}
                disabled={horizontalLines.length === 0 && rectangles.length === 0}
                className="px-1.5 py-0.5 bg-purple-100 hover:bg-purple-200 disabled:opacity-40 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] rounded font-semibold"
                title="将最近绘制的水平支撑阻力线或矩形边界同步为SL止损价"
              >
                画线价格
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
              <button
                type="button"
                onClick={() => {
                  if (horizontalLines.length > 0) {
                    const closest = [...horizontalLines].sort((a, b) => Math.abs(a.price - entryPrice) - Math.abs(b.price - entryPrice))[0];
                    setTpPrice(formatPriceNumber(closest.price, entryPrice));
                  } else if (rectangles.length > 0) {
                    const lastRect = rectangles[rectangles.length - 1];
                    const chosenPrice = orderDirection === 'long' ? lastRect.price1 : lastRect.price2;
                    setTpPrice(formatPriceNumber(chosenPrice, entryPrice));
                  }
                }}
                disabled={horizontalLines.length === 0 && rectangles.length === 0}
                className="px-1.5 py-0.5 bg-purple-100 hover:bg-purple-200 disabled:opacity-40 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 text-[10px] rounded font-semibold"
                title="将最近绘制的水平支撑阻力线或矩形边界同步为TP止盈价"
              >
                画线价格
              </button>
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

      {/* TradingView 风格回测结果统计与策略报告 (Strategy Tester & Results Analytics) */}
      <div className="bg-white dark:bg-navy-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        {/* 策略报告顶部 Header 与 Sub-Tabs */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/70 dark:bg-navy-900/40">
          <div>
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 rounded-lg">
                <BarChart2 className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-base">
                回测结果统计与策略报告 (Strategy Tester)
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-mono">
                {replayTrades.length} 笔交易
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              基于逐根K线推演、持仓规则与真实点差的量化绩效全景统计报告
            </p>
          </div>

          {/* 报告顶部操作工具 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportTradesCSV}
              disabled={replayTrades.length === 0}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition ${
                replayTrades.length === 0 
                  ? 'bg-gray-100 dark:bg-navy-700 text-gray-400 cursor-not-allowed' 
                  : 'bg-white dark:bg-navy-700 hover:bg-gray-50 dark:hover:bg-navy-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 shadow-2xs'
              }`}
              title="导出当前回测的全部交易记录为 CSV 文件"
            >
              <Download className="w-3.5 h-3.5" />
              <span>导出成交 (CSV)</span>
            </button>

            <button
              type="button"
              onClick={saveTradesToJournal}
              disabled={saveLoading || replayTrades.length === 0}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 text-white shadow-2xs transition ${
                replayTrades.length === 0 
                  ? 'bg-gray-300 dark:bg-navy-700 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
              title="将本次K线回测的所有交易记录归档保存至 TradeZen 交易日记"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveLoading ? '保存中...' : '保存至交易日记'}</span>
            </button>

            {replayTrades.length > 0 && (
              <button
                type="button"
                onClick={handleResetBacktestSession}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition flex items-center space-x-1"
                title="清空本次回测成交流水"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>清空数据</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-tab 选项卡导航 */}
        <div className="px-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-navy-800">
          <nav className="-mb-px flex space-x-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatsTab('summary')}
              className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
                statsTab === 'summary'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>核心绩效指标 (Summary)</span>
            </button>
            <button
              type="button"
              onClick={() => setStatsTab('curve')}
              className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
                statsTab === 'curve'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>资金权益曲线 (Equity Curve)</span>
            </button>
            <button
              type="button"
              onClick={() => setStatsTab('trades')}
              className={`py-3 border-b-2 flex items-center space-x-1.5 transition-colors ${
                statsTab === 'trades'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>成交流水明细 ({replayTrades.length})</span>
            </button>
          </nav>
        </div>

        {/* Tab 1: 核心绩效指标看板 */}
        {statsTab === 'summary' && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 1. 最终净值 */}
              <div className="bg-gray-50/70 dark:bg-navy-900/60 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/80">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">当前/最终净值</p>
                <p className={`text-base sm:text-lg font-bold font-mono mt-1 ${currentEquity >= accountCapital ? 'text-green-600' : 'text-red-600'}`}>
                  ${currentEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <span className="text-[10px] text-gray-400">
                  初始本金: ${accountCapital.toLocaleString()}
                </span>
              </div>

              {/* 2. 累计净利润 */}
              <div className="bg-gray-50/70 dark:bg-navy-900/60 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/80">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">累计净利润 (Net Profit)</p>
                <p className={`text-base sm:text-lg font-bold font-mono mt-1 ${totalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalNetProfit >= 0 ? `+$${totalNetProfit.toFixed(2)}` : `-$${Math.abs(totalNetProfit).toFixed(2)}`}
                </p>
                <span className={`text-[10px] font-bold ${totalNetProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalNetProfit >= 0 ? '+' : ''}{netProfitPercent}% 收益率
                </span>
              </div>

              {/* 3. 胜率 */}
              <div className="bg-gray-50/70 dark:bg-navy-900/60 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/80">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">胜率 (Win Rate)</p>
                <p className="text-base sm:text-lg font-bold font-mono mt-1 text-gray-900 dark:text-white">
                  {winRate}%
                </p>
                <span className="text-[10px] text-gray-400">
                  赢 {winningTrades.length} / 输 {losingTrades.length} / 平 {breakEvenTrades.length}
                </span>
              </div>

              {/* 4. 利润因子 */}
              <div className="bg-gray-50/70 dark:bg-navy-900/60 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/80">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">利润因子 (Profit Factor)</p>
                <p className="text-base sm:text-lg font-bold font-mono mt-1 text-purple-600 dark:text-purple-400">
                  {profitFactor}
                </p>
                <span className="text-[10px] text-gray-400">
                  毛利 ${totalGrossProfit.toFixed(1)} / 毛损 ${totalGrossLoss.toFixed(1)}
                </span>
              </div>

              {/* 5. 最大回撤 */}
              <div className="bg-gray-50/70 dark:bg-navy-900/60 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/80">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">最大资金回撤 (Drawdown)</p>
                <p className="text-base sm:text-lg font-bold font-mono mt-1 text-red-600">
                  -${maxDrawdownAmount.toFixed(2)}
                </p>
                <span className="text-[10px] text-gray-400">
                  峰值回撤: -{maxDrawdownPercent.toFixed(1)}%
                </span>
              </div>

              {/* 6. 平均单笔盈亏 */}
              <div className="bg-gray-50/70 dark:bg-navy-900/60 p-3.5 rounded-xl border border-gray-100 dark:border-gray-700/80">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">平均单笔盈亏 (Avg Trade)</p>
                <p className={`text-base sm:text-lg font-bold font-mono mt-1 ${parseFloat(avgTradeProfit) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {parseFloat(avgTradeProfit) >= 0 ? `+$${avgTradeProfit}` : `-$${Math.abs(parseFloat(avgTradeProfit))}`}
                </p>
                <span className="text-[10px] text-gray-400">
                  总计 {totalTradesCount} 笔已平仓
                </span>
              </div>
            </div>

            {/* 第二排更深入的指标 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 7. 平均盈亏比 */}
              <div className="bg-gray-50/50 dark:bg-navy-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">平均盈亏比 (Avg R:R)</p>
                <p className="text-sm font-bold font-mono mt-1 text-indigo-600 dark:text-indigo-400">
                  1:{avgRR}
                </p>
                <span className="text-[10px] text-gray-400">设定风险回报比例</span>
              </div>

              {/* 8. 平均盈利单 vs 亏损单 */}
              <div className="bg-gray-50/50 dark:bg-navy-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">均胜 / 均亏 (Win/Loss)</p>
                <p className="text-sm font-bold font-mono mt-1 text-gray-900 dark:text-white">
                  +${avgWin} / -${avgLoss}
                </p>
                <span className="text-[10px] text-gray-400">比率: {ratioAvgWinLoss}x</span>
              </div>

              {/* 9. 最大单笔盈利 */}
              <div className="bg-gray-50/50 dark:bg-navy-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">最大单笔盈利 (Max Win)</p>
                <p className="text-sm font-bold font-mono mt-1 text-green-600">
                  +${maxWin}
                </p>
                <span className="text-[10px] text-gray-400">最佳单笔执行</span>
              </div>

              {/* 10. 最大单笔亏损 */}
              <div className="bg-gray-50/50 dark:bg-navy-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">最大单笔亏损 (Max Loss)</p>
                <p className="text-sm font-bold font-mono mt-1 text-red-600">
                  -${maxLoss}
                </p>
                <span className="text-[10px] text-gray-400">严格风控保护</span>
              </div>

              {/* 11. 连续连胜与连亏 */}
              <div className="bg-gray-50/50 dark:bg-navy-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">最长连胜 / 连亏</p>
                <p className="text-sm font-bold font-mono mt-1 text-gray-900 dark:text-white">
                  {maxConsecutiveWins} 胜 / {maxConsecutiveLosses} 亏
                </p>
                <span className="text-[10px] text-gray-400">连续交易稳定性</span>
              </div>

              {/* 12. 夏普比率 */}
              <div className="bg-gray-50/50 dark:bg-navy-900/40 p-3 rounded-xl border border-gray-100 dark:border-gray-700/60">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">夏普比率 (Sharpe Ratio)</p>
                <p className="text-sm font-bold font-mono mt-1 text-purple-600 dark:text-purple-400">
                  {sharpeRatio}
                </p>
                <span className="text-[10px] text-gray-400">风险调整后年化收益</span>
              </div>
            </div>

            {/* 迷你内嵌资金曲线 */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300">资金曲线趋势速览</h4>
                <button
                  type="button"
                  onClick={() => setStatsTab('curve')}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-0.5"
                >
                  <span>查看全屏交互资金曲线</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              <ReplayEquityCurve data={equityCurveData} initialCapital={accountCapital} />
            </div>
          </div>
        )}

        {/* Tab 2: 完整资金权益曲线与回撤轨迹 */}
        {statsTab === 'curve' && (
          <div className="p-5 space-y-4">
            <ReplayEquityCurve data={equityCurveData} initialCapital={accountCapital} />
          </div>
        )}

        {/* Tab 3: 回测成交流水明细 */}
        {statsTab === 'trades' && (
          <div className="p-5 space-y-4">
            {/* 筛选控制器 */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-1.5 bg-gray-100 dark:bg-navy-900 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setTradeFilter('all')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    tradeFilter === 'all' ? 'bg-purple-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  全部交易 ({totalTradesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTradeFilter('win')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    tradeFilter === 'win' ? 'bg-green-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  盈利单 ({winningTrades.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTradeFilter('loss')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    tradeFilter === 'loss' ? 'bg-red-600 text-white shadow-xs' : 'text-gray-600 dark:text-gray-300'
                  }`}
                >
                  亏损单 ({losingTrades.length})
                </button>
              </div>

              <span className="text-[11px] text-gray-400">
                💡 点击任意单据可打开 TraderSync 逐帧图表动态复盘
              </span>
            </div>

            {filteredTrades.length === 0 ? (
              <div className="text-center py-12 bg-gray-50/50 dark:bg-navy-900/40 rounded-xl border border-gray-200 dark:border-gray-700">
                <Layers className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">当前筛选暂无交易记录</p>
                <p className="text-[11px] text-gray-400 mt-0.5">在上方图表放置多空标尺并前进K线模拟交易</p>
              </div>
            ) : (
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-navy-900">
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                    <thead className="bg-gray-50 dark:bg-navy-800 text-gray-500 dark:text-gray-400 font-semibold sticky top-0 z-10 shadow-2xs">
                      <tr>
                        <th className="px-3.5 py-2.5 text-left">#</th>
                        <th className="px-3.5 py-2.5 text-left">方向</th>
                        <th className="px-3.5 py-2.5 text-left">品种</th>
                        <th className="px-3.5 py-2.5 text-left">开仓时间</th>
                        <th className="px-3.5 py-2.5 text-left">平仓时间</th>
                        <th className="px-3.5 py-2.5 text-right">手数</th>
                        <th className="px-3.5 py-2.5 text-right">开仓价</th>
                        <th className="px-3.5 py-2.5 text-right">平仓价</th>
                        <th className="px-3.5 py-2.5 text-right">止损 (SL)</th>
                        <th className="px-3.5 py-2.5 text-right">止盈 (TP)</th>
                        <th className="px-3.5 py-2.5 text-center">盈亏比</th>
                        <th className="px-3.5 py-2.5 text-left">离场原因</th>
                        <th className="px-3.5 py-2.5 text-right">单笔净盈亏</th>
                        <th className="px-3.5 py-2.5 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-navy-900 font-mono">
                      {filteredTrades.map((t) => (
                        <tr 
                          key={t.id}
                          onClick={() => setReviewTrade(t)}
                          className="hover:bg-purple-50/60 dark:hover:bg-purple-950/20 cursor-pointer transition-colors"
                        >
                          <td className="px-3.5 py-2 text-gray-400 font-sans">{t.id}</td>
                          <td className="px-3.5 py-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.direction === 'long' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                            }`}>
                              {t.direction === 'long' ? 'BUY 多' : 'SELL 空'}
                            </span>
                          </td>
                          <td className="px-3.5 py-2 font-bold font-sans text-gray-900 dark:text-white">{t.symbol}</td>
                          <td className="px-3.5 py-2 text-gray-600 dark:text-gray-300 text-[11px]">{t.entryTime}</td>
                          <td className="px-3.5 py-2 text-gray-500 dark:text-gray-400 text-[11px]">{t.exitTime}</td>
                          <td className="px-3.5 py-2 text-right text-gray-700 dark:text-gray-300">{t.size}</td>
                          <td className="px-3.5 py-2 text-right text-gray-700 dark:text-gray-300">{t.entryPrice}</td>
                          <td className="px-3.5 py-2 text-right text-gray-700 dark:text-gray-300">{t.exitPrice}</td>
                          <td className="px-3.5 py-2 text-right text-rose-500">{t.stopLoss || '-'}</td>
                          <td className="px-3.5 py-2 text-right text-emerald-500">{t.takeProfit || '-'}</td>
                          <td className="px-3.5 py-2 text-center text-indigo-600 dark:text-indigo-400 font-sans">
                            {t.rrRatio ? `1:${t.rrRatio.toFixed(1)}` : '-'}
                          </td>
                          <td className="px-3.5 py-2 font-sans">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              t.exitReason === 'Take Profit' 
                                ? 'bg-green-50 text-green-700 dark:bg-green-950/60 dark:text-green-300' 
                                : t.exitReason === 'Stop Loss'
                                ? 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-navy-700 dark:text-gray-300'
                            }`}>
                              {t.exitReason === 'Take Profit' ? '止盈触发' : (t.exitReason === 'Stop Loss' ? '止损触发' : '手动平仓')}
                            </span>
                          </td>
                          <td className={`px-3.5 py-2 text-right font-bold ${t.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {t.profit >= 0 ? `+$${t.profit.toFixed(2)}` : `-$${Math.abs(t.profit).toFixed(2)}`}
                            <span className="text-[10px] ml-1 font-normal opacity-75">
                              ({t.profit >= 0 ? '+' : ''}{t.pnlPercent}%)
                            </span>
                          </td>
                          <td className="px-3.5 py-2 text-center font-sans" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setReviewTrade(t)}
                              className="px-2 py-0.5 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 rounded text-[11px] font-semibold transition"
                            >
                              复盘
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* TraderSync 风格单笔交易逐根复盘模态窗 */}
      {reviewTrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#0b0f19] rounded-2xl w-full max-w-4xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 rounded-lg">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                    TraderSync 风格单笔交易逐根动态复盘 #{reviewTrade.id} ({reviewTrade.symbol})
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    还原开仓前上下文，动态测算持仓期 MAE/MFE 极值与离场落袋效率
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewTrade(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <TradeExecutionChart
                symbol={reviewTrade.symbol}
                direction={reviewTrade.direction}
                entryPrice={reviewTrade.entryPrice}
                exitPrice={reviewTrade.exitPrice}
                stopLoss={reviewTrade.stopLoss || undefined}
                takeProfit={reviewTrade.takeProfit || undefined}
                entryTime={reviewTrade.entryTime}
                exitTime={reviewTrade.exitTime}
                size={reviewTrade.size}
                profit={reviewTrade.profit}
                exitReason={reviewTrade.exitReason}
                height={400}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
