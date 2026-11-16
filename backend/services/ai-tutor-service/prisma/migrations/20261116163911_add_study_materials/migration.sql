-- AlterTable
ALTER TABLE `TutorFeedback` ADD COLUMN `assuntos` JSON NULL;

-- CreateTable
CREATE TABLE `study_materials` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `subject` VARCHAR(100) NOT NULL,
    `topic` VARCHAR(150) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `study_materials_url_key`(`url`),
    INDEX `study_materials_subject_topic_active_idx`(`subject`, `topic`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
