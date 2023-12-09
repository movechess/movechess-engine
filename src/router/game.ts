import bcrypt from "bcrypt";
import Chess from "../engine/chess";
import { dbCollection } from "../database/collection";
import { Chess as ChessV2 } from "../engine/chess2";
import md5 from "md5";
import BN from "bn.js";
import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { ContractPromise } from "@polkadot/api-contract";
import jsonrpc from "@polkadot/types/interfaces/jsonrpc";
import { numberToU8a, stringToHex } from "@polkadot/util";
import abi from "../abi/movechesscontract.json";
import { WeightV2 } from "@polkadot/types/interfaces";

export type TGame = {
  game_id: string;
  player_1: string;
  player_2: string;
  board: any;
  score: any;
  turn_player: string;
  move_number: number;
  fen: string;
};

const keyring = new Keyring({ type: "sr25519" });
const DEFAULT_0X0_ADDRESS = "5HrN7fHLXWcFiXPwwtq2EkSGns9eMt5P7SpeTPewumZy6ftb";

export const gameController = {
  newGame: async (req, res) => {
    console.log("7s:new-game:body", req.params);
    const { game_id } = req.params;
    let id = null;
    if (!game_id) {
      id = await bcrypt.hash(new Date().getTime().toString(), 8);
    }
    const chess = new Chess();

    const board = {
      game_id: id,
      player_1: "",
      player_2: "",
      board: chess.getBoard(),
      score: chess.initialScore(),
      turn_player: "",
      move_number: 0,
      fen: "",
    };

    const { collection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
    console.log("7s200:new-game:name", collection.dbName, collection.collectionName);

    const insert = await collection.insertOne(board);
    console.log("7s200:new-game:insert", insert);

    return res.json({ board });
  },

  loadGame: async (req, res) => {},

  legalMoves: async (req, res) => {
    const { position, gameId } = req.params;
    const query = { game_id: gameId };

    const { collection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
    const board = await collection.findOne(query);

    const chess = new Chess(board.board);

    const square = chess.getBoard()[position];

    if (!square) {
      return res.status(400).json({ error: "Invalid position!" });
    }
    return res.json(chess.getLegalMoves(square.color, square.piece, position));
  },

  makeMove: async (req, res) => {
    const { game_id } = req.body;
    const { from, to } = req.params;

    const query = { game_id: game_id };

    const { collection: gameCollection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
    const game = await gameCollection.findOne(query);

    const chess = new Chess(game.board);

    const squareFrom = game.board[from];
    const squareTo = game.board[to];
    // console.log("7s200:square", from, squareFrom, to, squareTo);

    if (squareFrom && squareTo) {
      const moved = chess.move(squareFrom.color, from, to);
      if (moved) {
        const { move_number, turn_player, score } = game;

        if (moved === "x") {
          score[squareFrom.color][squareTo.piece] += 1;
        }

        const newBoard = {
          game_id: game_id,
          move_number: move_number + 1,
          turn_player: turn_player && turn_player === "W" ? "B" : "W",
          score: score,
          board: chess.getBoard(),
        };

        const updateDoc = {
          $set: {
            move_number: newBoard.move_number,
            turn_player: newBoard.turn_player,
            score: newBoard.score,
            board: newBoard.board,
          },
        };
        const updateGame = await gameCollection.updateOne(query, updateDoc);
        console.log("7s200:move:updateDocs", updateGame);

        const move = {
          game_id: game_id,
          player: newBoard.turn_player,
          flag: moved,
          move_number: newBoard.move_number,
          from,
          to,
          piece: squareFrom.piece,
        };

        const { collection: moveCollection } = await dbCollection<any>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_MOVES!);
        const insert = await moveCollection.insertOne(move);
        console.log("7s200:move:insert", insert);

        return res.json({ board: newBoard, move });
      }
      return res.status(400).json({ error: "Invalid move!" });
    }
    return res.status(400).json({ error: "Invalid position" });

    // const chess = new Chess(req.board);
  },
  // V1

  // V2 chess2.ts
  // create game
  newGameV2: async (req, res) => {
    const time = Date.now();
    const id = md5(time);

    const chess = new ChessV2();

    const board = {
      game_id: id,
      player_1: "",
      player_2: "",
      board: chess.board(),
      score: 0,
      turn_player: chess.turn(),
      move_number: chess.moveNumber(),
      fen: chess.fen(),
    };

    const { collection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
    const insert = await collection.insertOne(board);
    console.log("7s200:new-game:insert", insert);

    res.json({ board });
  },

  loadGameV2: async (req, res) => {
    const { game_id } = req.query;
    console.log("7s200:game", game_id);
    const query = { game_id: game_id };

    const { collection: gameCollection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
    const game = await gameCollection.findOne(query);

    res.json({ game });
  },

  getGamesV2: async (req, res) => {
    const { collection: gameCollection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
    const games = await gameCollection.find().toArray();
    res.json({ status: 200, games });
  },

  makeMoveV2: async (req, res) => {},

  updateWinnerV2: async (req, res) => {
    const { winner } = req.body;

    const provider = new WsProvider("wss://ws.test.azero.dev");
    const api = await ApiPromise.create({
      provider: provider,
    });

    const gasLimit = 30000n * 1000000n;
    const gasLimit2 = api.registry.createType("WeightV2", api.consts.system.blockWeights["maxBlock"]) as WeightV2;
    console.log("7s200:gas", gasLimit);
    console.log("7s200:gas2", gasLimit2.toHuman());
    const storageDepositLimit = null;
    const contract = new ContractPromise(api, abi, "5CRDBTruY3hLTCQmn7MTnULpL3ALXLMEUWLDa826hyFftKkK");
    const PHRASE = "provide toy deposit expect popular mesh undo resist jazz pizza wolf churn";
    const newPair = keyring.addFromUri(PHRASE);

    const gameIndex = 1;

    const { result, output } = await contract.query.getGameInfo(
      newPair.address,
      {
        gasLimit: gasLimit2,
        storageDepositLimit,
      },
      gameIndex
    );
    if (result.isOk) {
      res.json(output.toHuman());
      const txn = await contract.tx.updateWinner({ gasLimit: gasLimit, storageDepositLimit: storageDepositLimit }, { u32: gameIndex }, { u32: 1 }).signAndSend(newPair, (result) => {
        console.log("7s200:winner", result.isError, result.isCompleted);
      });
      res.json(txn);
      return;
    }
    res.json(null);
  },
};
