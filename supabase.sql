-- Create the collections table with user_id column
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  presets JSONB NOT NULL,
  is_built_in BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES auth.users(id),
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create shared collections table that doesn't require authentication
CREATE TABLE IF NOT EXISTS shared_collections (
  share_id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  name TEXT NOT NULL,
  presets JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- Enable Row Level Security
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
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

-- No need for RLS on shared collections since they're meant to be public
ALTER TABLE shared_collections DISABLE ROW LEVEL SECURITY;
