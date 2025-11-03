// backend/src/routes/media.proxy.ts
import { Router, Request, Response } from "express";
import { decryptUrl } from "../lib/crypto.ts";
import axios from "axios";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const router = Router();
const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);

const WAHA_MEDIA_DIR = process.env.WAHA_MEDIA_DIR || "/app/.media";

/**
 * Proxy endpoint to serve encrypted media URLs
 * This solves CORS issues and allows the backend to decrypt and serve media
 * 
 * Supports 3 methods:
 * 1. File path from WAHA media directory (file:///...)
 * 2. HTTP/HTTPS URLs (proxied via axios)
 * 3. Base64 data URIs (data:image/...)
 * 
 * Usage: GET /media/proxy?token=<encrypted_url_token>
 */
router.get("/proxy", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).json({ error: "Missing or invalid token parameter" });
    }

    // Decrypt the URL/path
    const originalUrl = decryptUrl(token);
    
    if (!originalUrl) {
      console.error("[media.proxy] Failed to decrypt token");
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    console.log("[media.proxy] Processing media:", originalUrl.substring(0, 80) + "...");

    // Method 1: Base64 data URI
    if (originalUrl.startsWith("data:")) {
      const matches = originalUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: "Invalid base64 data URI" });
      }
      const [, mimeType, base64Data] = matches;
      const buffer = Buffer.from(base64Data, "base64");
      
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Length", buffer.length);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
      
      return res.send(buffer);
    }

    // Method 2: Local file path (file:// or absolute path)
    let filePath: string | null = null;
    
    if (originalUrl.startsWith("file://")) {
      filePath = originalUrl.replace("file://", "");
    } else if (originalUrl.startsWith("/") || originalUrl.match(/^[a-zA-Z]:\\/)) {
      // Absolute path (Unix or Windows)
      filePath = originalUrl;
    } else if (!originalUrl.startsWith("http://") && !originalUrl.startsWith("https://")) {
      // Relative path - assume it's within WAHA_MEDIA_DIR
      filePath = path.join(WAHA_MEDIA_DIR, originalUrl);
    }

    if (filePath) {
      try {
        const stats = await statAsync(filePath);
        if (!stats.isFile()) {
          console.error("[media.proxy] Path is not a file:", filePath);
          return res.status(404).json({ error: "File not found" });
        }

        const buffer = await readFileAsync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        
        // Determine content type based on extension
        const mimeTypes: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".mp4": "video/mp4",
          ".webm": "video/webm",
          ".ogg": "audio/ogg",
          ".mp3": "audio/mpeg",
          ".wav": "audio/wav",
          ".pdf": "application/pdf",
          ".doc": "application/msword",
          ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
        
        const contentType = mimeTypes[ext] || "application/octet-stream";
        
        res.setHeader("Content-Type", contentType);
        res.setHeader("Content-Length", buffer.length);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "public, max-age=86400");
        
        console.log("[media.proxy] Serving file from disk:", filePath, `(${buffer.length} bytes)`);
        return res.send(buffer);
        
      } catch (fileError: any) {
        if (fileError.code === "ENOENT") {
          console.error("[media.proxy] File not found:", filePath);
          // Continue to try HTTP fallback
        } else {
          console.error("[media.proxy] Error reading file:", filePath, fileError.message);
          return res.status(500).json({ error: "Error reading file" });
        }
      }
    }

    // Method 3: HTTP/HTTPS URL (proxy via axios)
    if (originalUrl.startsWith("http://") || originalUrl.startsWith("https://")) {
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

      console.log("[media.proxy] Proxying HTTP media from:", originalUrl.substring(0, 50) + "...");
      
      // Stream the media to the client
      response.data.pipe(res);
      return;
    }

    // If we get here, the URL format is not supported
    return res.status(400).json({ error: "Unsupported media URL format" });

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
