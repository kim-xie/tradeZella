-- Add leverage field to trades table
-- Allows users to set leverage per trade (default 1 = no leverage)
-- Used together with manual_pnl: when manual_pnl is NULL, PnL is auto-calculated
-- from (exitPrice - entryPrice) * size * leverage.
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS leverage REAL DEFAULT 1;

-- Backfill existing rows so they have leverage = 1 (no leverage)
UPDATE trades SET leverage = 1 WHERE leverage IS NULL;
