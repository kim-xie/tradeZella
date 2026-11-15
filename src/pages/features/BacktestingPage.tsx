import React, { useState, useEffect } from 'react';
import FeaturePageLayout from './FeaturePageLayout';
import { 
  Play, Save, Download, BarChart2, 
  Calendar, TrendingUp, Target, DollarSign, Clock, Trash2,
  RefreshCw, Laptop, CheckCircle2, AlertCircle, ArrowUpRight, ArrowDownRight, Layers, Eye,
  X, Sparkles
} from 'lucide-react';
import ManualBarReplay from '../../components/ManualBarReplay';
import TradeExecutionChart from '../../components/TradeExecutionChart';
import SymbolSearchSelect from '../../components/common/SymbolSearchSelect';
import { 
  getBacktestingResults, 
  runBacktestApi, 
  deleteBacktest, 
  getMT5Status, 
  BacktestRecord, 
  BacktestTradeItem, 
  MT5StatusData 
} from '../../services/api';

const StrategyExample = ({ title, description, onClick }: { title: string; description: string; onClick: () => void }) => (
  <div 
    onClick={onClick}
    className="bg-gray-50 dark:bg-navy-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3.5 cursor-pointer hover:border-purple-500 dark:hover:border-purple-400 hover:bg-purple-50/40 dark:hover:bg-purple-900/20 transition-all"
  >
    <h4 className="font-medium text-gray-900 dark:text-white text-sm">{title}</h4>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</p>
  </div>
);

// Interactive SVG Equity Curve Component
const EquityCurveChart = ({ data, initialCapital }: { data: Array<{ time: string; capital: number; drawdown: number }>; initialCapital: number }) => {
  if (!data || data.length < 2) {
    return (
      <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-500 dark:text-gray-400">暂无资金曲线数据</p>
      </div>
    );
  }

  const capitals = data.map(d => d.capital);
  const minVal = Math.min(...capitals, initialCapital * 0.95);
  const maxVal = Math.max(...capitals, initialCapital * 1.05);
  const range = maxVal - minVal || 1;

  const width = 800;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 30, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * chartW;
    const y = padding.top + chartH - ((d.capital - minVal) / range) * chartH;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const areaD = `${pathD} L ${padding.left + chartW},${padding.top + chartH} L ${padding.left},${padding.top + chartH} Z`;

  const finalCapital = data[data.length - 1].capital;
  const isProfitable = finalCapital >= initialCapital;
  const strokeColor = isProfitable ? '#10B981' : '#EF4444';
  const fillColor = isProfitable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';

  return (
    <div className="w-full bg-white dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex justify-between items-center mb-2 px-2">
        <div className="flex items-center space-x-3 text-xs">
          <span className="font-medium text-gray-700 dark:text-gray-300">起始: ${initialCapital.toLocaleString()}</span>
          <span className={`font-semibold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
            最终: ${finalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <span className="text-xs text-gray-400">时间跨度: {data[0].time.split(' ')[0]} ~ {data[data.length - 1].time.split(' ')[0]}</span>
      </div>

      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 overflow-visible">
          <defs>
            <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = padding.top + chartH * pct;
            const val = maxVal - pct * range;
            return (
              <g key={idx}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="currentColor" className="text-gray-100 dark:text-gray-700" strokeDasharray="3 3" />
                <text x={padding.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-gray-400">
                  ${Math.round(val).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Area under curve */}
          <path d={areaD} fill="url(#equityGrad)" />

          {/* Curve line */}
          <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Start and end points */}
          {points.length > 0 && (
            <>
              <circle cx={points[0].split(',')[0]} cy={points[0].split(',')[1]} r="4" fill="#6B7280" />
              <circle cx={points[points.length - 1].split(',')[0]} cy={points[points.length - 1].split(',')[1]} r="5" fill={strokeColor} />
            </>
          )}
        </svg>
      </div>
    </div>
  );
};

export default function BacktestingPage() {
  const [backtests, setBacktests] = useState<BacktestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'builder' | 'replay' | 'results'>('builder');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);

  // Form State
  const [strategyType, setStrategyType] = useState<string>('ma_crossover');
  const [symbol, setSymbol] = useState<string>('EURUSD');
  const [timeframe, setTimeframe] = useState<string>('H1');
  const [startDate, setStartDate] = useState<string>(
    new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [initialCapital, setInitialCapital] = useState<string>('10000');
  const [stopLossPct, setStopLossPct] = useState<string>('1.5');
  const [takeProfitPct, setTakeProfitPct] = useState<string>('3.0');
  const [lotSize, setLotSize] = useState<string>('1.0');

  // Specific Strategy Params
  const [fastMa, setFastMa] = useState<number>(9);
  const [slowMa, setSlowMa] = useState<number>(21);
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [rsiOversold, setRsiOversold] = useState<number>(30);
  const [rsiOverbought, setRsiOverbought] = useState<number>(70);
  const [bbPeriod, setBbPeriod] = useState<number>(20);
  const [bbStd, setBbStd] = useState<number>(2.0);
  const [macdFast, setMacdFast] = useState<number>(12);
  const [macdSlow, setMacdSlow] = useState<number>(26);
  const [macdSignal, setMacdSignal] = useState<number>(9);
  const [lookback, setLookback] = useState<number>(20);

  const [selectedBacktest, setSelectedBacktest] = useState<BacktestRecord | null>(null);
  const [trades, setTrades] = useState<BacktestTradeItem[]>([]);
  const [replayTrade, setReplayTrade] = useState<BacktestTradeItem | null>(null);
  const [mt5Status, setMt5Status] = useState<MT5StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

  useEffect(() => {
    fetchBacktests();
    fetchMT5Info();
  }, []);

  const fetchMT5Info = async () => {
    try {
      setLoadingStatus(true);
      const status = await getMT5Status();
      setMt5Status(status);
      if (status.popularSymbols && status.popularSymbols.length > 0 && !status.popularSymbols.includes(symbol)) {
        setSymbol(status.popularSymbols[0]);
      }
    } catch {
      setMt5Status({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchBacktests = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('请先登录账号后查看量化回测记录。');
        return;
      }
      const data = await getBacktestingResults();
      setBacktests(data);
    } catch (err: any) {
      setError(err.message || '加载回测数据失败');
    } finally {
      setLoading(false);
    }
  };

  const runBacktest = async () => {
    if (!startDate || !endDate) {
      alert('请选择回测开始和结束日期');
      return;
    }

    try {
      setIsRunning(true);
      setProgress(15);

      const progressTimer = setInterval(() => {
        setProgress(prev => (prev < 90 ? prev + 15 : prev));
      }, 300);

      const params: Record<string, any> = {
        stopLossPct: parseFloat(stopLossPct) || 1.5,
        takeProfitPct: parseFloat(takeProfitPct) || 3.0,
        size: parseFloat(lotSize) || 1.0,
      };

      if (strategyType === 'ma_crossover') {
        params.fastPeriod = fastMa;
        params.slowPeriod = slowMa;
      } else if (strategyType === 'rsi') {
        params.rsiPeriod = rsiPeriod;
        params.rsiOversold = rsiOversold;
        params.rsiOverbought = rsiOverbought;
      } else if (strategyType === 'bollinger') {
        params.bbPeriod = bbPeriod;
        params.bbStd = bbStd;
      } else if (strategyType === 'macd') {
        params.macdFast = macdFast;
        params.macdSlow = macdSlow;
        params.macdSignal = macdSignal;
      } else if (strategyType === 'breakout') {
        params.lookback = lookback;
      }

      const result = await runBacktestApi({
        strategy: strategyType,
        symbol,
        timeframe,
        startDate,
        endDate,
        initialCapital: parseFloat(initialCapital) || 10000,
        parameters: params,
      });

      clearInterval(progressTimer);
      setProgress(100);

      setBacktests(prev => [result, ...prev]);
      setSelectedBacktest(result);
      setTrades(result.results?.trades || []);
      setActiveTab('results');
    } catch (err: any) {
      alert(`回测执行失败: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleDeleteBacktest = async (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除这条回测记录吗？')) return;
    try {
      await deleteBacktest(id);
      setBacktests(prev => prev.filter(b => b.id !== id));
      if (selectedBacktest && selectedBacktest.id === id) {
        setSelectedBacktest(null);
      }
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  const exportResults = () => {
    if (!selectedBacktest || !trades.length) {
      alert('暂无可导出的交易记录');
      return;
    }
    const headers = "id,date,symbol,direction,size,entryPrice,exitPrice,profit,commission,exitReason\n";
    const rows = trades.map(t => 
      `${t.id},${t.date},${t.symbol},${t.direction},${t.size},${t.entryPrice},${t.exitPrice},${t.profit},${t.commission},${t.exitReason || ''}`
    ).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `backtest_${selectedBacktest.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const viewDetails = (backtest: BacktestRecord) => {
    setSelectedBacktest(backtest);
    setTrades(backtest.results?.trades || []);
    setActiveTab('results');
  };

  return (
    <FeaturePageLayout
      title="Quantitative Backtesting"
      description="基于 MT5 真实历史行情与 Tick 级数据的自动化策略回测系统，提供资金曲线模拟、盈亏比与最大回撤深度分析。"
      image="/assets/5.png"
    >
      <div className="bg-white dark:bg-[#0b0f19] p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-200/80 dark:border-white/10">
        
        {/* MT5 状态横幅 */}
        <div className="mb-6 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-[#0f1422] dark:to-[#0f1422]/90 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${mt5Status?.connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {mt5Status?.connected ? 'MT5 终端行情直连引擎就绪' : '未连接本地 MT5 终端（使用仿真行情回测）'}
                </h3>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                  mt5Status?.connected ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50' : 'bg-amber-100 text-amber-800'
                }`}>
                  {mt5Status?.connected ? '● MT5 Direct Online' : 'Synthetic Data'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {mt5Status?.connected && mt5Status.account
                  ? `已连接经纪商 [${mt5Status.account.company}]，支持 ${mt5Status.symbolsTotal} 个品种历史 K 线拉取`
                  : '启动本地 MT5 客户端即可直接读取任意外汇、股指、大宗商品真实历史 K 线进行策略回测。'}
              </p>
            </div>
          </div>
          <button
            onClick={fetchMT5Info}
            disabled={loadingStatus}
            className="self-end md:self-auto px-3.5 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 bg-white dark:bg-[#070a13] hover:bg-purple-50 dark:hover:bg-white/5 border border-purple-200 dark:border-white/10 rounded-xl transition-all shadow-xs flex items-center space-x-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
            <span>检测 MT5 连接</span>
          </button>
        </div>

        {/* Tab 导航 */}
        <div className="border-b border-gray-200 dark:border-white/10 mb-6 flex justify-between items-center">
          <nav className="-mb-px flex space-x-6 sm:space-x-8">
            <button
              onClick={() => setActiveTab('builder')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'builder'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              自动策略回测 (Strategy Builder)
            </button>
            <button
              onClick={() => setActiveTab('replay')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'replay'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              手动K线复盘训练 (Manual Bar Replay)
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'results'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              回测历史与结果 ({backtests.length})
            </button>
          </nav>

          {activeTab === 'results' && selectedBacktest && (
            <button
              onClick={() => setSelectedBacktest(null)}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1"
            >
              <span>&larr; 返回所有回测列表</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-600"></div>
            <p className="mt-3 text-sm text-gray-500">正在同步回测数据...</p>
          </div>
        ) : activeTab === 'replay' ? (
          <ManualBarReplay 
            initialSymbol={symbol}
            popularSymbols={mt5Status?.popularSymbols || ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD']}
            allSymbols={mt5Status?.allSymbols || []}
          />
        ) : activeTab === 'builder' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 左侧配置面板 */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-gray-50 dark:bg-navy-800/60 p-5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-4">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-purple-600" />
                  <span>策略与品种参数设置</span>
                </h3>

                {/* 策略选择 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    量化策略模型 (Strategy Model)
                  </label>
                  <select
                    value={strategyType}
                    onChange={(e) => setStrategyType(e.target.value)}
                    className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-navy-700 dark:text-white focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="ma_crossover">双均线交叉趋势策略 (MA Crossover)</option>
                    <option value="rsi">RSI 超买超卖均值回归策略 (RSI Mean Reversion)</option>
                    <option value="bollinger">布林带通道突破/回归策略 (Bollinger Bands)</option>
                    <option value="macd">MACD 动量金叉死叉策略 (MACD Momentum)</option>
                    <option value="breakout">唐奇安通道突破策略 (Donchian Breakout)</option>
                  </select>
                </div>

                {/* 动态参数调节 */}
                {strategyType === 'ma_crossover' && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-white dark:bg-navy-700/60 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">快线周期 (Fast MA)</label>
                      <input
                        type="number"
                        value={fastMa}
                        onChange={(e) => setFastMa(parseInt(e.target.value) || 9)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">慢线周期 (Slow MA)</label>
                      <input
                        type="number"
                        value={slowMa}
                        onChange={(e) => setSlowMa(parseInt(e.target.value) || 21)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {strategyType === 'rsi' && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-white dark:bg-navy-700/60 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">RSI 周期</label>
                      <input
                        type="number"
                        value={rsiPeriod}
                        onChange={(e) => setRsiPeriod(parseInt(e.target.value) || 14)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">超卖阈值 (买入)</label>
                      <input
                        type="number"
                        value={rsiOversold}
                        onChange={(e) => setRsiOversold(parseInt(e.target.value) || 30)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">超买阈值 (卖出)</label>
                      <input
                        type="number"
                        value={rsiOverbought}
                        onChange={(e) => setRsiOverbought(parseInt(e.target.value) || 70)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {strategyType === 'bollinger' && (
                  <div className="grid grid-cols-2 gap-4 p-3 bg-white dark:bg-navy-700/60 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">均线周期 (SMA Period)</label>
                      <input
                        type="number"
                        value={bbPeriod}
                        onChange={(e) => setBbPeriod(parseInt(e.target.value) || 20)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">标准差倍数 (Std Dev)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={bbStd}
                        onChange={(e) => setBbStd(parseFloat(e.target.value) || 2.0)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {strategyType === 'macd' && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-white dark:bg-navy-700/60 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">快线 EMA (Fast)</label>
                      <input
                        type="number"
                        value={macdFast}
                        onChange={(e) => setMacdFast(parseInt(e.target.value) || 12)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">慢线 EMA (Slow)</label>
                      <input
                        type="number"
                        value={macdSlow}
                        onChange={(e) => setMacdSlow(parseInt(e.target.value) || 26)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">信号线 (Signal)</label>
                      <input
                        type="number"
                        value={macdSignal}
                        onChange={(e) => setMacdSignal(parseInt(e.target.value) || 9)}
                        className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {strategyType === 'breakout' && (
                  <div className="p-3 bg-white dark:bg-navy-700/60 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">唐奇安突破回溯周期 (Lookback Bars)</label>
                    <input
                      type="number"
                      value={lookback}
                      onChange={(e) => setLookback(parseInt(e.target.value) || 20)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-navy-800 dark:text-white"
                    />
                  </div>
                )}

                {/* 品种与周期 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        回测标的品种 (MT5 Symbol)
                      </label>
                      <span className="text-[11px] text-gray-400">支持外汇及中文代码检索</span>
                    </div>
                    <SymbolSearchSelect
                      value={symbol}
                      onChange={(newSym) => setSymbol(newSym)}
                      symbols={mt5Status?.allSymbols && mt5Status.allSymbols.length > 0 ? mt5Status.allSymbols : (mt5Status?.popularSymbols || ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'])}
                      popularSymbols={mt5Status?.popularSymbols || []}
                      placeholder="搜索或输入品种 (如 EURUSD, 纳斯达克100)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      K线时间周期 (Timeframe)
                    </label>
                    <select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value)}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-navy-700 dark:text-white focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="M1">1 分钟 (M1)</option>
                      <option value="M5">5 分钟 (M5)</option>
                      <option value="M15">15 分钟 (M15)</option>
                      <option value="M30">30 分钟 (M30)</option>
                      <option value="H1">1 小时 (H1 - 推荐)</option>
                      <option value="H4">4 小时 (H4)</option>
                      <option value="D1">日线 (D1)</option>
                    </select>
                  </div>
                </div>

                {/* 日期范围与初始资金 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">开始日期</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-navy-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">结束日期</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-navy-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">初始资金 ($)</label>
                    <input
                      type="number"
                      value={initialCapital}
                      onChange={(e) => setInitialCapital(e.target.value)}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-navy-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* 风控与仓位设置 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">止损百分比 (SL %)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={stopLossPct}
                      onChange={(e) => setStopLossPct(e.target.value)}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-navy-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">止盈百分比 (TP %)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={takeProfitPct}
                      onChange={(e) => setTakeProfitPct(e.target.value)}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-navy-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">每单手数 (Lots)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={lotSize}
                      onChange={(e) => setLotSize(e.target.value)}
                      className="block w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-navy-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* 运行按钮 */}
                <div className="pt-2">
                  <button
                    onClick={runBacktest}
                    disabled={isRunning}
                    className={`w-full py-3 px-6 rounded-lg font-medium text-sm text-white shadow-md flex items-center justify-center space-x-2 transition-all ${
                      isRunning 
                        ? 'bg-purple-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                    }`}
                  >
                    {isRunning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>正在通过 MT5 引擎运算回测 (Progress {progress}%)...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>开始量化回测 (Run MT5 Backtest)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 右侧策略模板与说明 */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">经典策略模板</h3>
              <div className="space-y-2.5">
                <StrategyExample
                  title="双均线突破趋势跟踪"
                  description="Fast MA 9 向上穿越 Slow MA 21 做多；反向下穿做空。适合欧元/美元、黄金等大趋势品种。"
                  onClick={() => {
                    setStrategyType('ma_crossover');
                    setFastMa(9);
                    setSlowMa(21);
                    setSymbol('EURUSD');
                  }}
                />
                <StrategyExample
                  title="RSI 超卖反弹策略"
                  description="14周期 RSI 低于 30 触发买入超跌反弹；高于 70 触发卖出。适合震荡行情。"
                  onClick={() => {
                    setStrategyType('rsi');
                    setRsiPeriod(14);
                    setRsiOversold(30);
                    setRsiOverbought(70);
                    setSymbol('XAUUSD');
                  }}
                />
                <StrategyExample
                  title="纳斯达克100 布林带策略"
                  description="20周期均线 ± 2 倍标准差。价格触及下轨反转做多，触及上轨平仓。"
                  onClick={() => {
                    setStrategyType('bollinger');
                    setBbPeriod(20);
                    setSymbol('纳斯达克100');
                  }}
                />
              </div>

              <div className="bg-purple-50 dark:bg-purple-950/40 p-4 rounded-xl border border-purple-200 dark:border-purple-800 text-xs space-y-1.5 text-purple-900 dark:text-purple-300">
                <p className="font-semibold flex items-center space-x-1.5">
                  <CheckCircle2 className="w-4 h-4 text-purple-600" />
                  <span>MT5 数据引擎优势</span>
                </p>
                <p className="text-purple-700 dark:text-purple-400">
                  回测直接调用 MT5 客户端的实际行情历史数据，严格模拟隔夜利息、点差以及止损/止盈逻辑，输出高置信度的绩效统计。
                </p>
              </div>
            </div>

          </div>
        ) : (
          /* Tab: 回测结果展示 */
          <div>
            {selectedBacktest ? (
              <div className="space-y-6">
                {/* 顶部标题与操作栏 */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                      <span>{selectedBacktest.name}</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        {selectedBacktest.results?.dataSource || 'MT5 Engine'}
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      回测区间: {selectedBacktest.startDate} 至 {selectedBacktest.endDate} | 品种: {selectedBacktest.results?.symbol || 'EURUSD'} ({selectedBacktest.results?.timeframe || 'H1'})
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={exportResults}
                      className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg text-gray-700 dark:text-gray-200 bg-white dark:bg-navy-800 hover:bg-gray-50 dark:hover:bg-navy-700 transition flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>导出成交明细 (CSV)</span>
                    </button>
                    <button
                      onClick={() => setSelectedBacktest(null)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg transition"
                    >
                      查看全部回测
                    </button>
                  </div>
                </div>

                {/* 核心绩效指标卡片 */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <div className="bg-gray-50 dark:bg-navy-800/80 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">最终净值 (Final Capital)</p>
                    <p className={`text-lg font-bold mt-1 ${
                      selectedBacktest.finalCapital >= selectedBacktest.initialCapital ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${Number(selectedBacktest.finalCapital).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className="text-[11px] text-gray-400">
                      净利: ${(selectedBacktest.finalCapital - selectedBacktest.initialCapital).toFixed(2)}
                    </span>
                  </div>

                  <div className="bg-gray-50 dark:bg-navy-800/80 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">总收益率 (Return)</p>
                    <p className={`text-lg font-bold mt-1 ${
                      selectedBacktest.finalCapital >= selectedBacktest.initialCapital ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(((selectedBacktest.finalCapital - selectedBacktest.initialCapital) / selectedBacktest.initialCapital) * 100).toFixed(2)}%
                    </p>
                    <span className="text-[11px] text-gray-400">基准初始: ${selectedBacktest.initialCapital}</span>
                  </div>

                  <div className="bg-gray-50 dark:bg-navy-800/80 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">胜率 (Win Rate)</p>
                    <p className="text-lg font-bold mt-1 text-gray-900 dark:text-white">
                      {selectedBacktest.winRate}%
                    </p>
                    <span className="text-[11px] text-gray-400">
                      盈利: {selectedBacktest.winningTrades} / 亏损: {selectedBacktest.losingTrades}
                    </span>
                  </div>

                  <div className="bg-gray-50 dark:bg-navy-800/80 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">盈亏比 (Profit Factor)</p>
                    <p className="text-lg font-bold mt-1 text-gray-900 dark:text-white">
                      {selectedBacktest.profitFactor}
                    </p>
                    <span className="text-[11px] text-gray-400">总交易笔数: {selectedBacktest.totalTrades}</span>
                  </div>

                  <div className="bg-gray-50 dark:bg-navy-800/80 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">最大回撤 (Max Drawdown)</p>
                    <p className="text-lg font-bold mt-1 text-red-600">
                      {selectedBacktest.maxDrawdown}%
                    </p>
                    <span className="text-[11px] text-gray-400">从最高峰值跌幅</span>
                  </div>

                  <div className="bg-gray-50 dark:bg-navy-800/80 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">夏普比率 (Sharpe)</p>
                    <p className="text-lg font-bold mt-1 text-purple-600">
                      {selectedBacktest.sharpeRatio}
                    </p>
                    <span className="text-[11px] text-gray-400">年化风险调整收益</span>
                  </div>
                </div>

                {/* 资金曲线可视化 */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    策略资金曲线与回撤轨迹 (Equity Curve)
                  </h4>
                  <EquityCurveChart 
                    data={selectedBacktest.results?.equityCurve || []} 
                    initialCapital={Number(selectedBacktest.initialCapital)} 
                  />
                </div>

                {/* 交易列表 */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      回测成交明细记录 ({trades.length} 笔交易)
                    </h4>
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
                      💡 点击任意交易可开启 TraderSync 动态逐帧复盘
                    </span>
                  </div>
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                      <thead className="bg-gray-50 dark:bg-navy-800">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">#</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">开仓时间</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">平仓时间</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">品种</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">方向</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">手数</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">开仓价</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">平仓价</th>
                          <th className="px-4 py-2.5 text-left font-medium text-gray-500 dark:text-gray-400">平仓原因</th>
                          <th className="px-4 py-2.5 text-right font-medium text-gray-500 dark:text-gray-400">净盈亏 ($)</th>
                          <th className="px-4 py-2.5 text-center font-medium text-gray-500 dark:text-gray-400">复盘动作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-navy-900 divide-y divide-gray-100 dark:divide-gray-800">
                        {trades.map((t) => (
                          <tr 
                            key={t.id} 
                            onClick={() => setReplayTrade(t)}
                            className="hover:bg-purple-50/50 dark:hover:bg-purple-950/20 cursor-pointer transition-colors"
                          >
                            <td className="px-4 py-2 text-gray-400">{t.id}</td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{t.entryTime}</td>
                            <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{t.exitTime}</td>
                            <td className="px-4 py-2 font-semibold text-gray-900 dark:text-white">{t.symbol}</td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                t.direction === 'Buy' || t.direction === 'long'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                              }`}>
                                {t.direction}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{t.size}</td>
                            <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300">{t.entryPrice}</td>
                            <td className="px-4 py-2 font-mono text-gray-700 dark:text-gray-300">{t.exitPrice}</td>
                            <td className="px-4 py-2 text-gray-500">{t.exitReason || 'Signal'}</td>
                            <td className={`px-4 py-2 text-right font-semibold font-mono ${
                              t.profit >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {t.profit >= 0 ? `+${t.profit.toFixed(2)}` : t.profit.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => setReplayTrade(t)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-950/80 hover:bg-purple-200 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold transition"
                              >
                                <Sparkles className="w-3 h-3 text-amber-500" />
                                <span>重播复盘</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* TraderSync 风格回测单笔交易复盘模态窗 */}
                {replayTrade && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-[#0b0f19] rounded-2xl w-full max-w-4xl border border-gray-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02]">
                        <div className="flex items-center space-x-2">
                          <div className="p-1.5 bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 rounded-lg">
                            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                              TraderSync 风格单笔交易逐根动态复盘 #{replayTrade.id} ({replayTrade.symbol})
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              还原开仓前上下文，动态测算持仓期 MAE/MFE 极值与离场落袋效率
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReplayTrade(null)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <div className="p-4 overflow-y-auto">
                        <TradeExecutionChart
                          symbol={replayTrade.symbol}
                          direction={replayTrade.direction.toLowerCase() === 'buy' || replayTrade.direction.toLowerCase() === 'long' ? 'long' : 'short'}
                          entryPrice={replayTrade.entryPrice}
                          exitPrice={replayTrade.exitPrice}
                          stopLoss={replayTrade.stopLoss}
                          takeProfit={replayTrade.takeProfit}
                          entryTime={replayTrade.entryTime}
                          exitTime={replayTrade.exitTime}
                          size={replayTrade.size}
                          profit={replayTrade.profit}
                          exitReason={replayTrade.exitReason}
                          height={400}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* 回测历史列表 */
              <div>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">已保存的回测实验</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">点击卡片可查看资金曲线走势及每笔成交明细</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('builder')}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg shadow-sm flex items-center space-x-1.5 transition"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>运行新回测</span>
                  </button>
                </div>

                {backtests.length === 0 ? (
                  <div className="text-center py-16 bg-gray-50 dark:bg-navy-800/40 rounded-xl border border-gray-200 dark:border-gray-700">
                    <BarChart2 className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600" />
                    <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-400">暂无回测结果</p>
                    <p className="text-xs text-gray-400 mt-1">切换到 Strategy Builder 配置参数并运行你的第一次 MT5 量化回测！</p>
                    <button
                      onClick={() => setActiveTab('builder')}
                      className="mt-4 px-4 py-2 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 rounded-lg hover:bg-purple-100 transition"
                    >
                      立刻开始回测
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {backtests.map((b) => {
                      const netProfit = b.finalCapital - b.initialCapital;
                      const returnPct = ((netProfit / b.initialCapital) * 100).toFixed(2);
                      const isProfit = netProfit >= 0;

                      return (
                        <div
                          key={b.id}
                          onClick={() => viewDetails(b)}
                          className="bg-white dark:bg-navy-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4.5 hover:shadow-md hover:border-purple-400 transition-all cursor-pointer flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-start">
                              <h4 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">
                                {b.name}
                              </h4>
                              <button
                                onClick={(e) => handleDeleteBacktest(b.id, e)}
                                className="text-gray-400 hover:text-red-500 p-1 -mr-1 transition"
                                title="删除回测"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                              {b.strategy}
                            </p>

                            <div className="mt-4 grid grid-cols-3 gap-2 py-2 px-3 bg-gray-50 dark:bg-navy-700/60 rounded-lg text-center">
                              <div>
                                <p className="text-[10px] text-gray-400">收益率</p>
                                <p className={`text-sm font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                                  {returnPct}%
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400">胜率</p>
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                  {b.winRate}%
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-gray-400">盈亏比</p>
                                <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                                  {b.profitFactor}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/80 flex items-center justify-between text-xs text-gray-400">
                            <span>{b.startDate?.split('T')[0]} ~ {b.endDate?.split('T')[0]}</span>
                            <span className="text-purple-600 dark:text-purple-400 font-medium flex items-center space-x-0.5">
                              <span>详情</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </FeaturePageLayout>
  );
}
