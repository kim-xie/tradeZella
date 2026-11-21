export type ExitMethodType = 'takeProfit' | 'stopLoss' | 'manual';

export interface Trade {
  id: number;
  userId?: number;
  symbol: string;
  direction: 'long' | 'short' | 'buy' | 'sell';
  size: number;
  entryprice?: number;
  entryPrice?: number;
  exitprice?: number;
  exitPrice?: number;
  manual_pnl?: number | null;
  manualPnl?: number | null;
  createdat?: string;
  createdAt?: string;
  entry_time?: string;
  entryTime?: string;
  exit_time?: string;
  exitTime?: string;
  stop_loss?: number;
  stopLoss?: number;
  take_profit?: number;
  takeProfit?: number;
  leverage?: number;
  rating?: number;
  notes?: string;
  tags?: string[] | string;
  sentiment?: string;
  final_trigger?: 'takeProfit' | 'stopLoss';
  finalTrigger?: 'takeProfit' | 'stopLoss';
}

export interface DayStats {
  dateStr: string;
  pnl: number;
  grossProfit: number;
  grossLoss: number;
  count: number;
  completedCount: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  profitFactor: number;
  totalVolume: number;
  avgRR: number;
  totalR: number;
  avgWinDuration: number;
  avgLossDuration: number;
  mistakesCount: number;
  hasNotes: boolean;
}

export interface MonthStats {
  netPnL: number;
  grossProfit: number;
  grossLoss: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  completedTrades: number;
  greenDaysCount: number;
  redDaysCount: number;
  breakevenDaysCount: number;
  tradingDaysCount: number;
  avgDailyPnL: number;
  bestDay: { date: string; pnl: number; count: number } | null;
  worstDay: { date: string; pnl: number; count: number } | null;
  totalVolume: number;
  expectancy: number;
}

export type CalendarViewMode = 'net_pnl' | 'trades' | 'volume' | 'rmultiple';
