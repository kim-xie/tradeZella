import { TradeService } from '../services/trade.service.js';
import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TradeController {
  static async createTrade(req, res, next) {
    try {
      // Assuming req.user is populated by authentication middleware
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
      console.log('=== UPDATE TRADE ===');
      console.log('Trade ID:', req.params.id);
      console.log('User ID:', req.user.id);
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      const updatedTrade = await TradeService.updateTrade(req.params.id, req.user.id, req.body);
      console.log('Update result:', updatedTrade ? 'SUCCESS' : 'FAILED (null)');
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
      console.error('Update trade error:', error);
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

  static async uploadTrades(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded.',
        });
      }

      const fileContent = req.file.buffer.toString('utf8');

      const tradesToCreate = await new Promise((resolve, reject) => {
        Papa.parse(fileContent, {
          header: true,
          skipEmptyLines: true,
          transformHeader: header => header.trim().toLowerCase().replace(' ', ''), // Normalizes header
          complete: (results) => {
            if (results.errors.length) {
              console.warn('CSV parsing errors encountered:', results.errors);
            }

            const requiredHeaders = ['symbol', 'direction', 'size', 'entryprice'];
            const actualHeaders = results.meta.fields;

            for (const requiredHeader of requiredHeaders) {
              if (!actualHeaders.includes(requiredHeader)) {
                return reject(new Error(`Missing required CSV header: ${requiredHeader}. Headers found: ${results.meta.fields.join(', ')}`));
              }
            }

            const trades = results.data.map(row => {
              const size = parseFloat(row.size);
              const entryPrice = parseFloat(row.entryprice);
  
              if (!row.symbol || !row.direction || isNaN(size) || isNaN(entryPrice)) {
                console.warn('Skipping invalid row:', row);
                return null;
              }
  
              return {
                symbol: row.symbol,
                direction: row.direction.toLowerCase(),
                size,
                entryPrice,
                userId: req.user.id,
              };
            }).filter(trade => trade !== null);

            resolve(trades);
          },
          error: (error) => reject(error),
        });
      });

      if (tradesToCreate.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid trades found in the uploaded file.',
        });
      }

      const newTrades = await TradeService.createBulkTrades(tradesToCreate);

      res.status(201).json({
        success: true,
        message: `Successfully created ${newTrades.length} trades.`,
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