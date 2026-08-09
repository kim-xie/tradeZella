-- Add trade rating field (1-5 stars) to trades table
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS rating SMALLINT;

-- Add check constraint: rating must be between 1 and 5 (or NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'trades_rating_check'
    ) THEN
        ALTER TABLE trades ADD CONSTRAINT trades_rating_check
            CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
    END IF;
END $$;