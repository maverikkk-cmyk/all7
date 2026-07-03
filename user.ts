import { User, usersDb } from "../config/db";
import { generateApiKey } from "../utils/keygen";

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  role?: "admin" | "user" | "guest";
}

export const UserModel = {
  /**
   * Register a new user and generate their unique API key
   */
  register: (input: CreateUserInput): User => {
    // Validate inputs
    if (!input.name || !input.email) {
      throw new Error("Name and email are required to register.");
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(input.email)) {
      throw new Error("Please provide a valid email address.");
    }

    // Check if user already exists
    const existing = usersDb.getByEmail(input.email);
    if (existing) {
      throw new Error("An account with this email already exists.");
    }

    // Generate API key and create user
    const apiKey = generateApiKey();
    const role = input.role || "user";
    const downloadLimit = role === "admin" ? 999999 : 38; // 38 daily download limit for registered free users

    const newUser = usersDb.create({
      id: `usr_${Math.random().toString(36).substr(2, 9)}`,
      name: input.name,
      email: input.email.toLowerCase(),
      apiKey,
      role,
      password: input.password,
      downloadLimit,
    });

    return newUser;
  },

  /**
   * Login helper
   */
  login: (email: string, password?: string): User => {
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    const user = usersDb.getByEmail(email);
    if (!user) {
      throw new Error("Invalid email or password.");
    }

    if (user.password !== password) {
      throw new Error("Invalid email or password.");
    }

    return user;
  },

  /**
   * Find a user by their API key
   */
  findByApiKey: (apiKey: string): User | undefined => {
    return usersDb.getByApiKey(apiKey);
  },

  /**
   * Get all registered users (useful for the dashboard stats)
   */
  getAllUsers: (): User[] => {
    return usersDb.getAll();
  }
};
