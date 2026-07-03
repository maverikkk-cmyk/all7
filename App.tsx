import React, { useState, useEffect } from "react";
import { 
  Download, 
  Terminal, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Copy, 
  Check, 
  RefreshCw, 
  Trash2, 
  Youtube, 
  FileText, 
  Music, 
  ExternalLink,
  Shield,
  Gauge,
  FileVideo,
  Instagram,
  Pin,
  Sparkles,
  Globe,
  Flame,
  User,
  Radio,
  Sliders,
  Users,
  HardDrive,
  LogIn,
  LogOut,
  Key
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Types matching server API schemas
interface DbUser {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  requestCount: number;
  dailyRequests?: number;
  lastRequestAt?: string;
  createdAt: string;
  role: "admin" | "user" | "guest";
  downloadLimit: number;
}

interface RequestLog {
  id: string;
  userId: string;
  userName: string;
  timestamp: string;
  url?: string;
  type: string;
  success: boolean;
  error?: string;
  details?: string;
}

interface MediaStream {
  url: string;
  quality: string;
  format: string;
  ext: string;
  hasVideo: boolean;
  hasAudio: boolean;
  sizeEstimate?: string;
}

interface ExtractionResult {
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  streams: MediaStream[];
}

interface StatusResponse {
  status: string;
  service: string;
  timestamp: string;
  uptime: number;
  version: string;
  capabilities: string[];
}

export default function App() {
  // Navigation & Screen Control
  const [activeTab, setActiveTab] = useState<"downloader" | "admin">("downloader");

  // State
  const [systemStatus, setSystemStatus] = useState<StatusResponse | null>(null);
  const [guestId, setGuestId] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<{
    type: string;
    data: ExtractionResult;
    rawJson: any;
  } | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // Admin Logs & Guest Sessions State
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Quick platform demo links matching socialExtractor
  const PLATFORMS_INFO = [
    {
      id: "youtube",
      name: "YouTube",
      icon: <Youtube className="h-5 w-5 text-red-500" />,
      color: "from-red-500/10 to-rose-500/10 border-red-500/20 text-red-400 animate-pulse",
      sample: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      desc: "Video & Audio tracks in 1080p or MP3 music streams."
    },
    {
      id: "spotify",
      name: "Spotify",
      icon: <Music className="h-5 w-5 text-emerald-400" />,
      color: "from-emerald-500/10 to-green-500/10 border-emerald-500/20 text-emerald-400",
      sample: "https://open.spotify.com/track/4PTG3Z6ehGkBF3zI7YmR73",
      desc: "High quality MP3 audio extractions directly from playlists."
    },
    {
      id: "instagram",
      name: "Instagram",
      icon: <Instagram className="h-5 w-5 text-pink-400" />,
      color: "from-pink-500/10 to-fuchsia-500/10 border-pink-500/20 text-pink-400",
      sample: "https://www.instagram.com/p/CG4g3p7n_4Y/",
      desc: "Download Instagram Reels, Photos, Slideshows & Posts."
    },
    {
      id: "pinterest",
      name: "Pinterest",
      icon: <Pin className="h-5 w-5 text-rose-500" />,
      color: "from-rose-500/10 to-red-500/10 border-rose-500/20 text-rose-400",
      sample: "https://www.pinterest.com/pin/123456789/",
      desc: "Save HD video and image pins directly to disk."
    },
    {
      id: "tiktok",
      name: "TikTok",
      icon: <Sparkles className="h-5 w-5 text-cyan-400" />,
      color: "from-cyan-500/10 to-blue-500/10 border-cyan-500/20 text-cyan-400",
      sample: "https://www.tiktok.com/@khaby.lame/video/6982424151528414470",
      desc: "No-watermark videos and soundtracks from TikTok."
    },
    {
      id: "twitter",
      name: "Twitter / X",
      icon: <Globe className="h-5 w-5 text-slate-300" />,
      color: "from-slate-800/20 to-neutral-800/20 border-slate-700/30 text-slate-300",
      sample: "https://twitter.com/elonmusk/status/1683344130325487616",
      desc: "High fidelity mp4 video extraction from post threads."
    }
  ];

  // Bootstrap lifecycle
  useEffect(() => {
    // Restore persistent auth session if exists
    const savedUser = localStorage.getItem("shadowx_user");
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to restore auth session:", e);
      }
    }

    // Check and set persistent Guest ID session
    let activeGuest = localStorage.getItem("shadowx_guest_id");
    if (!activeGuest) {
      activeGuest = `guest_shadow_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem("shadowx_guest_id", activeGuest);
    }
    setGuestId(activeGuest);

    fetchSystemStatus();
    fetchLogs();
    fetchUsers();

    // Constant background polling for stats, logs, and server integrity
    const syncInterval = setInterval(() => {
      fetchSystemStatus();
      if (activeTab === "admin") {
        fetchLogs();
        fetchUsers();
      }
    }, 6000);

    return () => clearInterval(syncInterval);
  }, [activeTab]);

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        setSystemStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch system status:", err);
    }
  };

  const fetchLogs = async () => {
    try {
      setIsLogsLoading(true);
      const res = await fetch("/api/download/logs");
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        if (data.success) setLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to query download logs:", err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        if (data.success) setUsers(data.users);
      }
    } catch (err) {
      console.error("Failed to query active users list:", err);
    }
  };

  const handleClearLogs = async () => {
    try {
      const res = await fetch("/api/download/logs/clear", { method: "POST" });
      if (res.ok) {
        setLogs([]);
        await fetchLogs();
      }
    } catch (err) {
      console.error("Failed to purge server logs:", err);
    }
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setExtractionError("Please supply a valid URL to extract.");
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setExtractionResult(null);

    try {
      const encodedUrl = encodeURIComponent(urlInput.trim());
      const apiKey = currentUser ? currentUser.apiKey : guestId;
      const res = await fetch(`/api/download?url=${encodedUrl}`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "x-from-website": "true",
        },
      });

      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Extraction failed. Remote Cobalt servers are unable to stream this resource. Please verify your link.");
      }

      setExtractionResult({
        type: data.type,
        data: data.data,
        rawJson: data,
      });

      // Instantly refresh user and admin stats
      if (currentUser) {
        const updatedUser = { 
          ...currentUser, 
          requestCount: currentUser.requestCount + 1,
          dailyRequests: (currentUser.dailyRequests || 0) + 1
        };
        setCurrentUser(updatedUser);
        localStorage.setItem("shadowx_user", JSON.stringify(updatedUser));
      }

      fetchUsers();
    } catch (err: any) {
      setExtractionError(err.message || "Unable to parse streaming meta. Cobalt API returned a server error.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    try {
      const endpoint = authMode === "login" ? "/api/login" : "/api/register";
      const payload = authMode === "login"
        ? { email: authEmail, password: authPassword }
        : { name: authName, email: authEmail, password: authPassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed.");
      }

      // Save user to state & localstorage
      setCurrentUser(data.user);
      localStorage.setItem("shadowx_user", JSON.stringify(data.user));
      setAuthSuccess(authMode === "login" ? "Successfully logged in!" : "Account registered successfully!");

      // Clear inputs
      setAuthEmail("");
      setAuthPassword("");
      setAuthName("");

      setTimeout(() => {
        setIsAuthModalOpen(false);
        setAuthSuccess(null);
      }, 1500);

      fetchUsers();
    } catch (err: any) {
      setAuthError(err.message || "An error occurred during authentication.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("shadowx_user");
    setActiveTab("downloader");
  };

  const handleQuickFill = (url: string) => {
    setUrlInput(url);
    setExtractionError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopyValue = (val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(val);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyJson = (json: any) => {
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const formatDuration = (seconds: number) => {
    if (seconds <= 0) return "Media Track";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
  };

  const getPlatformStyling = (type: string) => {
    switch (type?.toLowerCase()) {
      case "youtube":
        return { bg: "bg-red-500/10 border-red-500/20 text-red-400", icon: <Youtube className="h-4 w-4 fill-current" />, label: "YouTube" };
      case "spotify":
        return { bg: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400", icon: <Music className="h-4 w-4" />, label: "Spotify" };
      case "instagram":
        return { bg: "bg-pink-500/10 border-pink-500/20 text-pink-400", icon: <Instagram className="h-4 w-4" />, label: "Instagram" };
      case "pinterest":
        return { bg: "bg-rose-500/10 border-rose-500/20 text-rose-400", icon: <Pin className="h-4 w-4" />, label: "Pinterest" };
      case "tiktok":
        return { bg: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400", icon: <Sparkles className="h-4 w-4" />, label: "TikTok" };
      case "twitter":
        return { bg: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400", icon: <Globe className="h-4 w-4" />, label: "X / Twitter" };
      default:
        return { bg: "bg-blue-500/10 border-blue-500/20 text-blue-400", icon: <FileText className="h-4 w-4" />, label: "Direct Download" };
    }
  };

  // Quick stats calculators for Admin dashboard
  const stats = {
    totalGuestSessions: users.length,
    totalDownloads: users.reduce((acc, curr) => acc + curr.requestCount, 0),
    successfulExtractions: logs.filter(l => l.success).length,
    failedExtractions: logs.filter(l => !l.success).length,
    successPercentage: logs.length > 0 
      ? Math.round(((logs.filter(l => l.success).length) / logs.length) * 100) 
      : 100,
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-purple-500 selection:text-neutral-950 relative overflow-x-hidden pb-16">
      
      {/* Premium Cyber Ambient Glow Mesh */}
      <div className="absolute top-[-250px] left-[-200px] w-[700px] h-[700px] bg-gradient-to-br from-purple-600/15 via-fuchsia-600/5 to-transparent rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-[300px] right-[-300px] w-[700px] h-[700px] bg-gradient-to-bl from-cyan-600/10 via-purple-600/5 to-transparent rounded-full blur-[140px] pointer-events-none" />

      {/* Main Server Header */}
      <header className="border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo Branding - shadowXdownloding */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-purple-600 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/35 ring-1 ring-white/20">
              <Download className="h-6 w-6 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent font-black tracking-widest uppercase">Premium Hub</span>
                <span className="text-[9px] bg-neutral-900 border border-neutral-800 px-1.5 py-0.2 rounded font-mono text-neutral-400">Admin Live</span>
              </div>
              <h1 className="text-2xl font-black tracking-tighter text-white">
                shadow<span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400">X</span>downloding
              </h1>
            </div>
          </div>

          {/* Connection Indicators & User Profile Actions */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Server Online/Offline status */}
            <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3.5 py-1.5 rounded-xl text-xs">
              <span className={`h-2.5 w-2.5 rounded-full ${systemStatus ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-ping"}`} />
              <span className="font-semibold text-neutral-300">
                {systemStatus ? "Decentralized Engine Online" : "Connecting to Extractor"}
              </span>
            </div>

            {/* Seamless Auth widget */}
            {currentUser ? (
              <div className="flex items-center gap-3 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-xl shadow-md">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] text-neutral-400 font-bold leading-tight">Welcome, {currentUser.name}</span>
                  <span className="text-[9px] text-purple-400 font-mono font-black uppercase">
                    {currentUser.role === "admin" ? "Admin" : "Professional"}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 hover:bg-rose-950/20 hover:text-rose-400 text-neutral-400 rounded-lg transition-colors border border-transparent hover:border-rose-900/30"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 bg-purple-500/5 border border-purple-500/10 px-3 py-1.5 rounded-xl text-xs text-purple-300">
                  <User className="h-3.5 w-3.5 text-purple-400" />
                  <span className="font-mono">Guest Mode</span>
                </div>
                <button
                  onClick={() => {
                    setAuthMode("login");
                    setIsAuthModalOpen(true);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-pink-500 hover:opacity-90 px-4 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1 shadow-lg shadow-purple-500/15"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Login / Signup
                </button>
              </div>
            )}

          </div>
        </div>
      </header>

      {/* Main Core View Area */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        
        {/* Navigation Tabs Bar */}
        <div className="flex border-b border-neutral-900 mb-8 gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("downloader")}
            className={`px-6 py-3.5 text-xs uppercase tracking-wider font-black border-b-2 transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
              activeTab === "downloader"
                ? "border-purple-500 text-purple-400 bg-purple-950/10"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Download className="h-4 w-4" />
            Media Downloader
          </button>
          
          {currentUser?.role === "admin" && (
            <button
              onClick={() => setActiveTab("admin")}
              className={`px-6 py-3.5 text-xs uppercase tracking-wider font-black border-b-2 transition-all duration-200 flex items-center gap-2 whitespace-nowrap ${
                activeTab === "admin"
                  ? "border-purple-500 text-purple-400 bg-purple-950/10"
                  : "border-transparent text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <Sliders className="h-4 w-4" />
              Admin Control Panel
            </button>
          )}
        </div>

        {/* Tab Selection */}
        <AnimatePresence mode="wait">
          {activeTab === "downloader" ? (
            <motion.div
              key="downloader-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start"
            >
              
              {/* LEFT SIDE: Input Form, Loader & Streams Extraction Results */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Extractor Input Panel */}
                <div className="bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 relative overflow-hidden shadow-2xl backdrop-blur-xl ring-1 ring-white/5">
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
                  
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-purple-950/40 rounded-xl border border-purple-800/20">
                      <Flame className="h-5 w-5 text-purple-400 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Universal Social Media Downloader</h2>
                      <p className="text-neutral-400 text-xs">
                        {currentUser 
                          ? `Extracting high-speed media streams via Professional key with priority speed.` 
                          : "No logins required. Instant high-speed extractions via Guest ID."}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleExtract} className="space-y-4 mt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400">
                          Paste Video, Track, or Post URL
                        </label>
                        <span className={`text-[10px] border px-2.5 py-0.5 rounded-full font-black ${
                          currentUser?.role === "admin"
                            ? "text-purple-400 bg-purple-500/10 border-purple-500/25"
                            : currentUser
                              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
                              : "text-amber-400 bg-amber-500/10 border-amber-500/25"
                        }`}>
                          {currentUser?.role === "admin" 
                            ? "SUPER ADMIN ACCESS" 
                            : currentUser 
                              ? "PROFESSIONAL ACCESS" 
                              : "GUEST ACCESS"}
                        </span>
                      </div>

                      <div className="relative group">
                        <input
                          type="url"
                          required
                          value={urlInput}
                          onChange={(e) => setUrlInput(e.target.value)}
                          placeholder="Paste YouTube video, Spotify track, Instagram post, Pinterest link..."
                          className="bg-neutral-950 border border-neutral-800 rounded-2xl pl-4 pr-32 py-4.5 text-xs text-slate-100 w-full placeholder-neutral-600 focus:outline-none focus:border-purple-500 transition-all shadow-inner group-hover:border-neutral-700 focus:ring-1 focus:ring-purple-500/20"
                        />
                        <button
                          type="submit"
                          disabled={isExtracting}
                          className="absolute right-2 top-2 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 hover:opacity-90 disabled:bg-neutral-800 disabled:text-neutral-600 font-bold text-white px-5 py-2.5 rounded-xl text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-purple-500/10"
                        >
                          {isExtracting ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Download className="h-4 w-4" />
                              Extract
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Limit status indicator footer */}
                  <div className="mt-5 pt-4 border-t border-neutral-900/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 text-xs">
                    {currentUser ? (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="text-neutral-300">
                            Logged in as <span className="text-white font-bold">{currentUser.name}</span> ({currentUser.role === "admin" ? "Admin" : "Free Account"})
                          </span>
                        </div>
                        <div className="text-neutral-400 font-mono text-right flex flex-col items-end">
                          <div>
                            Today's Website Downloads: <span className="text-emerald-400 font-bold">Unlimited 🔥</span>
                          </div>
                          <span className="text-[10px] text-neutral-500 font-normal">Use your API key in external projects!</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                          <span className="text-neutral-400">
                            Using in <span className="text-neutral-300 font-bold">Guest Mode</span> (Website downloads: <span className="text-emerald-400 font-bold">Unlimited 🔥</span>).
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setAuthMode("register");
                            setIsAuthModalOpen(true);
                          }}
                          className="text-purple-400 hover:text-purple-300 font-black flex items-center gap-1 transition-colors self-end sm:self-auto"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-fuchsia-400 animate-pulse" />
                          Sign Up Free for API Key access!
                        </button>
                      </>
                    )}
                  </div>

                  {/* Errors display */}
                  {extractionError && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 p-4.5 bg-rose-950/20 border border-rose-850 rounded-2xl text-rose-300 text-xs flex gap-3"
                    >
                      <XCircle className="h-5 w-5 text-rose-500 shrink-0" />
                      <div>
                        <p className="font-bold">Extraction Error</p>
                        <p className="mt-0.5 opacity-90">{extractionError}</p>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Extraction process loader */}
                {isExtracting && (
                  <div className="bg-neutral-900/30 border border-neutral-900 rounded-3xl p-12 flex flex-col items-center justify-center text-center gap-4 shadow-xl">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full border-4 border-neutral-800 border-t-purple-500 border-b-fuchsia-500 animate-spin" />
                      <Sparkles className="h-6 w-6 text-fuchsia-400 absolute top-5 left-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-white font-black text-sm uppercase tracking-wide">Resolving Cobalt Streams</h3>
                      <p className="text-xs text-neutral-500 mt-2 max-w-sm leading-relaxed">
                        Querying decentralized server queues, verifying payload bypasses, and extracting audio-video streams...
                      </p>
                    </div>
                  </div>
                )}

                {/* Media Streams list result */}
                {extractionResult && (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    
                    {/* Media metadata info */}
                    <div className="bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-md">
                      <div className="flex flex-col md:flex-row gap-6">
                        
                        {/* Image preview */}
                        <div className="w-full md:w-56 shrink-0 aspect-video md:h-32 bg-neutral-950 rounded-2xl overflow-hidden relative border border-neutral-800 group shadow-md">
                          <img 
                            src={extractionResult.data.thumbnail} 
                            alt={extractionResult.data.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-lg font-mono text-[10px] text-white">
                            {formatDuration(extractionResult.data.duration)}
                          </div>
                          
                          <div className={`absolute top-2 left-2 font-bold text-[9px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-lg backdrop-blur-md border ${
                            getPlatformStyling(extractionResult.type).bg
                          }`}>
                            {getPlatformStyling(extractionResult.type).icon}
                            {getPlatformStyling(extractionResult.type).label.toUpperCase()}
                          </div>
                        </div>

                        {/* Title and stats */}
                        <div className="flex-1 flex flex-col justify-between">
                          <div>
                            <h3 className="text-lg font-bold text-white leading-snug line-clamp-2">
                              {extractionResult.data.title}
                            </h3>
                            <p className="text-neutral-400 text-xs mt-1 font-medium">
                              Channel / Author: <span className="text-purple-400 font-bold">{extractionResult.data.author}</span>
                            </p>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            <button
                              onClick={() => handleCopyJson(extractionResult.rawJson)}
                              className="px-3.5 py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 rounded-xl text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
                            >
                              {copiedJson ? (
                                <>
                                  <Check className="h-4 w-4 text-emerald-400" />
                                  JSON Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4" />
                                  Copy JSON Response
                                </>
                              )}
                            </button>
                            <a 
                              href={urlInput} 
                              target="_blank" 
                              rel="noreferrer"
                              className="px-3.5 py-2 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 rounded-xl text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Original URL
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Available media streaming files */}
                    <div className="bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-md">
                      <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Flame className="h-4 w-4 text-purple-400" />
                        Available Extraction Streams ({extractionResult.data.streams.length})
                      </h4>
                      
                      <div className="divide-y divide-neutral-800/80">
                        {extractionResult.data.streams.map((stream, idx) => (
                          <div 
                            key={idx} 
                            className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 first:pt-0 last:pb-0"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2.5 rounded-2xl border ${
                                stream.hasVideo && stream.hasAudio 
                                  ? "bg-purple-950/20 border-purple-800/20 text-purple-400"
                                  : stream.hasVideo 
                                    ? "bg-rose-950/20 border-rose-800/20 text-rose-400"
                                    : "bg-emerald-950/20 border-emerald-800/20 text-emerald-400"
                              }`}>
                                {stream.hasVideo && stream.hasAudio ? (
                                  <FileVideo className="h-5 w-5" />
                                ) : stream.hasVideo ? (
                                  <FileVideo className="h-5 w-5 opacity-70" />
                                ) : (
                                  <Music className="h-5 w-5" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white">
                                    {stream.quality}
                                  </span>
                                  <span className="text-[10px] bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded-lg font-mono text-neutral-400 uppercase font-semibold">
                                    {stream.ext}
                                  </span>
                                </div>
                                <p className="text-neutral-400 text-xs mt-1">
                                  {stream.format} • Size: <span className="text-neutral-200 font-semibold">{stream.sizeEstimate || "Fast Download Speed"}</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-row gap-2 w-full sm:w-auto">
                              <a
                                href={`/api/download/stream?url=${encodeURIComponent(stream.url)}&filename=${encodeURIComponent(extractionResult.data.title + '.' + stream.ext)}`}
                                className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl transition-all text-center flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/15"
                              >
                                <Download className="h-4 w-4 stroke-[2.5]" />
                                Download File
                              </a>
                              <a
                                href={stream.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3.5 py-2.5 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 font-semibold text-xs border border-neutral-850 rounded-xl transition-colors text-center flex items-center justify-center gap-1.5"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                                Direct Link
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </motion.div>
                )}

                {currentUser && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-md"
                  >
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Key className="h-5 w-5 text-purple-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Your Personal API Key</h3>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-400">Integrated developer key</span>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 rounded-xl p-2.5">
                      <input
                        type="text"
                        readOnly
                        value={currentUser.apiKey}
                        className="bg-transparent text-xs text-purple-300 font-mono w-full focus:outline-none select-all"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentUser.apiKey);
                          setCopiedKey(currentUser.apiKey);
                          setTimeout(() => setCopiedKey(null), 2000);
                        }}
                        className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-lg text-[11px] font-bold text-neutral-300 hover:text-white transition-all flex items-center gap-1.5 whitespace-nowrap"
                      >
                        {copiedKey === currentUser.apiKey ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Key
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-4 text-[11px] text-neutral-400 space-y-2">
                      <p className="font-bold text-neutral-300">How to integrate this API Key into your projects:</p>
                      <div className="bg-neutral-950 border border-neutral-850 rounded-lg p-3 font-mono text-[10px] text-neutral-300 overflow-x-auto select-all leading-normal whitespace-pre">
                        {`curl -X GET "${window.location.origin}/api/download?url=YOUR_VIDEO_URL" \\\n  -H "x-api-key: ${currentUser.apiKey}"`}
                      </div>
                      <p className="text-neutral-500">
                        You can pass it via <code className="text-purple-400 font-mono">x-api-key</code> header or <code className="text-purple-400 font-mono">?key={currentUser.apiKey}</code> query parameter.
                      </p>
                      <div className="bg-purple-950/20 border border-purple-900/30 rounded-xl p-3 text-neutral-300 space-y-1">
                        <div className="font-bold text-purple-300 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                          External Project API Key Limits:
                        </div>
                        <ul className="list-disc pl-4 space-y-0.5 text-neutral-400 font-mono text-[10.5px]">
                          <li>Daily limit: <strong className="text-purple-300">50 requests / day</strong></li>
                          <li>Trial period: <strong className="text-purple-300">7 days</strong> from registration</li>
                          <li>Website limit: <strong className="text-emerald-400 font-bold">Completely UNLIMITED!</strong></li>
                        </ul>
                      </div>
                    </div>
                  </motion.div>
                )}

              </div>

              {/* RIGHT SIDE: Supported Social Media Platforms Grid */}
              <div className="space-y-6">
                
                {/* Visual Platforms Help Card */}
                <div className="bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-md">
                  <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-fuchsia-400" />
                    Supported Social Networks
                  </h3>
                  
                  <div className="space-y-3.5">
                    {PLATFORMS_INFO.map((item) => (
                      <div 
                        key={item.id} 
                        className="p-3 bg-neutral-950/60 hover:bg-neutral-950 border border-neutral-900 hover:border-neutral-800 rounded-2xl flex flex-col gap-2 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.icon}
                            <span className="text-xs font-bold text-white">{item.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleQuickFill(item.sample)}
                            className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1"
                          >
                            <Flame className="h-3 w-3 text-purple-400 animate-pulse" />
                            Test Link
                          </button>
                        </div>
                        <p className="text-[10px] text-neutral-400 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Free self-host warning card */}
                <div className="bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-400" />
                    Bypass & Privacy System
                  </h3>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    By matching and querying Turnstile-free Cobalt directory instances, shadowXdownloding achieves maximum reliability, routing requests directly on server-side proxies.
                  </p>
                </div>

              </div>

            </motion.div>
          ) : (
            
            /* TAB: ADMIN CONTROL PANEL */
            <motion.div
              key="admin-tab"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              
              {/* Statistical Bento Row for Admins */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="bg-neutral-900/40 border border-neutral-900 p-5 rounded-3xl flex items-center gap-4 shadow-xl backdrop-blur-md">
                  <div className="p-3.5 bg-purple-950/40 rounded-2xl border border-purple-800/20 text-purple-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Active Guest Sessions</p>
                    <p className="text-2xl font-black text-white mt-0.5">{stats.totalGuestSessions}</p>
                  </div>
                </div>

                <div className="bg-neutral-900/40 border border-neutral-900 p-5 rounded-3xl flex items-center gap-4 shadow-xl backdrop-blur-md">
                  <div className="p-3.5 bg-fuchsia-950/40 rounded-2xl border border-fuchsia-800/20 text-fuchsia-400">
                    <Download className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Total Downloads</p>
                    <p className="text-2xl font-black text-white mt-0.5">{stats.totalDownloads}</p>
                  </div>
                </div>

                <div className="bg-neutral-900/40 border border-neutral-900 p-5 rounded-3xl flex items-center gap-4 shadow-xl backdrop-blur-md">
                  <div className="p-3.5 bg-emerald-950/40 rounded-2xl border border-emerald-800/20 text-emerald-400">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Bypassed Success</p>
                    <p className="text-2xl font-black text-white mt-0.5">{stats.successfulExtractions} hits</p>
                  </div>
                </div>

                <div className="bg-neutral-900/40 border border-neutral-900 p-5 rounded-3xl flex items-center gap-4 shadow-xl backdrop-blur-md">
                  <div className="p-3.5 bg-rose-950/40 rounded-2xl border border-rose-800/20 text-rose-400">
                    <Gauge className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Success Rate</p>
                    <p className="text-2xl font-black text-white mt-0.5">{stats.successPercentage}%</p>
                  </div>
                </div>

              </div>

              {/* Split Area: User Sessions and Server Log Trace */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* LEFT AREA: Live Request Tracer */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-md">
                    
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <Terminal className="h-5 w-5 text-purple-400" />
                          Live Extraction Logs
                        </h2>
                        <p className="text-neutral-400 text-xs mt-0.5">
                          Real-time stream of bypass calls, Cobalt endpoints tested, and media status outputs.
                        </p>
                      </div>
                      <button
                        onClick={handleClearLogs}
                        disabled={logs.length === 0}
                        className="px-3.5 py-1.5 border border-rose-950/40 hover:border-rose-800 bg-rose-950/10 hover:bg-rose-950/20 text-rose-400 text-xs font-semibold rounded-xl disabled:opacity-50 transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear Database Logs
                      </button>
                    </div>

                    {isLogsLoading && logs.length === 0 ? (
                      <div className="flex items-center justify-center p-12 text-neutral-500 text-xs">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Syncing request database...
                      </div>
                    ) : logs.length === 0 ? (
                      <div className="text-center p-12 border border-dashed border-neutral-850 rounded-2xl">
                        <p className="text-sm text-neutral-400 font-semibold">No requests logged yet</p>
                        <p className="text-xs text-neutral-600 mt-1">
                          Query the downloader to stream active logs.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                        {logs.map((log) => (
                          <div 
                            key={log.id} 
                            className="bg-neutral-950/80 border border-neutral-900 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between hover:border-neutral-850 transition-colors"
                          >
                            <div className="space-y-1 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {log.success ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-full border border-emerald-500/15">
                                    <CheckCircle className="h-3 w-3" />
                                    SUCCESS
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-rose-500/10 text-rose-400 text-[10px] font-bold rounded-full border border-rose-500/15">
                                    <XCircle className="h-3 w-3" />
                                    FAILURE
                                  </span>
                                )}

                                <span className={`text-[10px] px-2.5 py-0.5 font-bold rounded-full border uppercase ${
                                  getPlatformStyling(log.type).bg
                                }`}>
                                  {log.type}
                                </span>

                                <span className="text-xs text-neutral-300 font-bold">
                                  {log.userName}
                                </span>
                              </div>

                              <p className="text-xs text-neutral-300 font-mono break-all mt-2 bg-neutral-900/60 p-2.5 rounded-xl border border-neutral-900">
                                {log.details}
                              </p>

                              {log.url && (
                                <p className="text-[10px] text-neutral-500 flex items-center gap-1 leading-relaxed pt-1">
                                  <span className="font-bold">Resource URL:</span>
                                  <span className="font-mono underline truncate max-w-sm block">{log.url}</span>
                                </p>
                              )}
                            </div>

                            <div className="text-[11px] text-neutral-500 shrink-0 flex items-center gap-1.5 self-end md:self-center font-mono">
                              <Clock className="h-3.5 w-3.5 text-neutral-600" />
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDEBAR: Guest Users & Server Info */}
                <div className="space-y-6">
                  
                  {/* System Hardware Config */}
                  <div className="bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
                    
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <HardDrive className="h-4.5 w-4.5 text-purple-400" />
                      Server Information
                    </h3>

                    <div className="space-y-3.5 text-xs">
                      <div className="flex justify-between border-b border-neutral-900 pb-2">
                        <span className="text-neutral-500">Service Runtime</span>
                        <span className="text-neutral-200 font-mono font-bold">shadowX-core</span>
                      </div>
                      <div className="flex justify-between border-b border-neutral-900 pb-2">
                        <span className="text-neutral-500">Uptime</span>
                        <span className="text-neutral-200 font-mono">
                          {systemStatus ? `${Math.floor(systemStatus.uptime / 60)}m ${Math.floor(systemStatus.uptime % 60)}s` : "Fetching..."}
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-neutral-900 pb-2">
                        <span className="text-neutral-500">Version</span>
                        <span className="text-neutral-200 font-mono">{systemStatus?.version || "2.1.0"}</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="text-neutral-500">Node Environment</span>
                        <span className="text-purple-400 font-mono font-bold">Production</span>
                      </div>
                    </div>
                  </div>

                  {/* Registered Users / Guest Sessions */}
                  <div className="bg-neutral-900/40 border border-neutral-900 rounded-3xl p-6 shadow-xl backdrop-blur-md">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <Users className="h-4.5 w-4.5 text-fuchsia-400" />
                      User & Session Directory ({users.length})
                    </h3>

                    {users.length === 0 ? (
                      <div className="text-center p-6 border border-dashed border-neutral-850 rounded-2xl text-xs text-neutral-500">
                        No active guest sessions registered yet.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                        {users.map((u) => (
                          <div 
                            key={u.id} 
                            className="p-3 bg-neutral-950 border border-neutral-900 rounded-xl space-y-2 hover:border-neutral-800 transition-colors"
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="font-bold text-xs text-white truncate max-w-[120px]" title={u.name}>{u.name}</h4>
                                  <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${
                                    u.role === "admin"
                                      ? "text-purple-400 bg-purple-500/10 border-purple-500/20"
                                      : u.role === "user"
                                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                        : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                  }`}>
                                    {u.role || "guest"}
                                  </span>
                                </div>
                                <span className="text-[9px] text-neutral-500 font-mono">
                                  {u.apiKey.substring(0, 18)}...
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-[10px] text-neutral-400 font-black block">
                                  {u.requestCount} / {u.role === "admin" ? "∞" : (u.downloadLimit || 30)}
                                </span>
                                {u.lastRequestAt && (
                                  <span className="text-[8px] text-purple-400 font-mono">
                                    {new Date(u.lastRequestAt).toLocaleTimeString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              </div>

            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* Immersive Auth Modal */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 bg-neutral-950/95 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-850 rounded-3xl p-6 w-full max-w-md relative overflow-hidden shadow-2xl ring-1 ring-white/5"
            >
              {/* Premium Glow line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />
              
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                    <User className="h-5 w-5 text-purple-400" />
                    {authMode === "login" ? "Account Login" : "Register Account"}
                  </h3>
                  <p className="text-neutral-400 text-xs mt-1">
                    {authMode === "login" 
                      ? "Enter credentials to access professional high-limit downloads" 
                      : "Create a free professional profile to unlock 30 downloads"}
                  </p>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white bg-neutral-950 rounded-xl border border-neutral-800 transition-all"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {authError && (
                <div className="p-3 bg-rose-950/20 border border-rose-850 rounded-2xl text-rose-300 text-xs mb-4">
                  {authError}
                </div>
              )}

              {authSuccess && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-850 rounded-2xl text-emerald-300 text-xs mb-4">
                  {authSuccess}
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === "register" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John Doe"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white w-full focus:outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. you@example.com"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white w-full focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white w-full focus:outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-pink-500 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-lg shadow-purple-500/10 flex items-center justify-center gap-2 mt-2"
                >
                  {authLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : authMode === "login" ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-neutral-800 text-center text-xs">
                {authMode === "login" ? (
                  <p className="text-neutral-400">
                    Don't have an account?{" "}
                    <button
                      onClick={() => setAuthMode("register")}
                      className="text-purple-400 hover:underline font-bold"
                    >
                      Sign Up Free
                    </button>
                  </p>
                ) : (
                  <p className="text-neutral-400">
                    Already have an account?{" "}
                    <button
                      onClick={() => setAuthMode("login")}
                      className="text-purple-400 hover:underline font-bold"
                    >
                      Sign In
                    </button>
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cyberpunk Humble footer */}
      <footer className="mt-20 border-t border-neutral-900 pt-8 text-center">
        <p className="text-[11px] text-neutral-600 font-mono tracking-widest uppercase">
          shadowXdownloding • Multi-Platform High-Speed Extraction Hub
        </p>
      </footer>

    </div>
  );
}
