import { Router } from "express";
import { UserController } from "../controllers/userController.js";

const router = Router();

// Rota interna chamada pelo Auth Service
router.post("/internal/sync", UserController.syncUser);

export const userRoutes = router;