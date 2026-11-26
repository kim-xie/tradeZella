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
      const { symbol = 'EURUSD', timeframe = 'M5', count = 300, start, end, price, entryPrice } = req.query;
      const targetPrice = parseFloat(price || entryPrice) || null;

      // 1. Check if database has synced candles from MQL EA or previous feeds
      const dbCandles = await CandleService.getCandles({ symbol, timeframe, count, start, end });
      if (dbCandles && dbCandles.length > 0) {
        return res.status(200).json({
          success: true,
          symbol,
          timeframe,
          contractSize: targetPrice && targetPrice > 100 ? 1.0 : 100000.0,
          dataSource: '同步K线',
          count: dbCandles.length,
          candles: dbCandles,
        });
      }

      // 2. Fallback to local MT5 python script or synthetic replay generator
      const scriptPath = path.join(__dirname, '../../scripts/mt5_candles.py');
      const args = [scriptPath, '--symbol', symbol, '--timeframe', timeframe, '--count', String(count)];
      if (start) args.push('--start', start);
      if (end) args.push('--end', end);
      if (targetPrice) args.push('--price', String(targetPrice));

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
      const targetPrice = parseFloat(req.query.price || req.query.entryPrice) || null;
      
      const intervalMinutes = {
        'M1': 1, '1M': 1,
        'M5': 5, '5M': 5,
        'M15': 15, '15M': 15,
        'M30': 30, '30M': 30,
        'H1': 60, '1H': 60,
        'H4': 240, '4H': 240,
        'D1': 1440, '1D': 1440
      }[String(tf).toUpperCase()] || 5;

      let basePrice = targetPrice;
      if (!basePrice || isNaN(basePrice)) {
        if (/原油|USOIL|WTI|XTI/i.test(sym)) basePrice = 70.0;
        else if (/布伦特|UKOIL|BRENT/i.test(sym)) basePrice = 75.0;
        else if (/纳斯达克|NAS100|US100|USTEC/i.test(sym)) basePrice = 20500.0;
        else if (/道琼斯|US30|DJ30/i.test(sym)) basePrice = 43500.0;
        else if (/标普|US500|SPX/i.test(sym)) basePrice = 5900.0;
        else if (/黄金|XAU|GOLD/i.test(sym)) basePrice = 2650.0;
        else if (/白银|XAG|SILVER/i.test(sym)) basePrice = 31.0;
        else if (/比特币|BTC/i.test(sym)) basePrice = 90000.0;
        else if (/以太坊|ETH/i.test(sym)) basePrice = 3200.0;
        else if (/德指|GER40|DAX/i.test(sym)) basePrice = 19200.0;
        else if (/日经|JP225/i.test(sym)) basePrice = 38500.0;
        else if (/恒生|HK50/i.test(sym)) basePrice = 19500.0;
        else if (/JPY/i.test(sym)) basePrice = 155.0;
        else if (/GBP/i.test(sym)) basePrice = 1.2850;
        else if (/AUD/i.test(sym)) basePrice = 0.6550;
        else basePrice = 1.0850;
      }

      const digits = basePrice >= 500 ? 2 : (basePrice >= 10 ? 3 : 5);
      const stepMs = intervalMinutes * 60 * 1000;
      let startMs;

      if (req.query.start) {
        const parsedStart = new Date(String(req.query.start).replace(' ', 'T').replace(/\./g, '-')).getTime();
        startMs = !isNaN(parsedStart) ? parsedStart : (Date.now() - limit * stepMs);
      } else {
        startMs = Date.now() - limit * stepMs;
      }

      const candles = [];
      let currentClose = basePrice;
      const pad = (n) => String(n).padStart(2, '0');

      for (let i = 0; i < limit; i++) {
        const timeMs = startMs + i * stepMs;
        const d = new Date(timeMs);
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
          open: parseFloat(open.toFixed(digits)),
          high: parseFloat(high.toFixed(digits)),
          low: parseFloat(low.toFixed(digits)),
          close: parseFloat(close.toFixed(digits)),
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
      const { symbol, timeframe, candles, timezone = 'broker', gmtOffsetSec = null } = req.body;
      if (!symbol || !timeframe || !Array.isArray(candles)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid payload: symbol, timeframe, and candles array are required.',
        });
      }

      const parsedOffsetSec = gmtOffsetSec !== undefined && gmtOffsetSec !== null ? Number(gmtOffsetSec) : NaN;
      const effectiveTz = (timezone === 'offset' && Number.isFinite(parsedOffsetSec))
        ? String((28800 - parsedOffsetSec) / 3600)
        : timezone;

      const result = await CandleService.saveBulkCandles({ symbol, timeframe, candles, timezone: effectiveTz });
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

  /**
   * Endpoint to clear historical candles (e.g. remove old M5 candles before syncing 1M)
   */
  static async clearCandles(req, res, next) {
    try {
      const symbol = req.query.symbol || req.body?.symbol;
      const timeframe = req.query.timeframe || req.body?.timeframe;

      const result = await CandleService.clearCandles({ symbol, timeframe });
      res.status(200).json({
        success: true,
        message: `成功清空 ${symbol || '全部品种'} ${timeframe || '全部周期'} K线数据 (共 ${result.deletedCount} 条)`,
        deletedCount: result.deletedCount,
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

  /**
   * Get symbols that actually have K-line candle data available
   * (combines DB synced candles, MT5 Market Watch candles, and fallback default favorites)
   */
  static async getAvailableCandleSymbols(req, res, next) {
    try {
      // 1. Get symbols from database `market_candles`
      const dbSymbols = await CandleService.getAvailableSymbols();

      // 2. Query MT5 status script to get active symbols with candles
      let mt5Symbols = [];
      let mt5Popular = [];
      try {
        const scriptPath = path.join(__dirname, '../../scripts/mt5_status.py');
        const { stdout } = await execFileAsync('python', [scriptPath], {
          timeout: 10000,
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        const statusData = JSON.parse(stdout);
        if (statusData.connected && Array.isArray(statusData.allSymbols)) {
          mt5Symbols = statusData.allSymbols;
        }
        if (Array.isArray(statusData.popularSymbols)) {
          mt5Popular = statusData.popularSymbols;
        }
      } catch (e) {
        // MT5 python execution failed or MT5 not connected
      }

      const defaultSymbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', '纳斯达克100', 'BTCUSD'];

      // Merge and deduplicate
      const symbolSet = new Set([...dbSymbols, ...mt5Symbols]);
      if (symbolSet.size === 0) {
        defaultSymbols.forEach(s => symbolSet.add(s));
      }

      const allSymbols = Array.from(symbolSet);

      const popularSet = new Set([...mt5Popular, ...defaultSymbols.filter(s => symbolSet.has(s))]);
      const popularSymbols = Array.from(popularSet).filter(s => symbolSet.has(s));

      res.status(200).json({
        success: true,
        data: {
          symbols: allSymbols,
          popularSymbols: popularSymbols.length > 0 ? popularSymbols : defaultSymbols,
        },
      });
    } catch (err) {
      next(err);
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
