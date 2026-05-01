export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const GOOGLE_LOGIN_URL = "/api/auth/google";
export const FACEBOOK_LOGIN_URL = "/api/auth/facebook";
export const LOGOUT_URL = "/api/auth/logout";
export const AUTH_ME_URL = "/api/auth/me";

// Keep this so old code using getLoginUrl() will not break.
// It now sends users to normal Google OAuth instead of Manus.
export const getLoginUrl = () => GOOGLE_LOGIN_URL;