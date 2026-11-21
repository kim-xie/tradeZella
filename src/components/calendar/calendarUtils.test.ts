import { describe, it, expect } from 'vitest';
import {
  calculateTradePnL,
  calculateTradeRR,
  isTradeMistake,
  computeDayStats,
  computeMonthStats,
  computeTradeSummaryStats,
  formatCurrency,
  formatDurationShort,
  formatDateTime,
  getTradeTradingDate,
  isTradeOvernightSession,
  getCurrentTradingDate,
  getPreviousTradingDate,
  getTradingWeekRange,
  getTradeDayOfWeek,
  getTradeMonthAndYear,
  calculateTradeExitMethod,
  getTradeDurationMinutes,
} from './calendarUtils';
import { Trade } from './calendarTypes';

describe('calendarUtils', () => {
  it('calculates trade PnL correctly for long and short positions', () => {
    const longTrade: Trade = {
      id: 1,
      symbol: 'EURUSD',
      direction: 'long',
      size: 1.0,
      entryprice: 1.1000,
      exitprice: 1.1050,
      leverage: 1,
    };
    expect(calculateTradePnL(longTrade)).toBeCloseTo(0.005, 4);

    const shortTrade: Trade = {
      id: 2,
      symbol: 'XAUUSD',
      direction: 'short',
      size: 2.0,
      entryprice: 2000,
      exitprice: 1980,
      leverage: 1,
    };
    expect(calculateTradePnL(shortTrade)).toBe(40);
  });

  it('respects manual_pnl when provided', () => {
    const tradeWithManual: Trade = {
      id: 3,
      symbol: 'BTCUSD',
      direction: 'long',
      size: 1,
      entryprice: 60000,
      exitprice: 65000,
      manual_pnl: 1250.50,
    };
    expect(calculateTradePnL(tradeWithManual)).toBe(1250.50);
  });

  it('calculates trade R-multiple correctly', () => {
    const tradeWithSL: Trade = {
      id: 4,
      symbol: 'EURUSD',
      direction: 'long',
      size: 1,
      entryprice: 100,
      exitprice: 120,
      stop_loss: 90, // Risk is 10
    };
    // PnL is 20, Risk is 10, R is 2.0
    expect(calculateTradeRR(tradeWithSL)).toBe(2);

    const tradeNoSL: Trade = {
      id: 5,
      symbol: 'EURUSD',
      direction: 'long',
      size: 1,
      entryprice: 100,
      exitprice: 120,
    };
    expect(calculateTradeRR(tradeNoSL)).toBeNull();
  });

  it('identifies discipline mistakes from tags, rating and sentiment', () => {
    const disciplinedTrade: Trade = {
      id: 6,
      symbol: 'AAPL',
      direction: 'long',
      size: 10,
      entryprice: 150,
      rating: 5,
      tags: ['trend', 'breakout'],
    };
    expect(isTradeMistake(disciplinedTrade)).toBe(false);

    const lowRatingTrade: Trade = {
      id: 7,
      symbol: 'AAPL',
      direction: 'long',
      size: 10,
      entryprice: 150,
      rating: 2,
    };
    expect(isTradeMistake(lowRatingTrade)).toBe(true);

    const fomoTagTrade: Trade = {
      id: 8,
      symbol: 'AAPL',
      direction: 'long',
      size: 10,
      entryprice: 150,
      tags: ['追高FOMO'],
    };
    expect(isTradeMistake(fomoTagTrade)).toBe(true);
  });

  it('computes day stats accurately', () => {
    const sampleDayTrades: Trade[] = [
      {
        id: 1,
        symbol: 'EURUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 100,
        exitprice: 120, // +20
      },
      {
        id: 2,
        symbol: 'GBPUSD',
        direction: 'long',
        size: 1.0,
        entryprice: 100,
        exitprice: 90, // -10
      },
    ];

    const stats = computeDayStats(sampleDayTrades, '2026-11-15');
    expect(stats.count).toBe(2);
    expect(stats.pnl).toBe(10);
    expect(stats.grossProfit).toBe(20);
    expect(stats.grossLoss).toBe(10);
    expect(stats.winRate).toBe(50);
    expect(stats.profitFactor).toBe(2.0);
    expect(stats.totalVolume).toBe(2.0);
  });

  it('computes monthly stats and green/red days ratio', () => {
    const tradesByDay: Record<string, Trade[]> = {
      '2026-11-01': [
        { id: 1, symbol: 'EURUSD', direction: 'long', size: 1, entryprice: 100, exitprice: 150 }, // +50 (Green)
      ],
      '2026-11-02': [
        { id: 2, symbol: 'EURUSD', direction: 'long', size: 1, entryprice: 100, exitprice: 80 }, // -20 (Red)
      ],
      '2026-11-03': [
        { id: 3, symbol: 'EURUSD', direction: 'long', size: 1, entryprice: 100, exitprice: 200 }, // +100 (Green, Best)
      ],
    };

    const monthStats = computeMonthStats(tradesByDay, 2026, 10); // November is month 10 (0-indexed)
    expect(monthStats.tradingDaysCount).toBe(3);
    expect(monthStats.greenDaysCount).toBe(2);
    expect(monthStats.redDaysCount).toBe(1);
    expect(monthStats.netPnL).toBe(130);
    expect(monthStats.bestDay?.date).toBe('2026-11-03');
    expect(monthStats.bestDay?.pnl).toBe(100);
    expect(monthStats.worstDay?.date).toBe('2026-11-02');
    expect(monthStats.worstDay?.pnl).toBe(-20);
  });

  it('computes arbitrary trade summary stats dynamically based on trade list', () => {
    const tradeList: Trade[] = [
      { id: 1, symbol: 'EURUSD', direction: 'long', size: 1.5, entryprice: 100, exitprice: 160, entry_time: '2026-11-04T10:00:00' }, // +90 (Green)
      { id: 2, symbol: 'XAUUSD', direction: 'short', size: 2.0, entryprice: 2000, exitprice: 2020, entry_time: '2026-11-05T14:30:00' }, // -40 (Red)
      { id: 3, symbol: 'BTCUSD', direction: 'long', size: 0.5, entryprice: 50000, exitprice: 50000, entry_time: '2026-11-06T09:00:00' }, // 0 (Breakeven)
    ];

    const stats = computeTradeSummaryStats(tradeList);
    expect(stats.totalTrades).toBe(3);
    expect(stats.completedTrades).toBe(3);
    expect(stats.tradingDaysCount).toBe(3);
    expect(stats.greenDaysCount).toBe(1);
    expect(stats.redDaysCount).toBe(1);
    expect(stats.breakevenDaysCount).toBe(1);
    expect(stats.netPnL).toBe(50); // 90 - 40
    expect(stats.grossProfit).toBe(90);
    expect(stats.grossLoss).toBe(40);
    expect(stats.profitFactor).toBeCloseTo(2.25, 2);
    expect(stats.totalVolume).toBe(4.0);
    expect(stats.bestDay?.pnl).toBe(90);
    expect(stats.worstDay?.pnl).toBe(-40);
  });

  it('formats currency and durations cleanly', () => {
    expect(formatCurrency(1250.5)).toBe('+$1,250.50');
    expect(formatCurrency(-450.25)).toBe('-$450.25');
    expect(formatDurationShort(150)).toBe('2h 30m');
    expect(formatDurationShort(25)).toBe('25m');
  });

  it('formats trade dates and times into clean YYYY-MM-DD HH:mm without raw T', () => {
    expect(formatDateTime('2026-11-15T02:06:00')).toBe('2026-11-15 02:06');
    expect(formatDateTime('2026-11-15T02:06:00.000Z')).toBe('2026-11-15 02:06');
    expect(formatDateTime('2026-11-15 02:06:00')).toBe('2026-11-15 02:06');
    expect(formatDateTime('2026-11-09T15:31')).toBe('2026-11-09 15:31');
    expect(formatDateTime('')).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
  });

  describe('Trading Day Cutoff Logic (TradeZella Standard)', () => {
    it('correctly maps overnight Friday US session (Saturday 00:00~05:59) to Friday trading day', () => {
      // 2026-11-14 is Saturday. 02:30 AM should roll back to 2026-11-13 (Friday)
      const fridayNightTrade1: Trade = {
        id: 101,
        symbol: 'NAS100',
        direction: 'long',
        size: 0.2,
        entryprice: 20500,
        entry_time: '2026-11-14T02:30:00',
      };
      expect(getTradeTradingDate(fridayNightTrade1)).toBe('2026-11-13');
      expect(isTradeOvernightSession(fridayNightTrade1)).toBe(true);

      // 05:59:59 AM just before Saturday market close rolls back to Friday
      const fridayNightTrade2: Trade = {
        id: 102,
        symbol: 'USOIL',
        direction: 'short',
        size: 0.1,
        entryprice: 70,
        entry_time: '2026-11-14T05:59:59',
      };
      expect(getTradeTradingDate(fridayNightTrade2)).toBe('2026-11-13');
      expect(isTradeOvernightSession(fridayNightTrade2)).toBe(true);

      // 06:00:00 AM or daytime crypto trade stays on Saturday
      const saturdayCryptoTrade: Trade = {
        id: 103,
        symbol: 'BTCUSD',
        direction: 'long',
        size: 0.1,
        entryprice: 90000,
        entry_time: '2026-11-14T14:20:00',
      };
      expect(getTradeTradingDate(saturdayCryptoTrade)).toBe('2026-11-14');
      expect(isTradeOvernightSession(saturdayCryptoTrade)).toBe(false);
    });

    it('correctly handles month and year boundary rollbacks before 06:00 AM', () => {
      // 2026-11-01 02:00 -> rolls back to 2026-10-31
      const monthBoundaryTrade: Trade = {
        id: 104,
        symbol: 'EURUSD',
        direction: 'long',
        size: 1,
        entryprice: 1.08,
        entry_time: '2026-11-01 01:45:00',
      };
      expect(getTradeTradingDate(monthBoundaryTrade)).toBe('2026-10-31');

      // 2026-01-01 04:00 -> rolls back to 2025-12-31
      const yearBoundaryTrade: Trade = {
        id: 105,
        symbol: 'XAUUSD',
        direction: 'short',
        size: 1,
        entryprice: 2000,
        entry_time: '2026-01-01T04:15:00',
      };
      expect(getTradeTradingDate(yearBoundaryTrade)).toBe('2025-12-31');
    });

    it('prioritizes exit_time over entry_time for closed trades to match MT5/broker realized PnL settlement day', () => {
      // Trade entered on 2026-11-18 evening, closed on 2026-11-19 16:46:00
      const swingTrade: Trade = {
        id: 106,
        symbol: '道琼斯指数',
        direction: 'long',
        size: 0.1,
        entryprice: 50200,
        exitprice: 50220,
        entry_time: '2026-11-18T22:30:00',
        exit_time: '2026-11-19T16:46:00',
      };
      expect(getTradeTradingDate(swingTrade)).toBe('2026-11-19');
    });

    it('handles various date format separators (dot, slash, ISO)', () => {
      expect(getTradeTradingDate({ entry_time: '2026.11.14 03:00:00' } as any)).toBe('2026-11-13');
      expect(getTradeTradingDate({ entry_time: '2026/11/14 03:00:00' } as any)).toBe('2026-11-13');
      expect(getTradeTradingDate({ entry_time: '2026-11-13' } as any)).toBe('2026-11-13');
    });

    it('calculates trading day helpers accurately', () => {
      // 2026-11-16 is Monday. Previous trading day must be Friday 2026-11-13!
      expect(getPreviousTradingDate('2026-11-16')).toBe('2026-11-13');
      // 2026-11-13 is Friday. Previous trading day is Thursday 2026-11-12.
      expect(getPreviousTradingDate('2026-11-13')).toBe('2026-11-12');

      // Trading week range for 2026-11-18 (Wednesday)
      const weekRange = getTradingWeekRange('2026-11-18');
      expect(weekRange.start).toBe('2026-11-16'); // Monday
      expect(weekRange.end).toBe('2026-11-22'); // Sunday

      // Trade Day of Week: Saturday 02:00 trade maps to Friday (day 5)
      const fridayNightTrade: Trade = {
        id: 999,
        symbol: 'NAS100',
        direction: 'long',
        size: 1,
        entryprice: 20000,
        entry_time: '2026-11-14T02:00:00', // Saturday 02:00 AM
      };
      expect(getTradeDayOfWeek(fridayNightTrade)).toBe(5); // 5 = Friday

      // Trade Month & Year: 2026-11-01 02:00 trade maps to 2026 October (month 9)
      const monthBoundaryTrade: Trade = {
        id: 1000,
        symbol: 'XAUUSD',
        direction: 'long',
        size: 1,
        entryprice: 2600,
        entry_time: '2026-11-01 02:30:00',
      };
      const ym = getTradeMonthAndYear(monthBoundaryTrade);
      expect(ym.year).toBe(2026);
      expect(ym.month).toBe(9); // October (0-indexed 9)
    });

    it('calculates trade exit methods accurately', () => {
      // 1. Explicit final_trigger takeProfit / stopLoss
      expect(calculateTradeExitMethod({
        id: 1,
        symbol: 'EURUSD',
        direction: 'long',
        size: 1,
        entryprice: 1.1000,
        exitprice: 1.1050,
        final_trigger: 'takeProfit',
      })).toBe('takeProfit');

      expect(calculateTradeExitMethod({
        id: 2,
        symbol: 'EURUSD',
        direction: 'long',
        size: 1,
        entryprice: 1.1000,
        exitprice: 1.0950,
        finalTrigger: 'stopLoss',
      })).toBe('stopLoss');

      // 2. MT5 notes with [tp] or [sl]
      expect(calculateTradeExitMethod({
        id: 3,
        symbol: 'BTCUSD',
        direction: 'long',
        size: 1,
        entryprice: 50000,
        exitprice: 51000,
        notes: 'MT5 Position #1234 [tp 51000.0]',
      })).toBe('takeProfit');

      // 3. Price comparison for long position
      expect(calculateTradeExitMethod({
        id: 4,
        symbol: 'XAUUSD',
        direction: 'long',
        size: 1,
        entryprice: 2000,
        exitprice: 2020,
        take_profit: 2020,
        stop_loss: 1990,
      })).toBe('takeProfit');

      expect(calculateTradeExitMethod({
        id: 5,
        symbol: 'XAUUSD',
        direction: 'long',
        size: 1,
        entryprice: 2000,
        exitprice: 1990,
        take_profit: 2020,
        stop_loss: 1990,
      })).toBe('stopLoss');

      expect(calculateTradeExitMethod({
        id: 6,
        symbol: 'XAUUSD',
        direction: 'long',
        size: 1,
        entryprice: 2000,
        exitprice: 2005,
        take_profit: 2020,
        stop_loss: 1990,
      })).toBe('manual');

      // 4. Open trade has no exit method
      expect(calculateTradeExitMethod({
        id: 7,
        symbol: 'XAUUSD',
        direction: 'long',
        size: 1,
        entryprice: 2000,
      })).toBeNull();
    });

    it('calculates duration in minutes accurately', () => {
      const trade: Trade = {
        id: 8,
        symbol: 'AAPL',
        direction: 'long',
        size: 10,
        entryprice: 150,
        entry_time: '2026-11-20 10:00:00',
        exit_time: '2026-11-20 12:30:00',
      };
      expect(getTradeDurationMinutes(trade)).toBe(150); // 2.5 hours = 150 minutes
    });
  });
});
