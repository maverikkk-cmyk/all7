import { YoutubeService, ExtractionResult } from "./youtube";
import { DirectService, DirectMediaInfo } from "./direct";
import { 
  SpotifyPlugin, 
  InstagramPlugin, 
  PinterestPlugin, 
  TiktokPlugin, 
  TwitterPlugin 
} from "./socialExtractor";

export type ExtractorType = "youtube" | "spotify" | "instagram" | "pinterest" | "tiktok" | "twitter" | "direct" | "unknown";

export interface ExtractedPayload {
  success: boolean;
  type: ExtractorType;
  data: ExtractionResult | DirectMediaInfo | null;
  apiKeyRequired: boolean;
  error?: string;
}

// Interface for creating future plugins (Modular plugin system!)
export interface ExtractorPlugin {
  name: string;
  canHandle: (url: string) => boolean;
  extract: (url: string) => Promise<any>;
}

class ExtractorServiceManager {
  private plugins: ExtractorPlugin[] = [];

  constructor() {
    // Register default core services as plugins
    this.registerPlugin({
      name: "youtube",
      canHandle: YoutubeService.canHandle,
      extract: YoutubeService.extract,
    });

    this.registerPlugin(SpotifyPlugin);
    this.registerPlugin(InstagramPlugin);
    this.registerPlugin(PinterestPlugin);
    this.registerPlugin(TiktokPlugin);
    this.registerPlugin(TwitterPlugin);

    this.registerPlugin({
      name: "direct",
      canHandle: DirectService.canHandle,
      extract: DirectService.extract,
    });
  }

  /**
   * Extensible: Developers can register custom service plugins (e.g., soundcloud, tiktok, vimeo, spotify)
   */
  public registerPlugin(plugin: ExtractorPlugin) {
    console.log(`Plugin Registered successfully: [${plugin.name}]`);
    this.plugins.push(plugin);
  }

  /**
   * Automatically detects the platform and processes url
   */
  public async processUrl(url: string): Promise<ExtractedPayload> {
    if (!url) {
      return {
        success: false,
        type: "unknown",
        data: null,
        apiKeyRequired: true,
        error: "URL is empty or missing.",
      };
    }

    try {
      // Find matching plugin in registry
      for (const plugin of this.plugins) {
        if (plugin.canHandle(url)) {
          const data = await plugin.extract(url);
          return {
            success: true,
            type: plugin.name as ExtractorType,
            data,
            apiKeyRequired: true,
          };
        }
      }

      // Safe Fallback: Process using Direct Service if no specific platform matches
      console.log(`No specific platform matches for: ${url}. Falling back to Direct extraction.`);
      const directData = await DirectService.extract(url);
      return {
        success: true,
        type: "direct",
        data: directData,
        apiKeyRequired: true,
      };
    } catch (error: any) {
      console.error(`Error processing extraction for URL (${url}):`, error);
      return {
        success: false,
        type: "unknown",
        data: null,
        apiKeyRequired: true,
        error: error.message || "An unexpected error occurred during extraction.",
      };
    }
  }
}

export const ExtractorService = new ExtractorServiceManager();
export default ExtractorService;
