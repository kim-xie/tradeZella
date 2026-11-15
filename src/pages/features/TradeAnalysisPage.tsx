import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import FeaturePageLayout from './FeaturePageLayout';
import SEO from '../../components/common/SEO';
import { Loader, BarChart2, TrendingUp, DollarSign, Target, Calendar, ShieldAlert, Layers, Sparkles } from 'lucide-react';
import { SERVER_BASE_URL as API_BASE_URL } from '../../services/api';
import MfeMaeScatterChart from '../../components/analytics/MfeMaeScatterChart';
import HourlyPerformanceChart from '../../components/analytics/HourlyPerformanceChart';
import DayOfWeekChart from '../../components/analytics/DayOfWeekChart';
import MistakeTracker from '../../components/analytics/MistakeTracker';
import MonthlyReturnsMatrix from '../../components/analytics/MonthlyReturnsMatrix';
import SymbolPerformanceTable from '../../components/analytics/SymbolPerformanceTable';
import RMultipleDistributionChart from '../../components/analytics/RMultipleDistributionChart';

interface Trade {
  id: number;
  symbol: string;
  direction: 'buy' | 'sell';
  size: number;
  entryPrice: number;
  exitPrice?: number;
  notes?: string;
  createdAt: string;
  trade_date: string;
  tags?: string[];
  sentiment?: string;
}

interface PerformanceMetrics {
  totalTrades: number;
  completedTrades: number;
  totalProfitLoss: number;
  winRate: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  expectancy: number;
}

interface WhatIfScenario {
  id: number;
  name: string;
  description: string;
  parameters: {
    winRateAdjustment: number;
    avgWinAdjustment: number;
    avgLossAdjustment: number;
  };
  projectedPL: number;
  projectedWinRate: number;
}

const StatCard: React.FC<{ 
  title: string; 
  value: string | number; 
  icon: React.ReactNode;
  className?: string;
  trend?: 'up' | 'down';
}> = ({ title, value, icon, className = '', trend }) => (
  <div className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md ${className}`}>
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
          {icon}
          <span className="ml-2">{title}</span>
        </h3>
        <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      {trend && (
        <div className={`p-2 rounded-full ${trend === 'up' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
          {trend === 'up' ? '↑' : '↓'}
        </div>
      )}
    </div>
  </div>
);

const ChartPlaceholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md h-64 flex items-center justify-center">
    <div className="text-center">
      <BarChart2 className="mx-auto h-12 w-12 text-gray-400" />
      <p className="mt-2 text-sm text-gray-500">{title}</p>
      <p className="mt-1 text-xs text-gray-400">Advanced charting visualization</p>
    </div>
  </div>
);

export default function TradeAnalysisPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'mistakes' | 'matrix' | 'symbols' | 'r_distribution' | 'whatif'>('overview');
  const [scenarios, setScenarios] = useState<WhatIfScenario[]>([
    {
      id: 1,
      name: "Improved Win Rate",
      description: "What if win rate improved by 5%",
      parameters: {
        winRateAdjustment: 5,
        avgWinAdjustment: 0,
        avgLossAdjustment: 0
      },
      projectedPL: 0,
      projectedWinRate: 0
    },
    {
      id: 2,
      name: "Better Risk Management",
      description: "What if average loss decreased by 10%",
      parameters: {
        winRateAdjustment: 0,
        avgWinAdjustment: 0,
        avgLossAdjustment: -10
      },
      projectedPL: 0,
      projectedWinRate: 0
    },
    {
      id: 3,
      name: "Optimal Strategy",
      description: "What if both win rate and risk management improved",
      parameters: {
        winRateAdjustment: 5,
        avgWinAdjustment: 2,
        avgLossAdjustment: -10
      },
      projectedPL: 0,
      projectedWinRate: 0
    }
  ]);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Please log in to view trade analysis.');
          setLoading(false);
          return;
        }
        const response = await axios.get(`${API_BASE_URL}/api/trades`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTrades(response.data.data);
      } catch (err) {
        setError('Failed to fetch trades.');
      } finally {
        setLoading(false);
      }
    };
    fetchTrades();
  }, []);

  const metrics = useMemo<PerformanceMetrics>(() => {
    const completedTrades = trades.filter(t => t.exitPrice != null && t.exitPrice > 0);

    let totalProfitLoss = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let maxDrawdown = 0;
    let peak = 0;
    let runningTotal = 0;

    // Calculate profit/loss for each trade
    const tradeResults: number[] = [];
    completedTrades.forEach(trade => {
      const profit = trade.direction === 'buy'
        ? (trade.exitPrice! - trade.entryPrice) * trade.size
        : (trade.entryPrice - trade.exitPrice!) * trade.size;

      tradeResults.push(profit);
      totalProfitLoss += profit;
      
      if (profit > 0) {
        winningTrades++;
        totalWins += profit;
      } else {
        losingTrades++;
        totalLosses += Math.abs(profit);
      }
      
      // Calculate drawdown
      runningTotal += profit;
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      const drawdown = peak - runningTotal;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    const totalClosedTrades = winningTrades + losingTrades;
    const winRate = totalClosedTrades > 0 ? (winningTrades / totalClosedTrades) * 100 : 0;
    const avgWin = winningTrades > 0 ? totalWins / winningTrades : 0;
    const avgLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;
    const profitFactor = avgLoss > 0 ? totalWins / totalLosses : 0;
    const expectancy = totalClosedTrades > 0 ? totalProfitLoss / totalClosedTrades : 0;
    const sharpeRatio = 1.5; // Simplified - would be calculated from actual returns

    return {
      totalTrades: trades.length,
      completedTrades: completedTrades.length,
      totalProfitLoss,
      winRate,
      winningTrades,
      losingTrades,
      avgWin,
      avgLoss,
      profitFactor,
      maxDrawdown,
      sharpeRatio,
      expectancy
    };
  }, [trades]);

  // Calculate "what-if" scenarios
  useEffect(() => {
    const updatedScenarios = scenarios.map(scenario => {
      const { winRateAdjustment, avgWinAdjustment, avgLossAdjustment } = scenario.parameters;
      
      const adjustedWinRate = Math.min(100, Math.max(0, metrics.winRate + winRateAdjustment));
      const adjustedAvgWin = metrics.avgWin * (1 + avgWinAdjustment / 100);
      const adjustedAvgLoss = metrics.avgLoss * (1 + avgLossAdjustment / 100);
      
      const projectedWinRate = adjustedWinRate;
      const projectedPL = (adjustedWinRate / 100) * adjustedAvgWin - ((100 - adjustedWinRate) / 100) * adjustedAvgLoss;
      
      return {
        ...scenario,
        projectedPL,
        projectedWinRate
      };
    });
    
    setScenarios(updatedScenarios);
  }, [metrics]);

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center p-10"><Loader className="animate-spin" /> Loading Analysis...</div>;
    }
    if (error) {
      return <div className="text-red-500 text-center p-10">{error}</div>;
    }
    if (trades.length === 0) {
      return <div className="text-center p-10 text-gray-500 dark:text-gray-400">No trades found. Add some trades to see your analysis.</div>;
    }

    return (
      <div className="space-y-6">
        {/* Timeframe Selector */}
        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            {(['7d', '30d', '90d', '1y', 'all'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-xs font-medium rounded transition ${
                  timeframe === tf
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-navy-800 dark:text-gray-300'
                }`}
              >
                {tf === '7d' && '近7天'}
                {tf === '30d' && '近30天'}
                {tf === '90d' && '近90天'}
                {tf === '1y' && '近1年'}
                {tf === 'all' && '全部历史'}
              </button>
            ))}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            已分析 {metrics.totalTrades} 笔订单
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-white/10 overflow-x-auto">
          <nav className="-mb-px flex space-x-6 min-w-max">
            <button
              onClick={() => setActiveTab('overview')}
              className={`whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              综合全景分析 (Overview)
            </button>
            <button
              onClick={() => setActiveTab('mistakes')}
              className={`whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'mistakes'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              心理与错误漏洞追踪 (Mistake Tracker)
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'matrix'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              年度月度收益热力矩阵 (Monthly Matrix)
            </button>
            <button
              onClick={() => setActiveTab('symbols')}
              className={`whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'symbols'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              品种标的排行榜 (Symbol Breakdown)
            </button>
            <button
              onClick={() => setActiveTab('r_distribution')}
              className={`whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'r_distribution'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              风险报酬 R 倍数 (R-Multiples)
            </button>
            <button
              onClick={() => setActiveTab('whatif')}
              className={`whitespace-nowrap py-3.5 px-1 border-b-2 font-semibold text-sm transition-colors ${
                activeTab === 'whatif'
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              收益情景推演 (What-If)
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="总净盈亏" 
                value={`$${metrics.totalProfitLoss.toFixed(2)}`} 
                icon={<DollarSign className="h-4 w-4" />}
                className={metrics.totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}
                trend={metrics.totalProfitLoss >= 0 ? 'up' : 'down'}
              />
              <StatCard 
                title="综合胜率" 
                value={`${metrics.winRate.toFixed(2)}%`} 
                icon={<Target className="h-4 w-4" />}
                trend={metrics.winRate >= 50 ? 'up' : 'down'}
              />
              <StatCard 
                title="盈亏比 (PF)" 
                value={metrics.profitFactor.toFixed(2)} 
                icon={<TrendingUp className="h-4 w-4" />}
                trend={metrics.profitFactor >= 1.5 ? 'up' : 'down'}
              />
              <StatCard 
                title="单笔数学期望" 
                value={`$${metrics.expectancy.toFixed(2)}`} 
                icon={<BarChart2 className="h-4 w-4" />}
                className={metrics.expectancy >= 0 ? 'text-green-600' : 'text-red-600'}
                trend={metrics.expectancy >= 0 ? 'up' : 'down'}
              />
            </div>

            {/* Additional Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard 
                title="总平仓订单数" 
                value={metrics.totalTrades} 
                icon={<Calendar className="h-4 w-4" />}
              />
              <StatCard 
                title="平均盈利单" 
                value={`$${metrics.avgWin.toFixed(2)}`} 
                icon={<TrendingUp className="h-4 w-4" />}
                className="text-green-600"
              />
              <StatCard 
                title="平均亏损单" 
                value={`$${metrics.avgLoss.toFixed(2)}`} 
                icon={<TrendingUp className="h-4 w-4" />}
                className="text-red-600"
              />
            </div>

            {/* Advanced Quant Analytics Charts */}
            <div className="space-y-6">
              {/* MFE / MAE Excursion Analysis (TraderSync / TradeZella 核心分析图) */}
              <MfeMaeScatterChart trades={trades} />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hourly Performance */}
                <HourlyPerformanceChart trades={trades} />
                
                {/* Day of Week Performance */}
                <DayOfWeekChart trades={trades} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mistakes' && (
          <div className="space-y-6">
            <MistakeTracker trades={trades} />
          </div>
        )}

        {activeTab === 'matrix' && (
          <div className="space-y-6">
            <MonthlyReturnsMatrix trades={trades} />
          </div>
        )}

        {activeTab === 'symbols' && (
          <div className="space-y-6">
            <SymbolPerformanceTable trades={trades} />
          </div>
        )}

        {activeTab === 'r_distribution' && (
          <div className="space-y-6">
            <RMultipleDistributionChart trades={trades} />
          </div>
        )}

        {activeTab === 'whatif' && (
          <div className="space-y-6">
            <div className="bg-purple-50 dark:bg-purple-950/30 p-4 rounded-xl border border-purple-100 dark:border-purple-800/40">
              <h3 className="font-bold text-purple-900 dark:text-purple-300 text-sm">收益情景推演 (What-If 敏锐度分析)</h3>
              <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">
                测算当胜率提高、平均亏损缩减或风控执行率提升时，对账户整体复利曲线的乘数效应。
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {scenarios.map((scenario) => (
                <div key={scenario.id} className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xs p-5">
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">{scenario.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{scenario.description}</p>
                  
                  <div className="mt-4 space-y-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">当前实盘胜率</span>
                      <span className="font-mono font-bold">{metrics.winRate.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">推演调整后胜率</span>
                      <span className="font-mono font-bold text-purple-600">{scenario.projectedWinRate.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">推演预期净利</span>
                      <span className={`font-mono font-bold ${scenario.projectedPL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${scenario.projectedPL.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/5">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">预期改善</span>
                      <span className={`font-mono font-bold ${scenario.projectedPL > metrics.totalProfitLoss ? 'text-green-600' : 'text-red-600'}`}>
                        {scenario.projectedPL > metrics.totalProfitLoss 
                          ? `+${((scenario.projectedPL - metrics.totalProfitLoss) / Math.abs(metrics.totalProfitLoss || 1) * 100).toFixed(1)}%` 
                          : `${((scenario.projectedPL - metrics.totalProfitLoss) / Math.abs(metrics.totalProfitLoss || 1) * 100).toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'scenarios' && (
          <div className="space-y-6">
            <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xs p-5">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">创建自定义推演模型</h3>
              <p className="text-xs text-gray-500 mt-1">
                灵活微调参数，模拟如果减少冲动交易或缩减最大亏损后的复盘模型
              </p>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    胜率提升调整 (%)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-lg shadow-xs focus:ring-purple-500 focus:border-purple-500 dark:bg-navy-950"
                    placeholder="例如：5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    平均盈利增幅 (%)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-lg shadow-xs focus:ring-purple-500 focus:border-purple-500 dark:bg-navy-950"
                    placeholder="例如：10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    平均亏损缩减 (%)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 text-xs border border-gray-300 dark:border-gray-700 rounded-lg shadow-xs focus:ring-purple-500 focus:border-purple-500 dark:bg-navy-950"
                    placeholder="例如：-5"
                  />
                </div>
              </div>
              
              <div className="mt-4">
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition">
                  开始执行推演测算
                </button>
              </div>
            </div>
            
            <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/10 rounded-xl shadow-xs p-5">
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">已保存的推演方案</h3>
              <p className="text-xs text-gray-500 mt-1">
                历史创建的方案将在此归档
              </p>
              
              <div className="mt-4 text-center py-8 text-gray-500 text-xs">
                <p>暂无已保存的推演场景</p>
                <p className="text-[11px] text-gray-400 mt-1">保存不同的测算模型以横向对比策略优化空间</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <SEO 
        title="深度量化交易分析"
        description="机构级交易分析、胜率盈亏比分解、MFE/MAE 最大潜力回撤与 What-If 收益推演。"
        keywords="TradeZen, 交易分析, 量化复盘, 胜率, 盈亏比, MFE, MAE, 期望值"
        url="https://tradezen.app/features/analysis"
      />
      <FeaturePageLayout
        title="深度交易分析 (Trade Analysis)"
        description="全景式量化图表、知行合一心理与违规追踪、时段收益分布与假设推演模型。"
        image="/assets/2.png"
      >
        <div className="bg-white dark:bg-[#0b0f19] p-6 rounded-2xl shadow-sm border border-gray-200/80 dark:border-white/10">
          {renderContent()}
        </div>
      </FeaturePageLayout>
    </>
  );
}