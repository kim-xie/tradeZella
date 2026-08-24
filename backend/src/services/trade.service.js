import { pool } from '../db.js';
import { types } from 'pg';

// 让 PostgreSQL TIMESTAMP (without time zone) 字段返回原始字符串，避免 node-pg 二次转换为 UTC
types.setTypeParser(types.TIMESTAMP, (val) => val);
types.setTypeParser(types.TIMESTAMPTZ, (val) => val);

// 生成本地时间 ISO 字符串（不带 Z 后缀），与前端 datetime-local 保持一致
// 格式："2026-08-09T11:13:00.000"
const localNowISO = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`;
};

export class TradeService {
  static async createTrade({ userId, symbol, direction, size, entryPrice, exitPrice, notes, tradeDate, tags, sentiment, screenshots, entryTime, exitTime, stopLoss, takeProfit, entryConditions, rating, manualPnl, session }) {
    const client = await pool.connect();
    try {
      const toNull = (v) => (v === '' || v === undefined ? null : v);
      const nowUtc = localNowISO();
      const result = await client.query(
        `INSERT INTO trades (userId, symbol, direction, size, entryPrice, exitPrice, notes, trade_date, tags, sentiment, screenshots, entry_time, exit_time, stop_loss, take_profit, entry_conditions, rating, manual_pnl, session, createdAt, updatedAt)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
           RETURNING *`,
        [userId, symbol, direction, size, entryPrice, toNull(exitPrice), toNull(notes), toNull(tradeDate), toNull(tags), toNull(sentiment), toNull(screenshots), toNull(entryTime), toNull(exitTime), toNull(stopLoss), toNull(takeProfit), toNull(entryConditions), toNull(rating), toNull(manualPnl), toNull(session), nowUtc, nowUtc]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async getTradesByUserId(userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, userId, symbol, direction, size, entryPrice, exitPrice, notes, trade_date, tags, sentiment, screenshots,
                TO_CHAR(entry_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS entry_time,
                TO_CHAR(exit_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS exit_time,
                stop_loss, take_profit, entry_conditions, rating, manual_pnl, session,
                TO_CHAR(createdat, 'YYYY-MM-DD"T"HH24:MI:SS') AS createdat,
                TO_CHAR(updatedat, 'YYYY-MM-DD"T"HH24:MI:SS') AS updatedat
         FROM trades WHERE userId = $1 ORDER BY createdat DESC`,
        [userId]
      );
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getTradeById(id, userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, userId, symbol, direction, size, entryPrice, exitPrice, notes, trade_date, tags, sentiment, screenshots,
                TO_CHAR(entry_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS entry_time,
                TO_CHAR(exit_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS exit_time,
                stop_loss, take_profit, entry_conditions, rating, manual_pnl, session,
                TO_CHAR(createdat, 'YYYY-MM-DD"T"HH24:MI:SS') AS createdat,
                TO_CHAR(updatedat, 'YYYY-MM-DD"T"HH24:MI:SS') AS updatedat
         FROM trades WHERE id = $1 AND userId = $2`,
        [id, userId]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async updateTrade(id, userId, tradeData) {
    const client = await pool.connect();
    try {
      const existingTrade = await this.getTradeById(id, userId);
      if (!existingTrade) {
        return null;
      }

      const fieldMap = {
        entryPrice: 'entryprice',
        exitPrice: 'exitprice',
        tradeDate: 'trade_date',
        entryTime: 'entry_time',
        exitTime: 'exit_time',
        stopLoss: 'stop_loss',
        takeProfit: 'take_profit',
        notes: 'notes',
        tags: 'tags',
        sentiment: 'sentiment',
        screenshots: 'screenshots',
        symbol: 'symbol',
        direction: 'direction',
        size: 'size',
        entryConditions: 'entry_conditions',
        rating: 'rating',
        manualPnl: 'manual_pnl',
        session: 'session',
      };

      const fields = [];
      const values = [];
      let index = 1;

      Object.keys(tradeData).forEach(key => {
        if (tradeData[key] !== undefined && fieldMap[key]) {
          const columnName = fieldMap[key];
          const value = tradeData[key] === '' ? null : tradeData[key];
          fields.push(columnName + ' = $' + index);
          values.push(value);
          index++;
        }
      });

      if (fields.length === 0) {
        return existingTrade;
      }

      values.push(localNowISO(), id, userId);

      const sqlQuery = 'UPDATE trades SET ' + fields.join(', ') + ', updatedAt = $' + index + ' WHERE id = $' + (index + 1) + ' AND userid = $' + (index + 2) + ' RETURNING *';

      const result = await client.query(sqlQuery, values);

      if (result.rowCount === 0) {
        return null;
      }
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async deleteTrade(id, userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM trades WHERE id = $1 AND userId = $2',
        [id, userId]
      );
      return result.rowCount > 0;
    } finally {
      client.release();
    }
  }

  static async createBulkTrades(trades) {
    if (!trades || trades.length === 0) {
      return [];
    }

    const client = await pool.connect();
    try {
      const values = [];
      const queryParams = [];
      let paramIndex = 1;

      for (const trade of trades) {
        const { userId, symbol, direction, size, entryPrice } = trade;
        queryParams.push('($' + (paramIndex++) + ', $' + (paramIndex++) + ', $' + (paramIndex++) + ', $' + (paramIndex++) + ', $' + (paramIndex++) + ')');
        values.push(userId, symbol, direction, size, entryPrice);
      }

      const query = 'INSERT INTO trades (userId, symbol, direction, size, entryPrice) VALUES ' + queryParams.join(', ') + ' RETURNING *';

      const result = await client.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error creating bulk trades:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}