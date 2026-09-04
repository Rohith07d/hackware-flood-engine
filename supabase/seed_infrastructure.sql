-- Supabase seed bootstrap for HackWave Flood Engine infrastructure data.

INSERT INTO infrastructure_assets (id, name, type, latitude, longitude, vulnerability_score, capacity, status)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Metro General Trauma Hospital', 'Hospital', 13.0827, 80.2707, 0.95, 650, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Central River Cross-Over Bridge', 'Bridge', 13.0780, 80.2650, 0.85, 0, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Coastal Power Grid Substation 4', 'Power Substation', 13.0910, 80.2810, 0.90, 45000, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'North District High School & Shelter', 'Emergency Shelter', 13.0715, 80.2580, 0.60, 1200, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Municipal Water Purification Works', 'Water Treatment', 13.0950, 80.2620, 0.80, 80000, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'St. Jude Emergency Medical Clinic', 'Hospital', 13.0650, 80.2450, 0.75, 120, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'South Highway Flyover Bridge', 'Bridge', 13.0520, 80.2380, 0.70, 0, 'Operational'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'East Harbour Primary School', 'School', 13.0880, 80.2920, 0.65, 450, 'Operational')
ON CONFLICT (id) DO NOTHING;
