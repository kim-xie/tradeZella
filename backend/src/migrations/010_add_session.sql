-- Add trading session field to trades table
-- Allows users to tag a trade with the active market session
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS session VARCHAR(16);

-- Add check constraint: session must be one of Asia / Europe / US (or NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trades_session_check'
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT trades_session_check
            CHECK (session IS NULL OR session IN ('Asia', 'Europe', 'US'));
    END IF;
END $$;
