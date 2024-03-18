import axios from 'axios';

const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept-Encoding': 'application/x-www-form-urlencoded'
};
export class DiscordService {

    async getToken(code: string) {
        const params = new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID,
            client_secret: process.env.DISCORD_CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: process.env.DISCORD_REDIRECT_URI
        });
        return await axios.post(
            'https://discord.com/api/v10/oauth2/token',
            params,
            {
                headers
            }
        );
    }

    async getMe(accessToken: string) {
        return await axios.get(`https://discord.com/api/users/@me`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...headers
            }
        });
    }

    async getGuildMemberInfo(accessToken: string) {
        return await axios.get(`https://discord.com/api/users/@me/guilds/${process.env.DISCORD_SERVER_ID}/member`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                ...headers
            }
        });
    }
}