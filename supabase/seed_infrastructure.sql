-- Supabase seed bootstrap for HackWave Flood Engine infrastructure data.

INSERT INTO infrastructure_assets (id, name, type, latitude, longitude, vulnerability_score, capacity, status)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a01', 'Ghatkesar Community Hospital', 'Hospital', 17.4938, 78.6795, 0.95, 350, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a02', 'Govt. High School & Evacuation Shelter', 'Emergency Shelter', 17.5005, 78.6875, 0.60, 1200, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a03', 'Musi Basin Electrical Substation', 'Power Substation', 17.4875, 78.6825, 0.90, 35000, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a04', 'Musi River Pump Station 04', 'Water Infrastructure', 17.5020, 78.6825, 0.85, 50000, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a05', 'Ghatkesar Central Police Station', 'Police Station', 17.4965, 78.6840, 0.45, 80, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a06', 'Musi Flood Retention Basin & Sluice', 'Retention Basin', 17.4925, 78.6910, 0.80, 120000, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a07', 'Keesara Musi River Cross Bridge', 'Bridge', 17.4855, 78.6780, 0.75, 0, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a08', 'Bibinagar Road Upstream Gauge Post', 'River Gauge', 17.4990, 78.6665, 0.70, 0, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Metro General Trauma Hospital', 'Hospital', 13.0827, 80.2707, 0.95, 650, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Central River Cross-Over Bridge', 'Bridge', 13.0780, 80.2650, 0.85, 0, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Coastal Power Grid Substation 4', 'Power Substation', 13.0910, 80.2810, 0.90, 45000, 'Operational')
ON CONFLICT (id) DO NOTHING;

