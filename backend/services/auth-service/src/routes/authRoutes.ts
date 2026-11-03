import { Router } from "express";
import { AuthController } from "../controllers/authController.js";

const router = Router();

// Rota pública de cadastro
router.post("/register", AuthController.register);

// Rota pública de login
router.post("/login", AuthController.login);

// Rotas internas chamadas pelo User Service (bloqueadas no Gateway)
router.patch("/internal/users/:id", AuthController.internalUpdate);
router.delete("/internal/users/:id", AuthController.internalDelete);

export const authRoutes = router;