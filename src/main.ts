import express from "express";
import { client } from "./database";
import routes from "./router";
const app = express();
const port = process.env.PORT || 3001;

import bodyParser from "body-parser";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { dbCollection } from "./database/collection";
import md5 from "md5";
import { Chess, Chess as ChessV2, Square } from "./engine/chess2";
import { TGame, getGasLimit, keyring } from "./router/game";
import { ApiPromise, WsProvider } from "@polkadot/api";
import { ContractPromise } from "@polkadot/api-contract";
import abi from "./abi/movechesscontract.json";
import { WeightV2 } from "@polkadot/types/interfaces/types";
import jsonrpc from "@polkadot/types/interfaces/jsonrpc";
import cors from "cors";

(async function main() {
  app.use(express.json());
  app.use(bodyParser.urlencoded({ extended: false }));

  // app.use(function (req, res, next) {
  //   res.header("Access-Control-Allow-Origin", "*");
  //   res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  //   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  //   next();
  // });

  var allowlist = ["http://localhost:3000", "https://www.client.movechess.com"];
  var corsOptionsDelegate = function (req, callback) {
    var corsOptions;
    if (allowlist.indexOf(req.header("Origin")) !== -1) {
      corsOptions = { origin: true }; // reflect (enable) the requested origin in the CORS response
    } else {
      corsOptions = { origin: false }; // disable CORS for this request
    }
    callback(null, corsOptions); // callback expects two parameters: error and options
  };

  app.get("/ping", cors(corsOptionsDelegate), (req, res) => {
    res.json("pong 2");
  });
  app.use("/", cors(corsOptionsDelegate), routes);

  await client.connect().catch((err) => console.log("7s200:err", err));
  client.on("close", () => {
    client.connect();
  });

  const http = app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });

  const io = new Server({
    cors: {
      origin: ["http://localhost:3000", "https://www.client.movechess.com"],
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

      if ((board as any).isPaymentMatch) {
        if (board.player_1 !== (socket as any).user && (board as any).pays.player1 === 10000000000000) {
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
              if ((output.toJSON() as any).ok.userBPayable === true) {
                const updateboard = {
                  $set: {
                    pays: {
                      player1: 10000000000000,
                      gameIndex: (board as any).pays.gameIndex,
                      player2: 10000000000000,
                    },
                  },
                };
                await collection
                  .findOneAndUpdate({ game_id: board.game_id }, updateboard)
                  .then((data) => {
                    console.log("7s200:data", data);
                  })
                  .catch((err) => {
                    console.log("7s200:err", err);
                  });
              }
            }
          }
        }
      }
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

          // if (isGameOver && (board as any).isPaymentMatch) {
          //   const provider = new WsProvider("wss://ws.test.azero.dev");
          //   const api = new ApiPromise({
          //     provider,
          //     rpc: jsonrpc,
          //     types: {
          //       ContractsPsp34Id: {
          //         _enum: {
          //           U8: "u8",
          //           U16: "u16",
          //           U32: "u32",
          //           U64: "u64",
          //           U128: "u128",
          //           Bytes: "Vec<u8>",
          //         },
          //       },
          //     },
          //   });
          //   api.on("connected", async () => {
          //     api.isReady.then((api) => {
          //       console.log("Smartnet AZERO Connected");
          //     });
          //   });
          //   api.on("ready", async () => {
          //     const contract = new ContractPromise(api, abi, "5CRDBTruY3hLTCQmn7MTnULpL3ALXLMEUWLDa826hyFftKkK");
          //     console.log("Collection Contract is ready");
          //     const PHRASE = "provide toy deposit expect popular mesh undo resist jazz pizza wolf churn";
          //     const newPair = keyring.addFromUri(PHRASE);

          //     const gasLimitResult = await getGasLimit(contract.api, newPair.address, "updateWinner", contract, {}, [(board as any).pays.gameIndex, chess.turn() === "w" ? 0 : 1]);
          //     const { value: gasLimit } = gasLimitResult;
          //     console.log("7s200:gas", gasLimit);

          //     // @ts-ignore
          //     const tx = await contract.tx.updateWinner({ gasLimit: gasLimit, storageDepositLimit: null }, (board as any).pays.gameIndex, chess.turn() === "w" ? 0 : 1);
          //     const signtx = await tx
          //       .signAndSend(newPair, (result) => {
          //         if (result.status.isInBlock) {
          //           console.log("in a block");
          //         } else if (result.status.isFinalized) {
          //           console.log("finalized");
          //         }
          //       })
          //       .catch((e) => console.log("e", e));
          //     console.log("7s200:chess.tur", isGameOver, (board as any).isPaymentMatch);
          //   });

          //   api.on("error", (err) => {
          //     console.log("error", err);
          //   });
          // }

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
