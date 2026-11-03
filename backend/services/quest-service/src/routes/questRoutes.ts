import { Router } from "express";
import { QuestController } from "../controllers/questController.js";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware.js";

const router = Router();

const teacherOrAdmin = [authMiddleware, requireRole("TEACHER", "ADMIN")];
const adminOnly = [authMiddleware, requireRole("ADMIN")];

// Admin: importar ENEM e ver estatísticas do banco de questões
router.post("/import/enem", ...adminOnly, QuestController.importEnem);
router.get("/stats", ...adminOnly, QuestController.stats);

// Professor (e admin): gerenciar questões autorais
router.get("/mine", ...teacherOrAdmin, QuestController.listMine);
router.post("/", ...teacherOrAdmin, QuestController.create);
router.get("/:id", ...teacherOrAdmin, QuestController.getOne);
router.put("/:id", ...teacherOrAdmin, QuestController.update);
router.delete("/:id", ...teacherOrAdmin, QuestController.remove);

// Qualquer usuário logado (tela do aluno)
router.get("/", authMiddleware, QuestController.listQuests);

export const questRoutes = router;
