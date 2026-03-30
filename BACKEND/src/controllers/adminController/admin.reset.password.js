import crypto from "crypto";
import { Admin } from "../../models/admin.model.js"; // Ensure path is correct
import { sendPasswordResetEmail } from "../../services/email.service.js";

/**
 * 🔑 Helper: Generate a secure random password
 */
const generateSecurePassword = () => {
  const length = 12;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }
  return password;
};

/**
 * 🕒 Helper: Simple in-memory rate limiting
 */
const resetAttempts = new Map();

const checkRateLimit = (email) => {
  const now = Date.now();
  const attempts = resetAttempts.get(email) || [];
  const recentAttempts = attempts.filter((time) => now - time < 3600000); // 1 hour

  if (recentAttempts.length >= 2) return false;

  recentAttempts.push(now);
  resetAttempts.set(email, recentAttempts);
  return true;
};

/**
 * 🔐 POST /api/auth/reset-password
 * Public endpoint to reset password
 */
export const resetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. Validate Input
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // 2. Rate Limiting
    if (!checkRateLimit(normalizedEmail)) {
      return res.status(429).json({
        success: false,
        error: "Too many attempts. Please try again in an hour.",
      });
    }

    // 3. Find User
    const user = await Admin.findOne({
      email: normalizedEmail,
      is_active: true,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "No active account found with this email address",
      });
    }

    // 4. Generate & Update Password
    const newPassword = generateSecurePassword();

    // We set the plain text; your Mongoose pre-save hook handles hashing
    user.password = newPassword;
    user.must_change_password = true;
    await user.save();

    // 5. Send Email
    await sendPasswordResetEmail(normalizedEmail, newPassword, user.role);

    console.log(`✅ Password reset: ${normalizedEmail} (${user.role})`);

    return res.status(200).json({
      success: true,
      message: "Success! Please check your email for the new password.",
    });
  } catch (error) {
    console.error("❌ Reset Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: "Failed to reset password. Contact support if this continues.",
    });
  }
};
