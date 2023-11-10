import express from "express";
import { client } from "./database";
import routes from "./router";
const app = express();
const port = 3001;
import bodyParser from "body-parser";

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

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
})();
