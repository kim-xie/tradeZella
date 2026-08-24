-- Add final_trigger field to trades table
-- Allows users to manually mark whether a trade finally triggered take profit or stop loss
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS final_trigger VARCHAR(16);

-- Add check constraint: final_trigger must be 'takeProfit' or 'stopLoss' (or NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trades_final_trigger_check'
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT trades_final_trigger_check
            CHECK (final_trigger IS NULL OR final_trigger IN ('takeProfit', 'stopLoss'));
    END IF;
END $$;