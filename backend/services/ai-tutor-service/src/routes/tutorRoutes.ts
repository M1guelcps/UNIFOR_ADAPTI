import { Router } from "express";
import type { RequestHandler } from "express";
import type { TutorController } from "../controllers/tutorController.js";

export function createTutorRoutes(controller: TutorController, internalAuth: RequestHandler): Router {
  const router = Router();

  router.post("/explain", internalAuth, controller.explain);

  return router;
}
