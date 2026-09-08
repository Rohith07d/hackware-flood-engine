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

-- 4. User Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone_number TEXT,
    preferred_language TEXT DEFAULT 'en',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. User Saved Locations Table (Authenticated Users)
CREATE TABLE IF NOT EXISTS user_saved_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. 'Home', 'Office', 'Parents' House'
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    notify_sms BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_user_id ON user_saved_locations (user_id);

-- 6. Crowd-Sourced Flood Reports Table
CREATE TABLE IF NOT EXISTS crowd_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    water_depth TEXT NOT NULL, -- 'Ankle', 'Knee', 'Waist', 'Submerged'
    location_name TEXT,
    description TEXT,
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crowd_coords ON crowd_reports (latitude, longitude);

-- 7. High-Hazard Alert Subscriptions Table
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    channel TEXT DEFAULT 'sms', -- 'sms' or 'whatsapp'
    location_name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security (RLS) Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crowd_reports ENABLE ROW LEVEL SECURITY;

-- User Profiles: users can only read & update their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- User Saved Locations: users can CRUD their own locations only
CREATE POLICY "Users can view own saved locations" ON user_saved_locations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved locations" ON user_saved_locations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved locations" ON user_saved_locations
    FOR DELETE USING (auth.uid() = user_id);

-- Crowd Reports: Anyone can view; authenticated or anonymous users can report
CREATE POLICY "Public can view crowd reports" ON crowd_reports
    FOR SELECT USING (true);

CREATE POLICY "Public can insert crowd reports" ON crowd_reports
    FOR INSERT WITH CHECK (true);

-- Alert Subscriptions: Users can view & delete their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON alert_subscriptions
    FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can insert subscriptions" ON alert_subscriptions
    FOR INSERT WITH CHECK (true);

-- Seed Critical Infrastructure for Hyderabad Metropolitan Region
INSERT INTO infrastructure_assets (id, name, type, latitude, longitude, vulnerability_score, capacity, status)
VALUES
    ('hyd-infra-01', 'Osmania General Trauma Hospital', 'Hospital', 17.3785, 78.4754, 0.95, 1200, 'Operational'),
    ('hyd-infra-02', 'Gandhi Super Specialty Hospital', 'Hospital', 17.4243, 78.5034, 0.88, 1500, 'Operational'),
    ('hyd-infra-03', 'Community Hospital Ghatkesar', 'Hospital', 17.4938, 78.6795, 0.82, 250, 'Operational'),
    ('hyd-infra-04', 'Musi River Puranapul Bridge', 'Bridge', 17.3660, 78.4630, 0.90, 0, 'Operational'),
    ('hyd-infra-05', 'Chaderghat Causeway River Bridge', 'Bridge', 17.3775, 78.4900, 0.92, 0, 'Operational'),
    ('hyd-infra-06', 'Gachibowli High-Tension Substation', 'Power Substation', 17.4400, 78.3500, 0.78, 60000, 'Operational'),
    ('hyd-infra-07', 'Keesara Electrical Substation', 'Power Substation', 17.4875, 78.6825, 0.85, 35000, 'Operational'),
    ('hyd-infra-08', 'Govt. High School Relief Shelter (Ghatkesar)', 'Emergency Shelter', 17.5005, 78.6875, 0.45, 1800, 'Operational'),
    ('hyd-infra-09', 'Begumpet Central Relief Shelter', 'Emergency Shelter', 17.4440, 78.4720, 0.50, 2200, 'Operational'),
    ('hyd-infra-10', 'Amberpet Water Treatment Works', 'Water Treatment', 17.3890, 78.5150, 0.86, 150000, 'Operational'),
    ('hyd-infra-11', 'Peerzadiguda Retention Basin Pump 02', 'Water Treatment', 17.4120, 78.5820, 0.70, 40000, 'Operational')
ON CONFLICT (id) DO NOTHING;
