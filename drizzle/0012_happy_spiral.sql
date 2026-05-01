ALTER TABLE `partnerEarnings` MODIFY COLUMN `status` enum('pending','credited','paid_out','voided') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `partnerEarnings` ADD `voidedAt` timestamp;--> statement-breakpoint
ALTER TABLE `partnerEarnings` ADD `voidedBy` int;--> statement-breakpoint
ALTER TABLE `partnerEarnings` ADD `voidReason` text;