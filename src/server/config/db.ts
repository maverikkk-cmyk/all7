import fs from "fs";
import path from "path";

// Define the DB file path
const DB_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DB_DIR, "db.json");

export interface User {
  id: string;
  name: string;
  email: string;
  apiKey: string;
  createdAt: string;
  requestCount: number;
  lastRequestAt?: string;
  role: "admin" | "user" | "guest";
  password?: string;
  downloadLimit: number; // Maximum downloads allowed
  dailyRequests?: number;
}

export interface RequestLog {
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

export interface DbSchema {
  users: User[];
  logs: RequestLog[];
}

const defaultDb: DbSchema = {
  users: [
    {
      id: "usr_admin_main",
      name: "Super Admin",
      email: "sm0247415@gmail.com",
      password: "8013381172",
      apiKey: "shadow_admin_sm0247415",
      createdAt: new Date().toISOString(),
      requestCount: 0,
      role: "admin",
      downloadLimit: 999999,
    }
  ],
  logs: [],
};

// Initialize DB directory and file
export function initDb() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2), "utf-8");
  } else {
    // Ensure our specific main admin exists with exact details requested by the user
    try {
      const content = fs.readFileSync(DB_FILE, "utf-8");
      const db = JSON.parse(content) as DbSchema;
      const hasMainAdmin = db.users.some(u => u.email.toLowerCase() === "sm0247415@gmail.com");
      if (!hasMainAdmin) {
        db.users.push({
          id: "usr_admin_main",
          name: "Super Admin",
          email: "sm0247415@gmail.com",
          password: "8013381172",
          apiKey: "shadow_admin_sm0247415",
          createdAt: new Date().toISOString(),
          requestCount: 0,
          role: "admin",
          downloadLimit: 999999,
        });
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
      }
    } catch (e) {
      console.error("Failed to ensure main admin exists:", e);
    }
  }
}

// Read database
export function readDb(): DbSchema {
  try {
    initDb();
    const content = fs.readFileSync(DB_FILE, "utf-8");
    const db = JSON.parse(content) as DbSchema;
    
    // Fallback/Ensure roles and download limits on any existing parsed users for backwards compatibility
    let dirty = false;
    db.users = db.users.map(u => {
      if (!u.role) {
        u.role = u.email.toLowerCase() === "sm0247415@gmail.com" ? "admin" : "user";
        dirty = true;
      }
      if (u.downloadLimit === undefined || u.downloadLimit === 30) {
        u.downloadLimit = u.role === "admin" ? 999999 : (u.role === "guest" ? 5 : 38);
        dirty = true;
      }
      if (u.dailyRequests === undefined) {
        u.dailyRequests = 0;
        dirty = true;
      }
      return u;
    });

    if (dirty) {
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    }

    return db;
  } catch (error) {
    console.error("Failed to read JSON database, resetting to default:", error);
    return defaultDb;
  }
}

// Write database
export function writeDb(data: DbSchema) {
  try {
    initDb();
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to write to JSON database:", error);
  }
}

// CRUD helper functions for Users
export const usersDb = {
  getAll: (): User[] => {
    return readDb().users;
  },
  
  getByApiKey: (apiKey: string): User | undefined => {
    const db = readDb();
    return db.users.find((u) => u.apiKey === apiKey);
  },

  getByEmail: (email: string): User | undefined => {
    const db = readDb();
    return db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },

  create: (user: Omit<User, "requestCount" | "createdAt" | "downloadLimit"> & { downloadLimit?: number }): User => {
    const db = readDb();
    const newUser: User = {
      ...user,
      role: user.role || "user",
      downloadLimit: user.downloadLimit !== undefined ? user.downloadLimit : (user.role === "admin" ? 999999 : (user.role === "guest" ? 5 : 38)),
      requestCount: 0,
      dailyRequests: 0,
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    writeDb(db);
    return newUser;
  },

  incrementRequests: (apiKey: string) => {
    const db = readDb();
    const index = db.users.findIndex((u) => u.apiKey === apiKey);
    if (index !== -1) {
      const u = db.users[index];
      const now = new Date();
      const lastReq = u.lastRequestAt ? new Date(u.lastRequestAt) : null;
      
      const isNewDay = !lastReq || 
        (now.getUTCDate() !== lastReq.getUTCDate() || 
         now.getUTCMonth() !== lastReq.getUTCMonth() || 
         now.getUTCFullYear() !== lastReq.getUTCFullYear()) ||
        ((now.getTime() - lastReq.getTime()) >= 24 * 60 * 60 * 1000);

      if (isNewDay) {
        u.dailyRequests = 1;
      } else {
        u.dailyRequests = (u.dailyRequests || 0) + 1;
      }
      u.requestCount += 1;
      u.lastRequestAt = now.toISOString();
      writeDb(db);
    }
  }
};

// CRUD helper functions for Logs
export const logsDb = {
  getAll: (): RequestLog[] => {
    return readDb().logs;
  },

  add: (log: Omit<RequestLog, "id" | "timestamp">): RequestLog => {
    const db = readDb();
    const newLog: RequestLog = {
      ...log,
      id: `log_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
    };
    // Keep logs list bounded to last 200 entries to prevent memory/file bloating
    db.logs.unshift(newLog);
    if (db.logs.length > 200) {
      db.logs = db.logs.slice(0, 200);
    }
    writeDb(db);
    return newLog;
  },

  clear: () => {
    const db = readDb();
    db.logs = [];
    writeDb(db);
  }
};
