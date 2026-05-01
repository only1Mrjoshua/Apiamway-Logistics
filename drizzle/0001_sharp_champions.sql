CREATE TABLE `devices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`traccarDeviceId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`status` enum('active','maintenance') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`previousStatus` varchar(50),
	`newStatus` varchar(50) NOT NULL,
	`changedByUserId` int,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `orderHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`trackingNumber` varchar(20) NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`customerEmail` varchar(320),
	`pickupAddress` text NOT NULL,
	`pickupZone` varchar(50),
	`pickupContactName` varchar(255),
	`pickupContactPhone` varchar(20),
	`deliveryAddress` text NOT NULL,
	`deliveryZone` varchar(50),
	`deliveryContactName` varchar(255),
	`deliveryContactPhone` varchar(20),
	`serviceType` enum('intra-city','inter-city-air','inter-city-ground') NOT NULL DEFAULT 'intra-city',
	`originCity` varchar(100) DEFAULT 'Enugu',
	`destinationCity` varchar(100) DEFAULT 'Enugu',
	`weightKg` decimal(10,2),
	`price` decimal(10,2) NOT NULL,
	`paymentStatus` enum('pending','paid','refunded') NOT NULL DEFAULT 'pending',
	`paymentMethod` varchar(50),
	`packageDescription` text,
	`declaredValue` decimal(10,2),
	`status` enum('pending','assigned','picked_up','in_transit','delivered','failed','returned') NOT NULL DEFAULT 'pending',
	`riderId` int,
	`deviceId` int,
	`proofOfDeliveryUrl` text,
	`deliveryNote` text,
	`scheduledPickupAt` timestamp,
	`actualPickupAt` timestamp,
	`estimatedDeliveryAt` timestamp,
	`actualDeliveryAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_trackingNumber_unique` UNIQUE(`trackingNumber`)
);
--> statement-breakpoint
CREATE TABLE `riders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`status` enum('active','inactive','on_leave') NOT NULL DEFAULT 'active',
	`currentDeviceId` int,
	`assignedHub` varchar(100) DEFAULT 'Enugu-Main',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `riders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trackingTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trackingTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `trackingTokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','dispatcher','support') NOT NULL DEFAULT 'user';