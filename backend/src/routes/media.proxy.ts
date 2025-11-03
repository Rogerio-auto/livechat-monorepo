// backend/src/routes/media.proxy.ts
import { Router, Request, Response } from "express";
import { decryptUrl } from "../lib/crypto.ts";
import axios from "axios";

const router = Router();

/**
 * Proxy endpoint to serve encrypted media URLs
 * This solves CORS issues and allows the backend to decrypt and serve media
 * 
 * Usage: GET /media/proxy?token=<encrypted_url_token>
 */
router.get("/proxy", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Missing or invalid token parameter" });
    }

    // Decrypt the URL
    const originalUrl = decryptUrl(token);
    
    if (!originalUrl) {
      console.error("[media.proxy] Failed to decrypt token");
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    console.log("[media.proxy] Proxying media from:", originalUrl.substring(0, 50) + "...");

    // Fetch the media from the original source
    const response = await axios.get(originalUrl, {
      responseType: "stream",
      timeout: 30000, // 30 seconds
      maxRedirects: 5,
      validateStatus: (status: number) => status < 500, // Accept 4xx as valid
    });

    // Check if the request was successful
    if (response.status !== 200) {
      console.error("[media.proxy] Failed to fetch media:", response.status, response.statusText);
      return res.status(response.status).json({ 
        error: "Failed to fetch media", 
        status: response.status 
      });
    }

    // Set appropriate headers
    const contentType = response.headers["content-type"] || "application/octet-stream";
    const contentLength = response.headers["content-length"];
    
    res.setHeader("Content-Type", contentType);
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400"); // Cache for 24 hours

    // Stream the media to the client
    response.data.pipe(res);

  } catch (error: any) {
    console.error("[media.proxy] Error proxying media:", error.message);
    
    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "Media source unavailable" });
    }
    
    if (error.code === "ETIMEDOUT") {
      return res.status(504).json({ error: "Media source timeout" });
    }
    
    return res.status(500).json({ 
      error: "Failed to proxy media",
      message: error.message 
    });
  }
});

/**
 * Health check endpoint
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", service: "media-proxy" });
});

export default router;
