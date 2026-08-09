-- Add entry_conditions field to trades table
ALTER TABLE trades
ADD COLUMN IF NOT EXISTS entry_conditions TEXT[];