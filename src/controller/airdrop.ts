import { dbCollection } from "../database/collection";
import axios from 'axios';
import {random} from "lodash";
export type TQuest = {
    wallet_address: string,
    discord_id: string,
    discord_roles: any
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
                discord_id: null,
                discord_roles: null
            }

            await collection.insertOne(newQuest);
            return res.json(newQuest);
        }

        return res.json(quest);
    },

    connectDiscord: async (req, res) => {
        const { address, discordId } = req.params;
        const query = { wallet_address: address };
        const { collection } = await dbCollection<TQuest>(process.env.DB_AIRDROP!, process.env.DB_AIRDROP_COLLECTION_QUEST!);
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

        const userResponse = await axios.get(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_SERVER_ID}/member`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...headers
            }
        });
        const isUserHaveRole = userResponse.data.roles.includes(process.env.DISCORD_PAWN_ROLE_ID);
        // TODO: Save db
        console.log(isUserHaveRole);
        res.redirect("http://localhost:3000")
    },
};
