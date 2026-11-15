import axios from 'axios';
import { uploadImage } from './cloudinary';

// ============================================================
// 全局唯一的环境变量与 URL 计算中心
// 其他文件请直接从本文件 import 常量/函数，禁止再自行计算环境变量！
// ============================================================

/**
 * API 接口基址（带 /api 后缀）
 * 例：https://api.example.com/api  |  /api（生产同源） |  http://localhost:5000/api（开发）
 * 用途：apiClient 的 baseURL
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.DEV ? 'http://localhost:5000/api' : '/api'
);

/**
 * 服务端根 URL（不带 /api 后缀）
 * 例：https://api.example.com  |  空字符串（生产同源）  |  http://localhost:5000（开发）
 * 用途：手动拼接 ${SERVER_BASE_URL}/api/xxx 接口或 ${SERVER_BASE_URL}/uploads/xxx 资源
 */
export const SERVER_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

/**
 * 便捷函数：拼接上传资源（截图等）的完整 URL
 * 自动区分传入的是完整 URL（已带 http）还是 /uploads/xxx 相对路径
 */
export function getAssetUrl(path?: string | null): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${SERVER_BASE_URL}${normalized}`;
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// 调试用：构建后可在控制台确认实际使用的URL
if (typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.log('[API] API_BASE_URL:', API_BASE_URL, '| SERVER_BASE_URL:', SERVER_BASE_URL || '(same-origin)');
}

// Response interceptor: auto-refresh token for sliding expiration + 401 auto-logout
apiClient.interceptors.response.use(
  (response) => {
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      localStorage.setItem('token', newToken);
      window.dispatchEvent(new Event('auth-change'));
      console.log('Token refreshed (sliding expiration)');
    }
    return response;
  },
  (error) => {
    const status = error.response?.status;

    // 401 = 会话失效（token 过期/无效/缺失）
    // 自动清除 token 并跳转登录页，避免用户看到一堆报错
    if (status === 401) {
      const path = window.location.pathname;
      const isAuthPage =
        path === '/login' ||
        path === '/signup' ||
        path === '/forgot-password' ||
        path.startsWith('/reset-password') ||
        path === '/oauth-callback';

      // 在认证页面不跳转，避免循环
      if (!isAuthPage) {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth-change'));
        const currentPath = path + window.location.search;
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }

    return Promise.reject(error);
  }
);

// Request interceptor: attach token to all requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const getCommunityCategories = async () => {
  try {
    const response = await apiClient.get('/community/categories');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching community categories:', error);
    throw error;
  }
};

export const getUserTrades = async (token: string) => {
  try {
    const response = await apiClient.get('/trades', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error('Error fetching user trades:', error);
    throw error;
  }
};

export interface CreateTradeData {
  symbol: string;
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  exitPrice?: number;
  notes?: string;
  tradeDate?: string;
  entryTime?: string;
  exitTime?: string;
  stopLoss?: number;
  takeProfit?: number;
  tags?: string[];
  sentiment?: string;
  screenshots?: string[];
  entryConditions?: string[];
  rating?: number | null;
  manualPnl?: number;
  session?: 'Asia' | 'Europe' | 'US';
  leverage?: number;
  finalTrigger?: 'takeProfit' | 'stopLoss';
}

export const createTrade = async (token: string, tradeData: CreateTradeData) => {
  try {
    const response = await apiClient.post('/trades', tradeData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error('Error creating trade:', error);
    throw error;
  }
};

export const createBulkTrades = async (token: string, trades: CreateTradeData[]) => {
  try {
    const response = await apiClient.post('/trades/bulk', { trades }, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error('Error creating bulk trades:', error);
    throw error;
  }
};

export const updateTrade = async (token: string, tradeId: number, tradeData: Partial<CreateTradeData>) => {
  try {
    const response = await apiClient.put(`/trades/${tradeId}`, tradeData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error('Error updating trade:', error);
    throw error;
  }
};

export const deleteTrade = async (token: string, tradeId: number) => {
  try {
    const response = await apiClient.delete(`/trades/${tradeId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error('Error deleting trade:', error);
    throw error;
  }
};

export const uploadScreenshot = async (token: string, file: File) => {
  // 直接上传到 Cloudinary，不再走后端
  // token 参数保留向后兼容，但 Cloudinary 直传不需要
  try {
    return await uploadImage(file);
  } catch (error) {
    console.error('Error uploading screenshot to Cloudinary:', error);
    throw error;
  }
};

// ============================================================
// MT5 及回测相关 API
// ============================================================

export interface MT5StatusData {
  connected: boolean;
  terminal?: {
    name: string;
    company: string;
    connected: boolean;
    build: number;
    path: string;
  };
  account?: {
    login: number;
    server: string;
    balance: number;
    equity: number;
    currency: string;
    leverage: number;
    name: string;
    company: string;
  };
  symbolsTotal?: number;
  popularSymbols?: string[];
  allSymbols?: string[];
  error?: string;
}

export interface RunBacktestParams {
  strategy: string;
  symbol: string;
  timeframe: string;
  startDate?: string;
  endDate?: string;
  initialCapital?: number;
  parameters?: Record<string, any>;
}

export interface BacktestTradeItem {
  id: number;
  date: string;
  entryTime: string;
  exitTime: string;
  symbol: string;
  direction: string;
  size: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss?: number;
  takeProfit?: number;
  profit: number;
  commission: number;
  pnlPercent: number;
  exitReason?: string;
}

export interface BacktestRecord {
  id: number | string;
  userId?: number;
  name: string;
  strategy: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  results: {
    symbol?: string;
    timeframe?: string;
    dataSource?: string;
    netProfit?: number;
    returnPct?: number;
    equityCurve?: Array<{ time: string; capital: number; drawdown: number }>;
    trades?: BacktestTradeItem[];
    totalBars?: number;
  };
  createdAt: string;
}

export interface CandleItem {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandlesResponse {
  success: boolean;
  symbol: string;
  timeframe: string;
  contractSize: number;
  dataSource: string;
  count: number;
  candles: CandleItem[];
}

/**
 * 从 MT5 获取指定品种与周期的历史 K 线数据（用于手动重播与回测）
 */
export const fetchCandles = async (params: { symbol: string; timeframe: string; count?: number; start?: string }): Promise<CandlesResponse> => {
  try {
    const response = await apiClient.get('/backtesting/candles', { params });
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch candles:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch candles');
  }
};

/**
 * 获取本地 MT5 终端运行状态、账户信息与支持品种
 */
export const getMT5Status = async (): Promise<MT5StatusData> => {
  try {
    const response = await apiClient.get('/trades/mt5/status');
    return response.data.data;
  } catch (error: any) {
    console.warn('Failed to fetch MT5 status:', error);
    return {
      connected: false,
      error: error.response?.data?.message || error.message,
    };
  }
};

/**
 * 一键直连同步本地 MT5 终端的历史平仓交易记录
 */
export const syncMT5Trades = async (options?: { days?: number; all?: boolean; limit?: number }) => {
  try {
    const response = await apiClient.post('/trades/mt5/sync', options || { days: 30 });
    return response.data;
  } catch (error: any) {
    console.error('Failed to sync MT5 trades:', error);
    throw new Error(error.response?.data?.message || 'Failed to sync trades from MT5');
  }
};

/**
 * 获取所有已保存的回测历史记录
 */
export const getBacktestingResults = async (): Promise<BacktestRecord[]> => {
  try {
    const response = await apiClient.get('/backtesting');
    return response.data.data;
  } catch (error: any) {
    console.error('Failed to fetch backtest results:', error);
    throw error;
  }
};

/**
 * 运行新的量化策略回测（基于 MT5 真实行情数据）
 */
export const runBacktestApi = async (params: RunBacktestParams): Promise<BacktestRecord> => {
  try {
    const response = await apiClient.post('/backtesting', params);
    return response.data.data;
  } catch (error: any) {
    console.error('Failed to run backtest:', error);
    throw new Error(error.response?.data?.message || 'Backtest execution failed');
  }
};

/**
 * 删除指定回测记录
 */
export const deleteBacktest = async (id: string | number): Promise<void> => {
  try {
    await apiClient.delete(`/backtesting/${id}`);
  } catch (error: any) {
    console.error('Failed to delete backtest:', error);
    throw error;
  }
};

// 券商/交易所集成相关 API
export interface BrokerConnectionData {
  id: string;
  userId?: string;
  brokerName: string;
  brokerType?: string;
  connectionDetails?: any;
  isActive?: boolean;
  lastSync?: string;
  syncStatus?: 'success' | 'failed' | 'in-progress';
  createdAt?: string;
  updatedAt?: string;
}

export const getBrokerConnections = async (): Promise<BrokerConnectionData[]> => {
  try {
    const response = await apiClient.get('/brokers');
    return response.data?.data || [];
  } catch (error) {
    console.warn('Failed to fetch broker connections:', error);
    return [];
  }
};

export const createBrokerConnection = async (data: {
  brokerName: string;
  brokerType?: string;
  connectionDetails: any;
}): Promise<BrokerConnectionData> => {
  const response = await apiClient.post('/brokers', data);
  return response.data?.data;
};

export const deleteBrokerConnection = async (id: string): Promise<void> => {
  await apiClient.delete(`/brokers/${id}`);
};

export const syncBrokerConnection = async (id: string): Promise<any> => {
  const response = await apiClient.post(`/brokers/${id}/sync`);
  return response.data;
};


