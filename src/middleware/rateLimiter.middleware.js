const rateLimit = require("express-rate-limit");

// Rate limiter for 2FA verification during login
// Limits based on userId from request body
const twoFALoginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each user to 5 requests per windowMs
  message: {
    success: false,
    message: "Too many 2FA verification attempts. Please try again later.",
    error: "TOO_MANY_ATTEMPTS",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use userId from request body as the key
  keyGenerator: (req) => {
    return req.body.userId || req.ip;
  },
  // Skip successful requests from counting against the limit
  skipSuccessfulRequests: false,
  // Skip failed requests from counting against the limit
  skipFailedRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many 2FA verification attempts. Please try again after 5 minutes.",
      error: "TOO_MANY_ATTEMPTS",
    });
  },
});

// Rate limiter for 2FA setup/verify (when enabling 2FA)
// This is less restrictive since it requires authentication
const twoFASetupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Allow more attempts for setup since user is authenticated
  message: {
    success: false,
    message: "Too many 2FA setup attempts. Please try again later.",
    error: "TOO_MANY_ATTEMPTS",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use authenticated user's ID as the key
    return req.currentUser?.id?.toString() || req.ip;
  },
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many 2FA setup attempts. Please try again after 5 minutes.",
      error: "TOO_MANY_ATTEMPTS",
    });
  },
});

module.exports = {
  twoFALoginLimiter,
  twoFASetupLimiter,
};
