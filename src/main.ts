import express from "express";
import { client } from "./database";
import routes from "./router";
const app = express();
const port = 3000;

(async function main() {
  app.use(express.json());
  app.use("/", routes);

  await client.connect().catch((err) => console.log("7s200:err", err));
  client.on("close", () => {
    client.connect();
  });

  app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
  });
})();
