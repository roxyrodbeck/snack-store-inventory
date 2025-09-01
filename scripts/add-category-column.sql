-- Add category column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

-- Update existing products to have default categories
UPDATE products SET category = 'other' WHERE category IS NULL;

-- Add some example categories (you can customize these)
-- UPDATE products SET category = 'chips' WHERE name ILIKE '%chip%' OR name ILIKE '%crisp%';
-- UPDATE products SET category = 'drinks' WHERE name ILIKE '%drink%' OR name ILIKE '%soda%' OR name ILIKE '%juice%' OR name ILIKE '%water%';
