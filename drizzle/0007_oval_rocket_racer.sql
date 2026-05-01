CREATE TABLE `fleetOwnerNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerCompanyId` int NOT NULL,
	`notificationType` enum('submitted','approved','rejected') NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`email` varchar(255) NOT NULL,
	CONSTRAINT `fleetOwnerNotifications_id` PRIMARY KEY(`id`)
);
