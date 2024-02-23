import express from "express";
import { client } from "./database";
import routes from "./router";
import cors from "cors";
import cookieParser from "cookie-parser";
const app = express();
const port = process.env.PORT || 3001;

import bodyParser from "body-parser";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { dbCollection } from "./database/collection";
import md5 from "md5";
import { Chess, Chess as ChessV2, Square } from "./engine/chess2";
import { DEFAULT_0X0_ADDRESS, TGame, gameController, getGasLimit, keyring } from "./controller/game";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ContractPromise } from "@polkadot/api-contract";
import abi from "./abi/movechesscontract.json";
import { WeightV2 } from "@polkadot/types/interfaces/types";
import jsonrpc from "@polkadot/types/interfaces/jsonrpc";
import { MongoClient } from "mongodb";

(async function main() {
  app.use(cors());
  app.use(express.json());
  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(cookieParser());

  let corsOptions = {
    origin: ["https://www.client.movechess.com", "https://client.movechess.com"],
    credentials: true,
  };

  app.get("/ping", (req, res) => {
    res.json("pong 17");
  });
  // app.get("/get-game-V2", cors(corsOptions), gameController.getGamesV2);
  // app.use("/", cors(corsOptions), routes);
  app.use(cors(), routes);

  await client.connect().catch((err) => console.log("7s200:err", err));
  client.on("close", () => {
    client.connect();
  });

  const http = app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });

  const io = new Server({
    cors: {
      origin: ["http://localhost:3000", "https://www.client.movechess.com", "https://client.movechess.com"],
    },
  }).listen(http);

  io.use((socket, next) => {
    if (socket.handshake.headers.authorization) {
      const token = socket.handshake.headers.authorization.toString();
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decodedToken) => {
        if (err) {
          // console.log("7s200:socket:auth:err", err, decodedToken);
          return;
        }
        const { collection } = await dbCollection<any>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_USERS!);
        const userData = await collection.findOne({ address: decodedToken.address });
        // console.log("7s200:userData", userData);
        if (!userData) {
          // console.log("7s200:socket:auth:err:userData", userData, decodedToken);
          return;
        }
        (socket as any).user = userData.address;
        return next();
      });
    } else {
      // console.log("7s200:socketerr:");
      return;
    }
  }).on("connection", (socket) => {
    console.log("New socket connection", (socket as any).user);

    socket.on("createGame", async function () {
      const time = Date.now();
      const id = md5(time);

      const chess = new ChessV2();

      const board = {
        game_id: id,
        player_1: (socket as any).user,
        player_2: "",
        board: chess.board(),
        score: 0,
        turn_player: chess.turn(),
        move_number: chess.moveNumber(),
        fen: chess.fen(),
      };

      const { collection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
      const insert = await collection.insertOne(board);
      if (insert) {
        socket.join(board.game_id);
      }
    });

    socket.on("move", async function (move) {
      // console.log("7s200:move:2");
      const { from, to, turn, address, isPromotion, fen, game_id } = move; //fake fen'
      socket.join(game_id);

      const { collection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
      const board = await collection.findOne({ game_id: game_id });
      if (board.player_1 === "" || board.player_2 === "" || board.player_2 === DEFAULT_0X0_ADDRESS) {
        return;
      }
      // console.log("7s200:move:3", (socket as any).user, turn, game_id);
      if ((board as any).isGameDraw || (board as any).isGameOver) {
        return;
      }
      // console.log("7s200:move:4");
      const chess = new ChessV2(fen);
      try {
        console.log("7s200:move:promotion");
        if (!isPromotion) {
          chess.move({
            from: from,
            to: to,
            // promotion: "q",
          });
        }
      } catch (error) {
        console.log("7s200:move:err");
      }

      const isGameOver = chess.isGameOver();
      const isGameDraw = chess.isDraw();
      // console.log("7s200:move:5");

      const newBoard = {
        $set: {
          board: chess.board(),
          turn_player: chess.turn(),
          move_number: chess.moveNumber(),
          fen: chess.fen(),
          isGameDraw: isGameDraw,
          isGameOver: isGameOver,
        },
      };
      // console.log("7s200:move:6");

      io.to(game_id).emit("newmove", { game_id: game_id, from, to, board: chess.board(), turn: chess.turn(), fen: chess.fen() });
      // console.log("7s200:move:7", { game_id: game_id, from, to, board: chess.board(), turn: chess.turn(), fen: chess.fen() });

      await collection
        .findOneAndUpdate({ game_id: board.game_id }, newBoard)
        .then((data) => {
          if (data) {
            // console.log("7s200:move:8");
            //  io.to(board.game_id).emit("newMove", { from, to, board: chess.board(), turn: chess.turn(), fen: chess.fen() });
          }
        })
        .catch((err) => {
          // console.log("7s200:err", err);
        });
      // console.log("7s200:move:9");

      // if ((board.turn_player !== turn && turn === "b" && (socket as any).user === board.player_1) || (board.turn_player !== turn && turn === "w" && (socket as any).user === board.player_2)) {
      //  // h
      //   // console.log("7s200:chess", newBoard);
      // }
      // else {
      //   // io.to(board.game_id).emit("newMove", { from, to, board: board.board, turn: board.turn_player, fen: board.fen });
      // }
    });

    socket.on("joinGame", async function (data) {
      const { collection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
      const board = await collection.findOne({ game_id: data.game_id });

      socket.join(board.game_id);

      if ((board as any).isPaymentMatch) {
        if (true) {
          // if (board.player_1 !== (socket as any).user && (board as any).pays.player1 === 10000000000000 && board.player_2 === "") {

          // }
          if ((board as any).pays.gameIndex) {
            const provider = new WsProvider("wss://ws.test.azero.dev");
            const api = await ApiPromise.create({
              provider,
              rpc: jsonrpc,
            });

            const contract = new ContractPromise(api, abi, "5CRDBTruY3hLTCQmn7MTnULpL3ALXLMEUWLDa826hyFftKkK");
            const gasLimit2 = api.registry.createType("WeightV2", api.consts.system.blockWeights["maxBlock"]) as WeightV2;
            const { result, output } = await contract.query.getGameInfo("5E7zwZHqCv53cWrFqfmaVBQ7u6dnWMR4dEdepAWBHAKx9LkH", { gasLimit: gasLimit2 }, (board as any).pays.gameIndex);

            if (result.isOk && output) {
              console.log("7s200:joingame", (socket as any).user, (output.toJSON() as any).ok);
              const updateboard = {
                $set: {
                  player_1: (output.toJSON() as any).ok.userA,
                  player_2: (output.toJSON() as any).ok.userB === DEFAULT_0X0_ADDRESS ? "" : (output.toJSON() as any).ok.userB,
                  pays: {
                    player1: 10000000000000,
                    gameIndex: (board as any).pays.gameIndex,
                    player2: (output.toJSON() as any).ok.userB === DEFAULT_0X0_ADDRESS ? 0 : 10000000000000,
                  },
                },
              };
              await collection
                .findOneAndUpdate({ game_id: board.game_id }, updateboard)
                .then((data) => {
                  console.log("7s200:data", data);
                  if ((output.toJSON() as any).ok.userA !== DEFAULT_0X0_ADDRESS && (output.toJSON() as any).ok.userB !== DEFAULT_0X0_ADDRESS) {
                    io.to(data.game_id).emit("start", { start: true });
                  }
                })
                .catch((err) => {
                  console.log("7s200:err", err);
                });
            }
          }
        }
      }

      // if (board.player_1.length === 0 && board.player_2.length === 0) {
      //   const updateDoc = {
      //     $set: {
      //       player_1: (socket as any).user,
      //     },
      //   };
      //   await collection.findOneAndUpdate({ game_id: data.game_id }, updateDoc);
      //   socket.join(data.game_id);
      // }
      // if (board.player_1.length > 0 && (socket as any).user !== board.player_1) {
      //   const updateDoc = {
      //     $set: {
      //       player_2: (socket as any).user,
      //     },
      //   };
      //   await collection.findOneAndUpdate({ game_id: data.game_id }, updateDoc);
      //   socket.join(data.game_id);
      // }
      // if (board.player_2.length > 0 && (socket as any).user !== board.player_2) {
      //   const updateDoc = {
      //     $set: {
      //       player_1: (socket as any).user,
      //     },
      //   };
      //   await collection.findOneAndUpdate({ game_id: data.game_id }, updateDoc);
      //   socket.join(data.game_id);
      // }
      socket.join(data.game_id);
    });

    socket.on("tournament", async function (data) {
      const { collection } = await dbCollection<any>(process.env.DB_MOVECHESS!, "tournament");
      // const board = await collection.find().toArray();
      // console.log("7s200:joinTournament:board", board);
      if (data.player1 && data.player2 && data.tournamnetIndex) {
        const board = await collection.findOne({ player1: data.player1, player2: data.player2, tournamentIndex: data.tournamentIndex, game_id: `${data.player1}-${data.player2}-${data.tournamentIndex}` });
        if (!board) {
          const chess = new ChessV2();
          const board = {
            board: chess.board(),
            fen: chess.fen(),
            player1: data.player1,
            player2: data.player2,
            turn_player: chess.turn(),
            game_id: `${data.player1}-${data.player2}-${data.tournamentIndex}`,
          };
          const newBoard = await collection.insertOne(board);
          socket.join(`${data.player1}-${data.player2}-${data.tournamentIndex}`);
        }
      }
    });

    socket.on("jointournamentgame", async function (data) {
      socket.join(data.game_id);
    });
    socket.on("tournamentmove", async function (move) {
      const { from, to, turn, address, isPromotion, fen, game_id } = move; //fake fen'
      socket.join(game_id);

      const { collection } = await dbCollection<any>(process.env.DB_MOVECHESS!, "tournament");
      const board = await collection.findOne({ game_id: game_id });
      console.log("7s200:board", board);
      if (board.player1 === "" || board.player2 === "" || board.player2 === DEFAULT_0X0_ADDRESS) {
        return;
      }
      if ((board as any).isGameDraw || (board as any).isGameOver) {
        return;
      }
      const chess = new ChessV2(fen);
      try {
        console.log("7s200:move:promotion");
        if (!isPromotion) {
          chess.move({
            from: from,
            to: to,
            // promotion: "q",
          });
        }
      } catch (error) {
        console.log("7s200:move:err");
      }
      const isGameOver = chess.isGameOver();
      const isGameDraw = chess.isDraw();
      const newBoard = {
        $set: {
          board: chess.board(),
          turn_player: chess.turn(),
          move_number: chess.moveNumber(),
          fen: chess.fen(),
          isGameDraw: isGameDraw,
          isGameOver: isGameOver,
        },
      };
      io.to(game_id).emit("tournamentnewmove", { game_id: game_id, from, to, board: chess.board(), turn: chess.turn(), fen: chess.fen() });
      await collection
        .findOneAndUpdate({ game_id: board.game_id }, newBoard)
        .then((data) => {
          if (data) {
          }
        })
        .catch((err) => {});
    });

    socket.on("disconnect", function () {
      console.log("7s200:socket:disconnect");
    });
  });
  function getMoveOptions(game: Chess, square: Square) {
    const moves = game.moves({
      square,
      verbose: true,
    });
    if (moves.length === 0) {
      return false;
    }
    return true;
  }
})();
