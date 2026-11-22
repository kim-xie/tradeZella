import { TradeService } from '../services/trade.service.js';
import { RealtimeService } from '../services/realtime.service.js';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { parseUniversalTradeFile, convertToShanghaiTime } from '../parsers/universalTradeParser.js';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TradeController {
  static async createTrade(req, res, next) {
    try {
      const tradeData = { ...req.body, userId: req.user.id };
      const newTrade = await TradeService.createTrade(tradeData);
      RealtimeService.broadcastTradeUpdate(req.user.id, {
        action: 'create',
        source: '手动记账',
        count: 1,
        trade: newTrade,
      });
      res.status(201).json({ 
        success: true,
        data: newTrade 
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTrades(req, res, next) {
    try {
      const options = {};
      if (req.query.limit) options.limit = parseInt(req.query.limit, 10);
      if (req.query.offset) options.offset = parseInt(req.query.offset, 10);
      if (req.query.page && req.query.limit) {
        const page = Math.max(1, parseInt(req.query.page, 10));
        options.offset = (page - 1) * parseInt(req.query.limit, 10);
      }
      const trades = await TradeService.getTradesByUserId(req.user.id, options);
      res.status(200).json({ 
        success: true,
        data: trades 
      });
    } catch (error) {
      next(error);
    }
  }

  static async getTrade(req, res, next) {
    try {
      const trade = await TradeService.getTradeById(req.params.id, req.user.id);
      if (!trade) {
        return res.status(404).json({ 
          success: false,
          message: 'Trade not found' 
        });
      }
      res.status(200).json({ 
        success: true,
        data: trade 
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateTrade(req, res, next) {
    try {
      const updatedTrade = await TradeService.updateTrade(req.params.id, req.user.id, req.body);
      if (!updatedTrade) {
        return res.status(404).json({ 
          success: false,
          message: 'Trade not found' 
        });
      }
      RealtimeService.broadcastTradeUpdate(req.user.id, {
        action: 'update',
        source: '订单更新',
        tradeId: req.params.id,
        trade: updatedTrade,
      });
      res.status(200).json({ 
        success: true,
        data: updatedTrade 
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteTrade(req, res, next) {
    try {
      const success = await TradeService.deleteTrade(req.params.id, req.user.id);
      if (!success) {
        return res.status(404).json({ 
          success: false,
          message: 'Trade not found' 
        });
      }
      RealtimeService.broadcastTradeUpdate(req.user.id, {
        action: 'delete',
        source: '删除订单',
        tradeId: req.params.id,
      });
      res.status(200).json({ 
        success: true,
        message: 'Trade deleted successfully' 
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteAllTrades(req, res, next) {
    try {
      const count = await TradeService.deleteAllTrades(req.user.id);
      RealtimeService.broadcastTradeUpdate(req.user.id, {
        action: 'delete_all',
        source: '清空历史订单',
        count,
      });
      res.status(200).json({
        success: true,
        message: `成功清空 ${count} 笔历史交易记录`,
        count,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Universal trade file parser: handles MT5, MT4, and standard reports in HTML, XML (SpreadsheetML), XLSX, CSV, and TSV formats
   */
  static async uploadTrades(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded.',
        });
      }

      const originalFilename = req.file.originalname || '';
      const timezone = req.body.timezone || 'broker';
      const parsedResult = await parseUniversalTradeFile(req.file.buffer, originalFilename, { timezone });
      const { platform, trades: extractedTrades } = parsedResult;

      if (!extractedTrades || extractedTrades.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid trades could be extracted from the file.',
        });
      }

      const tradesToCreate = extractedTrades.map(t => ({
        ...t,
        userId: req.user.id,
      }));

      const newTrades = await TradeService.createBulkTrades(tradesToCreate);
      const skippedCount = newTrades.skippedCount || 0;
      const insertedCount = newTrades.length;

      let msg = '';
      if (insertedCount > 0 && skippedCount > 0) {
        msg = `成功从 ${platform} 报表导入 ${insertedCount} 笔新交易，已自动过滤 ${skippedCount} 笔重复记录！`;
      } else if (insertedCount > 0) {
        msg = `成功从 ${platform} 报表解析并导入 ${insertedCount} 笔交易！`;
      } else {
        msg = `报表中的全部交易此前均已导入，已自动跳过 ${skippedCount} 笔重复记录。`;
      }

      if (insertedCount > 0) {
        RealtimeService.broadcastTradeUpdate(req.user.id, {
          action: 'upload',
          source: platform || '报表导入',
          platform,
          count: insertedCount,
          skippedCount,
          message: msg,
        });
      }

      res.status(200).json({
        success: true,
        message: msg,
        platform,
        count: insertedCount,
        skippedCount,
        data: newTrades,
      });
    } catch (error) {
      if (error.message && (error.message.includes('报表') || error.message.includes('未在上传') || error.message.includes('文件'))) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      next(error);
    }
  }

  /**
   * Endpoint for MQL EA or automated bridges to push orders directly
   */
  static async syncEATrades(req, res, next) {
    try {
      const payload = req.body;
      const rawTrades = Array.isArray(payload) ? payload : (payload.trades || []);

      if (!rawTrades || rawTrades.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No trades payload provided.',
        });
      }

      const platform = req.body.platform || 'MQL EA';
      const timezone = req.body.timezone || 'broker';

      const tradesToCreate = rawTrades.map(t => {
        const symbol = String(t.symbol || '').trim().toUpperCase();
        const direction = (t.direction === 'short' || t.type === 'sell' || String(t.type) === '1') ? 'short' : 'long';
        const size = parseFloat(t.size || t.volume) || 1.0;
        const entryPrice = parseFloat(t.entryPrice || t.price || t.openPrice) || null;
        const exitPrice = parseFloat(t.exitPrice || t.closePrice) || entryPrice;
        const rawEntryTime = t.entryTime || t.openTime || null;
        const rawExitTime = t.exitTime || t.closeTime || rawEntryTime;
        const entryTime = rawEntryTime ? convertToShanghaiTime(rawEntryTime, timezone) : null;
        const exitTime = rawExitTime ? convertToShanghaiTime(rawExitTime, timezone) : (entryTime || null);
        const ticket = t.ticket ? String(t.ticket).trim() : null;

        const profit = parseFloat(t.profit) || 0;
        const commission = parseFloat(t.commission) || 0;
        const swap = parseFloat(t.swap) || 0;
        const manualPnl = t.manualPnl !== undefined && t.manualPnl !== null
          ? parseFloat(t.manualPnl)
          : Math.round((profit + commission + swap) * 100) / 100;

        return {
          userId: req.user.id,
          ticket,
          symbol,
          direction,
          size,
          entryPrice,
          exitPrice,
          entryTime,
          exitTime,
          tradeDate: exitTime || entryTime || new Date().toISOString(),
          manualPnl,
          stopLoss: parseFloat(t.stopLoss || t.sl) || null,
          takeProfit: parseFloat(t.takeProfit || t.tp) || null,
          notes: t.notes || (ticket ? `Ticket/ID: ${ticket} | EA Auto Sync` : 'EA Auto Sync'),
          tags: [platform, symbol],
          finalTrigger: t.finalTrigger || null,
        };
      });

      const newTrades = await TradeService.createBulkTrades(tradesToCreate);
      const skippedCount = newTrades.skippedCount || 0;
      const insertedCount = newTrades.length;

      let msg = '';
      if (insertedCount > 0 && skippedCount > 0) {
        msg = `EA 成功直推同步 ${insertedCount} 笔新交易，已自动去重 ${skippedCount} 笔已有记录！`;
      } else if (insertedCount > 0) {
        msg = `EA 成功直推同步 ${insertedCount} 笔交易！`;
      } else {
        msg = `推送的全部交易此前均已同步，已自动跳过 ${skippedCount} 笔重复记录。`;
      }

      if (insertedCount > 0) {
        RealtimeService.broadcastTradeUpdate(req.user.id, {
          action: 'ea_sync',
          source: 'MQL EA 自动直推',
          platform,
          count: insertedCount,
          skippedCount,
          message: msg,
          trades: newTrades,
        });
      }

      res.status(200).json({
        success: true,
        message: msg,
        count: insertedCount,
        skippedCount,
        data: newTrades,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * One-click direct sync from local MT5 Terminal
   */
  static async syncMT5Trades(req, res, next) {
    try {
      const days = parseInt(req.body.days) || 30;
      const allHistory = req.body.all === true;
      const limit = parseInt(req.body.limit) || 2000;
      const startDate = req.body.startDate ? String(req.body.startDate).trim() : null;
      const endDate = req.body.endDate ? String(req.body.endDate).trim() : null;

      const scriptPath = path.join(__dirname, '../../scripts/mt5_sync_trades.py');
      const args = [scriptPath, '--limit', String(limit), '--json'];
      if (allHistory) {
        args.push('--all');
      } else if (startDate) {
        args.push('--from-date', startDate);
        if (endDate) {
          args.push('--to-date', endDate);
        }
      } else {
        args.push('--days', String(days));
      }

      const { stdout, stderr } = await execFileAsync('python', args, {
        maxBuffer: 25 * 1024 * 1024,
        timeout: 30000,
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      });

      if (!stdout || !stdout.trim()) {
        throw new Error(stderr || 'No response from MT5 sync tool');
      }

      const result = JSON.parse(stdout);
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error || 'Failed to sync trades from MT5',
        });
      }

      if (!result.trades || result.trades.length === 0) {
        return res.status(200).json({
          success: true,
          message: '所选时间范围内未在 MT5 终端查询到平仓交易记录。',
          count: 0,
          totalFound: 0,
          insertedCount: 0,
          skippedCount: 0,
          data: [],
        });
      }

      const tradesWithUser = result.trades.map(t => ({
        ...t,
        userId: req.user.id,
      }));

      const newTrades = await TradeService.createBulkTrades(tradesWithUser);
      const skippedCount = newTrades.skippedCount || 0;
      const insertedCount = newTrades.length;
      const totalCount = tradesWithUser.length;

      let message = '';
      if (insertedCount > 0 && skippedCount > 0) {
        message = `同步完成！成功新增导入 ${insertedCount} 笔新交易，已自动过滤 ${skippedCount} 笔已存在的重复订单。`;
      } else if (insertedCount > 0) {
        message = `同步完成！成功导入全部 ${insertedCount} 笔 MT5 交易。`;
      } else if (totalCount > 0) {
        message = `同步完成！所选范围内的 ${totalCount} 笔交易此前已全部同步入库，已自动去重，未产生重复订单。`;
      } else {
        message = '所选时间范围内未在 MT5 终端查询到平仓交易记录。';
      }

      if (insertedCount > 0) {
        RealtimeService.broadcastTradeUpdate(req.user.id, {
          action: 'mt5_sync',
          source: 'MT5 终端直连',
          count: insertedCount,
          skippedCount,
          message,
        });

        // Automatically trigger K-line evaluation for newly synced manual trades with SL/TP
        TradeService.autoEvaluateTriggers(req.user.id).catch((err) => {
          console.warn('Auto evaluation after MT5 sync failed:', err.message);
        });
      }

      res.status(200).json({
        success: true,
        message,
        count: insertedCount,
        totalFound: totalCount,
        insertedCount,
        skippedCount,
        data: newTrades,
      });
    } catch (error) {
      console.error('Error syncing from MT5:', error);
      res.status(500).json({
        success: false,
        message: `MT5 Sync failed: ${error.message}`,
      });
    }
  }

  /**
   * Get MT5 connection status and account info
   */
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
      res.status(200).json({
        success: true,
        data: { connected: false, error: error.message },
      });
    }
  }

  static async createBulkTrades(req, res, next) {
    try {
      const trades = req.body.trades || [];
      if (!Array.isArray(trades) || trades.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Trades array is required and cannot be empty.',
        });
      }

      const tradesWithUser = trades.map(t => ({
        ...t,
        userId: req.user.id,
      }));

      const newTrades = await TradeService.createBulkTrades(tradesWithUser);
      const skippedCount = newTrades.skippedCount || 0;
      const insertedCount = newTrades.length;

      if (insertedCount > 0) {
        RealtimeService.broadcastTradeUpdate(req.user.id, {
          action: 'bulk_create',
          source: '批量记录',
          count: insertedCount,
          skippedCount,
        });
      }

      res.status(201).json({
        success: true,
        message: skippedCount > 0
          ? `成功保存 ${insertedCount} 笔交易，已自动过滤 ${skippedCount} 笔重复记录。`
          : `成功保存 ${insertedCount} 笔交易。`,
        count: insertedCount,
        skippedCount,
        data: newTrades,
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadScreenshot(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded.',
        });
      }

      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileExt = path.extname(req.file.originalname) || '.png';
      const fileName = `screenshot_${req.user.id}_${Date.now()}${fileExt}`;
      const filePath = path.join(uploadsDir, fileName);

      fs.writeFileSync(filePath, req.file.buffer);

      const fileUrl = `/uploads/${fileName}`;

      res.status(201).json({
        success: true,
        data: { url: fileUrl },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Real-time Server-Sent Events (SSE) stream endpoint for live order push
   */
  static streamTrades(req, res, next) {
    try {
      RealtimeService.addSubscriber(req.user.id, req, res);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Automatically evaluate final triggers (takeProfit / stopLoss) for manual trades
   */
  static async autoEvaluateTriggers(req, res, next) {
    try {
      const tradeIds = req.body.tradeIds || null;
      const updated = await TradeService.autoEvaluateTriggers(req.user.id, tradeIds);
      if (updated && updated.length > 0) {
        RealtimeService.broadcastTradeUpdate(req.user.id, {
          action: 'triggers_evaluated',
          source: '智能K线回溯',
          count: updated.length,
          trades: updated,
        });
      }
      res.status(200).json({
        success: true,
        count: (updated || []).length,
        data: updated || [],
      });
    } catch (error) {
      next(error);
    }
  }
}
