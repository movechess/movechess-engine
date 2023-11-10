import { Router } from "express";
import { gameController } from "./game";

const routes = new Router();

routes.post("/new-game", gameController.newGame);
routes.get("/legal-moves/:gameId/:position", gameController.legalMoves);
export default routes;
