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

// 提取标准化秒级时间字符串 (YYYY-MM-DDTHH:mm:ss)
const normalizeTimeStr = (t) => {
  if (!t) return '';
  if (typeof t === 'string') {
    return t.replace(' ', 'T').replace(/\.\d+.*$/, '').replace(/Z$/, '');
  }
  if (t instanceof Date && !isNaN(t.getTime())) {
    return t.toISOString().replace(/\.\d+.*$/, '');
  }
  return String(t);
};

// 提取标准化浮点数字符串
const normalizeNumStr = (val) => {
  if (val === null || val === undefined || val === '') return '0.0000';
  const num = parseFloat(val);
  return isNaN(num) ? '0.0000' : num.toFixed(4);
};

// 生成单笔交易的唯一综合指纹
const buildTradeFingerprint = (trade) => {
  const sym = String(trade.symbol || '').trim().toUpperCase();
  const dir = String(trade.direction || '').trim().toLowerCase();
  const ep = normalizeNumStr(trade.entryPrice ?? trade.entryprice ?? trade.ep);
  const xp = normalizeNumStr(trade.exitPrice ?? trade.exitprice ?? trade.xp);
  const sz = normalizeNumStr(trade.size ?? trade.sz);
  const et = normalizeTimeStr(trade.entryTime ?? trade.entry_time ?? trade.et ?? trade.tradeDate ?? trade.trade_date);
  const xt = normalizeTimeStr(trade.exitTime ?? trade.exit_time ?? trade.xt);
  return `${sym}|${dir}|${ep}|${xp}|${sz}|${et}|${xt}`;
};

// 从交易对象或 notes 中提取 ticket/position_id
const extractTradeTicket = (trade) => {
  if (trade.ticket) return String(trade.ticket).trim();
  if (trade.positionId) return String(trade.positionId).trim();
  if (trade.pos_id) return String(trade.pos_id).trim();

  const notes = trade.notes || '';
  const mt5Match = notes.match(/MT5 Position #([0-9]+)/);
  if (mt5Match) return mt5Match[1];

  const ticketMatch = notes.match(/Ticket\/ID:\s*([0-9a-zA-Z_-]+)/);
  if (ticketMatch) return ticketMatch[1];

  return null;
};

export class TradeService {
  static async createTrade({
    userId,
    ticket,
    symbol,
    direction,
    size,
    entryPrice,
    exitPrice,
    notes,
    tradeDate,
    tags,
    sentiment,
    screenshots,
    entryTime,
    exitTime,
    stopLoss,
    takeProfit,
    entryConditions,
    rating,
    manualPnl,
    leverage,
    session,
    finalTrigger,
  }) {
    const client = await pool.connect();
    try {
      const toNull = (v) => (v === '' || v === undefined ? null : v);
      const nowUtc = localNowISO();
      const leverageVal = (!leverage || leverage < 1) ? 1 : leverage;
      const extractedTicket = ticket || extractTradeTicket({ ticket, notes });

      const result = await client.query(
        `INSERT INTO trades (
          userId, ticket, symbol, direction, size, entryPrice, exitPrice, notes,
          trade_date, tags, sentiment, screenshots, entry_time, exit_time,
          stop_loss, take_profit, entry_conditions, rating, manual_pnl,
          leverage, session, final_trigger, createdAt, updatedAt
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING *`,
        [
          userId,
          toNull(extractedTicket),
          symbol,
          direction,
          size,
          entryPrice,
          toNull(exitPrice),
          toNull(notes),
          toNull(tradeDate),
          toNull(tags),
          toNull(sentiment),
          toNull(screenshots),
          toNull(entryTime),
          toNull(exitTime),
          toNull(stopLoss),
          toNull(takeProfit),
          toNull(entryConditions),
          toNull(rating),
          toNull(manualPnl),
          leverageVal,
          toNull(session),
          toNull(finalTrigger),
          nowUtc,
          nowUtc,
        ]
      );
      return result.rows[0];
    } finally {
      client.release();
    }
  }

  static async getTradesByUserId(userId, options = {}) {
    const client = await pool.connect();
    try {
      let query = `SELECT id, userId, ticket, symbol, direction, size, entryPrice, exitPrice, notes, trade_date, tags, sentiment, screenshots,
                TO_CHAR(entry_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS entry_time,
                TO_CHAR(exit_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS exit_time,
                stop_loss, take_profit, entry_conditions, rating, manual_pnl, leverage, session, final_trigger,
                TO_CHAR(createdat, 'YYYY-MM-DD"T"HH24:MI:SS') AS createdat,
                TO_CHAR(updatedat, 'YYYY-MM-DD"T"HH24:MI:SS') AS updatedat
         FROM trades WHERE userId = $1 ORDER BY createdat DESC`;
      const params = [userId];

      if (options.limit && options.limit > 0) {
        params.push(options.limit);
        query += ` LIMIT $${params.length}`;
        if (options.offset && options.offset > 0) {
          params.push(options.offset);
          query += ` OFFSET $${params.length}`;
        }
      }

      const result = await client.query(query, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  static async getTradeById(id, userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT id, userId, ticket, symbol, direction, size, entryPrice, exitPrice, notes, trade_date, tags, sentiment, screenshots,
                TO_CHAR(entry_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS entry_time,
                TO_CHAR(exit_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS exit_time,
                stop_loss, take_profit, entry_conditions, rating, manual_pnl, leverage, session, final_trigger,
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
        ticket: 'ticket',
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
        leverage: 'leverage',
        session: 'session',
        finalTrigger: 'final_trigger',
      };

      const fields = [];
      const values = [];
      let index = 1;

      Object.keys(tradeData).forEach((key) => {
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

      const sqlQuery =
        'UPDATE trades SET ' +
        fields.join(', ') +
        ', updatedAt = $' +
        index +
        ' WHERE id = $' +
        (index + 1) +
        ' AND userid = $' +
        (index + 2) +
        ' RETURNING *';

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

  static async deleteAllTrades(userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM trades WHERE userId = $1',
        [userId]
      );
      return result.rowCount;
    } finally {
      client.release();
    }
  }

  /**
   * 批量创建交易记录（内置全量智能防重机制）
   * 1. 批次内自去重：避免同一个导入批次中有重复订单
   * 2. 数据库比对去重：根据 userId + ticket 以及核心综合特征指纹（品种、方向、价格、手数、开平仓时间），自动剔除已存在的订单
   * 3. 数据库唯一索引保护：ON CONFLICT (userid, ticket) WHERE ticket IS NOT NULL DO NOTHING，确保绝对幂等
   */
  static async createBulkTrades(trades) {
    if (!trades || trades.length === 0) {
      const empty = [];
      empty.skippedCount = 0;
      empty.insertedCount = 0;
      empty.totalReceived = 0;
      return empty;
    }

    const client = await pool.connect();
    try {
      // 提取目标用户 ID（批量同步通常属于同一用户）
      const userIds = [...new Set(trades.map((t) => t.userId).filter(Boolean))];
      
      // 查询涉及用户在数据库中已有的所有订单标识和特征指纹
      const existingTickets = new Set();
      const existingFingerprints = new Set();

      for (const uId of userIds) {
        const existingTradesRes = await client.query(
          `SELECT id, ticket, symbol, direction,
                  round(entryprice::numeric, 4) AS entryprice,
                  round(coalesce(exitprice, 0)::numeric, 4) AS exitprice,
                  round(size::numeric, 4) AS size,
                  TO_CHAR(entry_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS entry_time,
                  TO_CHAR(exit_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS exit_time,
                  notes
           FROM trades
           WHERE userid = $1`,
          [uId]
        );

        for (const row of existingTradesRes.rows) {
          if (row.ticket) {
            existingTickets.add(`${uId}:${String(row.ticket).trim()}`);
          }
          // 从已有 notes 中提取 ticket 兼容旧数据
          const fromNotesTicket = extractTradeTicket(row);
          if (fromNotesTicket) {
            existingTickets.add(`${uId}:${fromNotesTicket}`);
          }

          // 记录指纹
          const fp = `${uId}:${buildTradeFingerprint(row)}`;
          existingFingerprints.add(fp);
        }
      }

      // 批次内去重与数据库已存对比
      const tradesToInsert = [];
      let skippedCount = 0;

      for (const trade of trades) {
        const uId = trade.userId;
        const ticket = extractTradeTicket(trade);
        if (ticket) {
          trade.ticket = ticket;
        }

        // 1. 检查 ticket 是否已存在
        if (ticket && existingTickets.has(`${uId}:${ticket}`)) {
          skippedCount++;
          continue;
        }

        // 2. 检查交易综合特征指纹是否已存在
        const fp = `${uId}:${buildTradeFingerprint(trade)}`;
        if (existingFingerprints.has(fp)) {
          skippedCount++;
          continue;
        }

        // 未出现过的新订单，记录并准备入库
        if (ticket) {
          existingTickets.add(`${uId}:${ticket}`);
        }
        existingFingerprints.add(fp);
        tradesToInsert.push(trade);
      }

      // 如果全部都已存在，直接返回空结果（带统计）
      if (tradesToInsert.length === 0) {
        const result = [];
        result.skippedCount = skippedCount;
        result.insertedCount = 0;
        result.totalReceived = trades.length;
        return result;
      }

      // 分批分块执行批量插入（每批 200 笔，200 * 24 = 4800 个参数，远低于 PostgreSQL 65,535 参数协议上限，杜绝 bind message parameter overflow）
      const BATCH_SIZE = 200;
      const allInsertedRows = [];

      await client.query('BEGIN');
      try {
        for (let i = 0; i < tradesToInsert.length; i += BATCH_SIZE) {
          const batch = tradesToInsert.slice(i, i + BATCH_SIZE);
          const values = [];
          const queryParams = [];
          let paramIndex = 1;
          const nowUtc = localNowISO();

          for (const trade of batch) {
            const {
              userId,
              ticket,
              symbol,
              direction,
              size,
              entryPrice,
              exitPrice,
              notes,
              tradeDate,
              tags,
              sentiment,
              screenshots,
              entryTime,
              exitTime,
              stopLoss,
              takeProfit,
              entryConditions,
              rating,
              manualPnl,
              leverage,
              session,
              finalTrigger,
            } = trade;

            const toNull = (v) => (v === '' || v === undefined ? null : v);
            const leverageVal = (!leverage || leverage < 1) ? 1 : leverage;

            const rowParams = [];
            for (let p = 0; p < 24; p++) {
              rowParams.push('$' + paramIndex++);
            }
            queryParams.push('(' + rowParams.join(', ') + ')');

            values.push(
              userId,
              toNull(ticket),
              symbol,
              direction,
              size,
              entryPrice,
              toNull(exitPrice),
              toNull(notes),
              toNull(tradeDate || exitTime || entryTime),
              toNull(tags),
              toNull(sentiment),
              toNull(screenshots),
              toNull(entryTime),
              toNull(exitTime),
              toNull(stopLoss),
              toNull(takeProfit),
              toNull(entryConditions),
              toNull(rating),
              toNull(manualPnl),
              leverageVal,
              toNull(session),
              toNull(finalTrigger),
              nowUtc,
              nowUtc
            );
          }

          const query = `
            INSERT INTO trades (
              userId, ticket, symbol, direction, size, entryPrice, exitPrice, notes,
              trade_date, tags, sentiment, screenshots, entry_time, exit_time,
              stop_loss, take_profit, entry_conditions, rating, manual_pnl,
              leverage, session, final_trigger, createdAt, updatedAt
            )
            VALUES ${queryParams.join(', ')}
            ON CONFLICT (userid, ticket) WHERE ticket IS NOT NULL DO NOTHING
            RETURNING *`;

          const result = await client.query(query, values);
          if (result.rows && result.rows.length > 0) {
            allInsertedRows.push(...result.rows);
          }
        }
        await client.query('COMMIT');
      } catch (batchErr) {
        await client.query('ROLLBACK');
        throw batchErr;
      }

      // 计算真实插入与跳过的数量
      const actualInsertedCount = allInsertedRows.length;
      const conflictSkipped = tradesToInsert.length - actualInsertedCount;
      const totalSkipped = skippedCount + conflictSkipped;

      allInsertedRows.skippedCount = totalSkipped;
      allInsertedRows.insertedCount = actualInsertedCount;
      allInsertedRows.totalReceived = trades.length;

      return allInsertedRows;
    } catch (error) {
      console.error('Error creating bulk trades with deduplication:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
