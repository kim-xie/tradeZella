import { BacktestingService } from '../services/backtesting.service.js';
import { CandleService } from '../services/candle.service.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class BacktestingController {
  static async getCandles(req, res, next) {
    try {
      const { symbol = 'EURUSD', timeframe = 'M5', count = 300, start, end } = req.query;

      // 1. Check if database has synced candles from MQL EA or previous feeds
      const dbCandles = await CandleService.getCandles({ symbol, timeframe, count, start, end });
      if (dbCandles && dbCandles.length > 0) {
        return res.status(200).json({
          success: true,
          symbol,
          timeframe,
          contractSize: 100000.0,
          dataSource: 'MQL EA Cloud Sync',
          count: dbCandles.length,
          candles: dbCandles,
        });
      }

      // 2. Fallback to local MT5 python script or synthetic replay generator
      const scriptPath = path.join(__dirname, '../../scripts/mt5_candles.py');
      const args = [scriptPath, '--symbol', symbol, '--timeframe', timeframe, '--count', String(count)];
      if (start) args.push('--start', start);
      if (end) args.push('--end', end);

      const { stdout } = await execFileAsync('python', args, {
        maxBuffer: 15 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      const data = JSON.parse(stdout);
      res.status(200).json(data);
    } catch (err) {
      console.warn('Python mt5_candles execution failed, generating JavaScript synthetic replay feed:', err.message);
      const limit = Math.min(Math.max(parseInt(req.query.count) || 300, 50), 1000);
      const tf = req.query.timeframe || 'M5';
      const sym = req.query.symbol || 'EURUSD';
      
      const intervalMinutes = {
        'M1': 1, '1M': 1,
        'M5': 5, '5M': 5,
        'M15': 15, '15M': 15,
        'M30': 30, '30M': 30,
        'H1': 60, '1H': 60,
        'H4': 240, '4H': 240,
        'D1': 1440, '1D': 1440
      }[String(tf).toUpperCase()] || 5;

      let basePrice = 1.0850;
      if (sym.includes('JPY')) basePrice = 155.0;
      else if (sym.includes('XAU') || sym.includes('黄金')) basePrice = 2350.0;
      else if (sym.includes('BTC') || sym.includes('比特币')) basePrice = 67000.0;
      else if (sym.includes('纳斯达克') || sym.includes('US100') || sym.includes('NAS')) basePrice = 20500.0;

      const candles = [];
      const nowMs = Date.now();
      let currentClose = basePrice;

      for (let i = limit; i >= 0; i--) {
        const timeMs = nowMs - i * intervalMinutes * 60 * 1000;
        const d = new Date(timeMs);
        const pad = (n) => String(n).padStart(2, '0');
        const timeStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        
        const changePct = (Math.random() - 0.495) * 0.003;
        const open = currentClose;
        const close = open * (1 + changePct);
        const high = Math.max(open, close) * (1 + Math.random() * 0.0015);
        const low = Math.min(open, close) * (1 - Math.random() * 0.0015);
        currentClose = close;

        candles.push({
          time: timeStr,
          timestamp: Math.floor(timeMs / 1000),
          open: parseFloat(open.toFixed(basePrice > 100 ? 2 : 5)),
          high: parseFloat(high.toFixed(basePrice > 100 ? 2 : 5)),
          low: parseFloat(low.toFixed(basePrice > 100 ? 2 : 5)),
          close: parseFloat(close.toFixed(basePrice > 100 ? 2 : 5)),
          volume: Math.floor(Math.random() * 800) + 200,
        });
      }

      return res.status(200).json({
        success: true,
        symbol: sym,
        timeframe: tf,
        contractSize: basePrice > 100 ? 1.0 : 100000.0,
        dataSource: 'Synthetic Replay Fallback',
        count: candles.length,
        candles,
      });
    }
  }

  /**
   * Endpoint for MQL EA or external sync tools to push OHLCV candle data
   */
  static async syncCandles(req, res, next) {
    try {
      const { symbol, timeframe, candles } = req.body;
      if (!symbol || !timeframe || !Array.isArray(candles)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payload: symbol, timeframe, and candles array are required.',
        });
      }

      const result = await CandleService.saveBulkCandles({ symbol, timeframe, candles });
      res.status(200).json({
        success: true,
        message: `成功同步 ${symbol} (${timeframe}) ${result.insertedCount} 根K线数据到云端！`,
        symbol,
        timeframe,
        count: result.insertedCount,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getMT5Status(req, res, next) {
    try {
      const scriptPath = path.join(__dirname, '../../scripts/mt5_status.py');
      const { stdout } = await execFileAsync('python', [scriptPath], {
        timeout: 10000,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      const data = JSON.parse(stdout);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      console.warn('MT5 status check failed:', error.message);
      res.status(200).json({
        success: true,
        data: {
          connected: false,
          error: error.message,
        },
      });
    }
  }

  static async runBacktest(req, res, next) {
    try {
      const backtestData = { ...req.body, userId: req.user.id };
      const backtestResult = await BacktestingService.runBacktest(backtestData);
      const savedResult = await BacktestingService.createBacktestingResult(backtestResult);
      
      res.status(201).json({ 
        success: true,
        data: savedResult 
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBacktestingResults(req, res, next) {
    try {
      const results = await BacktestingService.getBacktestingResultsByUserId(req.user.id);
      res.status(200).json({ 
        success: true,
        data: results 
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBacktestingResult(req, res, next) {
    try {
      const result = await BacktestingService.getBacktestingResultById(req.params.id);
      if (!result) {
        return res.status(404).json({ 
          success: false,
          message: 'Backtesting result not found' 
        });
      }
      
      // Check if user owns the result
      if (result.userId !== req.user.id) {
        return res.status(403).json({ 
          success: false,
          message: 'Access denied' 
        });
      }
      
      res.status(200).json({ 
        success: true,
        data: result 
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteBacktestingResult(req, res, next) {
    try {
      const success = await BacktestingService.deleteBacktestingResult(req.params.id, req.user.id);
      if (!success) {
        return res.status(404).json({ 
          success: false,
          message: 'Backtesting result not found' 
        });
      }
      res.status(200).json({ 
        success: true,
        message: 'Backtesting result deleted successfully' 
      });
    } catch (error) {
      next(error);
    }
  }
}
