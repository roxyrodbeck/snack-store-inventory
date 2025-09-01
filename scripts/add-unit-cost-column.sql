-- Add unit_cost column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(10,2) DEFAULT 0;

-- Update existing products to have a default unit cost of 0
UPDATE products SET unit_cost = 0 WHERE unit_cost IS NULL;
