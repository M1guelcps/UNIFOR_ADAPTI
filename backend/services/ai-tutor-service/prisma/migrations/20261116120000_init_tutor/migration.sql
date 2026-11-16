-- CreateTable
CREATE TABLE `TutorFeedback` (
    `id` VARCHAR(191) NOT NULL,
    `contentHash` VARCHAR(64) NOT NULL,
    `questaoId` VARCHAR(64) NOT NULL,
    `respostaAluno` VARCHAR(8) NOT NULL,
    `feedback` JSON NOT NULL,
    `promptVersion` VARCHAR(32) NOT NULL,
    `model` VARCHAR(128) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TutorFeedback_contentHash_key`(`contentHash`),
    INDEX `TutorFeedback_questaoId_idx`(`questaoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

