import { dbCollection } from "../database/collection";
import axios from 'axios';
import {ReturnDocument} from "mongodb";
import jwt from "jsonwebtoken";
export type TQuest = {
    wallet_address: string, // ID - Check connect wallet
    discord_info: {
        id: string, // Check connect discord
        user_name: string,
        avatar: string,
        email: string,
        is_have_require_role: boolean // Check join discord server and get role
    }
};
export const airdropController = {
    connectWallet: async (req, res) => {
        const { address } = req.body;
        const query = { wallet_address: address };
        const { collection } = await dbCollection<TQuest>(process.env.DB_AIRDROP!, process.env.DB_AIRDROP_COLLECTION_QUEST!);

        const quest = await collection.findOne(query);

        // Save new quest if first time connect
        if (!quest) {
            const newQuest: TQuest = {
                wallet_address: address,
                discord_info: {
                    id: null,
                    user_name: null,
                    avatar: null,
                    email: null,
                    is_have_require_role: false
                }
            }

            await collection.insertOne(newQuest);
            return res.json(newQuest);
        }
        return res.json(quest);
    },

    connectDiscord: async (req, res) => {
        const { address, jwtToken } = req.body;
        const tokenClaim = await jwt.verify(jwtToken, process.env.ACCESS_TOKEN_SECRET);
        const accessToken = tokenClaim.discordAccessToken;
        const query = { wallet_address: address };
        const { collection } = await dbCollection<TQuest>(process.env.DB_AIRDROP!, process.env.DB_AIRDROP_COLLECTION_QUEST!);
        const quest = await collection.findOne(query);
        // Not connect wallet yet
        if (!quest) {
            throw new Error("Unauthorized");
        }
        // Already connect discord
        if (quest.discord_info.id) {
            return res.json(quest);
        }

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Encoding': 'application/x-www-form-urlencoded'
        };
        // Fetch discord info
        const discordResponse = await axios.get(`https://discord.com/api/users/@me`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...headers
            }
        });
        // Fetch discord info fail
        if (!discordResponse?.data) {
            throw new Error("Unauthorized");
        }
        const discordInfo = discordResponse.data;

        const updateDoc = {
            $set: {
                wallet_address: address,
                discord_info: {
                    id: discordInfo.id,
                    user_name: discordInfo.username,
                    avatar: discordInfo.avatar,
                    email: discordInfo.email,
                    is_have_require_role: false
                }
            },
        };
        const options = {
            returnDocument: ReturnDocument.AFTER
        };
        const updateQuest = await collection.findOneAndUpdate(query, updateDoc, options);
        return res.json(updateQuest);
    },

    verifyDiscordRole: async (req, res) => {
        const { address, jwtToken } = req.body;
        const tokenClaim = await jwt.verify(jwtToken, process.env.ACCESS_TOKEN_SECRET);
        const accessToken = tokenClaim.discordAccessToken;
        const query = { wallet_address: address };
        const { collection } = await dbCollection<TQuest>(process.env.DB_AIRDROP!, process.env.DB_AIRDROP_COLLECTION_QUEST!);
        const quest = await collection.findOne(query);
        // Not connect wallet yet
        if (!quest) {
            throw new Error("Unauthorized");
        }
        // Not connect discord yet
        if (!quest.discord_info.id) {
            // TODO: handle error response
            throw new Error("Unauthorized");
        }

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Encoding': 'application/x-www-form-urlencoded'
        };
        const discordResponse = await axios.get(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_SERVER_ID}/member`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...headers
            }
        });
        console.log(discordResponse);
        const isUserHaveRole = discordResponse.data.roles.includes(process.env.DISCORD_PAWN_ROLE_ID);

        if (isUserHaveRole) {
            const updateDoc = {
                $set: {
                    'discord_info.is_have_require_role': isUserHaveRole
                },
            };
            const options = {
                returnDocument: ReturnDocument.AFTER
            };
            const updateQuest = await collection.findOneAndUpdate(query, updateDoc, options);
            return res.json(updateQuest);
        }
    },

    discordAuth: async (req, res) => {
        const url = process.env.DISCORD_LOGIN_URL;
        res.redirect(url);
    },

    discordAuthCallback: async (req, res) => {
        if (!req.query.code) throw new Error('Code not provided.');
        const { code } = req.query;

        const params = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.DISCORD_REDIRECT_URI
        });

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Encoding': 'application/x-www-form-urlencoded'
        };

        const authResponse = await axios.post(
            'https://discord.com/api/v10/oauth2/token',
            params,
            {
                headers
            }
        );

        const accessToken = authResponse.data.access_token;
        const jwtToken = jwt.sign({ discordAccessToken: accessToken }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "24h",
        });
        res.cookie('jwtToken', jwtToken);

        res.redirect('http://localhost:3000/transfer');
    },
};
