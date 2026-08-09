import { pool } from '../db.js';

export class TradeService {
    static async createTrade({ userId, symbol, direction, size, entryPrice, exitPrice, notes, tradeDate, tags, sentiment, screenshots, entryTime, exitTime, stopLoss, takeProfit }) {
      const client = await pool.connect();
      try {
        // Convert empty strings to null to avoid TIMESTAMP/REAL insertion errors
        const toNull = (v) => (v === '' || v === undefined ? null : v);
        const result = await client.query(
          `INSERT INTO trades (userId, symbol, direction, size, entryPrice, exitPrice, notes, trade_date, tags, sentiment, screenshots, entry_time, exit_time, stop_loss, take_profit)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [userId, symbol, direction, size, entryPrice, toNull(exitPrice), toNull(notes), toNull(tradeDate), toNull(tags), toNull(sentiment), toNull(screenshots), toNull(entryTime), toNull(exitTime), toNull(stopLoss), toNull(takeProfit)]
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
          'SELECT id, userId, symbol, direction, size, entryPrice, exitPrice, notes, trade_date, tags, sentiment, screenshots, entry_time, exit_time, stop_loss, take_profit, createdAt, updatedAt FROM trades WHERE userId = $1 ORDER BY createdAt DESC',
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
          'SELECT id, userId, symbol, direction, size, entryPrice, exitPrice, notes, trade_date, tags, sentiment, screenshots, entry_time, exit_time, stop_loss, take_profit, createdAt, updatedAt FROM trades WHERE id = $1 AND userId = $2',
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

      // Map camelCase keys from frontend to snake_case column names in DB
      const fieldMap = {
        entryPrice: 'entryPrice',
        exitPrice: 'exitPrice',
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
      };

      // Build dynamic update query to only update provided fields
      const fields = [];
      const values = [];
      let index = 1;

      Object.keys(tradeData).forEach(key => {
        if (tradeData[key] !== undefined && fieldMap[key]) {
          const columnName = fieldMap[key];
          const value = tradeData[key] === '' ? null : tradeData[key];
          fields.push(`"${columnName}" = ${index}`);
          values.push(value);
          index++;
        }
      });

      if (fields.length === 0) {
        return existingTrade; // Nothing to update
      }

      values.push(id, userId); // Add id and userId for WHERE clause

      const sqlQuery = `UPDATE trades 
         SET ${fields.join(', ')}, updatedAt = CURRENT_TIMESTAMP 
         WHERE id = ${index} AND userId = ${index + 1}
         RETURNING *`;
      console.log('=== UPDATE SQL ===');
      console.log('SQL:', sqlQuery);
      console.log('VALUES:', JSON.stringify(values, null, 2));

      const result = await client.query(sqlQuery, values);

      if (result.rowCount === 0) {
        return null; // Should not happen if existingTrade was found
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
        queryParams.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
        values.push(userId, symbol, direction, size, entryPrice);
      }

      const query = `
        INSERT INTO trades (userId, symbol, direction, size, entryPrice)
        VALUES ${queryParams.join(', ')}
        RETURNING *
      `;

      const result = await client.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error creating bulk trades:', error);
      throw error; // Re-throw the error so it can be caught by the controller's next(error)
    } finally {
      client.release();
    }
  }
}