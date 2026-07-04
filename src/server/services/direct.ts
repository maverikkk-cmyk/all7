import axios from "axios";
import path from "path";

export interface DirectMediaInfo {
  title: string;
  author: string;
  duration: number; // 0 for static files
  thumbnail: string;
  streams: Array<{
    url: string;
    quality: string;
    format: string;
    ext: string;
    hasVideo: boolean;
    hasAudio: boolean;
    sizeEstimate: string;
  }>;
}

export const DirectService = {
  /**
   * Determines if this URL represents a direct file download
   */
  canHandle: (url: string): boolean => {
    // Basic regex checks for standard file extensions, or we can assume it's direct if it doesn't match a main platform.
    const urlLower = url.toLowerCase();
    
    // Check for standard media extensions in URL path
    const hasMediaExtension = /\.(mp3|mp4|wav|m4a|png|jpg|jpeg|gif|webp|pdf|zip|tar|gz|mov|avi|mkv|ogg)$/i.test(urlLower);
    
    // Check if it looks like a standard web HTTP link
    const isHttp = urlLower.startsWith("http://") || urlLower.startsWith("https://");
    
    return isHttp && (hasMediaExtension || !urlLower.includes("youtube.com") && !urlLower.includes("youtu.be"));
  },

  /**
   * Performs quick metadata extraction on a direct file URL
   */
  extract: async (url: string): Promise<DirectMediaInfo> => {
    try {
      console.log(`Extracting direct metadata for: ${url}`);
      
      // Perform lightweight HEAD request with 3 second timeout
      const response = await axios.head(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 3000,
        validateStatus: () => true, // Accept any status code to inspect headers
      });

      const headers = response.headers;
      const contentType = String(headers["content-type"] || "application/octet-stream");
      const contentLength = headers["content-length"] ? String(headers["content-length"]) : undefined;
      const contentDisposition = headers["content-disposition"] ? String(headers["content-disposition"]) : undefined;

      // Extract filename
      let fileName = "Direct File Download";
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename\*?=["']?([^"';]+)["']?/);
        if (filenameMatch && filenameMatch[1]) {
          fileName = decodeURIComponent(filenameMatch[1].replace(/UTF-8''/i, ""));
        }
      } else {
        // Parse from URL pathname
        try {
          const parsedUrl = new URL(url);
          const base = path.basename(parsedUrl.pathname);
          if (base && base.includes(".")) {
            fileName = base;
          }
        } catch (e) {
          // Keep default
        }
      }

      // Friendly size estimator
      let sizeText = "Unknown Size";
      if (contentLength) {
        const sizeBytes = parseInt(contentLength, 10);
        if (sizeBytes > 1024 * 1024 * 1024) {
          sizeText = `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        } else if (sizeBytes > 1024 * 1024) {
          sizeText = `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
        } else {
          sizeText = `${(sizeBytes / 1024).toFixed(1)} KB`;
        }
      }

      // Map Content-Type to extensions & flags
      let ext = "bin";
      let hasVideo = false;
      let hasAudio = false;
      let format = "Generic Binary File";
      let icon = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&q=80"; // Abstract art for direct files

      if (contentType.includes("video")) {
        ext = contentType.split("/")[1] || "mp4";
        hasVideo = true;
        hasAudio = true;
        format = `Video File (${ext.toUpperCase()})`;
        icon = "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=500&q=80"; // Cinema video icon
      } else if (contentType.includes("audio")) {
        ext = contentType.split("/")[1] || "mp3";
        hasAudio = true;
        format = `Audio Track (${ext.toUpperCase()})`;
        icon = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80"; // Microphone audio icon
      } else if (contentType.includes("image")) {
        ext = contentType.split("/")[1] || "png";
        format = `Image (${ext.toUpperCase()})`;
        icon = url; // Directly use the image as its thumbnail!
      } else if (contentType.includes("pdf")) {
        ext = "pdf";
        format = "PDF Document";
        icon = "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=500&q=80"; // Document thumbnail
      } else if (contentType.includes("zip") || contentType.includes("archive")) {
        ext = "zip";
        format = "Archive File";
        icon = "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=500&q=80"; // Folders archive
      }

      return {
        title: fileName,
        author: new URL(url).hostname || "Direct Web Link",
        duration: 0,
        thumbnail: icon,
        streams: [
          {
            url: url,
            quality: "Original Quality",
            format: format,
            ext: ext,
            hasVideo,
            hasAudio,
            sizeEstimate: sizeText,
          }
        ],
      };
    } catch (error: any) {
      console.warn("Direct extract head request failed, building fallback from URL pattern:", error.message || error);
      
      // Fallback extraction parses purely on local extension heuristics
      let ext = "mp4";
      let format = "Direct Download File";
      let hasVideo = true;
      let hasAudio = true;
      const urlLower = url.toLowerCase();

      if (urlLower.endsWith(".mp3") || urlLower.endsWith(".wav") || urlLower.endsWith(".m4a")) {
        ext = "mp3";
        format = "Direct Audio Track";
        hasVideo = false;
        hasAudio = true;
      } else if (urlLower.endsWith(".pdf")) {
        ext = "pdf";
        format = "PDF Document";
        hasVideo = false;
        hasAudio = false;
      } else if (urlLower.endsWith(".zip")) {
        ext = "zip";
        format = "Compressed ZIP Archive";
        hasVideo = false;
        hasAudio = false;
      } else if (urlLower.endsWith(".png") || urlLower.endsWith(".jpg") || urlLower.endsWith(".jpeg") || urlLower.endsWith(".webp")) {
        ext = "png";
        format = "Direct Image Asset";
        hasVideo = false;
        hasAudio = false;
      }

      // Safe URL title extraction
      let name = "Direct Stream Target";
      try {
        const u = new URL(url);
        const base = path.basename(u.pathname);
        if (base) name = base;
      } catch (_) {}

      return {
        title: name,
        author: "Remote Web Server",
        duration: 0,
        thumbnail: ext === "png" ? url : "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=500&q=80",
        streams: [
          {
            url: url,
            quality: "Original Link",
            format: format,
            ext: ext,
            hasVideo,
            hasAudio,
            sizeEstimate: "Direct Stream Connection",
          }
        ],
      };
    }
  }
};
