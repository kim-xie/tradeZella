import React, { useMemo, useState } from 'react';
import { 
  AlertTriangle, 
  Sparkles, 
  TrendingUp, 
  DollarSign, 
  ShieldAlert, 
  CheckCircle,
  HelpCircle,
  Percent
} from 'lucide-react';

export interface MistakeItem {
  id: string;
  name: string;
  nameCn: string;
  category: 'execution' | 'psychology' | 'risk';
  description: string;
}

export const COMMON_MISTAKES: MistakeItem[] = [
  { id: 'fomo', name: 'FOMO Entry', nameCn: '追涨杀跌 (FOMO)', category: 'psychology', description: '担心踏空在不合理位置强行追入' },
  { id: 'revenge', name: 'Revenge Trading', nameCn: '报复性交易', category: 'psychology', description: '亏损后情绪失控急于翻本' },
  { id: 'early_exit', name: 'Early Exit', nameCn: '过早止盈 (卖飞)', category: 'execution', description: '没有遵循计划，在目标位之前因恐惧提早平仓' },
  { id: 'moved_sl', name: 'Moved Stop Loss', nameCn: '下移/取消止损 (死扛)', category: 'risk', description: '浮亏时放大止损距离或直接撤销止损' },
  { id: 'oversized', name: 'Oversized Position', nameCn: '重仓违规 (超额风险)', category: 'risk', description: '单笔仓位远超计划风险百分比' },
  { id: 'no_plan', name: 'No Trading Plan', nameCn: '冲动无计划入场', category: 'execution', description: '缺少明确的入场依据、SL和TP规则' },
  { id: 'overtrading', name: 'Overtrading', nameCn: '过度频繁交易', category: 'psychology', description: '没有机会硬做，在垃圾时间频繁刷单' },
  { id: 'counter_trend', name: 'Counter Trend', nameCn: '盲目摸顶抄底', category: 'execution', description: '逆大势强行猜顶猜底被趋势碾压' },
];

interface MistakeTrackerProps {
  trades: any[];
  className?: string;
}

export const MistakeTracker: React.FC<MistakeTrackerProps> = ({ trades, className = '' }) => {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'psychology' | 'risk' | 'execution'>('all');

  // Compute mistake statistics
  const mistakeAnalytics = useMemo(() => {
    const completed = trades.filter(t => t.exitprice || t.exitPrice);

    // Calculate actual total P&L
    let actualPnl = 0;
    completed.forEach(t => {
      if (t.manual_pnl !== undefined && t.manual_pnl !== null) {
        actualPnl += Number(t.manual_pnl);
      } else if (t.entryprice && t.exitprice) {
        const isLong = (t.direction || 'long').toLowerCase() === 'long';
        actualPnl += isLong 
          ? (t.exitprice - t.entryprice) * (t.size || 1)
          : (t.entryprice - t.exitprice) * (t.size || 1);
      }
    });

    // Tag each trade with mistake patterns (from tags, notes, or synthetic rule flags)
    const mistakeMap: Record<string, { count: number; lossAmount: number; trades: any[] }> = {};
    COMMON_MISTAKES.forEach(m => {
      mistakeMap[m.id] = { count: 0, lossAmount: 0, trades: [] };
    });

    let totalMistakeLoss = 0;
    let totalMistakeCount = 0;

    completed.forEach(t => {
      const notes = (t.notes || '').toLowerCase();
      const tags = (t.tags || []).map((x: string) => String(x).toLowerCase());
      const sentiment = (t.sentiment || '').toLowerCase();
      const pnl = t.manual_pnl !== undefined && t.manual_pnl !== null
        ? Number(t.manual_pnl)
        : ((t.direction || 'long').toLowerCase() === 'long' 
            ? ((t.exitprice || 0) - (t.entryprice || 0)) * (t.size || 1)
            : ((t.entryprice || 0) - (t.exitprice || 0)) * (t.size || 1));

      // Check which mistakes apply
      const detected: string[] = [];

      // Check explicit tags
      COMMON_MISTAKES.forEach(m => {
        if (tags.includes(m.id) || notes.includes(m.name.toLowerCase()) || notes.includes(m.nameCn.toLowerCase())) {
          detected.push(m.id);
        }
      });

      // Heuristic detection if not manually tagged
      if (detected.length === 0 && pnl < 0) {
        if (sentiment === 'nervous' || sentiment === 'uneasy') {
          detected.push('fomo');
        } else if (t.final_trigger === 'stopLoss' && Math.abs(pnl) > 300) {
          detected.push('moved_sl');
        } else if ((t.size || 1) > 2) {
          detected.push('oversized');
        } else if (sentiment === 'overtrading' || notes.includes('overtrade')) {
          detected.push('overtrading');
        } else {
          detected.push('no_plan');
        }
      }

      // Aggregate
      detected.forEach(mId => {
        if (mistakeMap[mId]) {
          mistakeMap[mId].count++;
          totalMistakeCount++;
          if (pnl < 0) {
            const loss = Math.abs(pnl);
            mistakeMap[mId].lossAmount += loss;
            totalMistakeLoss += loss;
          }
          mistakeMap[mId].trades.push(t);
        }
      });
    });

    // P&L without mistakes
    const pnlWithoutMistakes = actualPnl + totalMistakeLoss;

    return {
      actualPnl: Math.round(actualPnl * 100) / 100,
      totalMistakeLoss: Math.round(totalMistakeLoss * 100) / 100,
      pnlWithoutMistakes: Math.round(pnlWithoutMistakes * 100) / 100,
      totalMistakeCount,
      mistakeMap,
    };
  }, [trades]);

  const filteredMistakes = useMemo(() => {
    return COMMON_MISTAKES.filter(m => {
      if (selectedCategory === 'all') return true;
      return m.category === selectedCategory;
    }).map(m => {
      const data = mistakeAnalytics.mistakeMap[m.id] || { count: 0, lossAmount: 0 };
      const pctOfLoss = mistakeAnalytics.totalMistakeLoss > 0 
        ? (data.lossAmount / mistakeAnalytics.totalMistakeLoss) * 100 
        : 0;

      return {
        ...m,
        count: data.count,
        lossAmount: Math.round(data.lossAmount * 100) / 100,
        pctOfLoss: Math.round(pctOfLoss * 10) / 10,
      };
    }).sort((a, b) => b.lossAmount - a.lossAmount);
  }, [mistakeAnalytics, selectedCategory]);

  return (
    <div className={`bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-white/10 p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
              <ShieldAlert className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">
              错误模式与漏洞追踪 (Mistake Tracker & Leak Detector)
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60 font-semibold">
              TRADERSYNC SIGNATURE
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            量化统计心理冲动与纪律违规对账户总收益的侵蚀程度
          </p>
        </div>

        {/* Filter categories */}
        <div className="flex items-center p-1 bg-gray-100 dark:bg-navy-900 rounded-xl border border-gray-200 dark:border-white/10 text-xs">
          {(['all', 'psychology', 'risk', 'execution'] as const).map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-lg font-mono font-medium transition-all ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {cat === 'all' ? '全部错误' : cat === 'psychology' ? '心理情绪' : cat === 'risk' ? '仓位风控' : '执行偏差'}
            </button>
          ))}
        </div>
      </div>

      {/* The Famous "P&L Without Mistakes" Banner (TradeZella & TraderSync 核心王牌模块) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Actual P&L */}
        <div className="p-4 rounded-xl bg-gray-50/80 dark:bg-white/[0.02] border border-gray-200/60 dark:border-white/5">
          <span className="text-xs text-gray-400 font-mono block">实际账户净收益 (Actual P/L)</span>
          <div className={`text-2xl font-black font-mono mt-1 ${mistakeAnalytics.actualPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {mistakeAnalytics.actualPnl >= 0 ? '+' : ''}${mistakeAnalytics.actualPnl.toFixed(2)}
          </div>
          <span className="text-[10px] text-gray-400 font-mono mt-1 block">包含所有已犯错误的结果</span>
        </div>

        {/* Cost of Mistakes */}
        <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40">
          <span className="text-xs text-rose-500 font-mono block flex items-center justify-between">
            <span>错误违规造成的累计亏损</span>
            <AlertTriangle className="w-3.5 h-3.5" />
          </span>
          <div className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
            -${mistakeAnalytics.totalMistakeLoss.toFixed(2)}
          </div>
          <span className="text-[10px] text-rose-500/80 font-mono mt-1 block">
            共计触发 {mistakeAnalytics.totalMistakeCount} 次违规操作
          </span>
        </div>

        {/* Potential P&L without mistakes */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 dark:from-purple-950/40 dark:to-indigo-950/40 border border-purple-200/80 dark:border-purple-800/60 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs text-purple-600 dark:text-purple-300 font-mono font-bold flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>若消除错误潜在收益 (P/L Without Mistakes)</span>
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-purple-700 dark:text-purple-300 mt-1">
            +${mistakeAnalytics.pnlWithoutMistakes.toFixed(2)}
          </div>
          <span className="text-[10px] text-purple-500 dark:text-purple-400 font-mono mt-1 block font-medium">
            💡 守纪律将帮助账户多捕获 ${mistakeAnalytics.totalMistakeLoss.toFixed(2)} 利润！
          </span>
        </div>
      </div>

      {/* Mistake Ranking Breakdown List */}
      <div className="space-y-3">
        <h4 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-wider">
          错误行为亏损排行榜 (Mistake Breakdown)
        </h4>

        <div className="space-y-2.5">
          {filteredMistakes.map(m => {
            const hasDamage = m.lossAmount > 0;
            return (
              <div 
                key={m.id}
                className="p-3 rounded-xl bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 hover:border-purple-200 dark:hover:border-purple-800/50 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-xs text-gray-900 dark:text-white font-mono">
                      {m.nameCn}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      ({m.name})
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-gray-200/80 dark:bg-navy-800 text-gray-600 dark:text-gray-300">
                      触发 {m.count} 次
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 text-xs font-mono">
                    <span className="text-gray-400 text-[11px]">占违规亏损: {m.pctOfLoss}%</span>
                    <span className="font-bold text-rose-500 text-sm">
                      {hasDamage ? `-$${m.lossAmount.toFixed(2)}` : '$0.00'}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-gray-200/60 dark:bg-white/5 h-2 rounded-full overflow-hidden">
                  <div 
                    style={{ width: `${Math.min(100, m.pctOfLoss)}%` }}
                    className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded-full transition-all duration-300"
                  />
                </div>

                <p className="text-[11px] text-gray-400 mt-1.5">
                  {m.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MistakeTracker;
