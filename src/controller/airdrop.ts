import { dbCollection } from "../database/collection";
import axios from 'axios';
import {ReturnDocument} from "mongodb";
export type TQuest = {
    wallet_address: string,
    discord_info: {
        id: string,
        user_name: string,
        avatar: string,
        email: string,
        is_have_require_role: boolean
    }
};
export const airdropController = {
    getAirdropProgress: async (req, res) => {
        const { address } = req.params;
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
        // TODO: Generate jwt containt address and save cookie
        return res.json(quest);
    },

    connectDiscord: async (req, res) => {
        const { address } = req.body;
        console.log('Cookie header: ' + req.headers.cookie);
        console.log('Cookie: ' + req.headers.cookie.discordAccessToken);
        if (!req.cookie || req.cookie.discordAccessToken) {
            return res.json({message: "Unauthorized"});
        }
        const accessToken = req.cookie.discordAccessToken;

        const query = { wallet_address: address };
        const { collection } = await dbCollection<TQuest>(process.env.DB_AIRDROP!, process.env.DB_AIRDROP_COLLECTION_QUEST!);
        const quest = await collection.findOne(query);
        if (!quest) {
            throw new Error("Unauthorized");
        }
        if (quest.discord_info.id) {
            throw new Error("Already connect discord");
        }

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Encoding': 'application/x-www-form-urlencoded'
        };

        const userResponse = await axios.get(`https://discord.com/api/users/@me`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...headers
            }
        });
        if (userResponse) {
            console.log(userResponse);
        }

        const updateDoc = {
            $set: {
                wallet_address: address,
                discord_info: {
                    id: null,
                    user_name: null,
                    avatar: null,
                    email: null,
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
        // TODO: get discord access token -> discordAuth
        // If not have access token ->
        const accessToken = "access";
        const { address } = req.body;
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Encoding': 'application/x-www-form-urlencoded'
        };
        const userResponse = await axios.get(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_SERVER_ID}/member`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...headers
            }
        });
        const isUserHaveRole = userResponse.data.roles.includes(process.env.DISCORD_PAWN_ROLE_ID);

        if (isUserHaveRole) {
            const query = { wallet_address: address };
            const { collection } = await dbCollection<TQuest>(process.env.DB_AIRDROP!, process.env.DB_AIRDROP_COLLECTION_QUEST!);
            const updateDoc = {
                $set: {
                    wallet_address: address,
                    discord_info: {
                        id: null,
                        user_name: null,
                        avatar: null,
                        email: null,
                        is_have_require_role: isUserHaveRole
                    }
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
        res.cookie('discordAccessToken', accessToken);

        res.redirect(process.env.AIRDROP_PAGE_URL);
    },
};
