CREATE TABLE `deviceMaintenanceEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` int NOT NULL,
	`actionType` enum('set_maintenance','mark_available') NOT NULL,
	`reason` text,
	`maintenanceUntil` timestamp,
	`performedByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deviceMaintenanceEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `status` enum('pending','assigned','picked_up','in_transit','delivered','failed','returned','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `devices` ADD `maintenanceReason` text;--> statement-breakpoint
ALTER TABLE `devices` ADD `maintenanceUntil` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancellationReason` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `cancelledBy` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `archivedAt` timestamp;--> statement-breakpoint
ALTER TABLE `orders` ADD `archivedBy` int;--> statement-breakpoint
ALTER TABLE `riders` ADD `userId` int;