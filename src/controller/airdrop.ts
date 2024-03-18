import {dbCollection} from "../database/collection";
import axios from 'axios';
import {ReturnDocument} from "mongodb";
import jwt from "jsonwebtoken";
import {TQuest} from "../model/Quest";
import {DbService} from "../service/DbService";

const questService = new DbService(process.env.DB_AIRDROP!, process.env.DB_AIRDROP_COLLECTION_QUEST!);
export const airdropController = {
    connectWallet: async (req, res) => {
        const { address } = req.body;
        const quest = await questService.findOne({ wallet_address: address });

        // Create new quest if first time connect wallet
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

            await questService.insertOne(newQuest);
            return res.json(newQuest);
        }
        return res.json(quest);
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

    connectDiscord: async (req, res) => {
        const { address, jwtToken } = req.body;
        const tokenClaim = await jwt.verify(jwtToken, process.env.ACCESS_TOKEN_SECRET);
        const accessToken = tokenClaim.discordAccessToken;
        const query = { wallet_address: address };
        let quest = await questService.findOne(query);

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

        // Check is discord account already connect with another wallet
        quest = await questService.findOne({ 'discord_info.id': discordInfo.id });
        if (quest) {
            throw new Error("Discord account already connect with another" +
                " wallet");
        }

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
        const updateQuest = await questService.findOneAndUpdate(query, updateDoc);
        return res.json(updateQuest);
    },

    inviteDiscord: async (req, res) => {
        const url = process.env.DISCORD_INVITE_URL;
        res.redirect(url);
    },

    verifyDiscordRole: async (req, res) => {
        const { address, jwtToken } = req.body;
        const tokenClaim = await jwt.verify(jwtToken, process.env.ACCESS_TOKEN_SECRET);
        const accessToken = tokenClaim.discordAccessToken;
        const query = { wallet_address: address };
        const quest = await questService.findOne(query);
        // Not connect wallet yet
        if (!quest) {
            throw new Error("Unauthorized");
        }
        // Not connect discord yet
        if (!quest.discord_info.id) {
            return res.json(quest);
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
        const isUserHaveRole = discordResponse.data.roles.includes(process.env.DISCORD_PAWN_ROLE_ID);

        if (isUserHaveRole) {
            const updateDoc = {
                $set: {
                    'discord_info.is_have_require_role': isUserHaveRole
                },
            };

            const updateQuest = await questService.findOneAndUpdate(query, updateDoc);
            return res.json(updateQuest);
        }
        return res.json(quest);
    },

    twitterAuth: async (req, res) => {
        const url = process.env.TWITTER_LOGIN_URL;
        res.redirect(url);
    },

    twitterCallBack: async (req, res) => {
        if (!req.query.code) throw new Error('Code not provided.');
        const { code } = req.query;
        console.log(code);

        const params = new URLSearchParams({
            client_id: process.env.TWITTER_CLIENT_ID,
            code_verifier: 'challenge',
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.TWITTER_REDIRECT_URI
        });

        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept-Encoding': 'application/x-www-form-urlencoded'
        };

        const authResponse = await axios.post(
            'https://api.twitter.com/2/oauth2/token',
            params,
            {
                headers
            }
        );
        console.log(authResponse);

        const accessToken = authResponse.data.access_token;
        const jwtToken = jwt.sign({ discordAccessToken: accessToken }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: "24h",
        });
        res.cookie('jwtToken', jwtToken);

        res.redirect('http://localhost:3000?code=' + code);
    },
};
