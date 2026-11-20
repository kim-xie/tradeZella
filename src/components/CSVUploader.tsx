import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Button from './common/Button';
import DateRangePicker from './common/DateRangePicker';
import { SERVER_BASE_URL as API_BASE_URL, getMT5Status, syncMT5Trades, getSyncToken, MT5StatusData } from '../services/api';
import { useRealtimeTrades } from '../services/realtime';
import { RefreshCw, Upload, CheckCircle2, AlertCircle, Laptop, Download, Database, FileSpreadsheet, FileCode, Radio, Copy, Check, BarChart2, Zap, Calendar, X, Globe } from 'lucide-react';

export interface UploadSuccessInfo {
  count?: number;
  message?: string;
  platform?: string;
  skippedCount?: number;
}

interface CSVUploaderProps {
  onUploadSuccess: (info?: UploadSuccessInfo) => void;
}

export type SyncRangePreset = 'week' | 'month' | 'year' | 'all' | 'days30' | 'custom';

const padZero = (n: number) => String(n).padStart(2, '0');
const formatDateYMD = (d: Date) => `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;

const getRangeConfig = (
  preset: SyncRangePreset,
  customStart: string,
  customEnd: string
) => {
  const now = new Date();
  const todayStr = formatDateYMD(now);

  if (preset === 'week') {
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const startStr = formatDateYMD(monday);
    return {
      startDate: startStr,
      endDate: todayStr,
      all: false,
      dateLabel: `${startStr} 至 至今（本周）`,
    };
  }

  if (preset === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const startStr = formatDateYMD(firstDay);
    return {
      startDate: startStr,
      endDate: todayStr,
      all: false,
      dateLabel: `${startStr} 至 至今（本月）`,
    };
  }

  if (preset === 'year') {
    const firstDay = new Date(now.getFullYear(), 0, 1);
    const startStr = formatDateYMD(firstDay);
    return {
      startDate: startStr,
      endDate: todayStr,
      all: false,
      dateLabel: `${startStr} 至 至今（今年）`,
    };
  }

  if (preset === 'days30') {
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startStr = formatDateYMD(d30);
    return {
      startDate: startStr,
      endDate: todayStr,
      all: false,
      days: 30,
      dateLabel: `${startStr} 至 至今（最近30天）`,
    };
  }

  if (preset === 'all') {
    return {
      startDate: '2010-01-01',
      endDate: todayStr,
      all: true,
      dateLabel: '全量历史平仓订单',
    };
  }

  return {
    startDate: customStart || todayStr,
    endDate: customEnd || todayStr,
    all: false,
    dateLabel: `${customStart || todayStr} 至 ${customEnd || todayStr}（自定义区间）`,
  };
};

const CSVUploader: React.FC<CSVUploaderProps> = ({ onUploadSuccess }) => {
  const [activeTab, setActiveTab] = useState<'mt5' | 'file' | 'ea'>('mt5');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [liveOrderSync, setLiveOrderSync] = useState<boolean>(true);
  const [rangePreset, setRangePreset] = useState<SyncRangePreset>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return formatDateYMD(d);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => formatDateYMD(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sourceTimezone, setSourceTimezone] = useState<string>('broker');
  const [mt5Status, setMt5Status] = useState<MT5StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);

  // EA Token state
  const [eaToken, setEaToken] = useState<string>('');
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [loadingToken, setLoadingToken] = useState<boolean>(false);
  const { isConnected: isRealtimeConnected } = useRealtimeTrades();

  useEffect(() => {
    fetchMt5Status();
  }, []);

  // 实时增量同步轮询：默认开启，当 MT5 终端在线且开关启用时，定时增量抓取最新订单；关闭开关可预防自动同步
  useEffect(() => {
    if (!liveOrderSync || !mt5Status?.connected) return;

    const interval = setInterval(async () => {
      try {
        const range = getRangeConfig(rangePreset, customStartDate, customEndDate);
        const res = await syncMT5Trades({
          startDate: range.startDate,
          endDate: range.endDate,
          all: range.all,
          days: (range as any).days,
          limit: 1000,
        });
        if (res && res.count > 0) {
          setSuccessMessage(`[实时增量同步] 自动检测到并成功入库 ${res.count} 笔最新平仓交易！`);
          onUploadSuccess();
        }
      } catch {
        // 静默捕获后台自动轮询的错误
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [liveOrderSync, mt5Status?.connected, rangePreset, customStartDate, customEndDate, onUploadSuccess]);

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

  const fetchEAToken = async () => {
    try {
      setLoadingToken(true);
      const token = await getSyncToken();
      setEaToken(token);
    } catch (err: any) {
      console.warn('Failed to load EA sync token:', err);
    } finally {
      setLoadingToken(false);
    }
  };

  const handleCopyText = (text: string, type: 'token' | 'url') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
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
      setError('请先选择要上传的报表文件（支持 HTML、XML、Excel、CSV、TSV 格式）。');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('timezone', sourceTimezone);

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

      const resData = response.data || {};
      const count = resData.count ?? 0;
      const skippedCount = resData.skippedCount ?? 0;
      const platform = resData.platform || '报表';
      const msg = resData.message || (count > 0 ? `成功从 ${platform} 解析导入 ${count} 笔交易！` : '上传成功！');

      setSuccessMessage(msg);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadSuccess({
        count,
        skippedCount,
        message: msg,
        platform,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || '文件上传与解析失败，请检查文件格式。');
    } finally {
      setUploading(false);
    }
  };

  const handleMT5Sync = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMessage(null);

    const range = getRangeConfig(rangePreset, customStartDate, customEndDate);

    try {
      const res = await syncMT5Trades({
        startDate: range.startDate,
        endDate: range.endDate,
        all: range.all,
        days: (range as any).days,
        limit: 3000,
      });

      const msg = res.message || (res.count > 0 ? `成功从 MT5 同步导入 ${res.count} 笔交易！` : '所有交易已是最新的，无新增订单。');
      setSuccessMessage(msg);
      onUploadSuccess({
        count: res.count,
        skippedCount: res.skippedCount,
        message: msg,
        platform: 'MT5',
      });
    } catch (err: any) {
      setError(err.message || '同步 MT5 交易失败，请确保本地 MT5 终端正在运行并允许交易接口。');
    } finally {
      setSyncing(false);
    }
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadSampleMT4HTML = () => {
    const htmlContent = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">
<html>
<head><title>Statement: 108239 - Trader</title></head>
<body>
<table cellspacing=1 cellpadding=2 border=0 width=800>
  <tr bgcolor="#C0C0C0" align="right">
    <th>Ticket</th><th>Open Time</th><th>Type</th><th>Size</th><th>Item</th><th>Price</th><th>S / L</th><th>T / P</th><th>Close Time</th><th>Price</th><th>Commission</th><th>Taxes</th><th>Swap</th><th>Profit</th>
  </tr>
  <tr bgcolor="#FFFFFF" align="right">
    <td>10823901</td><td>2026.11.13 14:20:00</td><td>buy</td><td>0.50</td><td>EURUSD</td><td>1.08500</td><td>1.08200</td><td>1.09100</td><td>2026.11.13 18:35:10</td><td>1.08950</td><td>-3.50</td><td>0.00</td><td>0.00</td><td>225.00</td>
  </tr>
  <tr bgcolor="#FFFFFF" align="right">
    <td>10824055</td><td>2026.11.14 09:15:30</td><td>sell</td><td>1.00</td><td>GBPUSD</td><td>1.26800</td><td>1.27200</td><td>1.26200</td><td>2026.11.14 11:40:00</td><td>1.26420</td><td>-7.00</td><td>0.00</td><td>-1.20</td><td>380.00</td>
  </tr>
  <tr bgcolor="#C0C0C0" align="right">
    <td colspan=12><b>Closed P/L:</b></td><td colspan=2><b>605.00</b></td>
  </tr>
</table>
</body>
</html>`;
    downloadFile(htmlContent, "mt4_statement_sample.htm", "text/html");
  };

  const downloadSampleMT5HTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Report: 500123</title></head>
<body>
<div class="header">Positions</div>
<table>
  <tr>
    <th>Time</th><th>Position</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Price</th><th>S / L</th><th>T / P</th><th>Time</th><th>Price</th><th>Commission</th><th>Swap</th><th>Profit</th>
  </tr>
  <tr>
    <td>2026.11.14 03:34:56</td><td>50671100</td><td>NAS100</td><td>sell</td><td>0.10</td><td>27828.9</td><td>28005.0</td><td>0.0</td><td>2026.11.14 06:51:12</td><td>28005.1</td><td>0.00</td><td>0.00</td><td>-17.62</td>
  </tr>
  <tr>
    <td>2026.11.14 03:22:42</td><td>50670977</td><td>XAUUSD</td><td>buy</td><td>1.00</td><td>3880.91</td><td>0.0</td><td>0.0</td><td>2026.11.14 03:35:59</td><td>3882.82</td><td>-5.00</td><td>0.00</td><td>191.00</td>
  </tr>
</table>
</body>
</html>`;
    downloadFile(htmlContent, "mt5_report_sample.html", "text/html");
  };

  const downloadSampleMT5XML = () => {
    const xmlContent = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Positions">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">Time</Data></Cell>
    <Cell><Data ss:Type="String">Position</Data></Cell>
    <Cell><Data ss:Type="String">Symbol</Data></Cell>
    <Cell><Data ss:Type="String">Type</Data></Cell>
    <Cell><Data ss:Type="String">Volume</Data></Cell>
    <Cell><Data ss:Type="String">Price</Data></Cell>
    <Cell><Data ss:Type="String">S / L</Data></Cell>
    <Cell><Data ss:Type="String">T / P</Data></Cell>
    <Cell><Data ss:Type="String">Time</Data></Cell>
    <Cell><Data ss:Type="String">Price</Data></Cell>
    <Cell><Data ss:Type="String">Commission</Data></Cell>
    <Cell><Data ss:Type="String">Swap</Data></Cell>
    <Cell><Data ss:Type="String">Profit</Data></Cell>
   </Row>
   <Row>
    <Cell><Data ss:Type="String">2026.11.14 03:34:56</Data></Cell>
    <Cell><Data ss:Type="Number">50671100</Data></Cell>
    <Cell><Data ss:Type="String">NAS100</Data></Cell>
    <Cell><Data ss:Type="String">sell</Data></Cell>
    <Cell><Data ss:Type="Number">0.10</Data></Cell>
    <Cell><Data ss:Type="Number">27828.9</Data></Cell>
    <Cell><Data ss:Type="Number">0.0</Data></Cell>
    <Cell><Data ss:Type="Number">0.0</Data></Cell>
    <Cell><Data ss:Type="String">2026.11.14 06:51:12</Data></Cell>
    <Cell><Data ss:Type="Number">28005.1</Data></Cell>
    <Cell><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="Number">0.00</Data></Cell>
    <Cell><Data ss:Type="Number">-17.62</Data></Cell>
   </Row>
  </Table>
 </Worksheet>
</Workbook>`;
    downloadFile(xmlContent, "mt5_report_sample.xml", "application/xml");
  };

  const downloadSampleTradeZenCSV = () => {
    const csvContent = "symbol,direction,size,entryPrice,exitPrice,entryTime,exitTime,manualPnl,stopLoss,takeProfit,notes,tags\n" +
      "EURUSD,long,1.0,1.10250,1.10650,2026-11-10 09:30:00,2026-11-10 15:45:00,400.00,1.09900,1.10800,Trend Breakout,Forex;Trend\n" +
      "XAUUSD,short,0.5,3885.20,3870.50,2026-11-11 14:00:00,2026-11-11 18:20:00,735.00,3895.00,3865.00,Resistance Rejection,Gold";
    downloadFile(csvContent, "tradezen_sample.csv", "text/csv");
  };

  const downloadSampleMT5CSV = () => {
    const csvContent = "Position,Time,Symbol,Type,Volume,Price,S / L,T / P,Time,Price,Commission,Swap,Profit\n" +
      "50671100,2026.11.14 03:34:56,NAS100,sell,0.10,27828.9,0.0,0.0,2026.11.14 06:51:12,28005.1,0.00,0.00,-17.62\n" +
      "50670977,2026.11.14 03:22:42,XAUUSD,buy,1.00,3880.91,0.0,0.0,2026.11.14 03:35:59,3882.82,0.00,0.00,191.00";
    downloadFile(csvContent, "mt5_report_sample.csv", "text/csv");
  };

  const apiEndpointUrl = `${API_BASE_URL}/api`;

  return (
    <div className="p-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-navy-900/50 rounded-xl mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
            <Database className="w-5 h-5 text-purple-600" />
            <span>交易与行情同步中心（复盘与统计）</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60 ml-1">
              智能防重已开启
            </span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            支持 MT5 终端直连、MQL EA 自动直推（订单+K线）及全格式离线报表导入
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="flex flex-wrap space-x-1 mt-3 sm:mt-0 bg-gray-200 dark:bg-navy-800 p-1 rounded-lg">
          <button
            onClick={() => { setActiveTab('mt5'); setError(null); setSuccessMessage(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 ${
              activeTab === 'mt5'
                ? 'bg-white dark:bg-navy-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>本地 MT5 直连</span>
          </button>
          <button
            onClick={() => { setActiveTab('ea'); setError(null); setSuccessMessage(null); fetchEAToken(); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 ${
              activeTab === 'ea'
                ? 'bg-white dark:bg-navy-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>MQL EA 自动直推 (订单+K线)</span>
          </button>
          <button
            onClick={() => { setActiveTab('file'); setError(null); setSuccessMessage(null); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center space-x-1.5 ${
              activeTab === 'file'
                ? 'bg-white dark:bg-navy-700 text-purple-600 dark:text-purple-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>报表文件导入 (全格式)</span>
          </button>
        </div>
      </div>

      {/* Tab 1: MT5 本地直连 */}
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
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300">
                    时区: 自动转上海时间 (UTC+8)
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

          {/* 实时增量同步控制开关栏 */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={liveOrderSync}
                onChange={(e) => setLiveOrderSync(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-2.5 font-medium text-gray-800 dark:text-gray-200 flex items-center">
                <span>实时增量同步开关</span>
                {liveOrderSync ? (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse"></span>
                    已开启（默认自动抓取增量订单）
                  </span>
                ) : (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 dark:bg-navy-700 dark:text-gray-400 border border-gray-300 dark:border-gray-600">
                    已关闭（已暂停实时同步，仅保留手动）
                  </span>
                )}
              </span>
            </label>

            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {liveOrderSync
                ? '保持开启：有新成交时每 45 秒静默检测入库'
                : '已停用实时同步，可预防不必要的自动更新'}
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">同步范围:</span>
              {[
                { label: '本周', preset: 'week' as const },
                { label: '本月', preset: 'month' as const },
                { label: '今年', preset: 'year' as const },
                { label: '全部', preset: 'all' as const },
                { label: '最近 30 天', preset: 'days30' as const },
                { label: '日历自选', preset: 'custom' as const },
              ].map(opt => (
                <button
                  key={opt.preset}
                  type="button"
                  onClick={() => {
                    setRangePreset(opt.preset);
                    if (opt.preset !== 'custom' && opt.preset !== 'all') {
                      const cfg = getRangeConfig(opt.preset, '', '');
                      setCustomStartDate(cfg.startDate);
                      setCustomEndDate(cfg.endDate);
                    }
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                    rangePreset === opt.preset
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

            {/* 当前选中范围提示与交互式日历范围选择器 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-gray-100/70 dark:bg-navy-900/40 px-3.5 py-2.5 rounded-lg border border-gray-200/70 dark:border-gray-700/60">
              <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                <span>目标范围：</span>
                <span className="font-semibold text-purple-700 dark:text-purple-300">
                  {getRangeConfig(rangePreset, customStartDate, customEndDate).dateLabel}
                </span>
              </div>

              {/* 现代双月份弹出式日历选择器 */}
              <div className="flex items-center space-x-2 self-start sm:self-auto">
                <span className="text-gray-500 dark:text-gray-400 text-xs hidden md:inline">日历选择：</span>
                <DateRangePicker
                  startDate={rangePreset === 'all' ? '' : customStartDate}
                  endDate={rangePreset === 'all' ? '' : customEndDate}
                  onChange={(start, end) => {
                    setCustomStartDate(start);
                    setCustomEndDate(end);
                    setRangePreset('custom');
                  }}
                  onClear={() => {
                    setRangePreset('all');
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: MQL EA 自动直推 */}
      {activeTab === 'ea' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-navy-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
                  <span className="flex items-center space-x-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>TradeZen MQL 同步网桥（EA 直推插件）</span>
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isRealtimeConnected
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                      : 'bg-gray-100 dark:bg-navy-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isRealtimeConnected ? 'bg-emerald-500 animate-ping' : 'bg-gray-400'}`} />
                    {isRealtimeConnected ? '网页实时接收端: 已就绪 (SSE推送到屏)' : '网页实时接收端: 连接中'}
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  挂载在图表上即可全自动将<b>平仓订单</b>与<b>历史K线数据</b>实时推送到远程服务器，零延迟且无需第三方收费服务。
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <a
                  href="/downloads/TradeZen_Sync_EA.mq5"
                  download="TradeZen_Sync_EA.mq5"
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-lg flex items-center space-x-1.5 shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载 MT5 EA (.mq5)</span>
                </a>
                <a
                  href="/downloads/TradeZen_Sync_EA.mq4"
                  download="TradeZen_Sync_EA.mq4"
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg flex items-center space-x-1.5 shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>下载 MT4 EA (.mq4)</span>
                </a>
              </div>
            </div>

            {/* 参数与密钥卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="bg-gray-50 dark:bg-navy-900/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    1. 远程服务 API 地址 (<code className="text-purple-600">InpServerUrl</code>)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(apiEndpointUrl, 'url')}
                    className="text-xs text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? '已复制' : '复制'}</span>
                  </button>
                </div>
                <div className="mt-1.5 p-2 bg-white dark:bg-navy-800 rounded font-mono text-xs text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 break-all select-all">
                  {apiEndpointUrl}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-navy-900/60 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    2. 个人专属同步密钥 (<code className="text-purple-600">InpApiToken</code>)
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={fetchEAToken}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                      title="刷新 Token"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingToken ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyText(eaToken, 'token')}
                      className="text-xs text-purple-600 hover:text-purple-700 flex items-center space-x-1"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken ? '已复制' : '复制密钥'}</span>
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 p-2 bg-white dark:bg-navy-800 rounded font-mono text-xs text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 truncate select-all">
                  {eaToken ? `${eaToken.substring(0, 32)}...` : '正在生成同步密钥...'}
                </div>
              </div>
            </div>

            {/* 4步快速指引 */}
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 block mb-2">
                4 步极速挂载使用说明：
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-[11px]">
                <div className="p-2.5 bg-gray-50 dark:bg-navy-900/40 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-semibold text-purple-600 dark:text-purple-400">第一步：放置 EA 插件</div>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    点击上方按钮下载 EA，拷贝到 MT5 的 <code className="bg-gray-200 dark:bg-navy-800 px-1 rounded">MQL5/Experts</code>（或 MT4 的 <code className="bg-gray-200 dark:bg-navy-800 px-1 rounded">MQL4/Experts</code>）目录。
                  </p>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-navy-900/40 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-semibold text-indigo-600 dark:text-indigo-400">第二步：开启 WebRequest</div>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    在客户端「工具」 $\to$ 「选项」 $\to$ 「EA交易」中勾选 <b>“允许 WebRequest 到所列的 URL”</b>，并将上方 API 网址添加到列表中。
                  </p>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-navy-900/40 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400">第三步：挂载并填入密钥</div>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    在导航器右键刷新，将 EA 拖到任意交易图表上，在“输入参数”中粘贴上方复制的 <b>InpServerUrl</b> 与 <b>InpApiToken</b>。
                  </p>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-navy-900/40 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-semibold text-amber-600 dark:text-amber-400">第四步：全自动双向同步</div>
                  <p className="mt-1 text-gray-500 dark:text-gray-400">
                    点击确定即可！EA 将在有新平仓订单时即时推送，并定时同步品种真实 K 线，在复盘图表中 100% 还原执行点位。
                  </p>
                </div>
              </div>

              {/* 订单范围与K线自定义范围与实时流同步说明 */}
              <div className="mt-3 p-3 bg-purple-50/60 dark:bg-purple-950/30 rounded-lg border border-purple-200/70 dark:border-purple-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-start space-x-2">
                  <BarChart2 className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-purple-900 dark:text-purple-200">
                      支持实时增量同步控制开关与灵活历史范围：
                    </span>
                    <p className="text-gray-600 dark:text-gray-400 text-[11px] mt-0.5">
                      • <b>实时增量订单同步开关</b>：参数 <code className="text-purple-700 dark:text-purple-300 font-mono">InpLiveOrderSync</code> 默认开启（<code className="text-emerald-600 font-semibold">true</code>），历史单同步后只要有新平仓将毫秒级自动推送；<b>若不需要实时同步，只需在 EA 输入参数中将其设为 false 即可预防自动同步</b>。<br />
                      • <b>订单历史范围</b>：在 EA 中配置 <code className="text-purple-700 dark:text-purple-300 font-mono">InpOrderSyncMode</code>，支持「本月（默认）」、「本周」、「今年」、「全部历史」或指定天数。<br />
                      • <b>K线实时增量流开关</b>：同样配备 <code className="text-purple-700 dark:text-purple-300 font-mono">InpLiveCandleSync</code> 开关（默认 true），历史K线同步完后自动保持每 15 秒/新K线增量推送，也可随时关闭。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: 报表文件全格式导入 */}
      {activeTab === 'file' && (
        <div className="space-y-4">
          {/* 报表时区转换配置 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">
            <div className="flex items-center space-x-2">
              <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
              <div>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  报表来源时区转换：
                </span>
                <span className="text-gray-500 dark:text-gray-400 ml-1">
                  (导入后将自动转换为上海/北京时间 UTC+8)
                </span>
              </div>
            </div>
            <select
              value={sourceTimezone}
              onChange={(e) => setSourceTimezone(e.target.value)}
              className="px-2.5 py-1.5 bg-gray-50 dark:bg-navy-900 border border-gray-300 dark:border-gray-600 rounded-md text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500 font-medium"
            >
              <option value="broker">券商服务器时区 (EET/EEST 智能夏令时: 冬+6h/夏+5h) - 默认推荐</option>
              <option value="utc">UTC 零时区 (+8h 换算为上海时间)</option>
              <option value="est">美东时间 (EST/EDT: 冬+13h/夏+12h 换算为上海时间)</option>
              <option value="shanghai">原报表已是上海时间 (无需转换)</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.htm,.html,.xml,.xlsx,.xls,.tsv,.txt"
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
              {uploading ? '正在解析导入...' : '开始导入报表'}
            </Button>
          </div>

          <div className="flex flex-col space-y-2.5 text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div>
              <span className="font-semibold text-gray-800 dark:text-gray-200 block mb-1">
                支持上传的报表格式（自动智能识别与解析）：
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                <div className="p-2 bg-white dark:bg-navy-800 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-medium text-purple-600 dark:text-purple-400 flex items-center space-x-1">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>MT4 报表</span>
                  </div>
                  <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                    HTML 户口结单、HTML 详细报告、导出的 CSV/TSV
                  </p>
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-medium text-indigo-600 dark:text-indigo-400 flex items-center space-x-1">
                    <FileCode className="w-3.5 h-3.5" />
                    <span>MT5 HTML 报告</span>
                  </div>
                  <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                    MT5 右键导出的 HTML Web 网页报告
                  </p>
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>MT5 XML / Excel</span>
                  </div>
                  <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                    XML (MS Office Excel 2003 XML / SpreadsheetML)、.xlsx、.xls
                  </p>
                </div>
                <div className="p-2 bg-white dark:bg-navy-800 rounded border border-gray-200 dark:border-gray-700">
                  <div className="font-medium text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>CSV / TSV 数据</span>
                  </div>
                  <p className="mt-0.5 text-gray-500 dark:text-gray-400">
                    TradeZen 标准 CSV、券商 CSV、终端表格复制保存的数据
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-gray-400">下载示例报表文件:</span>
              <button
                type="button"
                onClick={downloadSampleMT5HTML}
                className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800"
              >
                <Download className="w-3 h-3" />
                <span>MT5 HTML</span>
              </button>
              <button
                type="button"
                onClick={downloadSampleMT5XML}
                className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800"
              >
                <Download className="w-3 h-3" />
                <span>MT5 XML</span>
              </button>
              <button
                type="button"
                onClick={downloadSampleMT4HTML}
                className="text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800"
              >
                <Download className="w-3 h-3" />
                <span>MT4 HTML</span>
              </button>
              <button
                type="button"
                onClick={downloadSampleMT5CSV}
                className="text-gray-600 dark:text-gray-400 hover:underline flex items-center space-x-1 bg-gray-100 dark:bg-navy-800 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700"
              >
                <Download className="w-3 h-3" />
                <span>MT5 CSV</span>
              </button>
              <button
                type="button"
                onClick={downloadSampleTradeZenCSV}
                className="text-gray-600 dark:text-gray-400 hover:underline flex items-center space-x-1 bg-gray-100 dark:bg-navy-800 px-2 py-0.5 rounded border border-gray-300 dark:border-gray-700"
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
        <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 shadow-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-200 p-0.5 ml-2 cursor-pointer"
            title="关闭提示"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default CSVUploader;
