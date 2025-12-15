const rateLimit = require("express-rate-limit");

function keyByUserOrIp(req) {
  if (req.currentUser?.id) return `uid:${req.currentUser.id}`;
  if (req.body?.email)
    return `email:${req.body.email}|ip:${rateLimit.ipKeyGenerator(req)}`;
  return `ip:${rateLimit.ipKeyGenerator(req)}`;
}

// Generic rate limiter creator
function createRateLimiter(options) {
  const defaults = {
    keyGenerator: (req) =>
      req.currentUser?.id
        ? `uid:${req.currentUser.id}`
        : `ip:${rateLimit.ipKeyGenerator(req)}`,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: options.message || "Too many requests. Please try again later.",
        error: "RATE_LIMIT_EXCEEDED",
      });
    },
  };

  return rateLimit({ ...defaults, ...options });
}

// Rate limiter for 2FA verification during login
const twoFALoginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each user to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: keyByUserOrIp,
  // Skip successful requests - only count failures
  skipSuccessfulRequests: true,
  skipFailedRequests: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Too many 2FA verification attempts. Please try again after 5 minutes.",
      error: "TOO_MANY_ATTEMPTS",
    });
  },
});

// Rate limiter for 2FA setup/verify (when enabling 2FA)
// This is less restrictive since it requires authentication
const twoFASetupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Allow more attempts for setup since user is authenticated
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.currentUser?.id
      ? `uid:${req.currentUser.id}`
      : `ip:${rateLimit.ipKeyGenerator(req)}`,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many 2FA setup attempts. Please try again after 5 minutes.",
      error: "TOO_MANY_ATTEMPTS",
    });
  },
});

// Rate limiter for wallet balances
// 60 requests per minute per user
const walletBalancesLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.currentUser?.id
      ? `wallet:uid:${req.currentUser.id}`
      : `wallet:ip:${rateLimit.ipKeyGenerator(req)}`,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many requests. Please try again after 1 minute.",
      error: "RATE_LIMIT_EXCEEDED",
    });
  },
});

// Rate limiter for email change
// 3 requests per hour per user
const emailChangeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 requests per hour per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.currentUser?.id
      ? `emailchange:uid:${req.currentUser.id}`
      : `emailchange:ip:${rateLimit.ipKeyGenerator(req)}`,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: "Too many email change requests. Please try again after 1 hour.",
      error: "EMAIL_CHANGE_RATE_LIMIT_EXCEEDED",
    });
  },
});

// Rate limiter for password change
// 5 requests per 15 minutes per user
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per 15 minutes per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.currentUser?.id
      ? `pwdchange:uid:${req.currentUser.id}`
      : `pwdchange:ip:${rateLimit.ipKeyGenerator(req)}`,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message:
        "Too many password change attempts. Please try again after 15 minutes.",
      error: "PASSWORD_CHANGE_RATE_LIMIT_EXCEEDED",
    });
  },
});

module.exports = {
  createRateLimiter,
  twoFALoginLimiter,
  twoFASetupLimiter,
  walletBalancesLimiter,
  emailChangeLimiter,
  passwordChangeLimiter,
};
