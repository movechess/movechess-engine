import { Router } from "express";
import { gameController } from "./game";

const routes = new Router();

routes.post("/new-game", gameController.newGame);

export default routes;
