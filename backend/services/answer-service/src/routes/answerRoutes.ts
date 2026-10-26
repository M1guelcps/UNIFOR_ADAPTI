import { Router } from "express";
import { AnswerController } from "../controllers/answerController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = Router();


// Nova rota para buscar métricas e histórico
router.get("/me", authMiddleware, AnswerController.getMetrics);
// Rota para o aluno enviar a resposta
router.post("/", authMiddleware, AnswerController.submit);

export const answerRoutes = router;