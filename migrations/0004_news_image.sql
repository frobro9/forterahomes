-- Bing News RSS includes a thumbnail image for some (not all) articles.
ALTER TABLE news_items ADD COLUMN image_url TEXT;
