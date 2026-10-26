import { Router } from "express";
import { QuestController } from "../controllers/questController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js"; // <-- Importe aqui

const router = Router();

router.post("/import/enem", QuestController.importEnem);

router.get("/", authMiddleware, QuestController.listQuests);

export const questRoutes = router;