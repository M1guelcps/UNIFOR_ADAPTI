import { Router } from "express";
import { UserController } from "../controllers/userController.js";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware.js";

const router = Router();

// Rotas internas chamadas pelo Auth Service (bloqueadas no Gateway)
router.post("/internal/sync", UserController.syncUser);
router.get("/internal/:id", UserController.getInternal);

// Qualquer usuário logado
router.get("/me", authMiddleware, UserController.me);

// Somente administradores
router.get("/stats", authMiddleware, requireRole("ADMIN"), UserController.stats);
router.get("/", authMiddleware, requireRole("ADMIN"), UserController.list);
router.patch("/:id/role", authMiddleware, requireRole("ADMIN"), UserController.updateRole);
router.put("/:id", authMiddleware, requireRole("ADMIN"), UserController.update);
router.delete("/:id", authMiddleware, requireRole("ADMIN"), UserController.remove);

export const userRoutes = router;
