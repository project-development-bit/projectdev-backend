const TwoFAModel = require("../models/twofa.model");
const HttpException = require("../utils/HttpException.utils");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const { validationResult } = require("express-validator");

/******************************************************************************
 *                              2FA Controller
 ******************************************************************************/
class TwoFAController {

 //Setup 2FA - Generate secret and QR code

  setup2FA = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;
      const userEmail = req.currentUser.email;

      // Check if 2FA is already enabled
      const user = await TwoFAModel.findUserById(userId);
      if (user && user.twofa_enabled) {
        throw new HttpException(
          400,
          "2FA is already enabled for this account.",
          "2FA_ALREADY_ENABLED"
        );
      }

      // Generate secret
      const secret = speakeasy.generateSecret({
        name: `Gigafaucet (${userEmail})`,
        issuer: "Gigafaucet",
        length: 12,
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      res.status(200).json({
        success: true,
        message: "2FA setup initiated. Scan the QR code with your authenticator app.",
        data: {
          secret: secret.base32,
          qrCode: qrCodeUrl,
          otpauthUrl: secret.otpauth_url,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Verify and Enable 2FA
  verify2FA = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const userId = req.currentUser.id;
      const { token, secret } = req.body;

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: secret,
        encoding: "base32",
        token: token,
        window: 3, // Allow 3 time steps before/after for clock skew
      });

      if (!verified) {
        throw new HttpException(
          400,
          "Invalid verification code. Please try again.",
          "INVALID_2FA_TOKEN"
        );
      }

      // Enable 2FA for the user
      await TwoFAModel.enable2FA(userId, secret);

      res.status(200).json({
        success: true,
        message: "2FA has been successfully enabled for your account.",
        data: {
          twofa_enabled: true,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Verify 2FA during login
  verifyLogin2FA = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { userId, token } = req.body;

      // Get user's 2FA secret and full user info
      const user = await TwoFAModel.get2FASecret(userId);

      if (!user || !user.twofa_secret) {
        throw new HttpException(
          400,
          "2FA is not enabled for this account.",
          "2FA_NOT_ENABLED"
        );
      }

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: user.twofa_secret,
        encoding: "base32",
        token: token,
        window: 2,
      });

      if (!verified) {
        throw new HttpException(
          401,
          "Invalid 2FA code. Please try again.",
          "INVALID_2FA_TOKEN"
        );
      }

      // Generate tokens after successful 2FA verification
      const UserModel = require("../models/user.model");
      const { generateAccessToken, generateRefreshToken } = require("../utils/token.utils");

      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken(user);

      // Save refresh token to database
      await UserModel.refreshToken({
        refreshToken,
        userID: user.id,
      });

      const tokens = {
        accessToken,
        refreshToken,
        tokenType: "Bearer",
        accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
        refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
      };

      res.status(200).json({
        success: true,
        message: "2FA verification successful.",
        data: {
          verified: true,
          tokens: tokens,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Disable 2FA
  disable2FA = async (req, res, next) => {
    try {
      this.checkValidation(req);
      const userId = req.currentUser.id;

      // Get user's 2FA secret
      const user = await TwoFAModel.get2FASecret(userId);

      if (!user || !user.twofa_secret) {
        throw new HttpException(
          400,
          "2FA is not enabled for this account.",
          "2FA_NOT_ENABLED"
        );
      }

      // Disable 2FA
      await TwoFAModel.disable2FA(userId);

      res.status(200).json({
        success: true,
        message: "2FA has been successfully disabled for your account.",
        data: {
          twofa_enabled: false,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Get 2FA status
  get2FAStatus = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;

      const status = await TwoFAModel.check2FAStatus(userId);

      if (!status) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      res.status(200).json({
        success: true,
        data: {
          twofa_enabled: Boolean(status.twofa_enabled),
        },
      });
    } catch (error) {
      next(error);
    }
  };


  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(
        400,
        "Validation failed. Please check your input fields.",
        errors
      );
    }
  };

  generate2FAData = async (secret, email) => {
    try {
      // Generate otpauth URL using speakeasy
      const otpauthUrl = speakeasy.otpauthURL({
        secret: secret,
        label: `Gigafaucet (${email})`,
        issuer: "Gigafaucet",
        encoding: "base32"
      });

      // Generate QR code from otpauth URL
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

      return {
        twofa_secret: secret,
        otpauth_url: otpauthUrl,
        qrCode: qrCodeDataUrl
      };
    } catch (error) {
      throw new HttpException(
        500,
        "Error generating 2FA data",
        "2FA_GENERATION_ERROR"
      );
    }
  };
}

module.exports = new TwoFAController();
