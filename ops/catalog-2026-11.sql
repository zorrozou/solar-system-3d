START TRANSACTION;
-- JPL Solar System Dynamics discovery table retrieved 2026-11-03.
-- https://ssd.jpl.nasa.gov/sats/discovery.html
UPDATE planets SET moons = CASE name
    WHEN 'Mercury' THEN 0 WHEN 'Venus' THEN 0 WHEN 'Earth' THEN 1 WHEN 'Mars' THEN 2
    WHEN 'Jupiter' THEN 115 WHEN 'Saturn' THEN 293 WHEN 'Uranus' THEN 29
    WHEN 'Neptune' THEN 16 WHEN 'Pluto' THEN 5 END
WHERE name IN ('Mercury','Venus','Earth','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto');

-- JPL Horizons DE441, system barycenters relative to the Sun.
-- Osculating elements at JD 2451545.0 TDB in the J2000 ecliptic frame.
UPDATE planets SET eccentricity = 0.20563029, orbital_inclination = 7.00501430, mean_anomaly_j2000 = 174.7959, perihelion_longitude = 77.4548 WHERE name = 'Mercury';
UPDATE planets SET eccentricity = 0.00675579, orbital_inclination = 3.39458965, mean_anomaly_j2000 = 50.1148, perihelion_longitude = 131.8643 WHERE name = 'Venus';
UPDATE planets SET eccentricity = 0.01670236, orbital_inclination = 0.00010346, mean_anomaly_j2000 = 357.5452, perihelion_longitude = 102.9179 WHERE name = 'Earth';
UPDATE planets SET eccentricity = 0.09331510, orbital_inclination = 1.84987646, mean_anomaly_j2000 = 19.3565, perihelion_longitude = 336.0994 WHERE name = 'Mars';
UPDATE planets SET eccentricity = 0.04877488, orbital_inclination = 1.30462537, mean_anomaly_j2000 = 18.8185, perihelion_longitude = 15.5576 WHERE name = 'Jupiter';
UPDATE planets SET eccentricity = 0.05572339, orbital_inclination = 2.48525044, mean_anomaly_j2000 = 320.3479, perihelion_longitude = 89.6566 WHERE name = 'Saturn';
UPDATE planets SET eccentricity = 0.04440553, orbital_inclination = 0.77256753, mean_anomaly_j2000 = 142.9558, perihelion_longitude = 170.5311 WHERE name = 'Uranus';
UPDATE planets SET eccentricity = 0.01121514, orbital_inclination = 1.76798635, mean_anomaly_j2000 = 267.7657, perihelion_longitude = 37.4428 WHERE name = 'Neptune';
UPDATE planets SET eccentricity = 0.24467451, orbital_inclination = 17.15136440, mean_anomaly_j2000 = 15.0233, perihelion_longitude = 224.0498 WHERE name = 'Pluto';

-- JPL mean radii (km) and sidereal periods (days, orbital years converted with 365.25).
-- https://ssd.jpl.nasa.gov/planets/phys_par.html
UPDATE planets SET radius=2439.4, rotation_period=58.6462, orbital_period=87.96926 WHERE name='Mercury';
UPDATE planets SET radius=6051.8, rotation_period=-243.018, orbital_period=224.70080 WHERE name='Venus';
UPDATE planets SET radius=6371.0084, rotation_period=0.99726968, orbital_period=365.25636 WHERE name='Earth';
UPDATE planets SET radius=3389.5, rotation_period=1.02595676, orbital_period=686.97959 WHERE name='Mars';
UPDATE planets SET radius=69911.0, rotation_period=0.41354, orbital_period=4332.82013 WHERE name='Jupiter';
UPDATE planets SET radius=58232.0, rotation_period=0.44401, orbital_period=10755.69864 WHERE name='Saturn';
UPDATE planets SET radius=25362.0, rotation_period=-0.71833, orbital_period=30687.15300 WHERE name='Uranus';
UPDATE planets SET radius=24622.0, rotation_period=0.67125, orbital_period=60190.02963 WHERE name='Neptune';
UPDATE planets SET radius=1188.3, rotation_period=-6.3872, orbital_period=90553.01741 WHERE name='Pluto';
COMMIT;
