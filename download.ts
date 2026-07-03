import { Router, Response } from "express";
import axios from "axios";
import { apiKeyAuth, AuthenticatedRequest } from "../middleware/apiKeyAuth";
import { ExtractorService } from "../services/extractor";
import { logsDb } from "../config/db";

const router = Router();

// In-memory key-based rate limiter (15 requests per 1 minute window)
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 15;
const keyRequestTimestamps = new Map<string, number[]>();

function apiKeyRateLimiter(
  req: AuthenticatedRequest,
  res: Response,
  next: () => void
): void {
  const user = req.user;
  if (!user) {
    next();
    return;
  }

  const apiKey = user.apiKey;
  const now = Date.now();

  // Get timestamps for this key
  let timestamps = keyRequestTimestamps.get(apiKey) || [];
  
  // Filter timestamps to keep only those within the sliding window
  timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestTimestamp = timestamps[0];
    const msToWait = RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp);
    const secsToWait = Math.ceil(msToWait / 1000);

    // Track rate limit trigger in logs
    logsDb.add({
      userId: user.id,
      userName: user.name,
      type: "unknown",
      success: false,
      url: typeof req.query.url === "string" ? req.query.url : undefined,
      error: "Rate Limit Exceeded",
      details: `Key [${apiKey.substring(0, 10)}...] reached rate-limit. Blocked for ${secsToWait}s.`,
    });

    res.status(429).json({
      success: false,
      error: `Too Many Requests. API key rate limit reached (${MAX_REQUESTS_PER_WINDOW} requests per minute). Please wait ${secsToWait} second(s) before trying again.`,
    });
    return;
  }

  // Record this request
  timestamps.push(now);
  keyRequestTimestamps.set(apiKey, timestamps);
  next();
}

/**
 * GET /api/download/stream?url=&filename=
 * Proxies a direct stream request to provide local same-origin downloading
 */
router.get("/stream", async (req, res) => {
  const { url, filename } = req.query;
  if (!url || typeof url !== "string") {
    res.status(400).send("Missing 'url' parameter.");
    return;
  }

  try {
    const streamUrl = url;
    console.log(`Proxying download stream for url: ${streamUrl}`);

    // Request the stream from Cobalt / remote host
    const response = await axios({
      method: "get",
      url: streamUrl,
      responseType: "stream",
      timeout: 300000, // 5 minutes timeout for large files
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    const rawFilename = typeof filename === "string" ? filename : "download";
    // Sanitize for path/filesystem characters
    const sanitizedFilename = rawFilename.replace(/[/\\?%*:|"<>\s]+/g, "_");

    // Create an ASCII-safe version for the fallback filename parameter
    const asciiFilename = sanitizedFilename.replace(/[^\x20-\x7E]/g, "_");

    // Create a UTF-8 encoded version for the filename* parameter (RFC 6266)
    const utf8Filename = encodeURIComponent(sanitizedFilename)
      .replace(/['()]/g, escape)
      .replace(/\*/g, "%2A");

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${asciiFilename}"; filename*=UTF-8''${utf8Filename}`
    );
    
    // Pass along important headers from the remote stream if available
    const contentType = response.headers["content-type"];
    if (typeof contentType === "string" || typeof contentType === "number" || Array.isArray(contentType)) {
      res.setHeader("Content-Type", contentType);
    } else {
      res.setHeader("Content-Type", "application/octet-stream");
    }

    const contentLength = response.headers["content-length"];
    if (typeof contentLength === "string" || typeof contentLength === "number") {
      res.setHeader("Content-Length", contentLength);
    }

    // Pipe the response stream to Express response
    response.data.pipe(res);
  } catch (err: any) {
    console.error("Error streaming download file:", err.message);
    if (!res.headersSent) {
      res.status(500).send(`Failed to stream download: ${err.message}`);
    }
  }
});

/**
 * GET /api/download?url=
 * Extracts media for direct download link matching
 */
router.get("/", apiKeyAuth, apiKeyRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
  const url = req.query.url;
  const user = req.user!; // Provided by auth middleware

  if (!url || typeof url !== "string") {
    // Log missing URL request
    logsDb.add({
      userId: user.id,
      userName: user.name,
      type: "unknown",
      success: false,
      error: "Missing URL Parameter",
      details: "Request failed: URL parameter was not specified.",
    });

    res.status(400).json({
      success: false,
      error: "The 'url' query parameter is required. E.g., /api/download?url=https://youtube.com/watch?v=...",
    });
    return;
  }

  try {
    const result = await ExtractorService.processUrl(url);

    // Record logging success or failure
    logsDb.add({
      userId: user.id,
      userName: user.name,
      type: result.type,
      success: result.success,
      url,
      error: result.error,
      details: result.success 
        ? `Successfully extracted [${result.type}] - Title: "${(result.data as any)?.title || 'Unknown'}"`
        : `Extraction failed: ${result.error}`,
    });

    if (!result.success) {
      res.status(422).json(result);
      return;
    }

    res.json(result);
  } catch (error: any) {
    console.error("Critical error in download controller:", error);

    // Safe fallback standard error logging
    logsDb.add({
      userId: user.id,
      userName: user.name,
      type: "unknown",
      success: false,
      url,
      error: error.message || "Internal server error",
      details: "Crash prevented in download controller. Standard fallback served.",
    });

    res.status(500).json({
      success: false,
      type: "unknown",
      data: null,
      apiKeyRequired: true,
      error: error.message || "An internal server error occurred while processing the extraction request.",
    });
  }
});

/**
 * GET /api/logs
 * Supporting endpoint to expose detailed backend logs for the request tracker dashboard
 */
router.get("/logs", (req, res) => {
  try {
    const logs = logsDb.getAll();
    res.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to load request logs.",
    });
  }
});

/**
 * POST /api/logs/clear
 * Supporting endpoint to clear log history
 */
router.post("/logs/clear", (req, res) => {
  try {
    logsDb.clear();
    res.json({
      success: true,
      message: "Request tracking logs cleared successfully."
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to clear request logs.",
    });
  }
});

export default router;
