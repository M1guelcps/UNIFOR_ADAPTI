import { Router } from "express";
import { AnswerController } from "../controllers/answerController.js";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware.js";

const router = Router();


// Nova rota para buscar métricas e histórico
router.get("/me", authMiddleware, AnswerController.getMetrics);
// Rota para o aluno enviar a resposta
router.post("/", authMiddleware, AnswerController.submit);

// Professor: desempenho dos alunos nas questões que ele criou
router.get("/teacher/stats", authMiddleware, requireRole("TEACHER", "ADMIN"), AnswerController.getTeacherStats);
// Admin: visão geral de todas as respostas
router.get("/admin/stats", authMiddleware, requireRole("ADMIN"), AnswerController.getAdminStats);

export const answerRoutes = router;
