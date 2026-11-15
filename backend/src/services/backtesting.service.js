import { BacktestingModel } from '../models/backtesting.model.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BacktestingService {
  static async createBacktestingResult(backtestingData) {
    return await BacktestingModel.create(backtestingData);
  }

  static async getBacktestingResultById(id) {
    return await BacktestingModel.findById(id);
  }

  static async getBacktestingResultsByUserId(userId) {
    return await BacktestingModel.findByUserId(userId);
  }

  static async deleteBacktestingResult(id, userId) {
    return await BacktestingModel.delete(id, userId);
  }

  /**
   * Run backtest via the Python MT5 Backtesting Engine
   */
  static async runBacktest(backtestConfig) {
    const {
      userId,
      strategy = 'ma_crossover',
      symbol = 'EURUSD',
      timeframe = 'H1',
      startDate,
      endDate,
      initialCapital = 10000,
      parameters = {},
    } = backtestConfig;

    const scriptPath = path.join(__dirname, '../../scripts/mt5_backtest_engine.py');
    const configPayload = JSON.stringify({
      strategy,
      symbol,
      timeframe,
      startDate: startDate || new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0],
      endDate: endDate || new Date().toISOString().split('T')[0],
      initialCapital: parseFloat(initialCapital),
      parameters,
    });

    try {
      const { stdout, stderr } = await execFileAsync('python', [scriptPath, '--config', configPayload], {
        maxBuffer: 25 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      if (!stdout || !stdout.trim()) {
        throw new Error(stderr || 'No output received from backtest engine');
      }

      const engineResult = JSON.parse(stdout);
      if (!engineResult.success) {
        throw new Error(engineResult.error || 'Backtest failed');
      }

      return {
        userId,
        playbookId: backtestConfig.playbookId || null,
        name: engineResult.name || `Backtest: ${strategy} on ${symbol}`,
        strategy: engineResult.strategy || strategy,
        startDate: engineResult.startDate,
        endDate: engineResult.endDate,
        initialCapital: engineResult.initialCapital,
        finalCapital: engineResult.finalCapital,
        totalTrades: engineResult.totalTrades,
        winningTrades: engineResult.winningTrades,
        losingTrades: engineResult.losingTrades,
        winRate: engineResult.winRate,
        profitFactor: engineResult.profitFactor,
        maxDrawdown: engineResult.maxDrawdown,
        sharpeRatio: engineResult.sharpeRatio,
        results: {
          symbol: engineResult.symbol,
          timeframe: engineResult.timeframe,
          dataSource: engineResult.dataSource,
          netProfit: engineResult.netProfit,
          returnPct: engineResult.returnPct,
          equityCurve: engineResult.equityCurve,
          trades: engineResult.trades,
          totalBars: engineResult.totalBars,
        },
      };
    } catch (err) {
      console.error('Error executing backtest engine:', err);
      throw new Error(`Backtest execution failed: ${err.message}`);
    }
  }
}
