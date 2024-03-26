export type TQuest = {
    wallet_address: string, // ID - Check connect wallet
    discord_info: {
        id: string, // Check connect discord
        user_name: string,
        avatar: string,
        email: string,
        is_have_require_role: boolean // Check join discord server and get role
    },
    twitter_info : {
        id: string, // Check connect twitter
        user_name: string,
        is_follower: boolean,
        tweet_id: string,
    }
};