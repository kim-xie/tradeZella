import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  RefreshCw,
  BarChart2,
  Calendar,
  TrendingUp,
  Layers,
  CheckCircle2,
  ArrowRight,
  Shield,
  Zap,
  Target,
  FileText,
  PlaySquare,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Award,
  BookOpen,
} from 'lucide-react';

interface TutorialStep {
  id: string;
  stepNumber: string;
  badge: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  colorTheme: string;
}

const STEPS: TutorialStep[] = [
  {
    id: 'sync',
    stepNumber: '01',
    badge: '第一步 · 核心起点',
    title: '实盘数据同步 (Live Sync)',
    subtitle: '连接 Windows 本地 MT5 或导入券商/交易所账单，秒级聚合真实成交',
    icon: RefreshCw,
    colorTheme: 'emerald',
  },
  {
    id: 'dashboard',
    stepNumber: '02',
    badge: '第二步 · 核心指标',
    title: '仪表盘量化总览 (Dashboard)',
    subtitle: '多维透视净利润、胜率、盈亏比(PF)、资金曲线与知行纪律评分',
    icon: BarChart2,
    colorTheme: 'purple',
  },
  {
    id: 'trades',
    stepNumber: '03',
    badge: '第三步 · 过滤归因',
    title: '交易明细与多维过滤 (Trades)',
    subtitle: '按品种、多空、盈亏结果与平仓方式秒级筛选，半屏抽屉深度透视',
    icon: Layers,
    colorTheme: 'blue',
  },
  {
    id: 'calendar',
    stepNumber: '04',
    badge: '第四步 · 周期复盘',
    title: '交易日历与每日复盘 (Calendar)',
    subtitle: '当月每日盈亏柱形图直观透视，8列日历聚合每周战报与心得笔记',
    icon: Calendar,
    colorTheme: 'indigo',
  },
  {
    id: 'replay',
    stepNumber: '05',
    badge: '第五步 · 动态重放',
    title: 'K线打点与逐帧动态复盘 (Replay)',
    subtitle: 'TradingView 级进出场打点，逐帧步进播放、MFE/MAE 与出场落袋效率',
    icon: PlaySquare,
    colorTheme: 'amber',
  },
  {
    id: 'backtest',
    stepNumber: '06',
    badge: '第六步 · 进阶进化',
    title: '策略回测与战法沉淀 (Backtest)',
    subtitle: '离线复盘经典战法，测试历史期望值，建立知行合一交易手册',
    icon: TrendingUp,
    colorTheme: 'rose',
  },
];

export const TutorialPage: React.FC = () => {
  const [activeStep, setActiveStep] = useState<string>('sync');

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-[#0b0f19] text-gray-900 dark:text-gray-100 transition-colors duration-200">
      <Helmet>
        <title>新手快速入门教程 - TradeZen 知行合一交易管理</title>
        <meta
          name="description"
          content="TradeZen 新手教程：教您如何从实盘同步开始，全面掌握仪表盘量化统计、交易明细高级过滤、交易日历与每日复盘、TradingView K线打点及逐帧动态复盘功能。"
        />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* 1. Header Banner */}
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-purple-900/90 via-indigo-900/80 to-[#0b0f19] border border-purple-500/20 p-6 sm:p-10 text-white shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>新交易者快速上手指引 · 3分钟掌握全流程</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              TradeZen 新手快速上手指南
            </h1>
            <p className="mt-3 text-sm sm:text-base text-gray-300 leading-relaxed">
              从<span className="text-emerald-400 font-bold underline decoration-emerald-400/50 underline-offset-4">实盘数据同步</span>开始，建立完整的交易记录闭环。本教程带您一步步掌握量化仪表盘、明细过滤、交易日历、K线动态逐帧复盘与策略回测。
            </p>

            {/* Quick Actions */}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/features/broker-integration"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>立即开始实盘同步 (第一步)</span>
              </Link>
              <Link
                to="/"
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/20 transition-all flex items-center space-x-2"
              >
                <BarChart2 className="w-4 h-4" />
                <span>直接查看仪表盘</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 2. Step Navigator Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {STEPS.map((step) => {
            const Icon = step.icon;
            const isSelected = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white dark:bg-[#111827] border-purple-500 dark:border-purple-400 shadow-md ring-2 ring-purple-500/20'
                    : 'bg-white/80 dark:bg-[#111827]/60 border-gray-200 dark:border-white/10 hover:bg-white dark:hover:bg-[#111827] text-gray-600 dark:text-gray-400'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400'}`}>
                    {step.stepNumber}
                  </span>
                  <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400' : 'bg-gray-100 dark:bg-navy-800 text-gray-400'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-xs font-bold truncate text-gray-900 dark:text-white">
                  {step.title.split(' ')[0]}
                </div>
                <div className="text-[10px] text-gray-400 truncate mt-0.5">
                  {step.badge.split(' · ')[1] || step.badge}
                </div>
              </button>
            );
          })}
        </div>

        {/* 3. Detailed Guide Content (Highlighted Focus: Step 1 Live Sync First) */}

        {/* STEP 1: 实盘数据同步 (Core Foundation) */}
        <div className={`rounded-2xl border bg-white dark:bg-[#111827] shadow-sm overflow-hidden transition-all ${
          activeStep === 'sync' ? 'border-emerald-500/80 ring-2 ring-emerald-500/20' : 'border-gray-200 dark:border-white/10'
        }`}>
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                    STEP 01 · 核心起点
                  </span>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    实盘交易数据同步与导入 (Live Sync)
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  工欲善其事，必先利其器。量化复盘的第一步是将您的真实交易成交记录同步至系统。
                </p>
              </div>
            </div>
            <Link
              to="/features/broker-integration"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs shrink-0"
            >
              <span>立即去实盘同步</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Method A: MT5 Windows IPC */}
              <div className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/30 dark:bg-emerald-950/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">A</span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">MT5 本地客户端极速直连 (最推荐)</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                    零延迟自动同步
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  只要您在当前 Windows 电脑上运行着 MetaTrader 5 客户端并处于登录状态：
                </p>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2 font-mono">
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>第1步：</b>确保 Windows 端已打开 MT5 客户端。</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>第2步：</b>在 TradeZen 导航栏点击【实盘同步】按钮。</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span><b>第3步：</b>系统原生 IPC 管道自动识别平仓单，计算盈亏、手续费、SL/TP 点位。</span>
                  </li>
                </ul>
              </div>

              {/* Method B: CSV Upload */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-navy-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center">B</span>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white">券商与交易所 CSV 账单导入</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-200 dark:bg-navy-800 text-gray-700 dark:text-gray-300">
                    多平台自适应
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  若使用其他券商或交易所，可直接将导出的历史账单（CSV/HTML）拖拽上传：
                </p>
                <div className="flex flex-wrap gap-1.5 text-[11px] font-mono">
                  {['MT4 详细报表', 'MT5 Deals 导出', 'Binance 币安', 'Bybit', 'OKX', 'Tradovate', 'Interactive Brokers 盈透'].map((broker) => (
                    <span key={broker} className="px-2 py-0.5 rounded bg-white dark:bg-navy-900 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300">
                      {broker}
                    </span>
                  ))}
                </div>
                <div className="pt-1">
                  <Link
                    to="/trades"
                    className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1"
                  >
                    <span>去【交易明细】页面上传 CSV 账单</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Note alert */}
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-800 dark:text-emerald-300 flex items-center space-x-2.5">
              <Shield className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span><b>数据安全与隐私保密：</b>所有实盘同步仅读取已平仓订单记录，不涉及任何提款或交易操作权限，保障资金绝对安全。</span>
            </div>
          </div>
        </div>

        {/* STEP 2: 仪表盘量化总览 */}
        <div className={`rounded-2xl border bg-white dark:bg-[#111827] shadow-sm overflow-hidden transition-all ${
          activeStep === 'dashboard' ? 'border-purple-500/80 ring-2 ring-purple-500/20' : 'border-gray-200 dark:border-white/10'
        }`}>
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-purple-50/50 dark:bg-purple-950/20">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-md shadow-purple-500/20">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300">
                    STEP 02 · 核心功能
                  </span>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    仪表盘量化统计与全景透视 (Dashboard)
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  同步数据后，仪表盘将自动为您生成对标专业对冲基金的量化绩效指标。
                </p>
              </div>
            </div>
            <Link
              to="/"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition shadow-xs shrink-0"
            >
              <span>查看我的仪表盘</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-navy-950/30">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400">净利润与胜率 (Win Rate)</div>
              <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">净盈亏总览</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                统计扣除手续费后的真实净收益，动态对比多单胜率与空单胜率。
              </p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-navy-950/30">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400">盈亏比 (Profit Factor)</div>
              <div className="text-lg font-black font-mono text-purple-600 dark:text-purple-400 mt-1">期望值与PF</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                总盈利除以总亏损，衡量系统稳健度（优秀系统 PF 通常 &gt; 1.5）。
              </p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-navy-950/30">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400">资金权益曲线 (Equity Curve)</div>
              <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400 mt-1">动态回撤跟踪</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                按笔数或时间轴绘制账户资金走势，一目了然识别主升浪与回撤期。
              </p>
            </div>
            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-navy-950/30">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400">知行合一纪律评分</div>
              <div className="text-lg font-black font-mono text-amber-500 mt-1">失误归因与心智</div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                量化复盘是否遵守计划，排查追高FOMO、提前离场与报复性交易。
              </p>
            </div>
          </div>
        </div>

        {/* STEP 3: 交易明细与多维过滤 */}
        <div className={`rounded-2xl border bg-white dark:bg-[#111827] shadow-sm overflow-hidden transition-all ${
          activeStep === 'trades' ? 'border-blue-500/80 ring-2 ring-blue-500/20' : 'border-gray-200 dark:border-white/10'
        }`}>
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300">
                    STEP 03 · 深度筛选
                  </span>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    交易明细表与多维过滤筛选 (Trades Journal)
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  像专业交易经理一样审视每一笔单子，快速检索出需要复盘的问题订单。
                </p>
              </div>
            </div>
            <Link
              to="/trades"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-xs shrink-0"
            >
              <span>前往交易明细</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                <span className="font-bold text-gray-900 dark:text-white flex items-center space-x-1.5">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span>精准条件组合检索</span>
                </span>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  支持按品种代码（如 EURUSD、BTCUSDT）、多空方向、状态（已平仓/持仓中）、盈亏结果（盈利/亏损/保本）以及平仓方式（止盈触发/止损触发/手动离场）秒级筛选。
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                <span className="font-bold text-gray-900 dark:text-white flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-purple-500" />
                  <span>50% 半屏沉浸式抽屉</span>
                </span>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  点击列表任一记录，右侧展开占屏幕 50% 宽度的复盘抽屉，直观审视入场时间、出场价格、持仓时长、点数分布与行情截图。
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 space-y-2">
                <span className="font-bold text-gray-900 dark:text-white flex items-center space-x-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>战法标签与心智情绪</span>
                </span>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  为交易添加【顺势突破】、【早盘假突破】等策略标签，记录入场时心理状态（如从容自信、紧张焦虑、FOMO 等），便于统计哪些情绪产生亏损。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 4: 交易日历与每日复盘 */}
        <div className={`rounded-2xl border bg-white dark:bg-[#111827] shadow-sm overflow-hidden transition-all ${
          activeStep === 'calendar' ? 'border-indigo-500/80 ring-2 ring-indigo-500/20' : 'border-gray-200 dark:border-white/10'
        }`}>
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/50 dark:bg-indigo-950/20">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-300">
                    STEP 04 · 周期归纳
                  </span>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    交易日历与当月盈亏柱形图 (Calendar)
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  把冷冰冰的数字转化为一目了然的时间轴视觉，养成每日撰写复盘笔记的良好习惯。
                </p>
              </div>
            </div>
            <Link
              to="/calendar"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs shrink-0"
            >
              <span>打开交易日历</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>当月每日净盈亏柱形图 (Daily Net P&L)</span>
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  日历顶部集成直观的双极柱形图，以 $0 为基准零轴中线：
                </p>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-950/40 border border-gray-200 dark:border-white/5 space-y-2 text-xs font-mono">
                  <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                    <span>🟢 柱体向上生长：盈利日（绿日），高度正比于当日净收益</span>
                  </div>
                  <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
                    <span>🔴 柱体向下延伸：亏损日（红日），高度正比于当日亏损额</span>
                  </div>
                  <div className="text-gray-500 text-[11px] font-sans pt-1">
                    悬停任意柱体可查看当日胜率、笔数及盈亏；点击柱体一键打开该日日内复盘抽屉。
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  <span>8列日历全景 + 周度战报归纳</span>
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  提供周一至周日的日历单元格，并在最右侧提供独立的【周汇总 Week】统计列：
                </p>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-navy-950/40 border border-gray-200 dark:border-white/5 space-y-2 text-xs font-mono">
                  <div className="text-purple-600 dark:text-purple-400 font-bold">
                    📊 每周汇总直接统计：周净盈亏、周胜率、总交易手数与周盈亏比 (PF)
                  </div>
                  <div className="text-gray-500 text-[11px] font-sans">
                    点击日历中的任一日期，即可在半屏抽屉中书写专属交易日记并持久化保存。
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 5: K线打点与逐帧动态复盘播放器 */}
        <div className={`rounded-2xl border bg-white dark:bg-[#111827] shadow-sm overflow-hidden transition-all ${
          activeStep === 'replay' ? 'border-amber-500/80 ring-2 ring-amber-500/20' : 'border-gray-200 dark:border-white/10'
        }`}>
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                <PlaySquare className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                    STEP 05 · 精准复盘
                  </span>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    TradingView K线打点与逐帧动态复盘 (Replay Player)
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  对标顶级机构的动态逐根重放系统，精准归因进出场点位与风控执行。
                </p>
              </div>
            </div>
            <Link
              to="/features/backtesting"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-xs shrink-0"
            >
              <span>体验K线回测与打点</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-navy-950/20 space-y-2">
                <span className="font-bold text-gray-900 dark:text-white flex items-center space-x-1.5">
                  <Target className="w-4 h-4 text-amber-500" />
                  <span>K线真实执行打点</span>
                </span>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  蓝点标记开仓入场、黄点标记平仓出场，虚线红绿动态标注止损(SL)与止盈(TP)位，一目了然看清当时走势。
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-navy-950/20 space-y-2">
                <span className="font-bold text-gray-900 dark:text-white flex items-center space-x-1.5">
                  <PlaySquare className="w-4 h-4 text-emerald-500" />
                  <span>逐帧控制条播放器</span>
                </span>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  提供步退 ⏪、单步后退 ◀、播放/暂停 ▶/⏸、单步前进 ▶▶、步进 ⏩，支持 0.5x ~ 5x 倍速调节与进度条拖拽。
                </p>
              </div>
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-navy-950/20 space-y-2">
                <span className="font-bold text-gray-900 dark:text-white flex items-center space-x-1.5">
                  <Award className="w-4 h-4 text-purple-500" />
                  <span>MFE / MAE 空间与落袋效率</span>
                </span>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                  实时计算最大顺行盈利（MFE）、最大逆行回撤（MAE）、离场落袋效率 % 以及出场后是否“卖飞留给桌面的利润”。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* STEP 6: 策略回测与战法沉淀 */}
        <div className={`rounded-2xl border bg-white dark:bg-[#111827] shadow-sm overflow-hidden transition-all ${
          activeStep === 'backtest' ? 'border-rose-500/80 ring-2 ring-rose-500/20' : 'border-gray-200 dark:border-white/10'
        }`}>
          <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-50/50 dark:bg-rose-950/20">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300">
                    STEP 06 · 进阶进化
                  </span>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    策略回测与知行合一手册 (Playbooks & Backtesting)
                  </h2>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  将复盘得出的教训沉淀为纪律规则，在历史行情中离线反复验证。
                </p>
              </div>
            </div>
            <Link
              to="/features/backtesting"
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition shadow-xs shrink-0"
            >
              <span>进入K线回测</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              知行合一是持续盈利的核心基石。通过在【K线回测】中反复演练自己的交易战法（如供求区突破、斐波那契回撤、均线金叉等），交易者能克服盘中的贪婪与恐惧，在实盘中形成肌肉记忆。
            </p>
          </div>
        </div>

        {/* 4. Complete Workflow Checklist for Beginners */}
        <div className="p-6 rounded-3xl bg-gradient-to-br from-purple-900/10 via-indigo-900/10 to-transparent border border-purple-200/60 dark:border-purple-800/40 space-y-4">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
            <Award className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <span>新手每日交易复盘最佳实践路线 (Daily Routine)</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 space-y-1">
              <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400">01. 盘后同步</span>
              <div className="font-bold text-gray-900 dark:text-white">点击【实盘同步】</div>
              <p className="text-gray-400 text-[11px]">秒级拉取当日平仓的所有成交单。</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 space-y-1">
              <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400">02. 总体审视</span>
              <div className="font-bold text-gray-900 dark:text-white">查看【仪表盘】</div>
              <p className="text-gray-400 text-[11px]">确认当日盈亏、胜率与资金曲线走向。</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 space-y-1">
              <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400">03. 抽屉归因</span>
              <div className="font-bold text-gray-900 dark:text-white">在【交易明细】筛选</div>
              <p className="text-gray-400 text-[11px]">筛选亏损单或异常止损单，抽屉内查因。</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 space-y-1">
              <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400">04. 动态重放</span>
              <div className="font-bold text-gray-900 dark:text-white">K线逐帧打点复盘</div>
              <p className="text-gray-400 text-[11px]">播放当时行情，排查出场是否过早或扛单。</p>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#111827] border border-gray-200 dark:border-white/10 space-y-1">
              <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400">05. 日历撰写</span>
              <div className="font-bold text-gray-900 dark:text-white">记录【交易日记】</div>
              <p className="text-gray-400 text-[11px]">在日历中填写每日反思笔记并保存。</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TutorialPage;
