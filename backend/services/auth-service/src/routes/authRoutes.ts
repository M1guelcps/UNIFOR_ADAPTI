import { Router } from "express";
import { AuthController } from "../controllers/authController.js";

const router = Router();

// Rota pública de cadastro
router.post("/register", AuthController.register);

// Rota pública de login
router.post("/login", AuthController.login);

export const authRoutes = router;