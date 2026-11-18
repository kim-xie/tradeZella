import React, { useState, useEffect } from 'react';
import FeaturePageLayout from './FeaturePageLayout';
import { Laptop, RefreshCw } from 'lucide-react';
import ManualBarReplay from '../../components/ManualBarReplay';
import { getMT5Status, MT5StatusData } from '../../services/api';

export default function BacktestingPage() {
  const [mt5Status, setMt5Status] = useState<MT5StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

  useEffect(() => {
    fetchMT5Info();
  }, []);

  const fetchMT5Info = async () => {
    try {
      setLoadingStatus(true);
      const status = await getMT5Status();
      setMt5Status(status);
    } catch {
      setMt5Status({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  return (
    <FeaturePageLayout
      title="TradingView 风格 K线重播回测系统"
      description="参考 TradingView 实现的逐根K线重播与多空标尺回测引擎，支持真实行情推演、实时仓位风控与全维度回测结果统计。"
      image="/assets/5.png"
    >
      <div className="space-y-6">
        {/* MT5 状态横幅 */}
        <div className="bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-[#0f1422] dark:to-[#0f1422]/90 p-4 rounded-2xl border border-purple-100 dark:border-purple-900/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${mt5Status?.connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'}`}>
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  {mt5Status?.connected ? 'MT5 终端行情直连引擎就绪' : '未连接本地 MT5 终端（使用高保真仿真行情）'}
                </h3>
                <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold ${
                  mt5Status?.connected ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50' : 'bg-amber-100 text-amber-800'
                }`}>
                  {mt5Status?.connected ? '● MT5 Direct Online' : 'Synthetic Data'}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {mt5Status?.connected && mt5Status.account
                  ? `已连接经纪商 [${mt5Status.account.company}]，支持 ${mt5Status.symbolsTotal} 个品种历史 K 线拉取与点差模拟`
                  : '支持任意外汇、黄金、股指与加密货币 K 线逐根复盘。连接本地 MT5 客户端可直连读取实盘历史行情。'}
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

        {/* 核心 K线回测与回测结果统计引擎 (参考 TradingView 实现) */}
        <ManualBarReplay 
          initialSymbol="EURUSD"
          popularSymbols={mt5Status?.popularSymbols || ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD']}
          allSymbols={mt5Status?.allSymbols || []}
        />
      </div>
    </FeaturePageLayout>
  );
}
