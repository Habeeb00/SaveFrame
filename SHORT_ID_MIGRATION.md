# Implementing Short Share IDs for Frame Presets

This document explains how to implement the shortened share IDs for the Frame Presets plugin.

## Migration Steps

1. Connect to your Supabase project using the SQL Editor
2. Run the migration SQL script `short_id_migration.sql`
3. The script will:
   - Create a function to generate 8-character random IDs
   - Create a new shared_collections table with the short ID format
   - Migrate existing data
   - Replace the old table with the new one

## Benefits of Short IDs

- Easy to share: 8 characters instead of 36
- Simple to type manually
- No hyphens to worry about
- Still provides enough randomness for security (over 200 trillion combinations)

## Technical Details

The new share IDs are:
- 8 characters long
- Alphanumeric (a-z, A-Z, 0-9)
- Case sensitive
- Generated using a PostgreSQL function

## Compatibility

The code changes maintain compatibility with both old and new ID formats for a smooth transition. Eventually, all IDs will be in the new 8-character format.
