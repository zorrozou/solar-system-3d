-- MySQL dump 10.13  Distrib 8.0.45, for Linux (x86_64)
--
-- Host: localhost    Database: solar_system
-- ------------------------------------------------------
-- Server version	8.0.45-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `planets`
--

DROP TABLE IF EXISTS `planets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `planets`
--

LOCK TABLES `planets` WRITE;
/*!40000 ALTER TABLE `planets` DISABLE KEYS */;
INSERT INTO `planets` VALUES (1,'Mercury','水星',0.39,87.969,58.6,2439.7,0.33,'#8C7853','水星是太阳系中最小的行星，也是距离太阳最近的行星。表面温度变化极大，白天可达430°C，夜晚降至-180°C。',0,'2026-02-11 07:27:00',0,7,0.03,0.2056,174.7960,77.4500),(2,'Venus','金星',0.72,224.701,-243,6051.8,4.87,'#FFC649','金星是太阳系中最热的行星，表面温度高达465°C。它的自转方向与其他行星相反，且自转速度极慢。大气层主要由二氧化碳组成。',0,'2026-02-11 07:27:00',0,3.39,177.4,0.0068,50.1150,131.5300),(3,'Earth','地球',1,365.256,1,6371,5.97,'#4169E1','地球是太阳系中唯一已知存在生命的行星。拥有液态水、适宜的温度和富含氧气的大气层。地球的自转轴倾斜23.5度，形成了四季变化。',1,'2026-02-11 07:27:00',1,0,23.44,0.0167,357.5290,102.9400),(4,'Mars','火星',1.52,686.98,1.03,3389.5,0.642,'#CD5C5C','火星被称为\"红色星球\"，因其表面富含氧化铁。火星拥有太阳系最高的山峰（奥林帕斯山，高约22公里）和最大的峡谷。',2,'2026-02-11 07:27:00',2,1.85,25.19,0.0934,19.3730,336.0400),(5,'Jupiter','木星',5.2,4332.59,0.41,69911,1898,'#DAA520','木星是太阳系最大的行星，质量是其他所有行星总和的2.5倍。著名的大红斑是一个持续了至少350年的巨型风暴。木星拥有强大的磁场。',79,'2026-02-11 07:27:00',79,1.31,3.13,0.0489,120.5370,273.8670),(6,'Saturn','土星',9.54,10759.2,0.45,58232,568,'#F4A460','土星以其壮观的行星环系统而闻名，环主要由冰粒和岩石碎片组成。土星的密度很低，甚至能漂浮在水上。',82,'2026-02-11 07:27:00',82,2.49,26.73,0.0565,70.6850,339.3920),(7,'Uranus','天王星',19.19,30688.5,-0.72,25362,86.8,'#4FD0E0','天王星的自转轴几乎平躺在轨道平面上，倾斜角度达98度。这使得它的季节变化极为极端，每个季节持续约21年。大气层呈蓝绿色。',27,'2026-02-11 07:27:00',27,0.77,97.77,0.0457,217.0570,96.9980),(8,'Neptune','海王星',30.07,60182,0.67,24622,102,'#4169E1','海王星是太阳系距离太阳最远的行星，也是风速最快的行星，风速可达2100km/h。其深蓝色外观来自大气层中的甲烷。',14,'2026-02-11 07:27:00',14,1.77,28.32,0.0113,31.1610,273.1870),(9,'Pluto','冥王星',39.48,90560,-6.387,1188.3,0.013,'#C2B280','冥王星是柯伊伯带中已知最大的矮行星。2006年被国际天文学联合会重新分类为矮行星。它有一颗大卫星冥卫一（卡戎），两者几乎构成双星系统。表面主要由氮冰、甲烷冰和一氧化碳冰覆盖。',0,'2026-04-16 13:54:26',5,17.16,122.53,0.2488,14.5300,224.0700);
/*!40000 ALTER TABLE `planets` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-04-17  9:20:42
