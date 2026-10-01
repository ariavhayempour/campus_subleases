INSERT INTO schools (slug, name, campus_location, default_map_zoom, timezone, warn_radius_km)
VALUES
  ('uw-madison', 'University of Wisconsin–Madison', 'SRID=4326;POINT(-89.4040 43.0753)'::geography, 13, 'America/Chicago', 25),
  ('umich', 'University of Michigan', 'SRID=4326;POINT(-83.7382 42.2770)'::geography, 13, 'America/Detroit', 25),
  ('ucla', 'University of California, Los Angeles', 'SRID=4326;POINT(-118.4422 34.0729)'::geography, 13, 'America/Los_Angeles', 25)
ON CONFLICT (slug) DO NOTHING;
