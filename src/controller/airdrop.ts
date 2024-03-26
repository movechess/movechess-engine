import jwt from "jsonwebtoken";
import {TQuest} from "../models/quest.model";
import {DbService} from "../services/db.service";
import {DiscordService} from "../services/discord.service";
import {TwitterService} from "../services/twitter.service";

const questService = new DbService(process.env.DB_AIRDROP!, process.env.DB_AIRDROP_COLLECTION_QUEST!);
const discordService = new DiscordService();
const twitterService = new TwitterService();
const convertResponse = (quest: TQuest) => {
    return {
        isConnectWallet: !!quest.wallet_address,
        isConnectDiscord: quest.discord_info.user_name,
        isHaveDiscordRole: quest.discord_info.is_have_require_role,
        isConnectTwitter: quest.twitter_info.user_name,
        isFollowTwitter: quest.twitter_info.is_follower,
        isTweet: !!quest.twitter_info.tweet_id,
    }
}
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
                },
                twitter_info: {
                    id: null,
                    user_name: null,
                    is_follower: false,
                    tweet_id: null
                }
            }

            await questService.insertOne(newQuest);
            return res.json(convertResponse(newQuest));
        }
        return res.json(convertResponse(quest));
    },

    discordAuth: async (req, res) => {
        const url = process.env.DISCORD_LOGIN_URL;
        res.redirect(url);
    },

    discordAuthCallback: async (req, res) => {
        if (!req.query.code) throw new Error('Code not provided.');
        const { code } = req.query;

        const authResponse = await discordService.getToken(code);
        if (authResponse) {
            const accessToken = authResponse.data.access_token;
            const jwtToken = jwt.sign({ discordAccessToken: accessToken }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "24h",
            });
            res.cookie('discordJwt', jwtToken);
        }

        res.redirect(process.env.AIRDROP_PAGE_URL);
    },

    connectDiscord: async (req, res) => {
        const { address, discordJwt } = req.body;
        const tokenClaim = await jwt.verify(discordJwt, process.env.ACCESS_TOKEN_SECRET);
        const accessToken = tokenClaim.discordAccessToken;
        const query = { wallet_address: address };
        let quest = await questService.findOne(query);

        // Not connect wallet yet
        if (!quest) {
            throw new Error("Unauthorized");
        }
        // Already connect discord
        if (quest.discord_info.id) {
            return res.json(convertResponse(quest));
        }

        // Fetch discord info
        const discordResponse = await discordService.getMe(accessToken);

        if (discordResponse) {
            const discordInfo = discordResponse.data;

            // Check is discord account already connect with another wallet
            quest = await questService.findOne({ 'discord_info.id': discordInfo.id });
            if (quest) {
                throw new Error("Already connect with another wallet");
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
            return res.json(convertResponse(updateQuest));
        }
        return res.json(convertResponse(quest));
    },

    inviteDiscord: async (req, res) => {
        const url = process.env.DISCORD_INVITE_URL;
        res.redirect(url);
    },

    verifyDiscordRole: async (req, res) => {
        const { address, discordJwt } = req.body;
        const tokenClaim = await jwt.verify(discordJwt, process.env.ACCESS_TOKEN_SECRET);
        const accessToken = tokenClaim.discordAccessToken;
        const query = { wallet_address: address };
        const quest = await questService.findOne(query);
        // Not connect wallet yet
        if (!quest) {
            throw new Error("Unauthorized");
        }
        // Not connect discord yet
        if (!quest.discord_info.id) {
            return res.json(convertResponse(quest));
        }

        const discordResponse = await discordService.getGuildMemberInfo(accessToken);
        if (discordResponse) {
            const isUserHaveRole = discordResponse.data.roles.includes(process.env.DISCORD_PAWN_ROLE_ID);

            const updateDoc = {
                $set: {
                    'discord_info.is_have_require_role': isUserHaveRole
                },
            };

            const updateQuest = await questService.findOneAndUpdate(query, updateDoc);
            return res.json(convertResponse(updateQuest));
        }
        return res.json(convertResponse(quest));
    },

    twitterAuth: async (req, res) => {
        const url = process.env.TWITTER_LOGIN_URL;
        res.redirect(url);
    },

    twitterCallBack: async (req, res) => {
        if (!req.query.code) throw new Error('Code not provided.');
        const { code } = req.query;
        const twitterResponse = await twitterService.getToken(code);
        console.log(twitterResponse);
        if (twitterResponse) {
            const accessToken = twitterResponse.data.access_token;
            const jwtToken = jwt.sign({ twitterAccessToken: accessToken }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "24h",
            });
            res.cookie('twitterJwt', jwtToken);
            console.log(jwtToken);
        }

        res.redirect(process.env.AIRDROP_PAGE_URL);
    },

    connectTwitter: async (req, res) => {
        const { address, twitterJwt } = req.body;
        const tokenClaim = await jwt.verify(twitterJwt, process.env.ACCESS_TOKEN_SECRET);
        const accessToken = tokenClaim.twitterAccessToken;
        const query = { wallet_address: address };
        let quest = await questService.findOne(query);

        // Not connect wallet yet
        if (!quest) {
            throw new Error("Unauthorized");
        }
        // Already connect twitter
        if (quest.twitter_info.id) {
            return res.json(convertResponse(quest));
        }

        // Fetch discord info
        const twitterResponse = await twitterService.getMe(accessToken);
        if (twitterResponse) {
            const twitterInfo = twitterResponse.data.data;

            // Check is discord account already connect with another wallet
            quest = await questService.findOne({ 'twitter_info.id': twitterInfo.id });
            if (quest) {
                throw new Error("Already connect with another wallet");
            }

            const updateDoc = {
                $set: {
                    wallet_address: address,
                    twitter_info: {
                        id: twitterInfo.id,
                        user_name: twitterInfo.username,
                        is_follower: false,
                        tweet_id: null
                    }
                },
            };
            const updateQuest = await questService.findOneAndUpdate(query, updateDoc);
            return res.json(convertResponse(updateQuest));
        }
        return res.json(convertResponse(quest));
    },

    followTwitter: async (req, res) => {
        const { address } = req.body;
        const query = { wallet_address: address };
        const updateDoc = {
            $set: {
                'twitter_info.is_follower': true
            },
        };
        const updateQuest = await questService.findOneAndUpdate(query, updateDoc);
        return res.json(convertResponse(updateQuest));
    },

    tweetTwitter: async (req, res) => {
        const { address, tweetId } = req.body;
        const query = { wallet_address: address };
        const updateDoc = {
            $set: {
                'twitter_info.tweet_id': tweetId
            },
        };
        const updateQuest = await questService.findOneAndUpdate(query, updateDoc);
        return res.json(convertResponse(updateQuest));
    }
};
