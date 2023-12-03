import { Router } from "express";
import { gameController } from "./game";

const routes = new Router();

routes.post("/new-game", gameController.newGame);
routes.get("/legal-moves/:gameId/:position", gameController.legalMoves);
routes.post("/make-move/:from/:to", gameController.makeMove);

routes.post("/new-game-v2", gameController.newGameV2);
routes.get("/load-game-v2", gameController.loadGameV2);

export default routes;
