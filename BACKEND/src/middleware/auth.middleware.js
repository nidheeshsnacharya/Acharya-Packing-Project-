import { verifyToken } from "../utils/adminAuth.js";

/**
 * STEP 1: Check if the user is logged in
 */
export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      code: "UNAUTHORIZED",
      error: "Authentication Required",
      message: "Please log in to access this resource.",
    });
  }

  const token = authHeader.split(" ")[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      error: "Session Expired",
      message: "Your session has expired. Please log in again.",
    });
  }

  req.user = payload; // Attach user data (id, role, shop) to the request
  next();
};

/**
 * STEP 2: Check if the user has the right Role
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    // If the user's role is not in the list we provided in the route
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        status: 403,
        code: "FORBIDDEN_ACCESS",
        error: "Access Restricted",
        message: `You are signed in as '${req.user.role}', but this task requires '${allowedRoles.join(" or ")}' permissions.`,
        suggestion:
          "Please contact your system administrator if you need access.",
      });
    }
    next();
  };
};
