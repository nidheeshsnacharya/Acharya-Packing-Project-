import jwt from "jsonwebtoken";

const getSecret = () => {
  const secret = process.env.ADMIN_TOKEN_SECRET;
  if (!secret)
    throw new Error("CRITICAL: ADMIN_TOKEN_SECRET is missing in .env");
  return secret;
};

export const createToken = (payload, expiresIn = "12h") => {
  return jwt.sign(payload, getSecret(), { expiresIn });
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, getSecret());
  } catch (error) {
    return null; // Invalid or expired
  }
};
