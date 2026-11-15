import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';
import SectionHeading from '../components/common/SectionHeading';
import FAQ from '../components/common/FAQ';
import { 
  ShieldCheck, RefreshCw, Upload, Terminal, Key, 
  CheckCircle2, ArrowRight, FileText, ChevronDown, 
  ChevronUp, ExternalLink, Sparkles
} from 'lucide-react';

interface SupportedPlatform {
  id: string;
  name: string;
  category: 'forex' | 'crypto';
  categoryLabel: string;
  marketTypes: string[];
  description: string;
  syncMethods: string[];
  highlights: string[];
  guideAnchor: string;
  badgeColor: string;
  gradient: string;
}

const supportedPlatforms: SupportedPlatform[] = [
  {
    id: 'mt5',
    name: 'MetaTrader 5 (MT5)',
    category: 'forex',
    categoryLabel: '外汇 & 差价合约',
    marketTypes: ['外汇', '现货黄金/白银', '原油', '全球股指 (US30/NAS100)', '加密CFD'],
    description: '全球主流多资产交易终端。支持本地客户端原生 IPC 管道零配置一键同步实盘历史 Deals，并支持报表 CSV/HTML 解析导入。',
    syncMethods: ['本地终端 IPC 直连 (一键同步)', 'Deals / Orders 报表 CSV 导出导入'],
    highlights: ['自动识别 SL / TP 点位', '净盈亏精确计算 (扣除隔夜费Swap与手续费)', '单边与双向持仓模式兼容', '极速本地数据通信'],
    guideAnchor: 'guide-mt5',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    gradient: 'from-blue-600 to-indigo-600'
  },
  {
    id: 'mt4',
    name: 'MetaTrader 4 (MT4)',
    category: 'forex',
    categoryLabel: '外汇 & 黄金',
    marketTypes: ['主流外汇货币对', '贵金属 (XAUUSD)', '大宗商品', '指数差价合约'],
    description: '外汇市场使用最广泛的经典终端。支持 Account History 历史报表 (Detailed Statement) 及 CSV 自动化解析导入。',
    syncMethods: ['Account History 详细报表 CSV 导入', 'EA WebHook 自动化推送 (即将上线)'],
    highlights: ['标准 Detailed Statement 表头智能对齐', '税费 (Taxes) 与隔夜利息自动结算', '多语言报表自适应解析', '历史平仓单毫秒级回溯'],
    guideAnchor: 'guide-mt4',
    badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    gradient: 'from-sky-500 to-blue-600'
  }
];

export default function BrokerSupportPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'mt5' | 'mt4'>('all');
  const [expandedGuide, setExpandedGuide] = useState<string>('guide-mt5');

  const filteredPlatforms = supportedPlatforms.filter(platform => {
    const matchesSearch = platform.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          platform.marketTypes.some(m => m.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          platform.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || platform.id === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="py-20 bg-gray-50 dark:bg-[#070a13] min-h-screen text-gray-900 dark:text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* 页头标语 */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-4 border border-purple-200 dark:border-purple-800/60">
            <Sparkles className="w-3.5 h-3.5" />
            <span>专注 MetaTrader 生态 · 深度支持 MT5 与 MT4</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            券商与终端支持中心
          </h1>
          <p className="mt-4 text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            TradeZen 目前重点专注为 <b>MetaTrader 5 (MT5) 与 MetaTrader 4 (MT4)</b> 提供原生直连与智能报表解析。通过只读权限与本地通信，保障资金绝对安全。
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <RouterLink
              to="/features/broker-integration"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md hover:shadow-lg transition flex items-center space-x-1.5"
            >
              <span>进入接入与同步管理</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </RouterLink>
            <RouterLink
              to="/trades"
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-[#0b0f19] border border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5 transition"
            >
              <span>查看交易日志</span>
            </RouterLink>
          </div>
        </div>

        {/* 搜索与分类 Tab */}
        <div className="mt-12 max-w-2xl mx-auto space-y-4">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索平台、交易品种 (例如 MT5、MT4、XAUUSD、EURUSD)..."
              className="w-full px-4 py-3 pl-11 text-sm border border-gray-300 dark:border-white/10 rounded-2xl shadow-sm focus:ring-2 focus:ring-purple-500 focus:outline-none dark:bg-[#0b0f19] dark:text-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg 
              className="w-5 h-5 text-gray-400 absolute left-3.5 top-3.5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex justify-center space-x-2">
            {[
              { key: 'all', label: '全部终端 (2)' },
              { key: 'mt5', label: 'MetaTrader 5 (MT5)' },
              { key: 'mt4', label: 'MetaTrader 4 (MT4)' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveCategory(tab.key as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
                  activeCategory === tab.key
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white dark:bg-[#0b0f19] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 平台卡片网格 */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredPlatforms.map((platform, index) => (
            <motion.div
              key={platform.id}
              className="bg-white dark:bg-[#0b0f19] border border-gray-200/80 dark:border-white/10 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-purple-500/40 transition flex flex-col justify-between"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${platform.gradient} text-white flex items-center justify-center font-bold text-sm shadow-md`}>
                      {platform.id.toUpperCase().slice(0, 3)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                        {platform.name}
                      </h3>
                      <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border mt-0.5 ${platform.badgeColor}`}>
                        {platform.categoryLabel}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    现已支持 (Active)
                  </span>
                </div>

                <p className="mt-4 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                  {platform.description}
                </p>

                {/* 涵盖品种 */}
                <div className="mt-4">
                  <span className="text-[11px] text-gray-400 block mb-1.5 font-medium">支持交易品种:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {platform.marketTypes.map((m, i) => (
                      <span 
                        key={i} 
                        className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-300"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 同步方式与亮点 */}
                <div className="mt-4 space-y-1.5 pt-3 border-t border-gray-100 dark:border-white/5">
                  <span className="text-[11px] text-gray-400 block mb-1 font-medium">同步方式与特性:</span>
                  {platform.syncMethods.map((sm, i) => (
                    <div key={i} className="text-xs text-purple-700 dark:text-purple-300 flex items-center space-x-1.5 font-medium">
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      <span>{sm}</span>
                    </div>
                  ))}
                  <div className="pt-2 grid grid-cols-2 gap-1.5">
                    {platform.highlights.map((hl, i) => (
                      <div key={i} className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="truncate">{hl}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                <button
                  onClick={() => {
                    setExpandedGuide(platform.guideAnchor);
                    const el = document.getElementById(platform.guideAnchor);
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center space-x-1"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>查看接入教程</span>
                </button>

                <RouterLink
                  to="/features/broker-integration"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 transition shadow-xs flex items-center space-x-1"
                >
                  <span>立即接入</span>
                  <ArrowRight className="w-3 h-3" />
                </RouterLink>
              </div>
            </motion.div>
          ))}
        </div>

        {/* 详细接入教程板块 */}
        <div className="mt-20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              平台接入与报表导出教程
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
              按步骤快速完成您的 MT5 或 MT4 交易记录导入与实时同步
            </p>
          </div>

          <div className="space-y-4 max-w-4xl mx-auto">
            
            {/* Guide 1: MT5 */}
            <div id="guide-mt5" className="bg-white dark:bg-[#0b0f19] border border-gray-200/80 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setExpandedGuide(expandedGuide === 'guide-mt5' ? '' : 'guide-mt5')}
                className="w-full p-5 text-left flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-white/5 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    MT5
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                      MetaTrader 5 (MT5) 本地直连与 Deals 报表导出指南
                    </h4>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      支持原生 IPC 零配置极速同步，或导出 CSV / HTML 报表导入
                    </span>
                  </div>
                </div>
                {expandedGuide === 'guide-mt5' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              {expandedGuide === 'guide-mt5' && (
                <div className="p-5 sm:p-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-black/20 text-xs sm:text-sm space-y-4 text-gray-700 dark:text-gray-300">
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200">
                    <span className="font-semibold">极速方式（推荐）：</span> 只要您在当前 Windows 电脑上运行着 MT5 客户端并登录账户，前往【交易日志】或【Broker Integration】页面点击“一键同步 MT5 交易”，系统便会通过原生进程通道直连读取平仓记录，无需手动导出。
                  </div>
                  <div>
                    <h5 className="font-bold text-gray-900 dark:text-white mb-2">手动导出报表导入步骤：</h5>
                    <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                      <li>打开 MetaTrader 5 桌面客户端，按快捷键 <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[11px]">Ctrl + T</kbd> 打开底部【工具箱 (Toolbox)】窗口。</li>
                      <li>切换至【历史 (History)】标签页。在列表空白处点击鼠标右键，在菜单中选择【交易 (Deals)】视图（确保记录包含持仓平仓及费用）。</li>
                      <li>再次鼠标右键，选择需要导出的时间范围（例如：全部历史 / 最近3个月）。</li>
                      <li>在右键菜单中点击【报告 (Report)】&rarr;【存储为 CSV (另存为 CSV)】或【Open XML / HTML】。</li>
                      <li>在 TradeZen 导入面板中，拖入该导出的 CSV 文件，系统将自动识别表头并完成入账！</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

            {/* Guide 2: MT4 */}
            <div id="guide-mt4" className="bg-white dark:bg-[#0b0f19] border border-gray-200/80 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm">
              <button
                onClick={() => setExpandedGuide(expandedGuide === 'guide-mt4' ? '' : 'guide-mt4')}
                className="w-full p-5 text-left flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-white/5 transition"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500 text-white font-bold text-xs flex items-center justify-center">
                    MT4
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                      MetaTrader 4 (MT4) 详细报表 (Detailed Statement) 导出指南
                    </h4>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      支持经典 MT4 历史账户报表解析，自动核算 Taxes、Swap 与盈亏
                    </span>
                  </div>
                </div>
                {expandedGuide === 'guide-mt4' ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
              </button>

              {expandedGuide === 'guide-mt4' && (
                <div className="p-5 sm:p-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/40 dark:bg-black/20 text-xs sm:text-sm space-y-4 text-gray-700 dark:text-gray-300">
                  <div>
                    <h5 className="font-bold text-gray-900 dark:text-white mb-2">详细导出操作：</h5>
                    <ol className="list-decimal list-inside space-y-2 leading-relaxed">
                      <li>打开 MT4 终端，按 <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 font-mono text-[11px]">Ctrl + T</kbd> 调出【终端 (Terminal)】窗口。</li>
                      <li>点击【账户历史 (Account History)】标签页。</li>
                      <li>在交易记录区域点击鼠标右键，选择【所有历史 (All History)】或自选周期。</li>
                      <li>再次鼠标右键，选择【保存为详细报表 (Save as Detailed Statement)】或【保存为报告 (Save as Report)】。</li>
                      <li>将生成的 CSV 报表（或在 Excel 中将导出的表格另存为 .csv）上传至 TradeZen。系统自动提取 Ticket、品种(Item)、开平仓时间、止盈止损及净盈亏。</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 常见问题 */}
        <div className="mt-20 border-t border-gray-200 dark:border-white/10 pt-16">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              券商与平台对接常见疑问 (FAQ)
            </h2>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              关于 MT5 / MT4 接入中的安全与数据结算问答
            </p>
          </div>
          <FAQ />
        </div>

      </div>
    </div>
  );
}
