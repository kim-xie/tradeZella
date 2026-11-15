import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Button from './common/Button';
import { SERVER_BASE_URL as API_BASE_URL, getMT5Status, syncMT5Trades, MT5StatusData } from '../services/api';
import { RefreshCw, Upload, CheckCircle2, AlertCircle, Laptop, Download, Database } from 'lucide-react';

interface CSVUploaderProps {
  onUploadSuccess: () => void;
}

const CSVUploader: React.FC<CSVUploaderProps> = ({ onUploadSuccess }) => {
  const [activeTab, setActiveTab] = useState<'mt5' | 'csv'>('mt5');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncDays, setSyncDays] = useState<number>(30);
  const [syncAll, setSyncAll] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mt5Status, setMt5Status] = useState<MT5StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

  useEffect(() => {
    fetchMt5Status();
  }, []);

  const fetchMt5Status = async () => {
    try {
      setLoadingStatus(true);
      const data = await getMT5Status();
      setMt5Status(data);
    } catch {
      setMt5Status({ connected: false });
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFile(event.target.files[0]);
      setError(null);
      setSuccessMessage(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('请先选择要上传的 CSV 文件。');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('未检测到登录 Token，请先登录。');
        setUploading(false);
        return;
      }

      const response = await axios.post(`${API_BASE_URL}/api/trades/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${token}`,
        },
      });

      setSuccessMessage(response.data.message || '上传成功！已成功导入交易数据。');
      setSelectedFile(null);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || '文件上传与解析失败，请检查 CSV 格式。');
    } finally {
      setUploading(false);
    }
  };

  const handleMT5Sync = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await syncMT5Trades({
        days: syncDays,
        all: syncAll,
        limit: 2000,
      });

      const msg = res.message || (res.count > 0 ? `成功从 MT5 同步导入 ${res.count} 笔交易！` : '所有交易已是最新的，无新增订单。');
      setSuccessMessage(msg);
      onUploadSuccess();
    } catch (err: any) {
      setError(err.message || '同步 MT5 交易失败，请确保本地 MT5 终端正在运行并允许交易接口。');
    } finally {
      setSyncing(false);
    }
  };

  const downloadSampleTradeZenCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "symbol,direction,size,entryPrice,exitPrice,entryTime,exitTime,manualPnl,stopLoss,takeProfit,notes,tags\n" +
      "EURUSD,long,1.0,1.10250,1.10650,2026-11-10 09:30:00,2026-11-10 15:45:00,400.00,1.09900,1.10800,Trend Breakout,Forex;Trend\n" +
      "XAUUSD,short,0.5,3885.20,3870.50,2026-11-11 14:00:00,2026-11-11 18:20:00,735.00,3895.00,3865.00,Resistance Rejection,Gold";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "tradezen_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSampleMT5CSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Position,Time,Symbol,Type,Volume,Price,S / L,T / P,Time,Price,Commission,Swap,Profit\n" +
      "50671100,2026.11.14 03:34:56,NAS100,sell,0.10,27828.9,0.0,0.0,2026.11.14 06:51:12,28005.1,0.00,0.00,-17.62\n" +
      "50670977,2026.11.14 03:22:42,XAUUSD,buy,1.00,3880.91,0.0,0.0,2026.11.14 03:35:59,3882.82,0.00,0.00,191.00";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mt5_report_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSampleMT4CSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Ticket,Open Time,Type,Size,Item,Price,S / L,T / P,Close Time,Price,Commission,Taxes,Swap,Profit\n" +
      "10823901,2026.11.13 14:20:00,buy,0.50,EURUSD,1.08500,1.08200,1.09100,2026.11.13 18:35:10,1.08950,-3.50,0.00,0.00,225.00\n" +
      "10824055,2026.11.14 09:15:30,sell,1.00,GBPUSD,1.26800,1.27200,1.26200,2026.11.14 11:40:00,1.26420,-7.00,0.00,-1.20,380.00";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "mt4_report_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-navy-900/50 rounded-xl mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
            <Database className="w-5 h-5 text-purple-600" />
            <span>导入历史交易记录（复盘与统计）</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 ml-1">
              智能防重已开启
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            支持 MT5 终端直连及报表导入（内置单号指纹比对，多次同步绝不重复）
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="flex space-x-1 mt-3 sm:mt-0 bg-gray-200 dark:bg-navy-800 p-1 rounded-lg">
          <button
            onClick={() => { setActiveTab('mt5'); setError(null); setSuccessMessage(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 ${
              activeTab === 'mt5'
                ? 'bg-white dark:bg-navy-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>MT5 终端直连</span>
          </button>
          <button
            onClick={() => { setActiveTab('csv'); setError(null); setSuccessMessage(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 ${
              activeTab === 'csv'
                ? 'bg-white dark:bg-navy-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>CSV 报表导入</span>
          </button>
        </div>
      </div>

      {/* Tab 1: MT5 直连 */}
      {activeTab === 'mt5' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-navy-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className={`mt-0.5 p-2 rounded-full ${mt5Status?.connected ? 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                {mt5Status?.connected ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-white">
                    {mt5Status?.connected ? 'MetaTrader 5 终端已连接' : '未检测到 MT5 终端或未启动'}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                    mt5Status?.connected 
                      ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {mt5Status?.connected ? 'Live API Connected' : 'Terminal Offline'}
                  </span>
                </div>
                {mt5Status?.connected && mt5Status.account ? (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-x-3">
                    <span>账号: <b>{mt5Status.account.login}</b> ({mt5Status.account.name || 'Trader'})</span>
                    <span>服务器: <b>{mt5Status.account.server}</b></span>
                    <span>余额: <b>${mt5Status.account.balance.toFixed(2)} {mt5Status.account.currency}</b></span>
                    <span>品种数: <b>{mt5Status.symbolsTotal}</b></span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    请打开本地 MT5 客户端（无需额外配置），系统将通过 Python MT5 协议直连读取您的平仓交易单。
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 self-end md:self-auto">
              <button
                type="button"
                onClick={fetchMt5Status}
                disabled={loadingStatus}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-navy-700 transition"
                title="刷新 MT5 状态"
              >
                <RefreshCw className={`w-4 h-4 ${loadingStatus ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">同步范围:</span>
            {[
              { label: '最近 7 天', days: 7, all: false },
              { label: '最近 30 天', days: 30, all: false },
              { label: '最近 90 天', days: 90, all: false },
              { label: '全部历史 (All Deals)', days: 3650, all: true },
            ].map(opt => (
              <button
                key={opt.label}
                type="button"
                onClick={() => { setSyncDays(opt.days); setSyncAll(opt.all); }}
                className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                  (syncAll === opt.all && (syncAll || syncDays === opt.days))
                    ? 'border-purple-600 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-semibold shadow-sm'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-navy-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}

            <div className="ml-auto flex items-center space-x-3">
              <span className="hidden sm:inline-flex items-center text-[11px] text-gray-400 dark:text-gray-500">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                已开启智能防重 (增量同步)
              </span>
              <Button
                onClick={handleMT5Sync}
                disabled={syncing || !mt5Status?.connected}
                variant="gradient"
                className="text-xs py-2 px-4 shadow-md flex items-center space-x-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? '正在从 MT5 抓取...' : '一键同步 MT5 交易到日志'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: CSV 上传 */}
      {activeTab === 'csv' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-900 dark:text-gray-300
                         file:mr-4 file:py-2 file:px-4
                         file:rounded-md file:border-0
                         file:text-sm file:font-semibold
                         file:bg-purple-50 file:text-purple-700
                         dark:file:bg-purple-900/40 dark:file:text-purple-300
                         hover:file:bg-purple-100 dark:hover:file:bg-purple-900/60 cursor-pointer"
            />
            <Button
              onClick={handleUpload}
              disabled={uploading || !selectedFile}
              variant="gradient"
              className="w-full sm:w-auto text-xs py-2 px-5 whitespace-nowrap"
            >
              {uploading ? '正在解析导入...' : '开始导入 CSV'}
            </Button>
          </div>

          <div className="flex flex-col space-y-2 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                支持券商与终端: MT5、MT4 报表及 TradeZen / TradeZella 标准 CSV。系统智能自动识别字段并自动关联平台标签与手续费计算。
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-gray-400">下载示例文件:</span>
              <button
                type="button"
                onClick={downloadSampleMT5CSV}
                className="text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800"
              >
                <Download className="w-3 h-3" />
                <span>MT5 报表</span>
              </button>
              <button
                type="button"
                onClick={downloadSampleMT4CSV}
                className="text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800"
              >
                <Download className="w-3 h-3" />
                <span>MT4 报表</span>
              </button>
              <button
                type="button"
                onClick={downloadSampleTradeZenCSV}
                className="text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1 bg-gray-100 dark:bg-navy-800 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700"
              >
                <Download className="w-3 h-3" />
                <span>TradeZen 标准</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg flex items-center space-x-2 text-xs text-green-700 dark:text-green-300">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};

export default CSVUploader;
