import { Router, Response } from "express";
import { UserModel } from "../models/user";
import { logsDb } from "../config/db";

const router = Router();

/**
 * POST /api/register
 * Register a user and output a secure cobalt-clone API key
 */
router.post("/register", (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email) {
      res.status(400).json({
        success: false,
        error: "Both 'name' and 'email' parameters are required for registration.",
      });
      return;
    }

    const newUser = UserModel.register({ name, email, password });

    // Track this auth registration in logs
    logsDb.add({
      userId: newUser.id,
      userName: newUser.name,
      type: "auth",
      success: true,
      details: `Registered new account (${newUser.role}) for ${newUser.email}`,
    });

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        apiKey: newUser.apiKey,
        role: newUser.role,
        downloadLimit: newUser.downloadLimit,
        dailyRequests: newUser.dailyRequests || 0,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || "Failed to register user.",
    });
  }
});

/**
 * POST /api/login
 * Professional login for normal users and admins
 */
router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: "Both 'email' and 'password' parameters are required for login.",
      });
      return;
    }

    const user = UserModel.login(email, password);

    // Track login in logs
    logsDb.add({
      userId: user.id,
      userName: user.name,
      type: "auth",
      success: true,
      details: `Logged in as ${user.email} (${user.role})`,
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        apiKey: user.apiKey,
        role: user.role,
        downloadLimit: user.downloadLimit,
        dailyRequests: user.dailyRequests || 0,
        requestCount: user.requestCount,
        createdAt: user.createdAt,
      },
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: error.message || "Authentication failed. Invalid email or password.",
    });
  }
});

/**
 * GET /api/users
 * Internal endpoint for the visual dashboard to show registration statistics
 */
router.get("/users", (req, res) => {
  try {
    const users = UserModel.getAllUsers();
    res.json({
      success: true,
      users: users.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        apiKey: u.apiKey,
        role: u.role,
        downloadLimit: u.downloadLimit,
        dailyRequests: u.dailyRequests || 0,
        requestCount: u.requestCount,
        lastRequestAt: u.lastRequestAt,
        createdAt: u.createdAt,
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: "Failed to retrieve user registrations.",
    });
  }
});

export default router;
