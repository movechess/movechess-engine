import { dbCollection } from "../database/collection";
import jwt from "jsonwebtoken";
export const userController = {
  createUser: async (req, res) => {
    const { address, password } = req.body;
    const query = { address };
    // const { collection } = await dbCollection<any>(process.env.DB_MOVECHESS!, process.env.DB_MOVECHESS_COLLECTION_USERS!);
    // const user = await collection.findOne(query);

    // if (user) {
    //   const queryPassword = { address, password };
    //   const temp = await collection.findOne(queryPassword);
    //   if (temp) {
    //     const accessToken = jwt.sign(temp, process.env.ACCESS_TOKEN_SECRET, {
    //       expiresIn: "24h",
    //     });
    //     res.json({ status: 200, message: "LOGIN_SUCCESS", data: accessToken });
    //     return;
    //   }
    //   res.json({ status: 405, message: "ERROR_PASSWORD" });
    //   return;
    // }

    // const insertUser = await collection.insertOne({ address, password });
    // const accessToken = jwt.sign(insertUser, process.env.ACCESS_TOKEN_SECRET, {
    //   expiresIn: "24h",
    // });

    res.json({ status: 200, message: "REGISTER_SUCCESS", data: "accessToken" });
  },
  getUser: async (req, res) => {
    if (req.userData) {
      res.json({ status: 200, message: "GET_USER_DATA_SUCCESS", data: { address: req.userData.address } });
      return;
    }
    res.json({ status: 404, message: "GET_USER_DATA_FAILD" });
  },
};
