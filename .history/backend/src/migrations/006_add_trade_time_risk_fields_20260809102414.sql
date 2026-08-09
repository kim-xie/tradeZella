-- Add entry/exit time and risk management fields to trades table
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS entry_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS exit_time TIMESTAMP,
ADD COLUMN IF NOT EXISTS stop_loss REAL,
ADD COLUMN IF NOT EXISTS take_profit REAL;

-- Update existing trades: set entry_time from trade_date if available
UPDATE trades
SET
    entry_time = trade_date
WHERE
    entry_time IS NULL
    AND trade_date IS NOT NULL;