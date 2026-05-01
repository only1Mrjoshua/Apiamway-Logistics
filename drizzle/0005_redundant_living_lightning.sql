ALTER TABLE `orders` ADD `settlementStatus` enum('pending','settled','failed') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `partnerCompanies` ADD `commissionType` enum('percentage','flat') DEFAULT 'percentage' NOT NULL;--> statement-breakpoint
ALTER TABLE `partnerCompanies` ADD `commissionValue` decimal(10,2) DEFAULT '70.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `partnerCompanies` ADD `balance` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `partnerEarnings` ADD CONSTRAINT `partnerEarnings_orderId_unique` UNIQUE(`orderId`);