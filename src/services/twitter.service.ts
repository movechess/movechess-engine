import axios from 'axios';

const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept-Encoding': 'application/x-www-form-urlencoded'
};

export class TwitterService {
    async getToken(code: string, address:string) {
        const params = new URLSearchParams({
            client_id: process.env.TWITTER_CLIENT_ID,
            code_verifier: 'challenge',
            grant_type: 'authorization_code',
            code,
            redirect_uri: `${process.env.TWITTER_REDIRECT_URI}?address=${address}`
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