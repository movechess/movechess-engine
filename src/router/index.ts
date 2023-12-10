import { Router } from "express";
import { gameController } from "./game";
import { userController } from "./user";
import { authenToken } from "../auth/auth";

const routes = new Router();

routes.get("/user/ping", userController.ping);
routes.get("/users", userController.getUser);
routes.post("/create-user", userController.createUser);
routes.get("/get-user", authenToken, userController.getUser);

routes.post("/new-game", gameController.newGame);
routes.get("/legal-moves/:gameId/:position", gameController.legalMoves);
routes.post("/make-move/:from/:to", gameController.makeMove);

routes.post("/new-game-v2", authenToken, gameController.newGameV2);
routes.get("/load-game-v2", gameController.loadGameV2);
routes.get("/get-game-v2", gameController.getGamesV2);
routes.post("/update-winner-v2", authenToken, gameController.updateWinnerV2);

export default routes;
