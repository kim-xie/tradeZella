import { TradeService } from '../services/trade.service.js';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cleanNumber(val) {
  if (val === undefined || val === null || val === '') return null;
  const cleaned = String(val).replace(/[^0-9.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseDirection(val) {
  if (!val) return 'long';
  const s = String(val).toLowerCase().trim();
  if (s === 'sell' || s === 'short' || s === '1') return 'short';
  return 'long';
}

function parseDateISO(val) {
  if (!val) return null;
  try {
    const s = String(val).trim().replace(/\./g, '-');
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    return s;
  } catch {
    return String(val).trim();
  }
}

export class TradeController {
  static async createTrade(req, res, next) {
    try {
      const tradeData = { ...req.body, userId: req.user.id };
      const newTrade = await TradeService.createTrade(tradeData);
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
      const trades = await TradeService.getTradesByUserId(req.user.id);
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
      res.status(200).json({ 
        success: true,
        message: 'Trade deleted successfully' 
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Universal CSV trade parser: handles MT5, MT4, and TradeZen standard CSV
   */
  static async uploadTrades(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded.',
        });
      }

      const fileContent = req.file.buffer.toString('utf8');

      const parsed = Papa.parse(fileContent, {
        header: false,
        skipEmptyLines: true,
      });

      if (!parsed.data || parsed.data.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Uploaded file is empty or missing data rows.',
        });
      }

      // Find the header row
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(15, parsed.data.length); i++) {
        const rowStr = parsed.data[i].join(' ').toLowerCase();
        if ((rowStr.includes('symbol') || rowStr.includes('item') || rowStr.includes('contract') || rowStr.includes('market') || rowStr.includes('pair')) && 
            (rowStr.includes('price') || rowStr.includes('volume') || rowStr.includes('type') || rowStr.includes('size') || rowStr.includes('qty') || rowStr.includes('amount') || rowStr.includes('side'))) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        return res.status(400).json({
          success: false,
          message: 'Could not find a valid header row with symbol/item columns.',
        });
      }

      const rawHeaders = parsed.data[headerRowIndex].map(h => String(h || '').trim());
      const lowerHeaders = rawHeaders.map(h => h.toLowerCase());

      // Identify platform source (focused on MT5, MT4, and standard CSV)
      let detectedPlatform = 'CSV';
      if (lowerHeaders.some(h => h.includes('taxes') || (h === 'item' && lowerHeaders.some(lh => lh.includes('ticket'))))) {
        detectedPlatform = 'MT4';
      } else if (lowerHeaders.some(h => h.includes('position') || h.includes('deal') || h.includes('swap'))) {
        detectedPlatform = 'MT5';
      }

      // Identify column indices
      const symbolIdx = lowerHeaders.findIndex(h => 
        h.includes('symbol') || h === 'item' || h.includes('contract') || h.includes('market') || h.includes('pair')
      );
      const typeIdx = lowerHeaders.findIndex(h => 
        h.includes('type') || h.includes('direction') || h.includes('action') || h.includes('side')
      );
      const sizeIdx = lowerHeaders.findIndex(h => 
        h.includes('volume') || h.includes('size') || h.includes('lots') || h.includes('shares') || 
        h.includes('qty') || h.includes('amount') || h.includes('executed')
      );
      
      // Look for open and close price/time (handles duplicate headers)
      let openPriceIdx = -1;
      let closePriceIdx = -1;
      let openTimeIdx = -1;
      let closeTimeIdx = -1;

      lowerHeaders.forEach((h, idx) => {
        if (h.includes('entryprice') || h.includes('openprice') || h.includes('open price') || h.includes('entry price') || h.includes('avg entry') || h.includes('order price')) {
          openPriceIdx = idx;
        } else if (h.includes('exitprice') || h.includes('closeprice') || h.includes('close price') || h.includes('exit price') || h.includes('avg exit') || h.includes('exec price') || h.includes('avgprice')) {
          closePriceIdx = idx;
        } else if (h === 'price') {
          if (openPriceIdx === -1) openPriceIdx = idx;
          else if (closePriceIdx === -1) closePriceIdx = idx;
        }

        if (h.includes('entrytime') || h.includes('opentime') || h.includes('open time') || h.includes('entry time') || h.includes('trade_date') || h.includes('date(utc)') || h.includes('trade time') || h.includes('created time') || h === 'date') {
          openTimeIdx = idx;
        } else if (h.includes('exittime') || h.includes('closetime') || h.includes('close time') || h.includes('exit time') || h.includes('closed time') || h.includes('updated time')) {
          closeTimeIdx = idx;
        } else if (h === 'time') {
          if (openTimeIdx === -1) openTimeIdx = idx;
          else if (closeTimeIdx === -1) closeTimeIdx = idx;
        }
      });

      // Fallback for single price column
      if (openPriceIdx === -1 && closePriceIdx !== -1) {
        openPriceIdx = closePriceIdx;
      }

      const profitIdx = lowerHeaders.findIndex(h => 
        h.includes('profit') || h.includes('pnl') || h.includes('manual_pnl') || h.includes('realized')
      );
      const swapIdx = lowerHeaders.findIndex(h => h.includes('swap'));
      const commissionIdx = lowerHeaders.findIndex(h => 
        h.includes('commission') || h.includes('fee') || h.includes('fee paid') || h.includes('trading fee')
      );
      const taxesIdx = lowerHeaders.findIndex(h => h.includes('tax'));
      const slIdx = lowerHeaders.findIndex(h => h.includes('s / l') || h.includes('s/l') || h.includes('stoploss') || h.includes('stop_loss'));
      const tpIdx = lowerHeaders.findIndex(h => (h.includes('t / p') || h.includes('t/p') || h.includes('takeprofit') || h.includes('take_profit')) && !h.includes('profit factor'));
      const posIdIdx = lowerHeaders.findIndex(h => h.includes('position') || h.includes('ticket') || h.includes('deal') || h.includes('order id') || h.includes('trade id'));
      const commentIdx = lowerHeaders.findIndex(h => h.includes('comment') || h.includes('note') || h.includes('notes'));

      if (symbolIdx === -1 || (sizeIdx === -1 && openPriceIdx === -1)) {
        return res.status(400).json({
          success: false,
          message: 'Missing essential columns (Symbol/Item/Contracts, Size/Qty, Price).',
        });
      }

      const tradesToCreate = [];
      for (let i = headerRowIndex + 1; i < parsed.data.length; i++) {
        const row = parsed.data[i];
        if (!row || row.length === 0) continue;

        const symbol = row[symbolIdx] ? String(row[symbolIdx]).trim() : '';
        if (!symbol || symbol.toLowerCase().includes('total') || symbol.toLowerCase().includes('summary') || symbol.toLowerCase() === 'symbol') {
          continue;
        }

        const rawType = typeIdx >= 0 ? row[typeIdx] : 'buy';
        const direction = parseDirection(rawType);

        const size = sizeIdx >= 0 ? cleanNumber(row[sizeIdx]) : 1.0;
        const entryPrice = openPriceIdx >= 0 ? cleanNumber(row[openPriceIdx]) : null;
        const exitPrice = closePriceIdx >= 0 ? cleanNumber(row[closePriceIdx]) : (entryPrice || 0);

        if (!symbol || entryPrice === null || !size) {
          continue;
        }

        const rawProfit = profitIdx >= 0 ? cleanNumber(row[profitIdx]) : null;
        const swap = swapIdx >= 0 ? (cleanNumber(row[swapIdx]) || 0) : 0;
        const commission = commissionIdx >= 0 ? (cleanNumber(row[commissionIdx]) || 0) : 0;
        const taxes = taxesIdx >= 0 ? (cleanNumber(row[taxesIdx]) || 0) : 0;
        
        let manualPnl = null;
        if (rawProfit !== null) {
          manualPnl = Math.round((rawProfit + swap + commission + taxes) * 100) / 100;
        }

        const entryTime = openTimeIdx >= 0 ? parseDateISO(row[openTimeIdx]) : null;
        const exitTime = closeTimeIdx >= 0 ? parseDateISO(row[closeTimeIdx]) : (entryTime || null);
        const stopLoss = slIdx >= 0 ? cleanNumber(row[slIdx]) : null;
        const takeProfit = tpIdx >= 0 ? cleanNumber(row[tpIdx]) : null;

        const posId = posIdIdx >= 0 ? String(row[posIdIdx] || '').trim() : '';
        const comment = commentIdx >= 0 ? String(row[commentIdx] || '').trim() : '';
        const notes = [posId ? `Ticket/ID: ${posId}` : '', comment].filter(Boolean).join(' | ');

        let finalTrigger = null;
        if (comment.toLowerCase().includes('[sl') || comment.toLowerCase().includes('stop loss')) {
          finalTrigger = 'stopLoss';
        } else if (comment.toLowerCase().includes('[tp') || comment.toLowerCase().includes('take profit')) {
          finalTrigger = 'takeProfit';
        }

        tradesToCreate.push({
          userId: req.user.id,
          ticket: posId || null,
          symbol,
          direction,
          size,
          entryPrice,
          exitPrice,
          entryTime,
          exitTime,
          tradeDate: entryTime || new Date().toISOString(),
          manualPnl,
          stopLoss,
          takeProfit,
          notes: notes || `${detectedPlatform} 导入交易记录`,
          tags: [detectedPlatform, symbol],
          finalTrigger,
        });
      }

      if (tradesToCreate.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid trades could be extracted from the file.',
        });
      }

      const newTrades = await TradeService.createBulkTrades(tradesToCreate);
      const skippedCount = newTrades.skippedCount || 0;
      const insertedCount = newTrades.length;

      let msg = '';
      if (insertedCount > 0 && skippedCount > 0) {
        msg = `成功从 ${detectedPlatform} 报表导入 ${insertedCount} 笔新交易，已自动过滤 ${skippedCount} 笔重复记录！`;
      } else if (insertedCount > 0) {
        msg = `成功从 ${detectedPlatform} 报表解析并导入 ${insertedCount} 笔交易！`;
      } else {
        msg = `报表中的全部交易此前均已导入，已自动跳过 ${skippedCount} 笔重复记录。`;
      }

      res.status(200).json({
        success: true,
        message: msg,
        platform: detectedPlatform,
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

      const scriptPath = path.join(__dirname, '../../scripts/mt5_sync_trades.py');
      const args = [scriptPath, '--days', String(days), '--limit', String(limit), '--json'];
      if (allHistory) args.push('--all');

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
}
