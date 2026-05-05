/*
SQLyog Ultimate
MySQL - 8.0.30 : Database - db_aq_gis
*********************************************************************
*/

/*!40101 SET NAMES utf8 */;

/*!40101 SET SQL_MODE=''*/;

/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
USE `db_aq_gis`;

/*Table structure for table `air_quality_readings` */

CREATE TABLE `air_quality_readings` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `city_id` bigint NOT NULL,
  `source_id` bigint NOT NULL,
  `measured_on` date NOT NULL,
  `frequency` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'daily',
  `resolution` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'modeled_city',
  `pm10` double DEFAULT NULL,
  `pm2_5` double DEFAULT NULL,
  `carbon_monoxide` double DEFAULT NULL,
  `nitrogen_dioxide` double DEFAULT NULL,
  `sulphur_dioxide` double DEFAULT NULL,
  `ozone` double DEFAULT NULL,
  `aerosol_optical_depth` double DEFAULT NULL,
  `dust` double DEFAULT NULL,
  `uv_index` double DEFAULT NULL,
  `us_aqi` double DEFAULT NULL,
  `european_aqi` double DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_air_quality_city_source_date` (`city_id`,`source_id`,`measured_on`),
  KEY `idx_air_quality_readings_city_date` (`city_id`,`measured_on`),
  KEY `idx_air_quality_readings_source_date` (`source_id`,`measured_on`),
  CONSTRAINT `fk_air_quality_readings_city` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_air_quality_readings_source` FOREIGN KEY (`source_id`) REFERENCES `data_sources` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1299 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*Table structure for table `cities` */

CREATE TABLE `cities` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `geoname_id` bigint NOT NULL,
  `city_name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `country_code` char(2) COLLATE utf8mb4_unicode_ci NOT NULL,
  `admin1` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin2` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `feature_code` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `latitude` double NOT NULL,
  `longitude` double NOT NULL,
  `population` int DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cities_geoname_id` (`geoname_id`),
  KEY `idx_cities_lat_lon` (`latitude`,`longitude`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*Table structure for table `data_sources` */

CREATE TABLE `data_sources` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `name` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `frequency` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `resolution` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_data_sources_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/*Table structure for table `air_quality_readings_geo` */

DROP TABLE IF EXISTS `air_quality_readings_geo`;

/*!50001 CREATE TABLE  `air_quality_readings_geo`(
 `id` bigint ,
 `measured_on` date ,
 `frequency` varchar(80) ,
 `resolution` varchar(80) ,
 `geoname_id` bigint ,
 `city_name` varchar(160) ,
 `country_code` char(2) ,
 `latitude` double ,
 `longitude` double ,
 `source_name` varchar(160) ,
 `source_provider` varchar(160) ,
 `pm10` double ,
 `pm2_5` double ,
 `carbon_monoxide` double ,
 `nitrogen_dioxide` double ,
 `sulphur_dioxide` double ,
 `ozone` double ,
 `aerosol_optical_depth` double ,
 `dust` double ,
 `uv_index` double ,
 `us_aqi` double ,
 `european_aqi` double 
)*/;

/*Table structure for table `latest_air_quality_by_city` */

DROP TABLE IF EXISTS `latest_air_quality_by_city`;

/*!50001 CREATE TABLE  `latest_air_quality_by_city`(
 `id` bigint ,
 `measured_on` date ,
 `frequency` varchar(80) ,
 `resolution` varchar(80) ,
 `geoname_id` bigint ,
 `city_name` varchar(160) ,
 `country_code` char(2) ,
 `latitude` double ,
 `longitude` double ,
 `source_name` varchar(160) ,
 `source_provider` varchar(160) ,
 `pm10` double ,
 `pm2_5` double ,
 `carbon_monoxide` double ,
 `nitrogen_dioxide` double ,
 `sulphur_dioxide` double ,
 `ozone` double ,
 `aerosol_optical_depth` double ,
 `dust` double ,
 `uv_index` double ,
 `us_aqi` double ,
 `european_aqi` double 
)*/;

/*View structure for view air_quality_readings_geo */

/*!50001 DROP TABLE IF EXISTS `air_quality_readings_geo` */;
/*!50001 CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `air_quality_readings_geo` AS select `r`.`id` AS `id`,`r`.`measured_on` AS `measured_on`,`r`.`frequency` AS `frequency`,`r`.`resolution` AS `resolution`,`c`.`geoname_id` AS `geoname_id`,`c`.`city_name` AS `city_name`,`c`.`country_code` AS `country_code`,`c`.`latitude` AS `latitude`,`c`.`longitude` AS `longitude`,`ds`.`name` AS `source_name`,`ds`.`provider` AS `source_provider`,`r`.`pm10` AS `pm10`,`r`.`pm2_5` AS `pm2_5`,`r`.`carbon_monoxide` AS `carbon_monoxide`,`r`.`nitrogen_dioxide` AS `nitrogen_dioxide`,`r`.`sulphur_dioxide` AS `sulphur_dioxide`,`r`.`ozone` AS `ozone`,`r`.`aerosol_optical_depth` AS `aerosol_optical_depth`,`r`.`dust` AS `dust`,`r`.`uv_index` AS `uv_index`,`r`.`us_aqi` AS `us_aqi`,`r`.`european_aqi` AS `european_aqi` from ((`air_quality_readings` `r` join `cities` `c` on((`c`.`id` = `r`.`city_id`))) join `data_sources` `ds` on((`ds`.`id` = `r`.`source_id`))) */;

/*View structure for view latest_air_quality_by_city */

/*!50001 DROP TABLE IF EXISTS `latest_air_quality_by_city` */;
/*!50001 CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `latest_air_quality_by_city` AS select `geo`.`id` AS `id`,`geo`.`measured_on` AS `measured_on`,`geo`.`frequency` AS `frequency`,`geo`.`resolution` AS `resolution`,`geo`.`geoname_id` AS `geoname_id`,`geo`.`city_name` AS `city_name`,`geo`.`country_code` AS `country_code`,`geo`.`latitude` AS `latitude`,`geo`.`longitude` AS `longitude`,`geo`.`source_name` AS `source_name`,`geo`.`source_provider` AS `source_provider`,`geo`.`pm10` AS `pm10`,`geo`.`pm2_5` AS `pm2_5`,`geo`.`carbon_monoxide` AS `carbon_monoxide`,`geo`.`nitrogen_dioxide` AS `nitrogen_dioxide`,`geo`.`sulphur_dioxide` AS `sulphur_dioxide`,`geo`.`ozone` AS `ozone`,`geo`.`aerosol_optical_depth` AS `aerosol_optical_depth`,`geo`.`dust` AS `dust`,`geo`.`uv_index` AS `uv_index`,`geo`.`us_aqi` AS `us_aqi`,`geo`.`european_aqi` AS `european_aqi` from (`air_quality_readings_geo` `geo` join (select `air_quality_readings_geo`.`geoname_id` AS `geoname_id`,max(`air_quality_readings_geo`.`measured_on`) AS `latest_measured_on` from `air_quality_readings_geo` group by `air_quality_readings_geo`.`geoname_id`) `latest` on(((`latest`.`geoname_id` = `geo`.`geoname_id`) and (`latest`.`latest_measured_on` = `geo`.`measured_on`)))) */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
