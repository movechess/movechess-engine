import { Router } from "express";
import { gameController } from "./game";

const routes = new Router();

routes.post("/new-game", gameController.newGame);
routes.get("/legal-moves/:gameId/:position", gameController.legalMoves);
routes.post("/make-move/:from/:to", gameController.makeMove);

export default routes;
