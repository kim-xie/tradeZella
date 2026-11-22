import { Trade, DayStats, MonthStats, ExitMethodType } from './calendarTypes';

export const getTradeEntryPrice = (t: Trade): number => {
  return Number(t.entryprice ?? t.entryPrice ?? 0);
};

export const getTradeExitPrice = (t: Trade): number => {
  return Number(t.exitprice ?? t.exitPrice ?? 0);
};

export const getTradeSize = (t: Trade): number => {
  return Number(t.size) || 0;
};

export const getTradeDirection = (t: Trade): 'long' | 'short' => {
  const d = String(t.direction || '').toLowerCase();
  return (d === 'sell' || d === 'short') ? 'short' : 'long';
};

export const getTradeEntryTime = (t: Trade): string => {
  return t.entry_time || t.entryTime || (t as any).trade_date || t.createdat || t.createdAt || '';
};

export const getTradeExitTime = (t: Trade): string => {
  return t.exit_time || t.exitTime || '';
};

/**
 * 获取交易所属的“交易日”（Trading Day / Session Date），格式为 YYYY-MM-DD。
 *
 * 核心金融逻辑与行业标准 (TradeZella / TraderSync / MT5)：
 * 全球金融市场（外汇、美股大盘指数、黄金原油等大宗商品）美盘交易跨越北京时间零点（前一日 21:00 至次日凌晨 05:00/06:00 闭市）。
 * 国际主流交易日志平台统一以每日清算结算休市时间（美东 17:00 / 冬令时北京时间 06:00，夏令时 05:00）作为交易日切日点。
 * 1. 已平仓订单：以【平仓出场时间 exit_time】归集所属交易日（因为已实现盈亏 Realized P&L 在出场时刻结算）。
 * 2. 未平仓持仓/挂单：回退以【开仓入场时间 entry_time】归集。
 * 3. 因此，北京时间凌晨 00:00:00 ~ 05:59:59 间出场的交易，实质上属于前一天的交易日（特别是周五美盘下半夜延续至周六清晨的订单统一归属【周五交易日】，周六休市无交易）。
 *
 * @param trade 交易记录对象
 * @param cutoffHour 切日小时（默认 6，即 06:00:00 前归属前一交易日）
 */
export const getTradeTradingDate = (trade: Trade, cutoffHour: number = 6): string => {
  const rawDate = getTradeExitTime(trade) || getTradeEntryTime(trade);
  if (!rawDate) return '';

  const str = String(rawDate).trim();
  const match = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) {
    return str.length >= 10 ? str.substring(0, 10).replace(/[./]/g, '-') : str;
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  const hour = match[4] !== undefined ? parseInt(match[4], 10) : 12;

  let effectiveCutoff = 6;
  if (typeof cutoffHour === 'number' && !isNaN(cutoffHour)) {
    effectiveCutoff = cutoffHour;
  } else {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedCutoff = localStorage.getItem('tradezella_trading_day_cutoff');
        if (savedCutoff !== null && !isNaN(Number(savedCutoff))) {
          const val = Number(savedCutoff);
          if (val > 0) effectiveCutoff = val;
        }
      }
    } catch {}
  }

  const pad = (n: number) => String(n).padStart(2, '0');

  // 若在切日点前（如 00:00 ~ 05:59），回退归入上一日交易日
  if (hour < effectiveCutoff) {
    const prevDate = new Date(year, month - 1, day - 1);
    return `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(prevDate.getDate())}`;
  }

  return `${year}-${pad(month)}-${pad(day)}`;
};

/**
 * 判断某笔交易是否属于跨夜美盘交易（北京时间 00:00 ~ 05:59:59）
 */
export const isTradeOvernightSession = (trade: Trade, cutoffHour: number = 6): boolean => {
  const rawDate = getTradeExitTime(trade) || getTradeEntryTime(trade);
  if (!rawDate) return false;
  const match = String(rawDate).trim().match(/[T\s](\d{1,2}):/);
  if (!match) return false;
  const hour = parseInt(match[1], 10);

  let effectiveCutoff = 6;
  if (typeof cutoffHour === 'number' && !isNaN(cutoffHour)) {
    effectiveCutoff = cutoffHour;
  } else {
    try {
      if (typeof localStorage !== 'undefined') {
        const savedCutoff = localStorage.getItem('tradezella_trading_day_cutoff');
        if (savedCutoff !== null && !isNaN(Number(savedCutoff))) {
          const val = Number(savedCutoff);
          if (val > 0) effectiveCutoff = val;
        }
      }
    } catch {}
  }
  return hour < effectiveCutoff;
};

/**
 * 获取当前时刻所属的交易日（格式 YYYY-MM-DD）。
 * 例如：周六凌晨 02:00（美盘下半夜），当前交易日属于【周五】。
 */
export const getCurrentTradingDate = (cutoffHour: number = 6): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const localNowStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  return getTradeTradingDate({ entry_time: localNowStr } as any, cutoffHour);
};

/**
 * 获取上一交易日（跳过周末闭市）。
 * 例如：周一的前一交易日为【周五】；周五的前一交易日为【周四】。
 */
export const getPreviousTradingDate = (currentTradingDateStr?: string, cutoffHour: number = 6): string => {
  const baseDateStr = currentTradingDateStr || getCurrentTradingDate(cutoffHour);
  const parts = baseDateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const date = new Date(y, m, d);

  date.setDate(date.getDate() - 1);
  if (date.getDay() === 0) {
    // Sunday -> Friday
    date.setDate(date.getDate() - 2);
  } else if (date.getDay() === 6) {
    // Saturday -> Friday
    date.setDate(date.getDate() - 1);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * 获取指定交易日所在的周度范围（周一至周日，格式 YYYY-MM-DD）。
 */
export const getTradingWeekRange = (
  referenceTradingDate?: string,
  cutoffHour: number = 6
): { start: string; end: string } => {
  const baseDateStr = referenceTradingDate || getCurrentTradingDate(cutoffHour);
  const parts = baseDateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const date = new Date(y, m, d);

  const day = date.getDay(); // 0 is Sun, 1 is Mon ... 6 is Sat
  const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(y, m, diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const pad = (n: number) => String(n).padStart(2, '0');
  const start = `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`;
  const end = `${sunday.getFullYear()}-${pad(sunday.getMonth() + 1)}-${pad(sunday.getDate())}`;

  return { start, end };
};

/**
 * 获取订单在交易日体系下的星期几（1 = 周一, 2 = 周二 ... 5 = 周五, 6 = 周六, 0 = 周日）。
 * 周五跨夜美盘订单（周六 00:00~06:00 成交）归属为 5 (周五交易日)。
 */
export const getTradeDayOfWeek = (trade: Trade, cutoffHour: number = 6): number => {
  const tradingDate = getTradeTradingDate(trade, cutoffHour);
  if (!tradingDate || tradingDate.length < 10) return -1;
  const parts = tradingDate.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const d = parseInt(parts[2], 10);
  const dateObj = new Date(y, m, d);
  return dateObj.getDay();
};

/**
 * 获取订单在交易日体系下的年份与月份 (month 0-indexed: 0 = 1月, 11 = 12月)。
 * 月末跨夜订单归属上月交易日。
 */
export const getTradeMonthAndYear = (
  trade: Trade,
  cutoffHour: number = 6
): { year: number; month: number } => {
  const tradingDate = getTradeTradingDate(trade, cutoffHour);
  if (!tradingDate || tradingDate.length < 7) {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  }
  const year = parseInt(tradingDate.substring(0, 4), 10);
  const month = parseInt(tradingDate.substring(5, 7), 10) - 1;
  return { year, month };
};

/**
 * 根据开仓入场时间（entry_time）自动推算所属交易时段 (Market Session)
 * 
 * 国际通用三大交易时段划分 (以北京时间 UTC+8 为准)：
 * 1. 亚盘时段 (Asia): 08:00:00 ~ 14:59:59 (东京/新加坡/香港盘)
 * 2. 欧盘时段 (Europe): 15:00:00 ~ 20:59:59 (伦敦盘为主，欧系货币流动性爆发)
 * 3. 美盘时段 (US): 21:00:00 ~ 次日 07:59:59 (纽约盘主行情与跨夜美盘)
 *
 * @param dateStr 入场时间字符串或 Date
 * @returns 'Asia' | 'Europe' | 'US' | null
 */
export const calculateMarketSession = (dateStr?: string | Date | null): 'Asia' | 'Europe' | 'US' | null => {
  if (!dateStr) return null;
  let hour: number;
  if (dateStr instanceof Date) {
    hour = dateStr.getHours();
  } else {
    const str = String(dateStr).trim();
    const match = str.match(/[T\s](\d{1,2}):/);
    if (!match) return null;
    hour = parseInt(match[1], 10);
  }
  if (isNaN(hour)) return null;

  if (hour >= 8 && hour < 15) {
    return 'Asia';
  }
  if (hour >= 15 && hour < 21) {
    return 'Europe';
  }
  return 'US';
};

/**
 * 根据平仓出场后的 K 线序列 (Candles) 自动推算手动平仓订单的最终走势 (Final Trigger)
 * 判定行情后续是先触碰了止盈目标 (takeProfit / 打止盈)，还是先触碰了止损目标 (stopLoss / 打止损)
 *
 * @param params
 * @param params.direction 开仓方向 ('long' | 'short' | 'buy' | 'sell')
 * @param params.stopLoss 止损价 (SL)
 * @param params.takeProfit 止盈价 (TP)
 * @param params.exitTime 平仓时间 (ISO 或时间字符串)
 * @param params.candles K 线序列 (按时间升序)
 * @returns 'takeProfit' | 'stopLoss' | null
 */
export const evaluateFinalTriggerFromCandles = ({
  direction,
  stopLoss,
  takeProfit,
  exitTime,
  candles,
}: {
  direction?: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
  exitTime?: string | null;
  candles: Array<{ time: string; timestamp?: number; open?: number; high: number; low: number; close?: number }>;
}): 'takeProfit' | 'stopLoss' | null => {
  if (!candles || candles.length === 0) return null;
  if (stopLoss == null || takeProfit == null || isNaN(stopLoss) || isNaN(takeProfit)) return null;

  const isLong = String(direction || '').toLowerCase() === 'long' || String(direction || '').toLowerCase() === 'buy';

  let exitTs = 0;
  if (exitTime) {
    const normalized = String(exitTime).replace(' ', 'T');
    const d = new Date(normalized);
    if (!isNaN(d.getTime())) {
      exitTs = d.getTime();
    }
  }

  for (const c of candles) {
    const candleTs = typeof c.timestamp === 'number' && c.timestamp > 0
      ? (c.timestamp < 1e11 ? c.timestamp * 1000 : c.timestamp)
      : new Date(String(c.time).replace(' ', 'T')).getTime();

    // 只检查平仓时间之后的 K 线 (如果 exitTs 存在，允许 1 分钟内的微小误差)
    if (exitTs > 0 && !isNaN(candleTs) && candleTs < exitTs - 60000) {
      continue;
    }

    const high = Number(c.high);
    const low = Number(c.low);
    const open = c.open !== undefined ? Number(c.open) : low;
    const close = c.close !== undefined ? Number(c.close) : high;

    if (isNaN(high) || isNaN(low)) continue;

    if (isLong) {
      const hitTP = high >= takeProfit;
      const hitSL = low <= stopLoss;

      if (hitTP && !hitSL) return 'takeProfit';
      if (hitSL && !hitTP) return 'stopLoss';
      if (hitTP && hitSL) {
        // 同一根 K 线双向触及：阳线开盘低、收盘高，通常先下探后冲高；阴线先冲高后回落
        return close >= open ? 'stopLoss' : 'takeProfit';
      }
    } else {
      // 做空 Short：向下触及 takeProfit 为打止盈，向上触及 stopLoss 为打止损
      const hitTP = low <= takeProfit;
      const hitSL = high >= stopLoss;

      if (hitTP && !hitSL) return 'takeProfit';
      if (hitSL && !hitTP) return 'stopLoss';
      if (hitTP && hitSL) {
        // 做空同一根 K 线双向触及：阴线开盘高、收盘低，通常先冲高（触SL）后跌下（触TP）；阳线先探底后回升
        return close <= open ? 'stopLoss' : 'takeProfit';
      }
    }
  }

  return null;
};

export const getTradeStopLoss = (t: Trade): number | undefined => {
  const sl = t.stop_loss ?? t.stopLoss;
  return sl !== undefined && sl !== null ? Number(sl) : undefined;
};

export const getTradeTakeProfit = (t: Trade): number | undefined => {
  const tp = t.take_profit ?? t.takeProfit;
  return tp !== undefined && tp !== null ? Number(tp) : undefined;
};

export const getTradeTags = (t: Trade): string[] => {
  if (!t.tags) return [];
  if (Array.isArray(t.tags)) return t.tags;
  if (typeof t.tags === 'string') {
    try {
      const parsed = JSON.parse(t.tags);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return t.tags.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

export const calculateTradePnL = (trade: Trade): number => {
  const manual = trade.manual_pnl ?? trade.manualPnl;
  if (manual !== undefined && manual !== null && !isNaN(Number(manual))) {
    return Number(manual);
  }
  const entry = getTradeEntryPrice(trade);
  const exit = getTradeExitPrice(trade);
  const size = getTradeSize(trade);
  if (!exit || !entry || size <= 0) return 0;
  const leverage = trade.leverage && Number(trade.leverage) >= 1 ? Number(trade.leverage) : 1;
  const dir = getTradeDirection(trade);
  const diff = dir === 'long' ? exit - entry : entry - exit;
  return diff * size * leverage;
};

export const calculateTradeTargetRR = (trade: Trade): number | null => {
  const entry = getTradeEntryPrice(trade);
  const sl = getTradeStopLoss(trade);
  const tp = getTradeTakeProfit(trade);
  if (!entry || !sl || !tp || entry <= 0 || sl <= 0 || tp <= 0) return null;

  const dir = getTradeDirection(trade);
  // 止损必须在开仓方向的真实亏损侧 (Protective Stop Loss)
  // 多单 (long): 止损必须严格低于开仓价 (sl < entry)
  // 空单 (short): 止损必须严格高于开仓价 (sl > entry)
  const risk = dir === 'long' ? entry - sl : sl - entry;
  const reward = dir === 'long' ? tp - entry : entry - tp;

  if (risk <= 0.0000001 || reward <= 0.0000001) return null;
  const rr = reward / risk;
  return isFinite(rr) && rr > 0 ? rr : null;
};

export const calculateTradeRR = (trade: Trade): number | null => {
  const entry = getTradeEntryPrice(trade);
  const exit = getTradeExitPrice(trade);
  const sl = getTradeStopLoss(trade);
  const size = getTradeSize(trade);
  if (!exit || !sl || !entry || size <= 0) return null;

  const dir = getTradeDirection(trade);
  // 止损必须在开仓方向的真实亏损侧 (Protective Stop Loss):
  // 多单 (long): 止损必须严格低于开仓价 (sl < entry)
  // 空单 (short): 止损必须严格高于开仓价 (sl > entry)
  // 若止损在盈利侧或保本位 (如空单 sl <= entry 或 多单 sl >= entry)，
  // 说明为移动止损/保本锁利，不能作为初始下行风险(1R)的分母，否则会导致盈亏比失真暴涨(如 +49.1R)
  const riskPerUnit = dir === 'long' ? entry - sl : sl - entry;
  if (riskPerUnit <= 0.0000001) return null;

  const diff = dir === 'long' ? exit - entry : entry - exit;
  const manual = trade.manual_pnl ?? trade.manualPnl;
  const hasManual = manual !== undefined && manual !== null && !isNaN(Number(manual));

  if (hasManual && diff !== 0) {
    const pnl = Number(manual);
    const sign = pnl === 0 ? 0 : pnl > 0 ? 1 : -1;
    return sign * (Math.abs(diff) / riskPerUnit);
  }
  return diff / riskPerUnit;
};

export const getTradeDurationMinutes = (trade: Trade): number | null => {
  const entry = getTradeEntryTime(trade);
  const exit = getTradeExitTime(trade);
  if (!entry || !exit) return null;
  const entryMs = new Date(String(entry).replace(' ', 'T')).getTime();
  const exitMs = new Date(String(exit).replace(' ', 'T')).getTime();
  const diff = exitMs - entryMs;
  if (isNaN(diff) || diff < 0) return null;
  return diff / 60000;
};

export const calculateTradeExitMethod = (trade: Trade): ExitMethodType | null => {
  // 1. 优先使用终局触发标记 (例如 MT5 / 券商同步的 [tp] / [sl] 触发)
  const finalTrigger = trade.final_trigger || trade.finalTrigger;
  if (finalTrigger === 'takeProfit') return 'takeProfit';
  if (finalTrigger === 'stopLoss') return 'stopLoss';

  // 2. 兼容历史数据在 notes 中带有 MT5 SL/TP 触发标记的情况
  if (trade.notes) {
    const lower = trade.notes.toLowerCase();
    if (lower.includes('[tp') || lower.includes('take profit')) return 'takeProfit';
    if (lower.includes('[sl') || lower.includes('stop loss')) return 'stopLoss';
  }

  // 3. 检查是否为已平仓订单
  const exit = getTradeExitPrice(trade);
  const isClosed = exit > 0 || (trade.manual_pnl != null || (trade as any).manualPnl != null) || getTradeExitTime(trade) !== '';
  if (!isClosed) return null;

  const sl = getTradeStopLoss(trade);
  const tp = getTradeTakeProfit(trade);
  const dir = getTradeDirection(trade);

  // 4. 根据多空方向与止盈/止损价格推算
  if (dir === 'long') {
    if (tp != null && tp > 0 && exit >= tp) return 'takeProfit';
    if (sl != null && sl > 0 && exit <= sl) return 'stopLoss';
    return 'manual';
  } else {
    if (tp != null && tp > 0 && exit <= tp) return 'takeProfit';
    if (sl != null && sl > 0 && exit >= sl) return 'stopLoss';
    return 'manual';
  }
};

export const isTradeMistake = (trade: Trade): boolean => {
  if (trade.rating && Number(trade.rating) <= 2) return true;
  const sentiment = String(trade.sentiment || '').toLowerCase();
  if (sentiment === 'bad' || sentiment === 'fomo' || sentiment === 'revenge' || sentiment === 'mistake') return true;
  const tags = getTradeTags(trade).map((t) => t.toLowerCase());
  const mistakeKeywords = ['mistake', 'fomo', 'chase', 'revenge', 'overtrade', 'early_exit', 'moved_sl', 'no_sl', 'discipline', '失误', '追高', '扛单'];
  return tags.some((tag) => mistakeKeywords.some((kw) => tag.includes(kw)));
};

export const computeDayStats = (trades: Trade[], dateStr: string = ''): DayStats => {
  const completed = trades.filter((t) => getTradeExitPrice(t) > 0 || (t.manual_pnl !== undefined && t.manual_pnl !== null) || (t.manualPnl !== undefined && t.manualPnl !== null));
  let pnl = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let totalVolume = 0;
  let mistakesCount = 0;
  let hasNotes = false;

  const rrValues: number[] = [];
  const winDurations: number[] = [];
  const lossDurations: number[] = [];

  trades.forEach((t) => {
    totalVolume += getTradeSize(t);
    if (isTradeMistake(t)) mistakesCount++;
    if (t.notes && t.notes.trim().length > 0) hasNotes = true;
  });

  // Also check localStorage daily notes & journal discipline score
  let journalScore: number | null = null;
  if (dateStr) {
    try {
      const storedNote = localStorage.getItem(`tradezella_daily_notes_${dateStr}`);
      if (storedNote && storedNote.trim().length > 0) {
        hasNotes = true;
        try {
          const parsed = JSON.parse(storedNote);
          if (typeof parsed === 'object' && parsed !== null && typeof parsed.score === 'number' && parsed.score > 0) {
            journalScore = parsed.score;
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  // Fallback to average trade rating on this day if journal score not explicitly set
  if (journalScore === null) {
    const ratedTrades = trades.filter((t) => typeof t.rating === 'number' && t.rating > 0);
    if (ratedTrades.length > 0) {
      const avg = Math.round(ratedTrades.reduce((acc, t) => acc + (t.rating || 0), 0) / ratedTrades.length);
      journalScore = avg;
    }
  }

  completed.forEach((t) => {
    const tradePnl = calculateTradePnL(t);
    pnl += tradePnl;
    if (tradePnl > 0.001) {
      wins++;
      grossProfit += tradePnl;
      const dur = getTradeDurationMinutes(t);
      if (dur !== null) winDurations.push(dur);
    } else if (tradePnl < -0.001) {
      losses++;
      grossLoss += Math.abs(tradePnl);
      const dur = getTradeDurationMinutes(t);
      if (dur !== null) lossDurations.push(dur);
    } else {
      breakevens++;
    }

    const rr = calculateTradeRR(t);
    if (rr !== null) rrValues.push(rr);
  });

  const completedCount = completed.length;
  const winRate = completedCount > 0 ? (wins / completedCount) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.9 : 0);
  const totalR = rrValues.reduce((sum, r) => sum + r, 0);
  const avgRR = rrValues.length > 0 ? totalR / rrValues.length : 0;

  return {
    dateStr,
    pnl,
    grossProfit,
    grossLoss,
    count: trades.length,
    completedCount,
    wins,
    losses,
    breakevens,
    winRate,
    profitFactor,
    totalVolume,
    avgRR,
    totalR,
    avgWinDuration: winDurations.length > 0 ? winDurations.reduce((a, b) => a + b, 0) / winDurations.length : 0,
    avgLossDuration: lossDurations.length > 0 ? lossDurations.reduce((a, b) => a + b, 0) / lossDurations.length : 0,
    mistakesCount,
    hasNotes,
    journalScore,
  };
};

/**
 * 获取所有日内复盘日记的评分数据 (用于月度、半年度与年度卡片聚合突出)
 */
export const getAllDailyJournalScores = (): Record<string, number> => {
  const scores: Record<string, number> = {};
  if (typeof localStorage === 'undefined') return scores;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('tradezella_daily_notes_')) {
        const dateStr = key.replace('tradezella_daily_notes_', '');
        const val = localStorage.getItem(key);
        if (val) {
          try {
            const parsed = JSON.parse(val);
            if (typeof parsed === 'object' && parsed !== null && typeof parsed.score === 'number' && parsed.score > 0) {
              scores[dateStr] = parsed.score;
            }
          } catch {}
        }
      }
    }
  } catch {}
  return scores;
};

/**
 * 获取指定日期的日内复盘日记详情
 */
export const getDailyJournalData = (
  dateStr: string
): { note: string; tags: string[]; score: number | null } => {
  if (!dateStr || typeof localStorage === 'undefined') return { note: '', tags: [], score: null };
  try {
    const stored = localStorage.getItem(`tradezella_daily_notes_${dateStr}`);
    if (!stored) return { note: '', tags: [], score: null };
    try {
      const parsed = JSON.parse(stored);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          note: parsed.note || '',
          tags: parsed.tags || [],
          score: typeof parsed.score === 'number' && parsed.score > 0 ? parsed.score : null,
        };
      }
    } catch {
      return { note: stored, tags: [], score: null };
    }
  } catch {}
  return { note: '', tags: [], score: null };
};

export const computeTradeSummaryStatsFromDailyMap = (
  tradesByDay: Record<string, Trade[]>
): MonthStats => {
  let netPnL = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let totalTrades = 0;
  let completedTrades = 0;
  let winningTrades = 0;
  let greenDaysCount = 0;
  let redDaysCount = 0;
  let breakevenDaysCount = 0;
  let tradingDaysCount = 0;
  let totalVolume = 0;

  let bestDay: { date: string; pnl: number; count: number } | null = null;
  let worstDay: { date: string; pnl: number; count: number } | null = null;

  Object.entries(tradesByDay).forEach(([dateStr, dayTrades]) => {
    if (dayTrades.length === 0) return;

    const dayStats = computeDayStats(dayTrades, dateStr);
    tradingDaysCount++;
    netPnL += dayStats.pnl;
    grossProfit += dayStats.grossProfit;
    grossLoss += dayStats.grossLoss;
    totalTrades += dayStats.count;
    completedTrades += dayStats.completedCount;
    winningTrades += dayStats.wins;
    totalVolume += dayStats.totalVolume;

    if (dayStats.pnl > 0.001) {
      greenDaysCount++;
    } else if (dayStats.pnl < -0.001) {
      redDaysCount++;
    } else {
      breakevenDaysCount++;
    }

    if (!bestDay || dayStats.pnl > bestDay.pnl) {
      bestDay = { date: dateStr, pnl: dayStats.pnl, count: dayStats.count };
    }
    if (!worstDay || dayStats.pnl < worstDay.pnl) {
      worstDay = { date: dateStr, pnl: dayStats.pnl, count: dayStats.count };
    }
  });

  const winRate = completedTrades > 0 ? (winningTrades / completedTrades) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.9 : 0);
  const avgDailyPnL = tradingDaysCount > 0 ? netPnL / tradingDaysCount : 0;

  // Expectancy = (Win% * AvgWin) - (Loss% * AvgLoss)
  const avgWin = winningTrades > 0 ? grossProfit / winningTrades : 0;
  const losingTrades = completedTrades - winningTrades;
  const avgLoss = losingTrades > 0 ? grossLoss / losingTrades : 0;
  const expectancy = completedTrades > 0
    ? ((winningTrades / completedTrades) * avgWin) - ((losingTrades / completedTrades) * avgLoss)
    : 0;

  return {
    netPnL,
    grossProfit,
    grossLoss,
    winRate,
    profitFactor,
    totalTrades,
    completedTrades,
    greenDaysCount,
    redDaysCount,
    breakevenDaysCount,
    tradingDaysCount,
    avgDailyPnL,
    bestDay,
    worstDay,
    totalVolume,
    expectancy,
  };
};

export const computeTradeSummaryStats = (trades: Trade[]): MonthStats => {
  const tradesByDay: Record<string, Trade[]> = {};
  trades.forEach((trade) => {
    const dateStr = getTradeTradingDate(trade) || 'unknown';
    if (!tradesByDay[dateStr]) tradesByDay[dateStr] = [];
    tradesByDay[dateStr].push(trade);
  });
  return computeTradeSummaryStatsFromDailyMap(tradesByDay);
};

export const computeMonthStats = (
  tradesByDay: Record<string, Trade[]>,
  year: number,
  month: number
): MonthStats => {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const filteredMap: Record<string, Trade[]> = {};
  Object.entries(tradesByDay).forEach(([dateStr, dayTrades]) => {
    if (dateStr.startsWith(monthPrefix) && dayTrades.length > 0) {
      filteredMap[dateStr] = dayTrades;
    }
  });
  return computeTradeSummaryStatsFromDailyMap(filteredMap);
};

export const formatCurrency = (val: number): string => {
  const prefix = val >= 0 ? '+' : '-';
  return `${prefix}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDurationShort = (minutes: number): string => {
  if (!minutes || minutes <= 0) return '-';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = Math.floor(minutes % 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 && days === 0) parts.push(`${mins}m`);
  return parts.join(' ') || '<1m';
};

export const formatDateTime = (dateStr?: string): string => {
  if (!dateStr) return '-';
  const normalized = dateStr.replace(' ', 'T');
  const m = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
  }
  return dateStr.replace('T', ' ').slice(0, 16);
};

