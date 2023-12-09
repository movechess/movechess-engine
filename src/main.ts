import express from "express";
import { client } from "./database";
import routes from "./router";
const app = express();
const port = process.env.PORT || 3000;

import bodyParser from "body-parser";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { dbCollection } from "./database/collection";
import md5 from "md5";
import { Chess, Chess as ChessV2, Square } from "./engine/chess2";
import { TGame } from "./router/game";

(async function main() {
  app.use(express.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    next();
  });
  app.get("/ping", (req, res) => {
    res.json("pong");
  });
  app.use("/", routes);

  await client.connect().catch((err) => console.log("7s200:err", err));
  client.on("close", () => {
    client.connect();
  });

  const http = app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });

  const io = new Server({
    cors: {
      origin: "http://localhost:3000",
    },
  }).listen(http);

  io.use((socket, next) => {
    if (socket.handshake.headers.authorization) {
      const token = socket.handshake.headers.authorization.toString();
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (err, decodedToken) => {
        if (err) {
          // throw new Error("Authentication error, Invalid Token supplied");
          return;
        }
        const { collection } = await dbCollection<any>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_USERS!);
        const userData = await collection.findOne({ address: decodedToken.address });
        if (!userData) {
          // throw new Error("Invalid Email or Password, Kindly contact the admin if this is an anomaly");
          return;
        }
        (socket as any).user = userData.address;
        return next();
      });
    } else {
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

    socket.on("joinGame", async function (data) {
      const { collection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
      const board = await collection.findOne({ game_id: data.game_id });
      socket.on(board.game_id, async function (move) {
        const { from, to, turn, address, isPromotion, fen } = move; //fake fen'
        console.log("7s200:turn", (socket as any).user, turn);
        if ((board as any).isGameDraw || (board as any).isGameOver) {
          return;
        }
        if ((board.turn_player !== turn && turn === "b" && (socket as any).user === board.player_1) || (board.turn_player !== turn && turn === "w" && (socket as any).user === board.player_2)) {
          const chess = new ChessV2(fen);
          try {
            if (!isPromotion) {
              chess.move({
                from: from,
                to: to,
              });
              // if (_move === null) {
              //   return;
              // }
            }
          } catch (error) {}

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

          await collection
            .findOneAndUpdate({ game_id: board.game_id }, newBoard)
            .then((data) => {
              if (data) {
                io.to(board.game_id).emit("newMove", { from, to, board: chess.board(), turn: chess.turn(), fen: chess.fen() });
              }
            })
            .catch((err) => {
              console.log("7s200:err", err);
            });
          // console.log("7s200:chess", newBoard);
        } else {
          // io.to(board.game_id).emit("newMove", { from, to, board: board.board, turn: board.turn_player, fen: board.fen });
        }
      });
      if (board.player_1.length > 0 && board.player_2.length > 0) {
        io.to(data.game_id).emit("start");
      }
      if (board.player_1.length === 0 && board.player_2.length === 0) {
        const updateDoc = {
          $set: {
            player_1: (socket as any).user,
          },
        };
        await collection.findOneAndUpdate({ game_id: data.game_id }, updateDoc);
        socket.join(data.game_id);
      }
      if (board.player_1.length > 0 && (socket as any).user !== board.player_1) {
        const updateDoc = {
          $set: {
            player_2: (socket as any).user,
          },
        };
        await collection.findOneAndUpdate({ game_id: data.game_id }, updateDoc);
        socket.join(data.game_id);
      }
      if (board.player_2.length > 0 && (socket as any).user !== board.player_2) {
        const updateDoc = {
          $set: {
            player_1: (socket as any).user,
          },
        };
        await collection.findOneAndUpdate({ game_id: data.game_id }, updateDoc);
        socket.join(data.game_id);
      }
    });

    socket.on("disconnect", function () {
      // if (currentCode) {
      //   io.to(currentCode).emit("gameOverDisconnect");
      //   // delete games[currentCode];
      // }
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
