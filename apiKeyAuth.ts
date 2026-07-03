import { Request, Response, NextFunction } from "express";
import { UserModel } from "../models/user";
import { usersDb, logsDb } from "../config/db";

// Extend Express Request interface to include user information
export interface AuthenticatedRequest extends Request {
  user?: ReturnType<typeof UserModel.findByApiKey>;
}

export function apiKeyAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Extract API key from:
  // 1. Header: 'x-api-key'
  // 2. Header: 'Authorization: Bearer <key>'
  // 3. Query Parameter: 'apiKey' or 'key'
  let apiKey: string | undefined;

  const headerApiKey = req.headers["x-api-key"];
  if (typeof headerApiKey === "string") {
    apiKey = headerApiKey;
  }

  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    apiKey = authHeader.substring(7).trim();
  }

  const queryApiKey = req.query.apiKey || req.query.key;
  if (typeof queryApiKey === "string") {
    apiKey = queryApiKey;
  }

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: "API key is missing. Please provide it via 'x-api-key' header, 'Authorization: Bearer <key>', or '?key=<key>' query parameter.",
    });
    return;
  }

  // Support on-the-fly guest registration if guest_ key is provided
  if (apiKey.startsWith("guest_")) {
    const existing = usersDb.getByApiKey(apiKey);
    if (!existing) {
      usersDb.create({
        id: `usr_${apiKey}`,
        name: `Guest (${apiKey.substring(6)})`,
        email: `${apiKey}@shadowx.local`,
        apiKey: apiKey,
        role: "guest",
        downloadLimit: 5, // Guest session limit
      });
    }
  }

  const user = UserModel.findByApiKey(apiKey);

  if (!user) {
    // Log unauthorized attempt
    logsDb.add({
      userId: "unauthorized",
      userName: "Anonymous",
      type: "unknown",
      success: false,
      url: typeof req.query.url === "string" ? req.query.url : undefined,
      error: "Invalid API Key",
      details: `Attempt with invalid key: ${apiKey.substring(0, 12)}...`,
    });

    res.status(401).json({
      success: false,
      error: "Invalid API Key provided.",
    });
    return;
  }

  // Check if request is from the website
  const isFromWebsite = 
    req.headers["x-from-website"] === "true" ||
    (req.headers["referer"] && req.headers["host"] && req.headers["referer"].includes(req.headers["host"] as string)) ||
    (req.headers["sec-fetch-site"] === "same-origin");

  // Skip all download limits if request is made from the website UI
  if (!isFromWebsite) {
    // External API Key usage limits
    if (user.role !== "admin") {
      // 1. Check if guest is trying to use API Key externally
      if (user.role === "guest") {
        res.status(403).json({
          success: false,
          error: "Guest API Keys can only be used on the website. Please register a free account to use an API Key in your own projects!",
        });
        return;
      }

      const now = new Date();
      
      // 2. Check 7-day expiration limit for external API key projects
      const createdAt = new Date(user.createdAt || now);
      const ageInMs = now.getTime() - createdAt.getTime();
      const ageInDays = ageInMs / (24 * 60 * 60 * 1000);

      if (ageInDays > 7) {
        // Log expiration attempt
        logsDb.add({
          userId: user.id,
          userName: user.name,
          type: "unknown",
          success: false,
          url: typeof req.query.url === "string" ? req.query.url : undefined,
          error: "API Key External Trial Expired",
          details: `User [${user.name}] attempted external request but 7-day trial has expired.`,
        });

        res.status(403).json({
          success: false,
          error: "Your API Key's 7-day external project trial has expired. However, you can still perform UNLIMITED downloads directly on our website!",
        });
        return;
      }

      // 3. Check 50 daily requests limit for external use
      const lastReq = user.lastRequestAt ? new Date(user.lastRequestAt) : null;
      const isNewDay = !lastReq || 
        (now.getUTCDate() !== lastReq.getUTCDate() || 
         now.getUTCMonth() !== lastReq.getUTCMonth() || 
         now.getUTCFullYear() !== lastReq.getUTCFullYear()) ||
        ((now.getTime() - lastReq.getTime()) >= 24 * 60 * 60 * 1000);

      const currentDailyRequests = isNewDay ? 0 : (user.dailyRequests || 0);
      const externalDailyLimit = 50;

      if (currentDailyRequests >= externalDailyLimit) {
        // Log daily limit reach
        logsDb.add({
          userId: user.id,
          userName: user.name,
          type: "unknown",
          success: false,
          url: typeof req.query.url === "string" ? req.query.url : undefined,
          error: "Daily External Limit Reached",
          details: `User [${user.name}] reached daily external limit: ${currentDailyRequests}/${externalDailyLimit}.`,
        });

        res.status(403).json({
          success: false,
          error: `Daily API key external project limit of ${externalDailyLimit} downloads reached. This limit resets every 24 hours. Note that downloads are completely UNLIMITED directly on our website!`,
        });
        return;
      }
    }
  }

  // Bind authenticated user to request
  req.user = user;

  // Track the usage
  usersDb.incrementRequests(user.apiKey);

  next();
}
