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
// Connect to wallet
routes.post("/airdrop/quest/wallet", airdropController.connectWallet)

// DISCORD API
// Discord OAuth
routes.get("/airdrop/discord/auth", airdropController.discordAuth);
// Discord OAuth callback
routes.get("/airdrop/discord/auth/callback", airdropController.discordAuthCallback);
// Join discord server
routes.get("/airdrop/discord/invite", airdropController.inviteDiscord);
// Verify discord role
routes.post("/airdrop/discord/role/verification", airdropController.verifyDiscordRole)

// TWITTER API
// Twitter OAuth
routes.get("/airdrop/twitter/auth", airdropController.twitterAuth)
// Twitter OAuth callback
routes.get("/airdrop/twitter/auth/callback", airdropController.twitterCallBack);
// Follow twitter
routes.post("/airdrop/twitter/follow", airdropController.followTwitter);
// Tweet
routes.post("/airdrop/twitter/tweet", airdropController.tweetTwitter);


export default routes;
