-- Add manual_pnl field to trades table
-- Allows users to override the auto-calculated PnL (e.g., when leverage differs by symbol)
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS manual_pnl REAL;

-- Comment: manual_pnl is optional. When NULL, PnL is auto-calculated from
-- entryPrice, exitPrice, size, and leverage. When set, it overrides the calculation.