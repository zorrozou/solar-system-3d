# Production configuration

The PHP endpoint reads `/etc/solar-system/database.ini` with `user` and `password` keys. Keep the directory root:www-data mode 0750 and the file root:www-data mode 0640. Generate a unique local MySQL account and grant only SELECT on solar_system.planets. The web process does not need migration privileges.

Run the catalog SQL as a database administrator. A fresh installation can use catalog-schema.sql followed by catalog-data.sql and the dated migrations. Keep operational backups in a private directory outside the web root. Include private-paths.nginx in each Nginx server block that serves this app, alongside the existing restrictions on dotfiles and PHP execution.

The browser uses the vendored MIT-licensed Astronomy Engine 2.1.19. Its license is retained in the module. Scene coordinates use a fixed J2000 ecliptic frame; size and distance are exaggerated for viewing. The date picker supports local civil years 2000–2100. The current solar distance is calculated from the ephemeris. The orbital period and approximate semimajor axis in the panel are catalog values. Source: NASA/JPL Solar System Dynamics and its planetary satellite discovery table. The browser needs WebGL 2.
