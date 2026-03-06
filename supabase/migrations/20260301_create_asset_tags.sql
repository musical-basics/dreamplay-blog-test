-- ─── Asset Tags ─────────────────────────────────────
-- Table to store color-coded tag definitions

CREATE TABLE IF NOT EXISTS asset_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6b7280',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Asset ↔ Tag Links (many-to-many) ──────────────
-- Join table linking media_assets to asset_tags

CREATE TABLE IF NOT EXISTS asset_tag_links (
    asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES asset_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (asset_id, tag_id)
);

-- Index for fast lookups by asset
CREATE INDEX IF NOT EXISTS idx_asset_tag_links_asset ON asset_tag_links(asset_id);
-- Index for fast lookups by tag  
CREATE INDEX IF NOT EXISTS idx_asset_tag_links_tag ON asset_tag_links(tag_id);
