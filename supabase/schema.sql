-- Supabase schema bootstrap for HackWave Flood Engine.

-- 1. Critical Infrastructure Assets Table
CREATE TABLE IF NOT EXISTS infrastructure_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'Hospital', 'Bridge', 'Power Substation', 'School', 'Emergency Shelter', 'Water Treatment'
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    vulnerability_score DOUBLE PRECISION NOT NULL CHECK (vulnerability_score >= 0.0 AND vulnerability_score <= 1.0),
    capacity INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Operational',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for spatial bounding box filtering
CREATE INDEX IF NOT EXISTS idx_infra_coords ON infrastructure_assets (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_infra_type ON infrastructure_assets (type);

-- 2. Flood Predictions Table
CREATE TABLE IF NOT EXISTS flood_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    rainfall_mm DOUBLE PRECISION NOT NULL,
    probability DOUBLE PRECISION NOT NULL CHECK (probability >= 0.0 AND probability <= 1.0),
    hazard_level TEXT NOT NULL, -- 'Low', 'Moderate', 'High', 'Critical'
    features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pred_created_at ON flood_predictions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pred_hazard_level ON flood_predictions (hazard_level);

-- 3. Flood Emergency Alerts Table
CREATE TABLE IF NOT EXISTS flood_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    severity TEXT NOT NULL, -- 'Advisory', 'Watch', 'Warning', 'Emergency'
    location_name TEXT NOT NULL,
    advisory_title TEXT NOT NULL,
    advisory_markdown TEXT NOT NULL,
    recommended_actions JSONB DEFAULT '[]'::jsonb,
    threatened_infrastructure_count INTEGER DEFAULT 0,
    flood_probability DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON flood_alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON flood_alerts (severity);
