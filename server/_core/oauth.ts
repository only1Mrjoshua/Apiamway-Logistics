import type { Express, Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import * as db from "../db";

type LoginMethod = "google" | "facebook";

type OAuthUser = {
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: LoginMethod;
};

declare module "express-session" {
  interface SessionData {
    userOpenId?: string;
  }
}

let passportConfigured = false;

async function getRedirectPath(req: Request, user: any) {
  // 🔴 FIRST: role-based redirects (highest priority)

  if (user?.role === "admin") {
    return "/admin";
  }

  if (user?.role === "fleet_owner") {
    return "/fleet-owner/dashboard";
  }

  // 🟡 EXISTING LOGIC (keep this)

  const signupIntent = req.cookies?.signup_intent;

  if (signupIntent === "fleet_owner") {
    return "/fleet-owner/onboarding";
  }

  if (signupIntent === "shipper") {
    return "/request-delivery";
  }

  if (!user?.accountTypeIntent) {
    return "/choose-account-type";
  }

  if (user.accountTypeIntent === "fleet_owner") {
    const application = await db.getPartnerByUserId(user.id);

    if (application?.status === "approved") {
      return "/fleet-owner/dashboard";
    }

    if (application) {
      return "/fleet-owner/status";
    }

    return "/fleet-owner/onboarding";
  }

  return "/";
}

function configurePassport() {
  if (passportConfigured) return;
  passportConfigured = true;

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:3000/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const oauthUser: OAuthUser = {
            openId: `google:${profile.id}`,
            name: profile.displayName || null,
            email: profile.emails?.[0]?.value || null,
            loginMethod: "google",
          };

          await db.upsertUser({
            openId: oauthUser.openId,
            name: oauthUser.name,
            email: oauthUser.email,
            loginMethod: oauthUser.loginMethod,
            lastSignedIn: new Date(),
          });

          const user = await db.getUserByOpenId(oauthUser.openId);

          if (!user) {
            return done(new Error("User could not be loaded after Google login"));
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );

  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID || "",
        clientSecret: process.env.FACEBOOK_APP_SECRET || "",
        callbackURL:
          process.env.FACEBOOK_CALLBACK_URL ||
          "http://localhost:3000/api/auth/facebook/callback",
        profileFields: ["id", "displayName", "emails"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const oauthUser: OAuthUser = {
            openId: `facebook:${profile.id}`,
            name: profile.displayName || null,
            email: profile.emails?.[0]?.value || null,
            loginMethod: "facebook",
          };

          await db.upsertUser({
            openId: oauthUser.openId,
            name: oauthUser.name,
            email: oauthUser.email,
            loginMethod: oauthUser.loginMethod,
            lastSignedIn: new Date(),
          });

          const user = await db.getUserByOpenId(oauthUser.openId);

          if (!user) {
            return done(new Error("User could not be loaded after Facebook login"));
          }

          return done(null, user);
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
}

function requireSession(req: Request, res: Response, next: NextFunction) {
  if (!req.session) {
    res.status(500).json({
      error: "Session middleware is not active.",
    });
    return;
  }

  next();
}

export function registerOAuthRoutes(app: Express) {
  configurePassport();

  app.get(
    "/api/auth/google",
    requireSession,
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
      session: false,
    })
  );

  app.get(
    "/api/auth/google/callback",
    requireSession,
    passport.authenticate("google", {
      failureRedirect: "/login",
      session: false,
    }),
    async (req: Request, res: Response) => {
      const user = req.user as any;

      req.session.userOpenId = user.openId;

      req.session.save(async () => {
        const redirectPath = await getRedirectPath(req, user);
        res.clearCookie("signup_intent");
        res.redirect(302, redirectPath);
      });
    }
  );

  app.get(
    "/api/auth/facebook",
    requireSession,
    passport.authenticate("facebook", {
      scope: ["email"],
      session: false,
    })
  );

  app.get(
    "/api/auth/facebook/callback",
    requireSession,
    passport.authenticate("facebook", {
      failureRedirect: "/login",
      session: false,
    }),
    async (req: Request, res: Response) => {
      const user = req.user as any;

      req.session.userOpenId = user.openId;

      req.session.save(async () => {
        const redirectPath = await getRedirectPath(req, user);
        res.clearCookie("signup_intent");
        res.redirect(302, redirectPath);
      });
    }
  );

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    const openId = req.session?.userOpenId;

    if (!openId) {
      res.json({ user: null });
      return;
    }

    const user = await db.getUserByOpenId(openId);
    res.json({ user: user || null });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session?.destroy((error) => {
      if (error) {
        res.status(500).json({
          success: false,
          error: "Failed to destroy session",
        });
        return;
      }

      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
}