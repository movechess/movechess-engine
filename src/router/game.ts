import bcrypt from "bcrypt";
import Chess from "../engine/chess";
import { dbCollection } from "../database/collection";
import { Chess as ChessV2 } from "../engine/chess2";
import md5 from "md5";
import BN from "bn.js";
import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { Abi, ContractPromise } from "@polkadot/api-contract";
import jsonrpc from "@polkadot/types/interfaces/jsonrpc";
import { numberToU8a, stringToHex } from "@polkadot/util";
import abi from "../abi/movechesscontract.json";
import { WeightV2 } from "@polkadot/types/interfaces";
import { BN_ONE, hexToU8a, isHex, u8aToHex } from "@polkadot/util";
import { web3Accounts, web3Enable, web3FromSource } from "@polkadot/extension-dapp";
import { ApiBase } from "@polkadot/api/base";
import { convertWeight } from "@polkadot/api-contract/base/util";

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
    const { isPaymentMatch } = req.body.params;

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
      isPaymentMatch: isPaymentMatch,
      payAmount: 10_000_000_000_000,
      pays: {
        player1: 0,
        player2: 0,
      },
    };

    const { collection } = await dbCollection<TGame>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_GAMES!);
    const insert = await collection.insertOne(board);

    res.json({ status: 200, board });
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
    const api = new ApiPromise({
      provider,
      rpc: jsonrpc,
      types: {
        ContractsPsp34Id: {
          _enum: {
            U8: "u8",
            U16: "u16",
            U32: "u32",
            U64: "u64",
            U128: "u128",
            Bytes: "Vec<u8>",
          },
        },
      },
    });
    api.on("connected", async () => {
      api.isReady.then((api) => {
        console.log("Smartnet AZERO Connected");
      });
    });
    api.on("ready", async () => {
      const contract = new ContractPromise(api, abi, "5CRDBTruY3hLTCQmn7MTnULpL3ALXLMEUWLDa826hyFftKkK");
      console.log("Collection Contract is ready");
      const PHRASE = "provide toy deposit expect popular mesh undo resist jazz pizza wolf churn";
      const newPair = keyring.addFromUri(PHRASE);

      const gasLimitResult = await getGasLimit(contract.api, newPair.address, "updateWinner", contract, {}, [2, 1]);
      const { value: gasLimit } = gasLimitResult;
      console.log("7s200:gas", gasLimit);

      // const gasLimit = 100000n * 1000000n;
      const gasLimit2 = api.registry.createType("WeightV2", api.consts.system.blockWeights["maxBlock"]) as WeightV2;
      // const gasLimit3 = readOnlyGasLimit(api);

      const { result, output } = await contract.query.getCounter(newPair.address, { gasLimit: gasLimit2, value: 0 });
      if (result.isOk && output) {
        console.log("7s200", output.toHuman());
      }

      // const transfer = api.tx.balances.transferAllowDeath("5D4s8PFzAtY7sdnCCuC6n7nHCio19dPmwC6ytkQrWUZjCaXN", 10000000000000);
      // const hash = await transfer.signAndSend(newPair);

      // const txh = await api.tx.contracts.call("5CRDBTruY3hLTCQmn7MTnULpL3ALXLMEUWLDa826hyFftKkK", 0, gasLimit, abi.);

      // const tx = await contract.tx.matchGame({ gasLimit: gasLimit, storageDepositLimit: null, value: 10000000000000 }, 4);

      // const signTx = await tx.signAndSend(newPair, (result) => {
      //   if (result.status.isInBlock) {
      //     console.log("in a block");
      //   } else if (result.status.isFinalized) {
      //     console.log("finalized");
      //   }
      // });

      // @ts-ignore
      const tx = await contract.tx.updateWinner({ gasLimit: gasLimit, storageDepositLimit: null }, 2, 1);
      const signtx = await tx
        .signAndSend(newPair, (result) => {
          if (result.status.isInBlock) {
            console.log("in a block");
          } else if (result.status.isFinalized) {
            console.log("finalized");
          }
        })
        .catch((e) => console.log("e", e));
    });

    api.on("error", (err) => {
      console.log("error", err);
    });

    // const provider = new WsProvider("wss://ws.test.azero.dev");
    // const api = await ApiPromise.create({
    //   provider: provider,
    // });

    // const contract = new ContractPromise(api, abi, "5CRDBTruY3hLTCQmn7MTnULpL3ALXLMEUWLDa826hyFftKkK");

    // const gasLimit = 30000n * 1000000n;
    // // const gasLimit = readOnlyGasLimit(globalApi);
    // // const gasLimit2 = api.registry.createType("WeightV2", api.consts.system.blockWeights["maxBlock"]) as WeightV2;
    // // console.log("7s200:gas", gasLimit);
    // // console.log("7s200:gas2", gasLimit2.toHuman());
    // const chain = await api.rpc.system.chain();
    // console.log("7s200:chain", chain);
    // const storageDepositLimit = null;
    // const PHRASE = "provide toy deposit expect popular mesh undo resist jazz pizza wolf churn";
    // const newPair = keyring.addFromUri(PHRASE);

    // const gameIndex = 2;

    // // const { result, output } = await contract.query.getGameInfo(
    // //   newPair.address,
    // //   {
    // //     gasLimit: gasLimit2,
    // //     storageDepositLimit,
    // //   },
    // //   gameIndex
    // // );
    // // if (result.isOk) {
    // //   res.json(output.toHuman());
    // //   const txn = await contract.tx.updateWinner({ gasLimit: gasLimit, storageDepositLimit: storageDepositLimit }, gameIndex, 1).signAndSend(newPair, (result) => {
    // //     console.log("7s200:winner", result.isError, result.isCompleted);
    // //   });
    // //   res.json(txn);
    // //   return;
    // // }
    // // res.json(null);
    // const txn = await contract.tx.updateWinner({ gasLimit, storageDepositLimit: storageDepositLimit }, gameIndex, 1).signAndSend(newPair, (result) => {
    //   console.log("7s200:winner", result.isError, result.isCompleted);
    // });
    // res.json(txn);
  },
};

export function readOnlyGasLimit(api: ApiPromise): WeightV2 {
  return api.registry.createType("WeightV2", {
    refTime: new BN(1_000_000_000_000),
    proofSize: MAX_CALL_WEIGHT,
  });
}

const MAX_CALL_WEIGHT = new BN(5_000_000_000_000).isub(BN_ONE);

export async function getGasLimit(
  api: ApiBase<any>,
  userAddress: string,
  message: string,
  contract: ContractPromise,
  options = {},
  args: any[] = []
  // temporarily type is Weight instead of WeightV2 until polkadot-js type `ContractExecResult` will be changed to WeightV2
) {
  const abiMessage = toContractAbiMessage(contract, message);
  if (!abiMessage.ok) return abiMessage;
  // @ts-ignore
  const { value, gasLimit, storageDepositLimit } = options;
  const result = await api.call.contractsApi.call(userAddress, contract.address, value ?? new BN(0), gasLimit ?? null, storageDepositLimit ?? null, abiMessage?.value?.toU8a(args));
  // @ts-ignore
  const { v2Weight } = convertWeight(result?.gasRequired);
  const gasRequired = api.registry.createType("WeightV2", {
    refTime: v2Weight.refTime.add(new BN(25_000_000_000)),
    proofSize: v2Weight.proofSize,
  });
  return { ok: true, value: gasRequired };
}

const toContractAbiMessage = (contractPromise: ContractPromise, message: string) => {
  const value = contractPromise.abi.messages.find((m) => m.method === message);

  if (!value) {
    const messages = contractPromise?.abi.messages.map((m) => m.method).join(", ");

    const error = `"${message}" not found in metadata.spec.messages: [${messages}]`;
    console.error(error);

    return { ok: false, error };
  }

  return { ok: true, value };
};
