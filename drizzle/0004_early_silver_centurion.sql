CREATE TABLE `partnerCompanies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`contactPhone` varchar(20) NOT NULL,
	`contactEmail` varchar(320),
	`commissionPercentage` decimal(5,2) NOT NULL DEFAULT '70.00',
	`status` enum('pending','approved','suspended','rejected') NOT NULL DEFAULT 'pending',
	`approvedByUserId` int,
	`approvedAt` timestamp,
	`userId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partnerCompanies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partnerEarnings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerCompanyId` int NOT NULL,
	`orderId` int NOT NULL,
	`orderPrice` decimal(12,2) NOT NULL,
	`commissionPercentage` decimal(5,2) NOT NULL,
	`partnerAmount` decimal(12,2) NOT NULL,
	`apiamwayAmount` decimal(12,2) NOT NULL,
	`status` enum('pending','credited','paid_out') NOT NULL DEFAULT 'pending',
	`creditedAt` timestamp,
	`paidOutAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `partnerEarnings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `devices` ADD `fleetType` enum('apiamway_owned','partner_fleet') DEFAULT 'apiamway_owned' NOT NULL;--> statement-breakpoint
ALTER TABLE `devices` ADD `partnerCompanyId` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `partnerCompanyId` int;--> statement-breakpoint
ALTER TABLE `riders` ADD `fleetType` enum('apiamway_owned','partner_fleet') DEFAULT 'apiamway_owned' NOT NULL;--> statement-breakpoint
ALTER TABLE `riders` ADD `partnerCompanyId` int;