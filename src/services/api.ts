import axios from 'axios';

// Vite环境变量在构建时静态替换，部署后修改无效
// 开发环境：fallback 到本地 localhost
// 生产环境（Vercel）：优先用环境变量，否则同源 /api 路径
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.DEV ? 'http://localhost:5000/api' : '/api'
);

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// 调试用：构建后可在控制台确认实际使用的URL
if (typeof window !== 'undefined') {
  console.log('[API] Base URL:', API_BASE_URL);
}

// Response interceptor: auto-refresh token for sliding expiration
apiClient.interceptors.response.use(
  (response) => {
    const newToken = response.headers['x-new-token'];
    if (newToken) {
      localStorage.setItem('token', newToken);
      console.log('Token refreshed (sliding expiration)');
    }
    return response;
  },
  (error) => {
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
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await apiClient.post('/trades/screenshots', formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data.url;
  } catch (error) {
    console.error('Error uploading screenshot:', error);
    throw error;
  }
};
