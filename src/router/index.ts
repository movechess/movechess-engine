import { Router } from "express";
import { gameController } from "../controller/game";
import { userController } from "../controller/user";
import { authenToken } from "../auth/auth";
import { tournamentController } from "../controller/tournament";
import {airdropController} from "../controller/airdrop";

const routes = new Router();

routes.get("/user/ping", userController.ping);
routes.get("/users", userController.getAllUser);
routes.post("/create-user", userController.createUser);
routes.get("/get-user", authenToken, userController.getUser);

routes.post("/new-game", gameController.newGame);
routes.get("/legal-moves/:gameId/:position", gameController.legalMoves);
routes.post("/make-move/:from/:to", gameController.makeMove);

routes.post("/new-game-v2", authenToken, gameController.newGameV2);
routes.get("/load-game-v2", gameController.loadGameV2);
routes.get("/get-game-v2", authenToken, gameController.getGamesV2);
routes.post("/update-winner-v2", authenToken, gameController.updateWinnerV2);

routes.get("/load-tournament-game-v2", tournamentController.loadTournamentGameV2);

// Airdrop
routes.get("/airdrop/quest/:address", airdropController.getAirdropProgress)
routes.post("/airdrop/:address/discord/:discordId", airdropController.connectDiscord);
routes.get("/airdrop/discord/auth", airdropController.discordAuth);
routes.get("/airdrop/discord/auth/callback", airdropController.discordAuthCallback);

export default routes;
