-- Install in an empty solar_system database.
CREATE TABLE `planets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name_cn` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `distance_from_sun` float NOT NULL COMMENT '距离太阳的距离(AU)',
  `orbital_period` float NOT NULL COMMENT '公转周期(地球日)',
  `rotation_period` float NOT NULL COMMENT '自转周期(地球日)',
  `radius` float NOT NULL COMMENT '半径(km)',
  `mass` float NOT NULL COMMENT '质量(10^24 kg)',
  `color` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `satellites` int DEFAULT '0' COMMENT '卫星数量',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `moons` int DEFAULT '0',
  `orbital_inclination` float DEFAULT '0' COMMENT '轨道倾角(度)',
  `axial_tilt` float DEFAULT '0' COMMENT '轴倾角(度)',
  `eccentricity` float DEFAULT '0' COMMENT '轨道偏心率',
  `mean_anomaly_j2000` decimal(10,4) DEFAULT '0.0000',
  `perihelion_longitude` decimal(10,4) DEFAULT '0.0000',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
