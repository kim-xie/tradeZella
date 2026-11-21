import { TradeService } from '../services/trade.service.js';

export class DashboardController {
  static async getDashboardMetrics(req, res, next) {
    try {
      const userId = req.user.id;
      
      // Get all user trades
      const trades = await TradeService.getTradesByUserId(userId);
      
      // Calculate metrics
      const metrics = calculatePerformanceMetrics(trades);
      
      res.status(200).json({ 
        success: true,
        data: {
          metrics,
          recentTrades: trades.slice(0, 5)
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

export function getTradeExitMethod(trade) {
  const finalTrigger = trade.final_trigger || trade.finalTrigger;
  if (finalTrigger === 'takeProfit') return 'takeProfit';
  if (finalTrigger === 'stopLoss') return 'stopLoss';

  const notes = trade.notes;
  if (notes) {
    const lower = notes.toLowerCase();
    if (lower.includes('[tp') || lower.includes('take profit')) return 'takeProfit';
    if (lower.includes('[sl') || lower.includes('stop loss')) return 'stopLoss';
  }

  const exit = Number(trade.exitPrice ?? trade.exitprice ?? 0);
  const isClosed = exit > 0 || trade.manual_pnl != null || trade.manualPnl != null || trade.exit_time != null || trade.exitTime != null;
  if (!isClosed) return null;

  const sl = trade.stop_loss != null ? Number(trade.stop_loss) : (trade.stopLoss != null ? Number(trade.stopLoss) : null);
  const tp = trade.take_profit != null ? Number(trade.take_profit) : (trade.takeProfit != null ? Number(trade.takeProfit) : null);
  const dir = String(trade.direction || '').toLowerCase();
  const isLong = dir === 'buy' || dir === 'long' || dir === 'cover';

  if (isLong) {
    if (tp != null && tp > 0 && exit >= tp) return 'takeProfit';
    if (sl != null && sl > 0 && exit <= sl) return 'stopLoss';
    return 'manual';
  } else {
    if (tp != null && tp > 0 && exit <= tp) return 'takeProfit';
    if (sl != null && sl > 0 && exit >= sl) return 'stopLoss';
    return 'manual';
  }
}

export function getTradeDurationMinutes(trade) {
  const entry = trade.entry_time || trade.entryTime || trade.trade_date || trade.tradeDate || trade.createdat || trade.createdAt;
  const exit = trade.exit_time || trade.exitTime;
  if (!entry || !exit) return null;
  const entryMs = new Date(String(entry).replace(' ', 'T')).getTime();
  const exitMs = new Date(String(exit).replace(' ', 'T')).getTime();
  const diff = exitMs - entryMs;
  if (isNaN(diff) || diff < 0) return null;
  return diff / 60000;
}

export function calculatePerformanceMetrics(trades) {
  const completedTrades = trades.filter(
    t => (t.exitPrice != null && t.exitPrice > 0) || (t.exitprice != null && t.exitprice > 0) || t.manual_pnl != null || t.manualPnl != null
  );

  let totalProfitLoss = 0;
  let winningTrades = 0;
  let losingTrades = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let maxDrawdown = 0;
  let peak = 0;
  let runningTotal = 0;
  let bestTrade = 0;
  let worstTrade = 0;

  let takeProfitTrades = 0;
  let stopLossTrades = 0;
  let manualCloseTrades = 0;
  let manualCloseWins = 0;
  let manualCloseLosses = 0;
  let manualCloseBreakevens = 0;

  const winDurations = [];
  const lossDurations = [];
  const allDurations = [];

  // Calculate profit/loss for each trade
  completedTrades.forEach(trade => {
    const ep = Number(trade.entryPrice ?? trade.entryprice ?? 0);
    const xp = Number(trade.exitPrice ?? trade.exitprice ?? 0);
    const sz = Number(trade.size ?? 0);
    const manual = trade.manual_pnl ?? trade.manualPnl;
    const dir = String(trade.direction || '').toLowerCase();
    const isLong = dir === 'buy' || dir === 'long' || dir === 'cover';

    const profit = manual != null && !isNaN(Number(manual))
      ? Number(manual)
      : (isLong ? (xp - ep) * sz : (ep - xp) * sz);

    totalProfitLoss += profit;
    
    if (profit > 0.001) {
      winningTrades++;
      totalWins += profit;
      if (profit > bestTrade) bestTrade = profit;
    } else if (profit < -0.001) {
      losingTrades++;
      totalLosses += Math.abs(profit);
      if (profit < worstTrade) worstTrade = profit;
    }
    
    // Calculate drawdown
    runningTotal += profit;
    if (runningTotal > peak) {
      peak = runningTotal;
    }
    const drawdown = peak - runningTotal;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }

    // Exit method breakdown
    const exitMethod = getTradeExitMethod(trade);
    if (exitMethod === 'takeProfit') {
      takeProfitTrades++;
    } else if (exitMethod === 'stopLoss') {
      stopLossTrades++;
    } else if (exitMethod === 'manual') {
      manualCloseTrades++;
      if (profit > 0.001) {
        manualCloseWins++;
      } else if (profit < -0.001) {
        manualCloseLosses++;
      } else {
        manualCloseBreakevens++;
      }
    }

    // Duration calculation
    const dur = getTradeDurationMinutes(trade);
    if (dur !== null && dur >= 0) {
      allDurations.push(dur);
      if (profit > 0.001) {
        winDurations.push(dur);
      } else if (profit < -0.001) {
        lossDurations.push(dur);
      }
    }
  });

  const totalClosedTrades = winningTrades + losingTrades;
  const winRate = totalClosedTrades > 0 ? (winningTrades / totalClosedTrades) * 100 : 0;
  const avgWin = winningTrades > 0 ? totalWins / winningTrades : 0;
  const avgLoss = losingTrades > 0 ? totalLosses / losingTrades : 0;
  const profitFactor = avgLoss > 0 ? totalWins / totalLosses : 0;
  const expectancy = totalClosedTrades > 0 ? totalProfitLoss / totalClosedTrades : 0;
  const sharpeRatio = 1.5; // Simplified - would be calculated from actual returns

  const avgWinDuration = winDurations.length > 0 ? winDurations.reduce((a, b) => a + b, 0) / winDurations.length : 0;
  const avgLossDuration = lossDurations.length > 0 ? lossDurations.reduce((a, b) => a + b, 0) / lossDurations.length : 0;
  const avgHoldingDuration = allDurations.length > 0 ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length : 0;

  return {
    totalTrades: trades.length,
    completedTrades: completedTrades.length,
    totalProfitLoss: parseFloat(totalProfitLoss.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(2)),
    winningTrades,
    losingTrades,
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    profitFactor: parseFloat(profitFactor.toFixed(2)),
    maxDrawdown: parseFloat(maxDrawdown.toFixed(2)),
    sharpeRatio: parseFloat(sharpeRatio.toFixed(2)),
    expectancy: parseFloat(expectancy.toFixed(2)),
    bestTrade: parseFloat(bestTrade.toFixed(2)),
    worstTrade: parseFloat(worstTrade.toFixed(2)),
    takeProfitTrades,
    stopLossTrades,
    manualCloseTrades,
    manualCloseWins,
    manualCloseLosses,
    manualCloseBreakevens,
    avgWinDuration: parseFloat(avgWinDuration.toFixed(1)),
    avgLossDuration: parseFloat(avgLossDuration.toFixed(1)),
    avgHoldingDuration: parseFloat(avgHoldingDuration.toFixed(1))
  };
}
