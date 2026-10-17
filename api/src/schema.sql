
-- =====================================================
-- AOWeb Database Schema - Schema Version 2.0.0
-- Additions for NPC Spells and City Zones (Oct 2026)
-- =====================================================

-- 1. Update Characters Table (For Spell Proficiency)
-- Add columns to track base magical stats and equipped spells
ALTER TABLE characters ADD COLUMN mana_max INTEGER DEFAULT 100;
ALTER TABLE characters ADD COLUMN spell_mastery_level INTEGER DEFAULT 1;
ALTER TABLE characters ADD COLUMN learned_spells JSONB DEFAULT '{}';

-- 2. Create Spell Metadata Table
CREATE TABLE IF NOT EXISTS spells (
    spell_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    mana_cost INTEGER NOT NULL,
    max_cooldown_seconds INTEGER NOT NULL,
    damage_formula TEXT NOT NULL -- JSON or text for calculating damage (e.g., "BASE_DAMAGE * 0.8 + CON_STRENGTH * 0.5")
);

-- 3. Update City Zones Table (For Guardians Patrol)
-- Defines protected areas and associated guardians
DROP TABLE IF EXISTS city_zones;
CREATE TABLE city_zones (
    zone_id SERIAL PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL,
    -- Stores coordinates (e.g., array of {x, y} pairs) defining the polygon boundary
    boundary_coordinates JSONB NOT NULL, 
    -- Can specify a default guardian NPC ID or a zone-specific behavior flag
    guardian_default_npc_id INTEGER, 
    is_active BOOLEAN DEFAULT TRUE
);

-- 4. Indexing for performance
CREATE INDEX idx_character_spells ON characters USING GIN (learned_spells);
CREATE INDEX idx_city_zone_city ON city_zones USING B-Tree (city_name);
