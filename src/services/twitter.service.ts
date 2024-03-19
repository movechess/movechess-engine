import axios from 'axios';
import { Client, auth } from "twitter-api-sdk";

const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept-Encoding': 'application/x-www-form-urlencoded'
};

export class TwitterService {
    private readonly twitterClient: Client;
    private readonly authClient: auth.OAuth2User;
    constructor() {
        this.authClient = new auth.OAuth2User({
            client_id: process.env.TWITTER_CLIENT_ID as string,
            client_secret: process.env.TWITTER_CLIENT_SECRET as string,
            callback: process.env.TWITTER_REDIRECT_URI,
            scopes: ["tweet.read", "users.read", "follows.read", "follows.write", "offline.access"],
        });
        this.twitterClient = new Client(this.authClient);
    }
    getTwitterClient() {
        return this.twitterClient;
    }
    getAuthClient() {
        return this.authClient;
    }
    async getToken(code: string) {
        const params = new URLSearchParams({
            client_id: process.env.TWITTER_CLIENT_ID,
            code_verifier: 'challenge',
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.TWITTER_REDIRECT_URI
        });

        return await axios.post(
            'https://api.twitter.com/2/oauth2/token',
            params,
            {
                headers
            }
        );
    }

    async getMe(accessToken: string) {
        return await axios.get('https://api.twitter.com/2/users/me', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...headers
            }
        });
    }
}