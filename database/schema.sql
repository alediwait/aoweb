-- =====================================================
-- AOWeb Database Schema - Schema Version 2.0.0
-- Additions for NPC Spells and City Zones (Oct 2026)
-- =====================================================

-- 1. Update Characters Table (For Spell Proficiency)
-- Add columns only if they don't exist yet
ALTER TABLE characters ADD COLUMN IF NOT EXISTS mana_max INTEGER DEFAULT 100;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS spell_mastery_level INTEGER DEFAULT 1;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS learned_spells JSONB DEFAULT '{}';

-- 2. Create Spell Metadata Table
CREATE TABLE IF NOT EXISTS spells (
    spell_id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    mana_cost INTEGER NOT NULL,
    max_cooldown_seconds INTEGER NOT NULL,
    damage_formula TEXT NOT NULL
);

-- 3. Update City Zones Table (For Guardians Patrol)
DROP TABLE IF EXISTS city_zones CASCADE;
CREATE TABLE city_zones (
    zone_id SERIAL PRIMARY KEY,
    city_name VARCHAR(100) NOT NULL,
    boundary_coordinates JSONB NOT NULL,
    guardian_default_npc_id INTEGER,
    is_active BOOLEAN DEFAULT TRUE
);

-- 4. Indexing for performance
CREATE INDEX IF NOT EXISTS idx_character_spells ON characters USING GIN (learned_spells);
-- Corregido: Indexamos por city_name que es la columna real de la tabla
CREATE INDEX IF NOT EXISTS idx_city_zone_city ON city_zones USING B-Tree (city_name);