import axios from "axios";

export interface MediaStream {
  url: string;
  quality: string;
  format: string;
  ext: string;
  hasVideo: boolean;
  hasAudio: boolean;
  sizeEstimate?: string;
}

export interface SocialExtractionResult {
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  streams: MediaStream[];
}

// Guaranteed fallback instances verified to be active and Turnstile-free
const DEFAULT_COBALT_INSTANCES = [
  "https://api.cobalt.blackcat.sweeux.org",
  "https://api.cobalt.liubquanti.click",
  "https://rue-cobalt.xenon.zone",
  "https://cobaltapi.kittycat.boo"
];

/**
 * Dynamically fetches and ranks Cobalt instances from cobalt.directory
 */
async function getWorkingCobaltEndpoints(platformKey: string = "youtube"): Promise<string[]> {
  const endpointsToTry = [...DEFAULT_COBALT_INSTANCES];
  try {
    console.log(`[Social Extractor] Fetching dynamic Cobalt list from cobalt.directory for platform test: ${platformKey}`);
    const directoryRes = await axios.get("https://cobalt.directory/api/tests", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 4000
    });

    if (directoryRes.data && Array.isArray(directoryRes.data.data)) {
      // Filter out Turnstile, rank by score, and make sure they are online
      const dynamicList = directoryRes.data.data
        .filter((item: any) => 
          item && 
          item.online === true && 
          item.turnstile !== true && 
          item.score >= 50 && 
          item.api
        )
        .map((item: any) => `${item.protocol || "https"}://${item.api}`);

      if (dynamicList.length > 0) {
        // Prepend dynamic instances, preserving uniqueness
        for (const inst of dynamicList.reverse()) {
          if (inst && typeof inst === "string" && !endpointsToTry.includes(inst)) {
            endpointsToTry.unshift(inst);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn("[Social Extractor] Error fetching dynamic endpoints, using robust defaults:", err.message);
  }
  return endpointsToTry;
}

/**
 * Universal extraction helper that requests any URL from the best working Cobalt API
 */
async function extractViaCobalt(url: string, platformName: string, defaultThumbnail: string, isAudioOnly: boolean = false): Promise<SocialExtractionResult> {
  const endpoints = await getWorkingCobaltEndpoints(platformName);
  console.log(`[Social Extractor] Consolidated queue for ${platformName}:`, endpoints);

  for (const endpoint of endpoints) {
    try {
      console.log(`[Social Extractor] Trying ${endpoint} for ${platformName} URL: ${url}`);
      
      const payload: any = {
        url: url,
        filenameStyle: "pretty"
      };

      if (isAudioOnly) {
        payload.isAudioOnly = true;
        payload.audioFormat = "mp3";
      } else {
        payload.videoQuality = "1080";
      }

      const response = await axios.post(endpoint, payload, {
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        timeout: 10000
      });

      const body = response.data;
      console.log(`[Social Extractor] Cobalt API [${endpoint}] status:`, body?.status);

      if (body && (body.status === "stream" || body.status === "redirect" || body.status === "tunnel")) {
        const downloadUrl = body.url;
        const title = body.filename || `${platformName.toUpperCase()} Download_${Math.random().toString(36).substring(7)}`;
        const author = `${platformName.charAt(0).toUpperCase() + platformName.slice(1)} User`;
        const ext = isAudioOnly ? "mp3" : "mp4";

        return {
          title,
          author,
          duration: 0,
          thumbnail: defaultThumbnail,
          streams: [
            {
              url: downloadUrl,
              quality: isAudioOnly ? "320kbps Audio" : "1080p / Original",
              format: isAudioOnly ? "MP3 Audio" : "MP4 Video",
              ext: ext,
              hasVideo: !isAudioOnly,
              hasAudio: true,
              sizeEstimate: "Direct Extraction Stream"
            }
          ]
        };
      } else if (body && body.status === "picker") {
        // Handle slideshow or multiple items (e.g. Instagram slide post)
        const streams = body.picker.map((item: any, idx: number) => {
          const isAudio = item.type === "audio" || (item.url && item.url.includes(".mp3"));
          return {
            url: item.url,
            quality: item.quality || `Item ${idx + 1}`,
            format: isAudio ? "Audio Stream" : "Video/Image",
            ext: isAudio ? "mp3" : "mp4",
            hasVideo: !isAudio,
            hasAudio: true,
            sizeEstimate: "Slide Item"
          };
        });

        return {
          title: body.filename || `${platformName.charAt(0).toUpperCase() + platformName.slice(1)} Slideshow Media`,
          author: `${platformName.charAt(0).toUpperCase() + platformName.slice(1)} Creator`,
          duration: 0,
          thumbnail: defaultThumbnail,
          streams: streams
        };
      } else if (body && body.status === "error") {
        console.log(`[Social Extractor] Cobalt returned error status:`, body.text || body.error);
      }
    } catch (err: any) {
      const errMsg = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.log(`[Social Extractor] Attempt with [${endpoint}] was not successful:`, errMsg);
    }
  }

  throw new Error(`Failed to extract media. No working Cobalt servers could bypass constraints for this ${platformName} link.`);
}

export const SpotifyPlugin = {
  name: "spotify",
  canHandle: (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.includes("spotify.com");
  },
  extract: async (url: string): Promise<SocialExtractionResult> => {
    const defaultThumb = "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80"; // Spotify vibe
    return extractViaCobalt(url, "spotify", defaultThumb, true);
  }
};

export const InstagramPlugin = {
  name: "instagram",
  canHandle: (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.includes("instagram.com");
  },
  extract: async (url: string): Promise<SocialExtractionResult> => {
    const defaultThumb = "https://images.unsplash.com/photo-1611262588024-d12430b98920?w=500&q=80"; // Instagram vibe
    return extractViaCobalt(url, "instagram", defaultThumb, false);
  }
};

export const PinterestPlugin = {
  name: "pinterest",
  canHandle: (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.includes("pinterest.com") || lower.includes("pin.it");
  },
  extract: async (url: string): Promise<SocialExtractionResult> => {
    const defaultThumb = "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&q=80"; // Pinterest vibe
    return extractViaCobalt(url, "pinterest", defaultThumb, false);
  }
};

export const TiktokPlugin = {
  name: "tiktok",
  canHandle: (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.includes("tiktok.com");
  },
  extract: async (url: string): Promise<SocialExtractionResult> => {
    const defaultThumb = "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=500&q=80"; // TikTok vibe
    return extractViaCobalt(url, "tiktok", defaultThumb, false);
  }
};

export const TwitterPlugin = {
  name: "twitter",
  canHandle: (url: string): boolean => {
    const lower = url.toLowerCase();
    return lower.includes("twitter.com") || lower.includes("x.com");
  },
  extract: async (url: string): Promise<SocialExtractionResult> => {
    const defaultThumb = "https://images.unsplash.com/photo-1611605698335-8b15d27e03f2?w=500&q=80"; // Twitter vibe
    return extractViaCobalt(url, "twitter", defaultThumb, false);
  }
};
