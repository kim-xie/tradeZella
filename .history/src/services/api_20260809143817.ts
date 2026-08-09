import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

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
