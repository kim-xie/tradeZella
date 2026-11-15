import React, { useState, useEffect } from 'react';
import FeaturePageLayout from './FeaturePageLayout';
import Button from '../../components/common/Button';
import SEO from '../../components/common/SEO';
import axios from 'axios';
import { SERVER_BASE_URL as API_BASE_URL, syncMT5Trades } from '../../services/api';

interface Trade {
  id: string;
  userId: number;
  symbol: string;
  direction: 'buy' | 'sell' | 'short' | 'cover';
  size: number;
  entryPrice: number;
  exitPrice?: number;
  notes?: string;
  trade_date: string;
  tags?: string[];
  sentiment?: string;
  screenshots?: string[];
  createdAt: string;
  updatedAt: string;
}

interface AIAnalysis {
  id: string;
  tradeId: string;
  analysisType: string;
  results: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    emotionalState: string;
    riskAssessment: string;
  };
  createdAt: string;
}

export default function AutomatedJournalingPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [aiAnalyses, setAiAnalyses] = useState<Record<string, AIAnalysis>>({});
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'buy' | 'sell' | 'short' | 'cover'>('buy');
  const [size, setSize] = useState('');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [tradeDate, setTradeDate] = useState('');
  const [tags, setTags] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [screenshots, setScreenshots] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'manual' | 'broker' | 'file'>('manual');

  const fetchTrades = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/trades`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrades(response.data.data);
    } catch (err) {
      setError('获取交易记录失败，请检查网络或重新登录。');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIAnalysis = async (tradeId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/ai-analysis/${tradeId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAiAnalyses(prev => ({
        ...prev,
        [tradeId]: response.data.data
      }));
    } catch (err) {
      console.error('获取 AI 诊断失败。', err);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, []);

  const handleSaveTrade = async () => {
    if (!symbol || !tradeDate || !entryPrice || !size) {
      alert('请填写所有必填字段：交易标的、交易日期、入场价格、手数。');
      return;
    }

    const newTradeData = {
      symbol,
      direction,
      size: parseFloat(size),
      entryPrice: parseFloat(entryPrice),
      exitPrice: exitPrice ? parseFloat(exitPrice) : undefined,
      notes: notes || undefined,
      tradeDate,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : undefined,
      sentiment: sentiment || undefined,
      screenshots: screenshots ? screenshots.split(',').map(url => url.trim()) : undefined,
    };

    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/trades`, newTradeData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrades(prevTrades => [...prevTrades, response.data.data]);
      
      // Trigger AI analysis for the new trade
      await fetchAIAnalysis(response.data.data.id);
      
      // Clear form
      setSymbol('');
      setDirection('buy');
      setSize('');
      setEntryPrice('');
      setExitPrice('');
      setNotes('');
      setTradeDate('');
      setTags('');
      setSentiment('');
      setScreenshots('');
    } catch (err) {
      setError('保存交易记录失败。');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleBrokerSync = async () => {
    try {
      setSaving(true);
      setError(null);
      const res = await syncMT5Trades({ days: 30 });
      alert(res.message || `成功从 MT5 同步 ${res.count || 0} 笔实盘平仓交易！`);
      fetchTrades(); // Refresh the trades list
    } catch (err: any) {
      setError(err.message || '从经纪商同步交易失败。');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/trades/import`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`
        }
      });
      alert(`成功从文件解析并导入 ${response.data.data.importedCount} 笔交易记录！`);
      fetchTrades(); // Refresh the trades list
    } catch (err) {
      setError('导入交易文件失败，请确保格式正确。');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const requestAIAnalysis = async (tradeId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(`${API_BASE_URL}/api/ai-analysis/analyze-trade/${tradeId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAiAnalyses(prev => ({
        ...prev,
        [tradeId]: response.data.data
      }));
    } catch (err) {
      console.error('请求 AI 分析失败。', err);
    }
  };

  return (
    <>
      <SEO 
        title="自动交易日志与智能复盘"
        description="AI 驱动的交易分析、经纪商自动记账同步，以及支持胜率、盈亏比与心态追踪的多维复盘日志。"
        keywords="交易日志, 智能复盘, AI交易分析, MT5同步, 交易追踪, 绩效统计"
        url="https://tradezen.app/features/journaling"
      />
      <FeaturePageLayout
        title="自动化交易日志 (Journaling)"
        description="告别繁琐的手动 Excel 记账。支持 MT5/MT4 直连同步、报表智能解析与 AI 行为诊断，让每一次下单都知行合一。"
        image="/assets/1.png"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white dark:bg-[#0b0f19] p-6 sm:p-7 rounded-2xl shadow-sm border border-gray-200/80 dark:border-white/10">
            <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">录入与同步交易</h2>
            
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 dark:border-white/10 mb-4">
              <button
                className={`py-2 px-3 text-xs font-semibold transition ${activeTab === 'manual' ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                onClick={() => setActiveTab('manual')}
              >
                手动快速记账
              </button>
              <button
                className={`py-2 px-3 text-xs font-semibold transition ${activeTab === 'broker' ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                onClick={() => setActiveTab('broker')}
              >
                经纪商直连同步
              </button>
              <button
                className={`py-2 px-3 text-xs font-semibold transition ${activeTab === 'file' ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                onClick={() => setActiveTab('file')}
              >
                历史报表上传
              </button>
            </div>
            
            {error && <p className="text-red-500 mb-4 text-xs">{error}</p>}
            
            {activeTab === 'manual' && (
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="标的代码 (例如：EURUSD, XAUUSD)"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <input
                  type="date"
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as 'buy' | 'sell' | 'short' | 'cover')}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                >
                  <option value="buy">做多买入 (Buy/Long)</option>
                  <option value="sell">做空卖出 (Sell/Short)</option>
                  <option value="short">卖空 (Short)</option>
                  <option value="cover">平仓平多 (Cover)</option>
                </select>
                <input
                  type="number"
                  placeholder="成交手数 (Size/Lots)"
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="入场价格 (Entry Price)"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <input
                  type="number"
                  placeholder="出场价格 (Exit Price，可选)"
                  value={exitPrice}
                  onChange={(e) => setExitPrice(e.target.value)}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="标签 (逗号分隔，如：顺势突破, 严格止损)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <select
                  value={sentiment}
                  onChange={(e) => setSentiment(e.target.value)}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                >
                  <option value="">选择入场心理/情绪状态</option>
                  <option value="confident">从容自信 (Confident)</option>
                  <option value="fearful">恐慌担忧 (Fearful)</option>
                  <option value="greedy">贪婪追高 (Greedy)</option>
                  <option value="regretful">懊悔冲动 (Regretful)</option>
                  <option value="neutral">平和理性 (Neutral)</option>
                </select>
                <input
                  type="text"
                  placeholder="走势图截图链接 (以逗号分隔)"
                  value={screenshots}
                  onChange={(e) => setScreenshots(e.target.value)}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
                <textarea
                  placeholder="记录开仓逻辑、止损止盈设置原因与复盘体会..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-navy-950 focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  rows={3}
                />
                <Button 
                  variant="gradient" 
                  onClick={handleSaveTrade} 
                  className={`w-full ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={saving}
                >
                  {saving ? '正在保存...' : '保存交易记录'}
                </Button>
              </div>
            )}
            
            {activeTab === 'broker' && (
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">
                  一键连接本地 MetaTrader 5 或主流交易所，系统将自动读取已平仓订单并进行点位、盈亏比核算。
                </p>
                <Button 
                  variant="gradient" 
                  onClick={handleBrokerSync} 
                  className="w-full"
                  disabled={saving}
                >
                  {saving ? '正在同步...' : '立即从 MT5 同步数据'}
                </Button>
                <div className="mt-4">
                  <h3 className="font-medium text-xs mb-2">已支持对接平台:</h3>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
                    <li className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">MetaTrader 5 (MT5 本地实盘直连)</span>
                      </div>
                      <span className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 text-[10px] px-2 py-0.5 rounded font-medium">支持</span>
                    </li>
                    <li className="flex items-center justify-between py-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">MetaTrader 4 (MT4 报表导入)</span>
                      </div>
                      <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded font-medium">支持</span>
                    </li>
                  </ul>
                </div>
              </div>
            )}
            
            {activeTab === 'file' && (
              <div className="space-y-4">
                <p className="text-gray-600 dark:text-gray-300 text-xs">
                  上传包含您交易数据的 CSV、XLSX 或 MT4/MT5 详细对账单文件。
                </p>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
                  <input 
                    type="file" 
                    accept=".csv,.xlsx,.xls" 
                    onChange={handleFileUpload}
                    className="hidden" 
                    id="file-upload"
                  />
                  <label 
                    htmlFor="file-upload" 
                    className="cursor-pointer text-purple-600 hover:text-purple-800"
                  >
                    <div className="flex flex-col items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-xs font-semibold">点击上传交易流水对账单</span>
                      <p className="text-[10px] text-gray-500 mt-1">支持 CSV、XLSX 或 XLS 格式</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
          
          <div className="lg:col-span-2 bg-white dark:bg-[#0b0f19] p-6 sm:p-7 rounded-2xl shadow-sm border border-gray-200/80 dark:border-white/10">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 dark:border-white/10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">交易日志流水记录</h2>
              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                已记录 {trades.length} 笔交易
              </div>
            </div>
            
            {loading ? (
              <p className="text-gray-500 dark:text-gray-400 text-xs py-8 text-center">正在加载交易流水...</p>
            ) : trades.length === 0 ? (
              <div className="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-600 dark:text-gray-300 font-medium text-sm mb-1">暂无交易流水记录</p>
                <p className="text-gray-400 text-xs">使用左侧表单手动录入，或点击「经纪商直连同步」连接 MT5</p>
              </div>
            ) : (
              <div className="space-y-4">
                {trades.map((trade) => (
                  <div key={trade.id} className="border border-gray-200 dark:border-white/10 rounded-xl p-4 bg-gray-50/50 dark:bg-[#070a13] hover:shadow-sm transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center">
                          <h3 className="text-base font-bold font-mono text-gray-900 dark:text-white">{trade.symbol}</h3>
                          <span className={`ml-2 px-2 py-0.5 text-xs font-mono font-bold rounded ${
                            trade.direction === 'buy' || trade.direction === 'cover' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300' 
                              : 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          }`}>
                            {trade.direction.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mt-1 font-mono">
                          {new Date(trade.trade_date).toLocaleDateString()} • 
                          手数: {trade.size} • 
                          入场: ${trade.entryPrice}
                          {trade.exitPrice && ` • 出场: $${trade.exitPrice}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <button 
                          onClick={() => requestAIAnalysis(trade.id)}
                          className="text-xs bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 px-2.5 py-1 rounded hover:bg-purple-200 transition font-medium"
                        >
                          AI 复盘诊断
                        </button>
                        <p className="text-[10px] text-gray-400 mt-1 font-mono">
                          {new Date(trade.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    {trade.notes && (
                      <p className="mt-2 text-gray-600 dark:text-gray-300 text-xs leading-relaxed">{trade.notes}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {trade.tags?.map((tag, index) => (
                        <span key={index} className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] px-2 py-0.5 rounded font-mono">
                          #{tag}
                        </span>
                      ))}
                      {trade.sentiment && (
                        <span className="bg-yellow-50 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300 text-[10px] px-2 py-0.5 rounded">
                          心理: {trade.sentiment}
                        </span>
                      )}
                    </div>
                    
                    {aiAnalyses[trade.id] && (
                      <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-800/40">
                        <h4 className="font-bold text-purple-900 dark:text-purple-300 text-xs">AI 智能诊断与反思建议</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          <div>
                            <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">操作亮点 (Strengths)</p>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside mt-0.5">
                              {aiAnalyses[trade.id].results.strengths.slice(0, 2).map((strength, i) => (
                                <li key={i}>{strength}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">优化建议 (Recommendations)</p>
                            <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc list-inside mt-0.5">
                              {aiAnalyses[trade.id].results.recommendations.slice(0, 2).map((rec, i) => (
                                <li key={i}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="mt-2 text-xs border-t border-purple-100 dark:border-purple-800/40 pt-1.5 text-gray-700 dark:text-gray-300">
                          <span className="font-bold">风控与纪律评估:</span> {aiAnalyses[trade.id].results.riskAssessment}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </FeaturePageLayout>
    </>
  );
}