-- Add user_id column to existing collections table
ALTER TABLE collections 
ADD COLUMN user_id UUID REFERENCES auth.users(id) NOT NULL;

-- Enable Row Level Security if not already enabled
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies to avoid conflicts
DROP POLICY IF EXISTS "Allow users to view their own collections" ON collections;
DROP POLICY IF EXISTS "Allow users to insert their own collections" ON collections;
DROP POLICY IF EXISTS "Allow users to update their own collections" ON collections;
DROP POLICY IF EXISTS "Allow users to delete their own collections" ON collections;

-- Create policies for authenticated users - enforcing non-null user_id
CREATE POLICY "Allow users to view their own collections" 
  ON collections FOR SELECT 
  USING (auth.uid() = user_id OR is_built_in = true);

CREATE POLICY "Allow users to insert their own collections" 
  ON collections FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own collections" 
  ON collections FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own collections" 
  ON collections FOR DELETE 
  USING (auth.uid() = user_id);

-- Note: The 'OR user_id IS NULL' conditions have been removed to enforce
-- proper user authentication for all operations.