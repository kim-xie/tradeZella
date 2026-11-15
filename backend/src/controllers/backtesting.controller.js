import { BacktestingService } from '../services/backtesting.service.js';
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
      const { symbol = 'EURUSD', timeframe = 'H1', count = 300, start } = req.query;
      const scriptPath = path.join(__dirname, '../../scripts/mt5_candles.py');
      const args = [scriptPath, '--symbol', symbol, '--timeframe', timeframe, '--count', String(count)];
      if (start) args.push('--start', start);

      const { stdout } = await execFileAsync('python', args, {
        maxBuffer: 15 * 1024 * 1024,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });
      const data = JSON.parse(stdout);
      res.status(200).json(data);
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
