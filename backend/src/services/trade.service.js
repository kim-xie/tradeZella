import { pool } from '../db.js';
import { types } from 'pg';
import { CandleService } from './candle.service.js';

// Automatically determine market session from entry time
export const calculateMarketSession = (entryTime) => {
  if (!entryTime) return null;
  let hour;
  if (entryTime instanceof Date) {
    hour = entryTime.getHours();
  } else {
    const str = String(entryTime).trim();
    const match = str.match(/[T\s](\d{1,2}):/);
    if (!match) return null;
    hour = parseInt(match[1], 10);
  }
  if (isNaN(hour)) return null;

  if (hour >= 8 && hour < 15) return 'Asia';
  if (hour >= 15 && hour < 21) return 'Europe';
  return 'US';
};

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

// 解析时间为 Unix 毫秒时间戳（容错多种时区与字符串格式）
export const parseTimeToMs = (t) => {
  if (!t) return null;
  if (t instanceof Date && !isNaN(t.getTime())) return t.getTime();
  if (typeof t === 'number' && !isNaN(t)) return t;
  const str = String(t).trim();
  if (!str) return null;
  const isoStr = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
  const parsed = new Date(isoStr);
  if (!isNaN(parsed.getTime())) return parsed.getTime();
  const parsedDirect = new Date(str);
  return isNaN(parsedDirect.getTime()) ? null : parsedDirect.getTime();
};

// 标准化标的代码（移除常见券商后缀如 .m, .raw, _pro, # 等）
export const cleanSymbol = (s) => {
  if (!s) return '';
  return String(s).trim().toUpperCase().replace(/[\._#].*$/, '');
};

// 提取标准化秒级时间字符串 (YYYY-MM-DDTHH:mm:ss)
export const normalizeTimeStr = (t) => {
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
export const normalizeNumStr = (val) => {
  if (val === null || val === undefined || val === '') return '0.0000';
  const num = parseFloat(val);
  return isNaN(num) ? '0.0000' : num.toFixed(4);
};

// 生成单笔交易的唯一综合指纹
export const buildTradeFingerprint = (trade) => {
  const sym = cleanSymbol(trade.symbol);
  const rawDir = String(trade.direction || '').trim().toLowerCase();
  const dir = (rawDir === 'short' || rawDir === 'sell' || rawDir === '1') ? 'short' : 'long';
  const ep = normalizeNumStr(trade.entryPrice ?? trade.entryprice ?? trade.ep);
  const xp = normalizeNumStr(trade.exitPrice ?? trade.exitprice ?? trade.xp);
  const sz = normalizeNumStr(trade.size ?? trade.sz);
  const et = normalizeTimeStr(trade.entryTime ?? trade.entry_time ?? trade.et ?? trade.tradeDate ?? trade.trade_date);
  const xt = normalizeTimeStr(trade.exitTime ?? trade.exit_time ?? trade.xt);
  return `${sym}|${dir}|${ep}|${xp}|${sz}|${et}|${xt}`;
};

// 从交易对象或 notes 中提取 ticket
export const extractTradeTicket = (trade) => {
  if (!trade) return null;
  if (trade.ticket) return String(trade.ticket).trim();
  if (trade.positionId) return String(trade.positionId).trim();
  if (trade.pos_id) return String(trade.pos_id).trim();

  const notes = trade.notes || '';
  const dealMatch = notes.match(/Deal #([0-9]+)/);
  if (dealMatch) return dealMatch[1];

  const mt5Match = notes.match(/MT5 Position #([0-9]+)/);
  if (mt5Match) return mt5Match[1];

  const ticketMatch = notes.match(/Ticket\/ID:\s*([0-9a-zA-Z_-]+)/);
  if (ticketMatch) return ticketMatch[1];

  return null;
};

// 从交易对象或 notes 中提取 MT5 Position ID（用于区分或关联 EA Deal 与报表 Position）
export const extractPositionId = (trade) => {
  if (!trade) return null;
  if (trade.positionId && String(trade.positionId).trim() !== '0') {
    return String(trade.positionId).trim();
  }
  if (trade.pos_id && String(trade.pos_id).trim() !== '0') {
    return String(trade.pos_id).trim();
  }
  const notes = trade.notes || '';
  const mt5Match = notes.match(/MT5 Position #([0-9]+)/);
  if (mt5Match) return mt5Match[1];
  return null;
};

/**
 * 智能模糊/容差订单防重判定函数
 * 适用于不同数据源（EA直推、CSV报表导入、手动记账）平仓时间微差、秒级精度丢失或止损止盈缺失的情况
 */
export const areTradesFuzzyDuplicate = (tradeA, tradeB, options = {}) => {
  if (!tradeA || !tradeB) return false;
  const { strictTicket = false } = options;

  // 1. 品种必须一致 (容差后缀如 .m / .raw)
  const symA = cleanSymbol(tradeA.symbol);
  const symB = cleanSymbol(tradeB.symbol);
  if (!symA || !symB || symA !== symB) return false;

  // 2. 多空方向必须一致
  const rawDirA = String(tradeA.direction || '').trim().toLowerCase();
  const rawDirB = String(tradeB.direction || '').trim().toLowerCase();
  const dirA = (rawDirA === 'short' || rawDirA === 'sell' || rawDirA === '1') ? 'short' : 'long';
  const dirB = (rawDirB === 'short' || rawDirB === 'sell' || rawDirB === '1') ? 'short' : 'long';
  if (dirA !== dirB) return false;

  // 3. 手数必须一致 (容差 0.005，避免把部分平仓误判为重复)
  const szA = parseFloat(tradeA.size ?? tradeA.sz);
  const szB = parseFloat(tradeB.size ?? tradeB.sz);
  if (!isNaN(szA) && !isNaN(szB) && Math.abs(szA - szB) > 0.005) {
    return false;
  }

  // 4. Ticket 单号与 Position ID 比对
  const ticketA = extractTradeTicket(tradeA);
  const ticketB = extractTradeTicket(tradeB);
  if (ticketA && ticketB && ticketA === ticketB) {
    return true;
  }

  const posA = extractPositionId(tradeA);
  const posB = extractPositionId(tradeB);
  const isDealA = Boolean((tradeA.notes || '').includes('Deal #') || (ticketA && posA && ticketA !== posA));
  const isDealB = Boolean((tradeB.notes || '').includes('Deal #') || (ticketB && posB && ticketB !== posB));

  if (posA && posB) {
    if (posA !== posB) return false;
    // 同一个 MT5 Position 下的两笔不同 Deal Ticket（如分批平仓），不可合并！
    if (isDealA && isDealB && ticketA && ticketB && ticketA !== ticketB) {
      return false;
    }
    // 同批次内有不同 Ticket 不可合并
    if (strictTicket && ticketA && ticketB && ticketA !== ticketB) {
      return false;
    }
    // 跨来源（一侧为 Deal 记录、一侧为 Position 报表记录）且手数一致（即完整单笔平仓），确认同一笔
    if (isDealA !== isDealB) {
      return true;
    }
  }

  // 同批次内部或同源均有明确不同 Ticket 时，不进行模糊合并，防止连续拆单/加仓被误删
  if (strictTicket && ticketA && ticketB && ticketA !== ticketB) {
    return false;
  }
  if (isDealA && isDealB && ticketA && ticketB && ticketA !== ticketB) {
    return false;
  }

  // 5. 开仓入场时间比对 (容差 150 秒 / 2.5分钟)
  const etA = parseTimeToMs(tradeA.entryTime ?? tradeA.entry_time ?? tradeA.et ?? tradeA.tradeDate ?? tradeA.trade_date);
  const etB = parseTimeToMs(tradeB.entryTime ?? tradeB.entry_time ?? tradeB.et ?? tradeB.tradeDate ?? tradeB.trade_date);

  if (etA && etB) {
    const entryDiffSec = Math.abs(etA - etB) / 1000;
    if (entryDiffSec > 150) {
      return false;
    }
  } else if ((etA && !etB) || (!etA && etB)) {
    if (!ticketA && !ticketB) {
      const dA = String(tradeA.tradeDate || tradeA.trade_date || tradeA.entryTime || tradeA.entry_time || '').substring(0, 10);
      const dB = String(tradeB.tradeDate || tradeB.trade_date || tradeB.entryTime || tradeB.entry_time || '').substring(0, 10);
      if (dA && dB && dA !== dB) return false;
    }
  }

  // 6. 出场平仓时间比对 (容差 210 秒 / 3.5分钟)
  const xtA = parseTimeToMs(tradeA.exitTime ?? tradeA.exit_time ?? tradeA.xt);
  const xtB = parseTimeToMs(tradeB.exitTime ?? tradeB.exit_time ?? tradeB.xt);

  let exitMatch = false;
  if (xtA && xtB) {
    const exitDiffSec = Math.abs(xtA - xtB) / 1000;
    if (exitDiffSec <= 210) {
      exitMatch = true;
    }
  } else if (!xtA && !xtB) {
    exitMatch = true;
  }

  // 7. 净盈亏比对 (容差 0.05 货币单位)
  const pnlA = parseFloat(tradeA.manualPnl ?? tradeA.manual_pnl ?? tradeA.pnl);
  const pnlB = parseFloat(tradeB.manualPnl ?? tradeB.manual_pnl ?? tradeB.pnl);
  let pnlMatch = false;
  let pnlConflict = false;
  if (!isNaN(pnlA) && !isNaN(pnlB)) {
    pnlMatch = Math.abs(pnlA - pnlB) <= 0.05;
    // 若两笔单均有不同 Ticket 且净盈亏差异显著 (> $1 或正负相反)，通常为不同成交单
    if (ticketA && ticketB && ticketA !== ticketB && (Math.abs(pnlA - pnlB) > 1.0 || (pnlA * pnlB < 0))) {
      pnlConflict = true;
    }
  }

  // 8. 价格比对（严格收紧为相对价差 <= 0.01%，防止外汇等小报价品种 <= 0.5 全部误匹配）
  const isPriceClose = (pA, pB) => {
    if (isNaN(pA) || isNaN(pB) || pA <= 0 || pB <= 0) return false;
    const tol = Math.max(1e-5, Math.max(pA, pB) * 0.0001);
    return Math.abs(pA - pB) <= tol;
  };

  const epA = parseFloat(tradeA.entryPrice ?? tradeA.entryprice ?? tradeA.ep);
  const epB = parseFloat(tradeB.entryPrice ?? tradeB.entryprice ?? tradeB.ep);
  const epMatch = isPriceClose(epA, epB);

  const xpA = parseFloat(tradeA.exitPrice ?? tradeA.exitprice ?? tradeA.xp);
  const xpB = parseFloat(tradeB.exitPrice ?? tradeB.exitprice ?? tradeB.xp);
  const xpMatch = isPriceClose(xpA, xpB);

  // 若双方均有不同 MT5 Ticket，必须同时满足入场价与出场价精密吻合且盈亏不冲突，避免短时间拆单被误删
  if (ticketA && ticketB && ticketA !== ticketB) {
    if (pnlConflict) return false;
    return exitMatch && epMatch && xpMatch;
  }

  // 综合判定规则（主要针对无 Ticket 的手动记账 / 旧报表与 EA 同步合并）：
  if (pnlMatch && (epMatch || xpMatch || exitMatch)) return true;
  if (exitMatch && epMatch && xpMatch) return true;
  if (!xtA && !xtB && epMatch) return true;

  return false;
};

/**
 * 智能融合补充已存订单信息（将新数据源更完善的字段回填至已有记录）
 */
export const enrichExistingTrade = async (client, existingTrade, incomingTrade, userId) => {
  if (!existingTrade || !incomingTrade) return false;
  const updates = [];
  const params = [];
  let paramIdx = 1;

  // 1. Ticket 单号回填
  const inTicket = extractTradeTicket(incomingTrade);
  if (!existingTrade.ticket && inTicket) {
    updates.push(`ticket = $${paramIdx++}`);
    params.push(inTicket);
    existingTrade.ticket = inTicket;
  }

  // 2. 止损价 (SL) 智能回填
  const inSl = parseFloat(incomingTrade.stopLoss ?? incomingTrade.stop_loss);
  if ((existingTrade.stop_loss === null || existingTrade.stop_loss === undefined || Number(existingTrade.stop_loss) === 0) && !isNaN(inSl) && inSl > 0) {
    updates.push(`stop_loss = $${paramIdx++}`);
    params.push(inSl);
    existingTrade.stop_loss = inSl;
  }

  // 3. 止盈价 (TP) 智能回填
  const inTp = parseFloat(incomingTrade.takeProfit ?? incomingTrade.take_profit);
  if ((existingTrade.take_profit === null || existingTrade.take_profit === undefined || Number(existingTrade.take_profit) === 0) && !isNaN(inTp) && inTp > 0) {
    updates.push(`take_profit = $${paramIdx++}`);
    params.push(inTp);
    existingTrade.take_profit = inTp;
  }

  // 4. 平仓出场时间更新（若 incoming 具有更精确的秒级时间，予以更新）
  const inExit = incomingTrade.exitTime ?? incomingTrade.exit_time;
  if (inExit) {
    const normInExit = normalizeTimeStr(inExit);
    if (!existingTrade.exit_time || (normInExit.length > existingTrade.exit_time.length && !existingTrade.exit_time.endsWith(':00'))) {
      updates.push(`exit_time = $${paramIdx++}`);
      params.push(normInExit);
      existingTrade.exit_time = normInExit;
    }
  }

  // 5. 走势打到止盈/止损 (final_trigger) 回填
  const inTrigger = incomingTrade.finalTrigger ?? incomingTrade.final_trigger;
  if (!existingTrade.final_trigger && inTrigger) {
    updates.push(`final_trigger = $${paramIdx++}`);
    params.push(inTrigger);
    existingTrade.final_trigger = inTrigger;
  }

  // 6. 净盈亏 (manual_pnl) 回填
  const inPnl = parseFloat(incomingTrade.manualPnl ?? incomingTrade.manual_pnl);
  if ((existingTrade.manual_pnl === null || existingTrade.manual_pnl === undefined) && !isNaN(inPnl)) {
    updates.push(`manual_pnl = $${paramIdx++}`);
    params.push(inPnl);
    existingTrade.manual_pnl = inPnl;
  }

  // 7. 标签合并 (tags)
  const inTags = incomingTrade.tags;
  if (Array.isArray(inTags) && inTags.length > 0) {
    const existingTags = Array.isArray(existingTrade.tags) ? existingTrade.tags : [];
    const mergedTags = [...new Set([...existingTags, ...inTags])];
    if (mergedTags.length > existingTags.length) {
      updates.push(`tags = $${paramIdx++}`);
      params.push(mergedTags);
      existingTrade.tags = mergedTags;
    }
  }

  // 8. 截图合并 (screenshots)
  const inScreenshots = incomingTrade.screenshots;
  if (Array.isArray(inScreenshots) && inScreenshots.length > 0) {
    const existingScreenshots = Array.isArray(existingTrade.screenshots) ? existingTrade.screenshots : [];
    const mergedScreenshots = [...new Set([...existingScreenshots, ...inScreenshots])];
    if (mergedScreenshots.length > existingScreenshots.length) {
      updates.push(`screenshots = $${paramIdx++}`);
      params.push(mergedScreenshots);
      existingTrade.screenshots = mergedScreenshots;
    }
  }

  if (updates.length > 0) {
    updates.push(`updatedAt = $${paramIdx++}`);
    params.push(localNowISO());

    const idParam = `$${paramIdx++}`;
    params.push(existingTrade.id);
    const userParam = `$${paramIdx++}`;
    params.push(userId);

    await client.query(
      `UPDATE trades SET ${updates.join(', ')} WHERE id = ${idParam} AND userid = ${userParam}`,
      params
    );
    return true;
  }
  return false;
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
      const derivedSession = session || calculateMarketSession(entryTime || tradeDate);

      // 1. 检查是否存在模糊重复的已存订单（防重并智能补全）
      const existingCandidates = await client.query(
        `SELECT id, ticket, symbol, direction,
                round(entryprice::numeric, 4) AS entryprice,
                round(coalesce(exitprice, 0)::numeric, 4) AS exitprice,
                round(size::numeric, 4) AS size,
                TO_CHAR(entry_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS entry_time,
                TO_CHAR(exit_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS exit_time,
                stop_loss, take_profit, manual_pnl, notes, tags, screenshots, final_trigger
         FROM trades
         WHERE userid = $1 AND symbol ILIKE $2
         ORDER BY id DESC LIMIT 50`,
        [userId, symbol]
      );

      const incomingTrade = {
        userId,
        ticket: extractedTicket,
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
        leverage: leverageVal,
        session: derivedSession,
        finalTrigger,
      };

      for (const row of existingCandidates.rows) {
        if (areTradesFuzzyDuplicate(row, incomingTrade)) {
          await enrichExistingTrade(client, row, incomingTrade, userId);
          return row;
        }
      }

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
          toNull(derivedSession),
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
         FROM trades WHERE userId = $1 ORDER BY COALESCE(entry_time, createdat) DESC, id DESC`;
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

  static async getUserBrokerTimezone(userId) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'SELECT broker_timezone FROM users WHERE id = $1',
        [userId]
      );
      return result.rows[0]?.broker_timezone || null;
    } catch (err) {
      if (err?.code === '42703') return null;
      throw err;
    } finally {
      client.release();
    }
  }

  static async saveUserBrokerTimezone(userId, brokerTimezone) {
    if (!userId || !brokerTimezone) return null;
    const client = await pool.connect();
    try {
      await client.query(
        'UPDATE users SET broker_timezone = $1 WHERE id = $2',
        [brokerTimezone, userId]
      );
      return brokerTimezone;
    } catch (err) {
      if (err?.code === '42703') return null;
      throw err;
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

      if ((tradeData.entryTime || tradeData.entry_time) && tradeData.session === undefined) {
        const autoS = calculateMarketSession(tradeData.entryTime || tradeData.entry_time);
        if (autoS) {
          tradeData.session = autoS;
        }
      }

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
   * 批量创建交易记录（内置智能容差防重与新旧数据融合补全机制）
   * 1. 批次内自去重：避免同一个导入批次中有重复订单
   * 2. 数据库比对去重：根据 userId + ticket 以及特征指纹、模糊时间容差比对，自动剔除已存在的订单
   * 3. 智能融合补全：若新订单带有更完整的信息（如 SL/TP、精确平仓时间、finalTrigger），自动丰富已有订单
   * 4. 数据库唯一索引保护：ON CONFLICT (userid, ticket) WHERE ticket IS NOT NULL DO NOTHING，确保绝对幂等
   */
  static async createBulkTrades(trades) {
    if (!trades || trades.length === 0) {
      const empty = [];
      empty.skippedCount = 0;
      empty.insertedCount = 0;
      empty.enrichedCount = 0;
      empty.totalReceived = 0;
      return empty;
    }

    const client = await pool.connect();
    try {
      const userIds = [...new Set(trades.map((t) => t.userId).filter(Boolean))];
      
      const existingTickets = new Map();
      const existingFingerprints = new Map();
      const existingBySymbol = new Map();

      for (const uId of userIds) {
        const existingTradesRes = await client.query(
          `SELECT id, ticket, symbol, direction,
                  round(entryprice::numeric, 4) AS entryprice,
                  round(coalesce(exitprice, 0)::numeric, 4) AS exitprice,
                  round(size::numeric, 4) AS size,
                  TO_CHAR(entry_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS entry_time,
                  TO_CHAR(exit_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS exit_time,
                  stop_loss, take_profit, manual_pnl, notes, tags, screenshots, rating, final_trigger
           FROM trades
           WHERE userid = $1`,
          [uId]
        );

        for (const row of existingTradesRes.rows) {
          if (row.ticket) {
            existingTickets.set(`${uId}:${String(row.ticket).trim()}`, row);
          }
          const fromNotesTicket = extractTradeTicket(row);
          if (fromNotesTicket) {
            existingTickets.set(`${uId}:${fromNotesTicket}`, row);
          }

          const fp = `${uId}:${buildTradeFingerprint(row)}`;
          existingFingerprints.set(fp, row);

          const symKey = `${uId}:${cleanSymbol(row.symbol)}`;
          if (!existingBySymbol.has(symKey)) {
            existingBySymbol.set(symKey, []);
          }
          existingBySymbol.get(symKey).push(row);
        }
      }

      // 批次内去重与数据库已存对比
      const tradesToInsert = [];
      let skippedCount = 0;
      let enrichedCount = 0;

      for (const trade of trades) {
        const uId = trade.userId;
        const ticket = extractTradeTicket(trade);
        if (ticket) {
          trade.ticket = ticket;
        }

        let matchedExistingRow = null;

        // 1. 检查 ticket 是否匹配已存订单
        if (ticket && existingTickets.has(`${uId}:${ticket}`)) {
          matchedExistingRow = existingTickets.get(`${uId}:${ticket}`);
        }

        // 2. 检查精确特征指纹是否匹配已存订单
        if (!matchedExistingRow) {
          const fp = `${uId}:${buildTradeFingerprint(trade)}`;
          if (existingFingerprints.has(fp)) {
            matchedExistingRow = existingFingerprints.get(fp);
          }
        }

        // 3. 检查模糊/容差时间特征是否匹配已存订单
        if (!matchedExistingRow) {
          const symKey = `${uId}:${cleanSymbol(trade.symbol)}`;
          const candidates = existingBySymbol.get(symKey) || [];
          for (const cand of candidates) {
            if (areTradesFuzzyDuplicate(cand, trade)) {
              matchedExistingRow = cand;
              break;
            }
          }
        }

        // 如果匹配到已存订单：尝试融合补全止损止盈等字段，并跳过新增
        if (matchedExistingRow) {
          const didEnrich = await enrichExistingTrade(client, matchedExistingRow, trade, uId);
          if (didEnrich) {
            enrichedCount++;
          }
          skippedCount++;
          continue;
        }

        // 4. 检查批次内自去重（避免单次推送包内含有重复订单，同批次内不同 Ticket 视为不同成交单）
        let isBatchDuplicate = false;
        for (const approved of tradesToInsert) {
          if (approved.userId === uId && areTradesFuzzyDuplicate(approved, trade, { strictTicket: true })) {
            isBatchDuplicate = true;
            break;
          }
        }
        if (isBatchDuplicate) {
          skippedCount++;
          continue;
        }

        // 未出现过的新订单，注册并准备入库
        if (ticket) {
          existingTickets.set(`${uId}:${ticket}`, trade);
        }
        const newFp = `${uId}:${buildTradeFingerprint(trade)}`;
        existingFingerprints.set(newFp, trade);
        const newSymKey = `${uId}:${cleanSymbol(trade.symbol)}`;
        if (!existingBySymbol.has(newSymKey)) {
          existingBySymbol.set(newSymKey, []);
        }
        existingBySymbol.get(newSymKey).push(trade);

        tradesToInsert.push(trade);
      }

      // 如果全部都已存在，直接返回空结果（带统计）
      if (tradesToInsert.length === 0) {
        const result = [];
        result.skippedCount = skippedCount;
        result.insertedCount = 0;
        result.enrichedCount = enrichedCount;
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
              toNull(session || calculateMarketSession(entryTime || tradeDate)),
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
      allInsertedRows.enrichedCount = enrichedCount;
      allInsertedRows.totalReceived = trades.length;

      return allInsertedRows;
    } catch (error) {
      console.error('Error creating bulk trades with deduplication:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 智能检测并合并清理当前用户的所有历史重复订单
   */
  static async cleanupDuplicateTrades(userId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const tradesRes = await client.query(
        `SELECT id, ticket, symbol, direction,
                round(entryprice::numeric, 4) AS entryprice,
                round(coalesce(exitprice, 0)::numeric, 4) AS exitprice,
                round(size::numeric, 4) AS size,
                TO_CHAR(entry_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS entry_time,
                TO_CHAR(exit_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS exit_time,
                stop_loss, take_profit, manual_pnl, notes, tags, screenshots, rating, final_trigger, createdat
         FROM trades
         WHERE userid = $1
         ORDER BY COALESCE(entry_time, createdat) DESC, id DESC`,
        [userId]
      );

      const allTrades = tradesRes.rows || [];
      if (allTrades.length <= 1) {
        await client.query('COMMIT');
        return { cleanedCount: 0, mergedCount: 0, remainingCount: allTrades.length };
      }

      // 按清洗后的品种分组以提高比较性能
      const bySymbol = new Map();
      for (const t of allTrades) {
        const sym = cleanSymbol(t.symbol);
        if (!bySymbol.has(sym)) bySymbol.set(sym, []);
        bySymbol.get(sym).push(t);
      }

      const duplicateIdsToDelete = new Set();
      let mergedCount = 0;

      for (const [sym, list] of bySymbol.entries()) {
        const visited = new Set();

        for (let i = 0; i < list.length; i++) {
          const tA = list[i];
          if (visited.has(tA.id) || duplicateIdsToDelete.has(tA.id)) continue;

          const duplicatesGroup = [tA];

          for (let j = i + 1; j < list.length; j++) {
            const tB = list[j];
            if (visited.has(tB.id) || duplicateIdsToDelete.has(tB.id)) continue;

            if (areTradesFuzzyDuplicate(tA, tB)) {
              duplicatesGroup.push(tB);
              visited.add(tB.id);
            }
          }

          if (duplicatesGroup.length > 1) {
            // 评分机制：选出字段信息最完整的一笔作为保留对象 (Keeper)
            const scoreTrade = (t) => {
              let score = 0;
              if (t.ticket) score += 10;
              if (t.stop_loss && Number(t.stop_loss) > 0) score += 10;
              if (t.take_profit && Number(t.take_profit) > 0) score += 10;
              if (t.final_trigger) score += 8;
              if (t.rating && Number(t.rating) > 0) score += 5;
              if (t.screenshots && Array.isArray(t.screenshots) && t.screenshots.length > 0) score += 5;
              if (t.notes && t.notes.trim().length > 10) score += 4;
              if (t.tags && Array.isArray(t.tags) && t.tags.length > 0) score += 3;
              if (t.exit_time && t.exit_time.length >= 19 && !t.exit_time.endsWith(':00')) score += 2;
              return score;
            };

            duplicatesGroup.sort((a, b) => scoreTrade(b) - scoreTrade(a));
            const keeper = duplicatesGroup[0];
            const toDelete = duplicatesGroup.slice(1);

            // 将被删除订单中的有用字段融合补全至 keeper
            for (const other of toDelete) {
              await enrichExistingTrade(client, keeper, other, userId);
              duplicateIdsToDelete.add(other.id);
            }

            mergedCount++;
          }
        }
      }

      const deletedCount = duplicateIdsToDelete.size;
      if (deletedCount > 0) {
        const deleteArray = Array.from(duplicateIdsToDelete);
        await client.query(
          `DELETE FROM trades WHERE id = ANY($1) AND userid = $2`,
          [deleteArray, userId]
        );
      }

      await client.query('COMMIT');

      return {
        cleanedCount: deletedCount,
        mergedCount,
        remainingCount: allTrades.length - deletedCount,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Automatically evaluate final triggers (takeProfit / stopLoss) for completed manual trades
   * using historical candle sequences after exit_time.
   */
  static async autoEvaluateTriggers(userId, specificTradeIds = null) {
    const client = await pool.connect();
    try {
      let query = `
        SELECT id, symbol, direction, size, entryprice, exitprice, notes,
               TO_CHAR(entry_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS entry_time,
               TO_CHAR(exit_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS exit_time,
               stop_loss, take_profit, final_trigger
        FROM trades
        WHERE userId = $1
          AND exitprice IS NOT NULL
          AND exit_time IS NOT NULL
          AND stop_loss IS NOT NULL
          AND stop_loss > 0
          AND take_profit IS NOT NULL
          AND take_profit > 0
          AND final_trigger IS NULL
      `;
      const params = [userId];

      if (Array.isArray(specificTradeIds) && specificTradeIds.length > 0) {
        query += ` AND id = ANY($2)`;
        params.push(specificTradeIds);
      }

      query += ` ORDER BY exit_time DESC LIMIT 50`;

      const res = await client.query(query, params);
      const tradesToEvaluate = res.rows || [];
      const updatedTrades = [];

      for (const trade of tradesToEvaluate) {
        const exit = parseFloat(trade.exitprice);
        const sl = parseFloat(trade.stop_loss);
        const tp = parseFloat(trade.take_profit);
        const dir = String(trade.direction || '').toLowerCase();

        let isManual = true;
        if (trade.notes) {
          const notesLower = trade.notes.toLowerCase();
          if (notesLower.includes('[tp') || notesLower.includes('[sl') || notesLower.includes('take profit') || notesLower.includes('stop loss')) {
            isManual = false;
          }
        }
        if (dir === 'long' || dir === 'buy') {
          if (!isNaN(tp) && exit >= tp) isManual = false;
          if (!isNaN(sl) && exit <= sl) isManual = false;
        } else {
          if (!isNaN(tp) && exit <= tp) isManual = false;
          if (!isNaN(sl) && exit >= sl) isManual = false;
        }

        if (!isManual) continue;

        const candles = await CandleService.fetchCandlesForTrade(trade);
        if (candles && candles.length > 0) {
          const trigger = CandleService.evaluateFinalTriggerFromCandles({
            direction: trade.direction,
            stopLoss: sl,
            takeProfit: tp,
            exitTime: trade.exit_time,
            candles,
          });

          if (trigger === 'takeProfit' || trigger === 'stopLoss') {
            const updateRes = await client.query(
              `UPDATE trades SET final_trigger = $1, updatedAt = $2 WHERE id = $3 AND userId = $4 RETURNING *`,
              [trigger, localNowISO(), trade.id, userId]
            );
            if (updateRes.rows && updateRes.rows[0]) {
              updatedTrades.push(updateRes.rows[0]);
            }
          }
        }
      }

      return updatedTrades;
    } catch (err) {
      console.warn('Auto evaluation of triggers encountered an issue:', err.message);
      return [];
    } finally {
      client.release();
    }
  }
}
