import "dotenv/config";
import express from "express";
import session from "express-session";
import passport from "passport";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { handlePaystackWebhook } from "./paystack-webhook";
import { handleOpayWebhook } from "./opay-webhook";
import { startPayoutScheduler } from "../payoutScheduler";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(port, () => {
      server.close(() => resolve(true));
    });

    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.set("trust proxy", 1);

  app.use(
    session({
      name: "connect.sid",
      secret: process.env.SESSION_SECRET || "apiamway_local_secret_123",
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 365,
      },
    })
  );

  app.use(passport.initialize());

  // OPay webhook needs raw body for HMAC signature verification.
  // Must be registered BEFORE express.json() so the raw Buffer is preserved.
  app.post(
    "/api/webhooks/opay",
    express.raw({ type: "application/json", limit: "1mb" }),
    (req, _res, next) => {
      (req as any).rawBody = req.body;
      next();
    },
    handleOpayWebhook
  );

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.post("/api/payment/webhook", handlePaystackWebhook);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "3000", 10);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    startPayoutScheduler();
  });
}

startServer().catch(console.error);