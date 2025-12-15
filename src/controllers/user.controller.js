const UserModel = require("../models/user.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const BalanceModel = require('../models/balance.model');
const CountryModel = require("../models/country.model");

const {
  uploadImageToS3,
  deleteImageFromS3,
  validateImageFile,
} = require("../utils/imageUpload.utils");
dotenv.config();

const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/token.utils");

const { generateUniqueReferralCode } = require("../utils/referral.utils");
const ReferralModel = require("../models/referral.model");
const referralConfig = require("../config/referral.config");
const { getUserLevelConfig } = require("../config/rewards.config");
const { computeUserLevelState } = require("../services/rewards.service");

/******************************************************************************
 *                              User Controller
 ******************************************************************************/
class UserController {
  getAllUsers = async (req, res, next) => {
    let userList = await UserModel.find();
    if (!userList.length) {
      throw new HttpException(404, "Users not found");
    }

    userList = userList.map((user) => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    res.send(userList);
  };

  acceptTerms = async (req, res, next) => {
    this.checkValidation(req);

    const result = await UserModel.updateTerms(req.body, req.params.email);

    if (!result) {
      throw new HttpException(404, "Something went wrong");
    }

    const { affectedRows, changedRows, info } = result;

    const message = !affectedRows
      ? "User not found"
      : affectedRows && changedRows
      ? "Terms & Conditions updated successfully"
      : "Updated faild";

    res.send({ message, info });
  };

  getUserById = async (req, res, next) => {
    const user = await UserModel.findOne({ id: req.params.id }, true); // Include profile
    if (!user) {
      throw new HttpException(404, "User not found");
    }

    const { password, ...userWithoutPassword } = user;

    res.send(userWithoutPassword);
  };

  getUserByuserName = async (req, res, next) => {
    const user = await UserModel.findOne({ name: req.params.username }, true); // Include profile
    if (!user) {
      throw new HttpException(404, "User not found");
    }

    const { password, ...userWithoutPassword } = user;

    res.send(userWithoutPassword);
  };

  getCurrentUser = async (req, res, next) => {
    const { password, security_pin_enabled, ...userWithoutPassword } = req.currentUser;

    // Get user's XP and compute level state
    const userData = await UserModel.getUserXp(userWithoutPassword.id);
    const currentXp = userData?.xp || 0;
    const userLevelState = computeUserLevelState(currentXp);

    // Get user's COIN balance
    const coinBalance = await BalanceModel.getBalanceByCurrency(userWithoutPassword.id, 'COIN');

    // Get country name if country_id exists
    let country_name = null;
    if (userWithoutPassword.country_id) {
      const profileData = await UserModel.getProfileWithCountry(userWithoutPassword.id);
      country_name = profileData?.country_name || null;
    }

    res.send({
      ...userWithoutPassword,
      country_name,
      current_status: userLevelState.user_level_state.current_status,
      coin_balance: coinBalance ? coinBalance.available : 0,
      security_pin_required: security_pin_enabled
    });
  };

  createUser = async (req, res, next) => {
    try {
      this.checkValidation(req);
      await this.hashPassword(req);

      // Handle country_code if provided
      let countryId = null;
      if (req.body.country_code) {
        const country = await CountryModel.findByCode(req.body.country_code);
        if (country) {
          countryId = country.id;
          req.body.country_id = countryId;
        }
      }

      // Handle referral code if provided
      let referrerId = null;
      if (req.body.referral_code) {
        const referrer = await ReferralModel.getUserByReferralCode(
          req.body.referral_code
        );
        if (referrer) {
          referrerId = referrer.id;
          req.body.referred_by = referrerId;
        }
      }

      const userData = await this.saveNewUser(req);

      // Create referral relationship if user was referred
      if (referrerId) {
        await ReferralModel.createReferralRelationship(referrerId, userData.id);
        await ReferralModel.updateUserReferredBy(userData.id, referrerId);
      }

      const sendEmailResult = await this.sendRegistrationEmail(
        req,
        res,
        next,
        userData.name,
        "",
        userData.email,
        userData.securityCode,
        "register"
      );

      if (!sendEmailResult) {
        throw new HttpException(
          500,
          "Something went wrong when sending email notification"
        );
      }

      res.status(201).json({
        success: true,
        message: "User was created successfully.",
        data: {
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          referralCode: userData.referralCode,
          referredBy: referrerId,
        },
      });
    } catch (error) {
      // Handle duplicate email error
      if (error.code === "ER_DUP_ENTRY") {
        return next(
          new HttpException(
            409,
            "An account with this email already exists. Please use a different email or try logging in.",
            "EMAIL_ALREADY_EXISTS"
          )
        );
      }
      next(error);
    }
  };

  updateUser = async (req, res, next) => {
    this.checkValidation(req);

    await this.hashPassword(req);
    console.log("Update Request Body: ", req.body);

    // Define allowed fields for update
    const allowedFields = [
      "name",
      "country_id",
      "language",
      "notifications_enabled",
      "show_stats_enabled",
      "anonymous_in_contests",
      "security_pin_enabled",
      "interest_enable",
      "show_onboarding",
    ];

    // Filter request body to only include allowed fields
    const { confirm_password, ...restOfUpdates } = req.body;
    const filteredUpdates = {};

    Object.keys(restOfUpdates).forEach((key) => {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = restOfUpdates[key];
      }
    });

    // Check if there are any valid fields to update
    if (Object.keys(filteredUpdates).length === 0) {
      throw new HttpException(400, "No valid fields provided for update");
    }

    // do the update query and get the result
    // it can be partial edit
    const result = await UserModel.update(filteredUpdates, req.params.id);

    if (!result) {
      throw new HttpException(500, "Something went wrong");
    }

    const { affectedRows, changedRows } = result;

    if (!affectedRows) {
      throw new HttpException(404, "User not found");
    }

    const message =
      affectedRows && changedRows
        ? "User updated successfully"
        : "No changes made";

    res.status(200).json({
      success: true,
      message: message,
    });
  };

  deleteUser = async (req, res, next) => {
    try {
      const userId = req.params.id;
      const currentUser = req.currentUser;

      // Check if user is trying to delete their own account or is an admin
      if (currentUser.id !== parseInt(userId) && currentUser.role !== 'Admin') {
        throw new HttpException(
          403,
          "You can only delete your own account.",
          "FORBIDDEN"
        );
      }

      // Get user data
      const user = await UserModel.findOne({ id: userId });
      if (!user) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      // User must have a verified account
      if (user.is_verified !== 1) {
        throw new HttpException(
          403,
          "Your account must be verified to delete it.",
          "UNVERIFIED_ACCOUNT"
        );
      }

      // Generate verification code
      const verificationCode = this.securityCode();

      // Store verification code in security_code field
      const result = await UserModel.savePassword(
        { email: user.email },
        { securityCode: verificationCode }
      );

      if (!result) {
        throw new HttpException(500, "Something went wrong");
      }

      // Send verification email
      const sendEmailResult = await this.sendDeleteAccountEmail(
        req,
        res,
        next,
        user.name || "User",
        user.email,
        verificationCode
      );

      if (!sendEmailResult) {
        throw new HttpException(
          500,
          "Something went wrong when sending email verification"
        );
      }

      res.status(200).json({
        success: true,
        message: "Verification code sent to your email address. Please check your inbox and use the verify endpoint to complete account deletion.",
        data: {
          email: user.email,
          verification_code: verificationCode, // For testing, remove in production
        },
      });
    } catch (error) {
      next(error);
    }
  };

  userLogin = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { email, password: pass } = req.body;

      const user = await this.checkUserExists(email);

      const hashedPassword = Buffer.isBuffer(user.password)
        ? user.password.toString()
        : user.password;

      const ok = await bcrypt.compare(pass, hashedPassword);
      if (!ok) {
        throw new HttpException(401, "Invalid password", "INVALID_CREDENTIALS");
      }

      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        twofa_enabled: user.twofa_enabled,
        interest_enable: user.interest_enable,
        show_onboarding: user.show_onboarding,
      };

      // If 2FA is enabled, return only userId without tokens
      if (user.twofa_enabled === 1) {
        return res.status(200).json({
          success: true,
          message: "Login successful.",
          userId: user.id,
        });
      }

      // For users without 2FA, generate and return tokens
      const tokens = await this.generateToken(user, req);

      res.status(200).json({
        success: true,
        message: "Login successful.",
        data: {
          user: userData,
          tokens: tokens,
        },
      });
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req, res, next) => {
    this.checkForgotPassword(req);

    const user = await UserModel.checkEmail(req.body);

    if (!user) {
      throw new HttpException(
        401,
        "Your Email is incorrect. Please try again.",
        "INVALID_EMAIL"
      );
    }

    const securityCode = this.securityCode();

    const result = await UserModel.savePassword(req.body, {
      securityCode: securityCode,
    });

    if (!result) {
      throw new HttpException(500, "Something went wrong");
    }

    const sendEmailResult = await this.sendRegistrationEmail(
      req,
      res,
      next,
      user.name,
      "",
      req.body.email,
      securityCode,
      "forgot_password"
    );

    if (!sendEmailResult) {
      throw new HttpException(
        500,
        "Something went wrong when sending email notification",
        "EMAIL_NOT_SENT"
      );
    }

    // res.status(201).send("Reset password is completed!");
    res.status(201).json({
      success: true,
      message: "Requested code successfully",
      data: {
        email: req.body.email,
        securityCode: securityCode,
      },
    });
  };

  savePassword = async (req, res, next) => {
    this.checkConfirmPassword(req);

    // Allow password reset even if account is not verified
    const user = await this.checkUserExists(req.body.email, true);

    if (!user) {
      throw new HttpException(401, "Something went wrong", "INVALID_REQUEST");
    }

    await this.hashPassword(req);

    const result = await UserModel.updatePassword({
      email: req.body.email,
      password: req.body.password,
    });

    if (!result) {
      throw new HttpException(500, "Something went wrong");
    }

    // Only generate tokens if account is verified
    if (user.is_verified === 1) {
      const tokens = await this.generateToken(user, req);

      res.status(201).json({
        success: true,
        message: "Password was saved successfully!",
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            interest_enable: user.interest_enable,
            show_onboarding: user.show_onboarding,
          },
          tokens: tokens,
        },
      });
    } else {
      // Account not verified yet, don't return tokens
      res.status(201).json({
        success: true,
        message:
          "Password was saved successfully! Please verify your account to login.",
        data: {
          email: user.email,
          isVerified: false,
        },
      });
    }
  };

  securityCode = () => {
    const min = 1000;
    const max = 9999;
    const generateSecurityCode =
      Math.floor(Math.random() * (max - min + 1)) + min;

    return generateSecurityCode;
  };

  saveNewUser = async (req) => {
    const securityCode = this.securityCode();
    const referralCode = await generateUniqueReferralCode();

    const userData = await UserModel.create(req.body, {
      securityCode: securityCode,
      referralCode: referralCode,
    });

    if (!userData) {
      throw new HttpException(500, "Something went wrong");
    }

    return userData;
  };

  checkUserExists = async (email, no_verify = false) => {
    const user = await UserModel.findOne({ email });

    if (!user) {
      throw new HttpException(
        401,
        "Your email is incorrect. Please try again.",
        "INVALID_EMAIL"
      );
    }

    if (user.is_banned === 1) {
      throw new HttpException(
        401,
        "Your account is banned. Please contact support.",
        "BANNED_ACCOUNT"
      );
    }

    if (!no_verify && user.is_verified !== 1) {
      throw new HttpException(
        401,
        "Your account isn't verified.",
        "UNVERIFIED_ACCOUNT"
      );
    }

    return user;
  };

  generateToken = async (user, req = null) => {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const loginIp = req?.ip ?? req?.connection?.remoteAddress ?? null;
    const deviceFp = req?.body?.device_fingerprint ?? null;

    await UserModel.refreshToken({
      refreshToken,
      userID: user.id,
      loginIp,
      deviceFp,
    });

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m",
      refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
    };
  };

  sendRegistrationEmail = async (
    req,
    res,
    next,
    memberName,
    surname,
    recieverEmail,
    securityCode,
    type
  ) => {
    const transporter = nodemailer.createTransport({
      // host: process.env.EMAIL_HOST,
      // port: process.env.EMAIL_PORT,
      host: process.env.MAIL_NO_REPLY_HOST,
      port: process.env.MAIL_NO_REPLY_PORT,
      secure: true, // true for 465, false for other ports
      auth: {
        // login info
        user: process.env.EMAIL_USERNAME, // email user
        pass: process.env.EMAIL_PASSWORD, // email password

        // user: process.env.MAIL_NO_REPLY_USERNAME, // email user
        // pass: process.env.MAIL_NO_REPLY_PASSWORD, // email password // email user
      },
    });

    let subject = "";
    let html = "";

    if (type == "register") {
      subject = "Gigafaucet Accoount Registration";
      html =
        `<div>` +
        "Dear " +
        memberName +
        " " +
        surname +
        ",<br /><br />" +
        "Thank you for signing up for our service." +
        "<br/><br/>" +
        `Please use the following verification code: <br /><b><font style="font-size: 25px;">` +
        securityCode +
        `</font></b><br/><br/>` +
        "Yours Sincerely,<br/>" +
        "Gigafaucet Team<br/><br/>" +
        // `<img src="https://www.lumahealth.com/wp-content/uploads/2017/09/logo.png" width="90px"/><br><br>` +
        "<b>Gifafaucet</b><br/>" +
        `95/87, Moo 7, Soi Saiyuan,<br/>` +
        `A.Mueang, T.Rawai, Phuket, 83130<br/>` +
        // `Lumpini, Pathumwan, Bangkok, Thailand 10330<br/>` +
        // `Tel. +66 2 494 3600<br/>` +
        // `Email: cs@lumahealth.com<br/>` +
        "<div>" +
        // + "<br/><br/><br/><hr/>test server : "
        // + process.env.MAIL_NO_REPLY_SERVER_SEND
        "<br/><hr/>";
    } else {
      subject = "Forgot Password Request - Gigafaucet";
      html =
        `<div>` +
        "Dear " +
        memberName +
        " " +
        surname +
        ",<br /><br />" +
        "We received a request to reset your Gigafaucet account password." +
        "<br/><br/>" +
        `Please use the following verification code: <br /><b><font style="font-size: 25px;">` +
        securityCode +
        `</font></b><br/><br/>` +
        "If you did not make a request to reset your password," +
        // "<br/>" +
        " it is possible that someone else is trying to access " +
        // "<br/>" +
        `your Gigafaucet Account <a href="mailto:` +
        recieverEmail +
        `">` +
        recieverEmail +
        `</a>.` +
        // "<br/>" +
        " If so, please ignore and do not forward this message to anyone." +
        "<br/><br/>" +
        "Yours Sincerely,<br/>" +
        "Gigafaucet Team<br/><br/>" +
        // `<img src="https://www.lumahealth.com/wp-content/uploads/2017/09/logo.png" width="90px"/><br><br>` +
        "<b>Gigafaucet</b><br/>" +
        `95/87, Moo 7, Soi Saiyuan,<br/>` +
        `A.Mueang, T.Rawai, Phuket, 83130<br/>` +
        // `Lumpini, Pathumwan, Bangkok, Thailand 10330<br/>` +
        // `Tel. +66 2 494 3600<br/>` +
        // `Email: cs@lumahealth.com<br/>` +
        "<div>" +
        // + "<br/><br/><br/><hr/>test server : "
        // + process.env.MAIL_NO_REPLY_SERVER_SEND
        "<br/><hr/>";
    }

    const info = await transporter.sendMail({
      // from: process.env.EMAIL_FROM, // sender email
      from: '"Gigafaucet" <projectdev.bit@gmail.com>',
      to: recieverEmail, // reciever email by ,(Comma)
      subject: subject, // email subject
      text: "(TESTING) test noti member portal", // plain text body
      html: html, // html body
    });

    console.log("Request : %s", JSON.stringify(req.body));
    console.log("Message sent: %s", info.messageId);

    return true;
  };

  sendEmailChangeVerification = async (
    req,
    res,
    next,
    memberName,
    newEmail,
    securityCode,
    currentEmail
  ) => {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_NO_REPLY_HOST,
      port: process.env.MAIL_NO_REPLY_PORT,
      secure: true,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const subject = "Email Change Verification - Gigafaucet";
    const html =
      `<div>` +
      "Dear " +
      memberName +
      ",<br /><br />" +
      "We received a request to change your email address from <b>" +
      currentEmail +
      "</b> to <b>" +
      newEmail +
      "</b>." +
      "<br/><br/>" +
      `Please use the following verification code to complete the email change: <br /><b><font style="font-size: 25px;">` +
      securityCode +
      `</font></b><br/><br/>` +
      "If you did not make this request, please ignore this email and your email address will remain unchanged." +
      "<br/><br/>" +
      "Yours Sincerely,<br/>" +
      "Gigafaucet Team<br/><br/>" +
      "<b>Gigafaucet</b><br/>" +
      `95/87, Moo 7, Soi Saiyuan,<br/>` +
      `A.Mueang, T.Rawai, Phuket, 83130<br/>` +
      "<div>" +
      "<br/><hr/>";

    const info = await transporter.sendMail({
      from: '"Gigafaucet" <projectdev.bit@gmail.com>',
      to: newEmail, // Send to NEW email address
      subject: subject,
      text: "(TESTING) Email change verification",
      html: html,
    });

    console.log("Email change verification sent: %s", info.messageId);

    return true;
  };

  verifyUser = async (req, res) => {
    this.checkValidation(req);

    const verification = await UserModel.checkSecurityCode({
      email: req.body.email,
      security_code: req.body.security_code,
    });

    if (!verification) {
      throw new HttpException(
        404,
        "Verification code does not match.",
        "INVALID_CODE"
      );
    } else {
      await UserModel.updateRegistrationStatus(req.body.email);
    }

    const user = await this.checkUserExists(req.body.email);

    const tokens = await this.generateToken(user, req);

    res.status(200).json({
      success: true,
      message: "Verified successfully.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          interest_enable: user.interest_enable,
          show_onboarding: user.show_onboarding,
        },
        tokens: tokens,
      },
    });
  };

  verifyForgotPasswordCode = async (req, res) => {
    this.checkValidation(req);

    const verification = await UserModel.checkSecurityCode({
      email: req.body.email,
      security_code: req.body.security_code,
    });

    if (!verification) {
      throw new HttpException(
        404,
        "Verification code does not match.",
        "INVALID_CODE"
      );
    }

    // Don't update registration status for forgot password flow
    // Just verify the code is valid

    res.status(200).json({
      success: true,
      message: "Verification code is valid.",
      data: {
        email: req.body.email,
        verified: true,
      },
    });
  };

  resendVerificationCode = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const userData = await this.checkUserExists(req.body.email, true);

      if (userData.is_verified === 1) {
        throw new HttpException(
          400,
          "Account is already verified.",
          "ALREADY_VERIFIED"
        );
      }

      const securityCode = this.securityCode();

      const result = await UserModel.savePassword(
        { email: req.body.email },
        {
          securityCode: securityCode,
        }
      );

      if (!result) {
        throw new HttpException(500, "Something went wrong");
      }

      const sendEmailResult = await this.sendRegistrationEmail(
        req,
        res,
        next,
        userData.name,
        "",
        userData.email,
        securityCode,
        "register"
      );

      if (!sendEmailResult) {
        throw new HttpException(
          500,
          "Something went wrong when sending email notification"
        );
      }

      res.status(201).json({
        success: true,
        message: "Verification code sent.",
        data: {
          email: userData.email,
          securityCode: securityCode,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  resendForgotPasswordCode = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const user = await UserModel.checkEmail(req.body);

      if (!user) {
        throw new HttpException(
          401,
          "Your Email is incorrect. Please try again.",
          "INVALID_EMAIL"
        );
      }

      const securityCode = this.securityCode();

      const result = await UserModel.savePassword(req.body, {
        securityCode: securityCode,
      });

      if (!result) {
        throw new HttpException(500, "Something went wrong");
      }

      const sendEmailResult = await this.sendRegistrationEmail(
        req,
        res,
        next,
        user.name,
        "",
        req.body.email,
        securityCode,
        "forgot_password"
      );

      if (!sendEmailResult) {
        throw new HttpException(
          500,
          "Something went wrong when sending email notification",
          "EMAIL_NOT_SENT"
        );
      }

      res.status(201).json({
        success: true,
        message: "Reset password code resent successfully!",
        data: {
          email: req.body.email,
          securityCode: securityCode,
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

  checkConfirmPassword = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(
        400,
        "Password and confirm password are required.",
        errors
      );
    }
  };

  checkRegisterValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(
        400,
        "Member ID, Email, and DOB are required.",
        errors
      );
    }
  };

  checkForgotPassword = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(400, "Email is required.", errors);
    }
  };

  hashPassword = async (req) => {
    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 8);
    }
  };

  getPersonalInfo = async (req, res, next) => {
    const user = await UserModel.findPersonalInfo({
      email: req.params.email,
      member_id: req.params.member_id,
    });

    if (!user) {
      throw new HttpException(404, "User not found");
    }

    const { password, ...userWithoutPassword } = user;

    res.send(userWithoutPassword);
  };

  refreshToken = async (req, res, next) => {
    const { refreshToken } = req.body;

    this.checkValidation(req);

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

      const user = await UserModel.findOne({ id: decoded.id });

      if (!user) {
        return res.status(403).json({ message: "User not found" });
      }

      const newAccessToken = generateAccessToken(user);

      res.send({
        accessToken: newAccessToken,
      });
    } catch (err) {
      return res
        .status(403)
        .json({ message: "Invalid or expired refresh token" });
    }
  };

  getReferralLink = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found");
      }

      // Check if user has a referral code
      if (!user.referral_code) {
        throw new HttpException(404, "Referral code not found for this user");
      }

      // Use referral config
      const referralLink = `${referralConfig.frontendUrl}/r/${user.referral_code}`;

      res.status(200).json({
        success: true,
        message: "Referral link retrieved successfully.",
        data: {
          referralCode: user.referral_code,
          referralLink: referralLink,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getReferralStats = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found");
      }

      const stats = await ReferralModel.getReferralStats(user.id);

      res.status(200).json({
        success: true,
        message: "Referral statistics retrieved successfully.",
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  getReferredUsersList = async (req, res, next) => {
    try {
      const user = req.currentUser;

      if (!user) {
        throw new HttpException(404, "User not found");
      }

      // Extract query parameters
      const {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "created_at",
        sortOrder = "DESC",
        dateFrom = null,
        dateTo = null,
      } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));

      const options = {
        page: pageNum,
        limit: limitNum,
        search: search || "",
        sortBy: sortBy || "created_at",
        sortOrder: sortOrder || "DESC",
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
      };

      const result = await ReferralModel.getReferredUsersList(user.id, options);

      res.status(200).json({
        success: true,
        message: "Referred users list retrieved successfully.",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  //Get complete user profile with all related data
  getProfile = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;

      const userData = await UserModel.getProfileWithCountry(userId);

      if (!userData) {
        throw new HttpException(404, "User profile not found");
      }

      // Format response
      const profile = {
        account: {
          username: userData.username || "",
          email: userData.email,
          avatar_url: userData.avatar_url || null,
          country: userData.country_id
            ? {
                id: userData.country_id,
                code: userData.country_code,
                name: userData.country_name,
                flag: userData.country_flag || null,
              }
            : null,
          offer_token: userData.offer_token || null,
          created_at: userData.created_at,
        },
        security: {
          twofa_enabled: Boolean(userData.twofa_enabled),
          security_pin_enabled: Boolean(userData.security_pin_enabled),
        },
        settings: {
          language: userData.language || "en",
          notifications_enabled: Boolean(userData.notifications_enabled),
          show_stats_enabled: Boolean(userData.show_stats_enabled),
          anonymous_in_contests: Boolean(userData.anonymous_in_contests),
        },
      };

      res.status(200).json({
        success: true,
        message: "Profile retrieved successfully",
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  };

  //Upload or update user avatar
  uploadAvatar = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;

      // Check if file was uploaded
      if (!req.file) {
        throw new HttpException(
          400,
          "No avatar file uploaded. Please provide an image file.",
          "NO_FILE_UPLOADED"
        );
      }

      // Validate file
      const maxSizeBytes = parseInt(
        process.env.AVATAR_MAX_SIZE_BYTES || 2097152
      ); // Default 2MB
      const validation = validateImageFile(req.file, maxSizeBytes);

      if (!validation.valid) {
        throw new HttpException(400, validation.error, "INVALID_AVATAR_FILE");
      }

      // Get current user to check for existing avatar
      const currentUser = await UserModel.findOne({ id: userId }, true);

      if (!currentUser) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const oldAvatarUrl = currentUser.avatar_url;

      // Upload new avatar to S3
      let avatarUrl;
      try {
        avatarUrl = await uploadImageToS3(
          req.file.buffer,
          "avatars",
          userId,
          req.file.mimetype,
          req.file.originalname
        );
      } catch (error) {
        console.error("S3 upload failed:", error);
        throw new HttpException(
          500,
          "Failed to upload avatar. Please try again.",
          "S3_UPLOAD_FAILED"
        );
      }

      // Update database with new avatar URL
      try {
        const updateResult = await UserModel.update(
          { avatar_url: avatarUrl },
          userId
        );

        if (!updateResult || updateResult.affectedRows === 0) {
          // Rollback: delete uploaded S3 file
          await deleteImageFromS3(avatarUrl);
          throw new HttpException(
            500,
            "Failed to update avatar. Please try again.",
            "DB_UPDATE_FAILED"
          );
        }
      } catch (error) {
        // Rollback: delete uploaded S3 file
        await deleteImageFromS3(avatarUrl);
        throw error;
      }

      // Delete old avatar from S3 if it exists
      if (oldAvatarUrl) {
        await deleteImageFromS3(oldAvatarUrl);
      }

      // Return success response
      return res.status(200).json({
        success: true,
        avatarUrl: avatarUrl,
      });
    } catch (error) {
      next(error);
    }
  };

  //Delete user's avatar
  deleteAvatar = async (req, res, next) => {
    try {
      const userId = req.currentUser.id;

      // Get current user to check for existing avatar
      const currentUser = await UserModel.findOne({ id: userId }, true);

      if (!currentUser) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      const avatarUrl = currentUser.avatar_url;

      if (!avatarUrl) {
        return res.status(200).json({
          success: true,
          message: "No avatar to delete",
        });
      }

      // Delete from S3
      await deleteImageFromS3(avatarUrl);

      // Update database to remove avatar URL
      await UserModel.update({ avatar_url: null }, userId);

      return res.status(200).json({
        success: true,
        message: "Avatar deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  };

  //Get user rewards information
  getUserRewards = async (req, res) => {
    const userId = req.currentUser.id;
    // Get user XP from database
    const userData = await UserModel.getUserXp(userId);
    if (!userData) {
      throw new HttpException(404, "User not found", "USER_NOT_FOUND");
    }

    const currentXp = userData.xp || 0;

    const userLevelState = computeUserLevelState(currentXp);

    res.status(200).json({
      success: true,
      ...userLevelState,
    });
  };
  changeEmail = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { current_email, new_email, repeat_new_email } = req.body;
      const userId = req.currentUser.id;
      const user = req.currentUser;

      // User must have a verified account
      if (user.is_verified !== 1) {
        throw new HttpException(
          403,
          "Your account must be verified to change email.",
          "UNVERIFIED_ACCOUNT"
        );
      }

      // Current Email must match the authenticated user's email
      if (user.email.toLowerCase() !== current_email.toLowerCase()) {
        throw new HttpException(
          400,
          "Current email does not match your account email.",
          "CURRENT_EMAIL_MISMATCH"
        );
      }

      // New Email must NOT equal current email
      if (user.email.toLowerCase() === new_email.toLowerCase()) {
        throw new HttpException(
          400,
          "New email must be different from current email.",
          "SAME_EMAIL"
        );
      }

      // New Email must be unique (not used by any other account)
      const emailExists = await UserModel.emailExists(new_email, userId);
      if (emailExists) {
        throw new HttpException(
          409,
          "This email is already in use by another account.",
          "EMAIL_ALREADY_EXISTS"
        );
      }

      // Generate verification code
      const verificationCode = this.securityCode();

      // Store verification code in security_code field temporarily
      const result = await UserModel.savePassword(
        { email: user.email },
        { securityCode: verificationCode }
      );

      if (!result) {
        throw new HttpException(500, "Something went wrong");
      }

      // Send verification email to NEW email address
      const sendEmailResult = await this.sendEmailChangeVerification(
        req,
        res,
        next,
        user.name || "User",
        new_email,
        verificationCode,
        current_email
      );

      if (!sendEmailResult) {
        throw new HttpException(
          500,
          "Something went wrong when sending email verification"
        );
      }

      res.status(200).json({
        success: true,
        message: "Verification code sent to your new email address. Please check your inbox.",
        data: {
          current_email: current_email,
          new_email: new_email,
          verification_code: verificationCode, // For testing, remove in production
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Verify email change and update email
  verifyEmailChange = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { new_email, verification_code } = req.body;
      const userId = req.currentUser.id;
      const user = req.currentUser;

      // Verify the code
      const verification = await UserModel.checkSecurityCode({
        email: user.email,
        security_code: verification_code,
      });

      if (!verification) {
        throw new HttpException(
          404,
          "Verification code does not match.",
          "INVALID_CODE"
        );
      }

      // Check if new email is still available
      const emailExists = await UserModel.emailExists(new_email, userId);
      if (emailExists) {
        throw new HttpException(
          409,
          "This email is already in use by another account.",
          "EMAIL_ALREADY_EXISTS"
        );
      }

      // Update the email and clear security code
      const result = await UserModel.updateEmail(userId, new_email);

      if (!result || result.affectedRows === 0) {
        throw new HttpException(
          500,
          "Failed to update email.",
          "UPDATE_FAILED"
        );
      }

      // Clear the security code
      await UserModel.savePassword({ email: new_email }, { securityCode: null });

      res.status(200).json({
        success: true,
        message: "Email updated successfully.",
        data: {
          old_email: user.email,
          new_email: new_email,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Change user password
  changePassword = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { current_password, new_password, repeat_new_password } = req.body;
      const userId = req.currentUser.id;

      // Get user's current password hash
      const userPasswordData = await UserModel.getPasswordHash(userId);

      if (!userPasswordData) {
        throw new HttpException(404, "User not found", "USER_NOT_FOUND");
      }

      // Convert password buffer to string if needed
      const currentHashedPassword = Buffer.isBuffer(userPasswordData.password)
        ? userPasswordData.password.toString()
        : userPasswordData.password;

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(current_password, currentHashedPassword);
      if (!isCurrentPasswordValid) {
        throw new HttpException(
          400,
          "Current password is incorrect.",
          "INVALID_CURRENT_PASSWORD"
        );
      }

      // New password must not be the same as current password
      const isSameAsOld = await bcrypt.compare(new_password, currentHashedPassword);
      if (isSameAsOld) {
        throw new HttpException(
          400,
          "New password must be different from current password.",
          "SAME_PASSWORD"
        );
      }

      // Check against password history (last 5 passwords)
      const passwordHistory = await UserModel.getPasswordHistory(userId, 5);

      for (const historyEntry of passwordHistory) {
        const historicalHash = Buffer.isBuffer(historyEntry.password_hash)
          ? historyEntry.password_hash.toString()
          : historyEntry.password_hash;

        const matchesHistoricalPassword = await bcrypt.compare(new_password, historicalHash);
        if (matchesHistoricalPassword) {
          throw new HttpException(
            400,
            "You cannot reuse any of your last 5 passwords. Please choose a different password.",
            "PASSWORD_REUSED"
          );
        }
      }

      // Hash the new password
      const hashedNewPassword = await bcrypt.hash(new_password, 8);

      // Add current password to history before updating
      await UserModel.addPasswordToHistory(userId, currentHashedPassword);

      // Clean old password history (keep only last 5)
      await UserModel.cleanOldPasswordHistory(userId, 5);

      // Update password (logout all sessions)
      const result = await UserModel.updatePasswordById(userId, hashedNewPassword);

      if (!result || result.affectedRows === 0) {
        throw new HttpException(500, "Failed to update password.", "UPDATE_FAILED");
      }

      res.status(200).json({
        success: true,
        message: "Password updated successfully. Please login again with your new password.",
      });

    } catch (error) {
      next(error);
    }
  };

  // Toggle Security PIN (Enable/Disable)
  toggleSecurityPin = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const userId = req.currentUser.id;
      const { security_pin, enable } = req.body;

      // Convert to string in case it's a number
      const pinString = String(security_pin);

      // Validate PIN is exactly 4 digits
      if (!/^\d{4}$/.test(pinString)) {
        throw new HttpException(
          400,
          "Security PIN must be exactly 4 digits.",
          "INVALID_PIN_FORMAT"
        );
      }

      // Get current security PIN status
      const status = await UserModel.checkSecurityPinStatus(userId);

      if (enable) {
        // ENABLE security PIN
        if (status && status.security_pin_enabled) {
          throw new HttpException(
            400,
            "Security PIN is already enabled for this account.",
            "SECURITY_PIN_ALREADY_ENABLED"
          );
        }

        // Hash the security PIN (ensure it's a string)
        const hashedPin = await bcrypt.hash(pinString, 8);

        // Enable security PIN with hashed value
        await UserModel.enableSecurityPin(userId, hashedPin);

        res.status(200).json({
          success: true,
          message: "Security PIN has been successfully enabled for your account.",
          data: {
            security_pin_enabled: true,
          },
        });
      } else {
        // DISABLE security PIN
        if (!status || !status.security_pin_enabled) {
          throw new HttpException(
            400,
            "Security PIN is not enabled for this account.",
            "SECURITY_PIN_NOT_ENABLED"
          );
        }

        // Get user's security PIN hash
        const pinData = await UserModel.getSecurityPinHash(userId);

        // Convert security_pin buffer to string if needed
        const hashedPin = Buffer.isBuffer(pinData.security_pin)
          ? pinData.security_pin.toString()
          : pinData.security_pin;

        // Verify the provided PIN matches the hash
        const isPinValid = await bcrypt.compare(pinString, hashedPin);
        if (!isPinValid) {
          throw new HttpException(
            401,
            "Invalid security PIN. Please try again.",
            "INVALID_SECURITY_PIN"
          );
        }

        // Disable security PIN
        await UserModel.disableSecurityPin(userId);

        res.status(200).json({
          success: true,
          message: "Security PIN has been successfully disabled for your account.",
          data: {
            security_pin_enabled: false,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  };

  // Verify code and delete account
  verifyAndDeleteAccount = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { verification_code } = req.body;
      const userId = req.currentUser.id;
      const user = req.currentUser;

      // Verify the code
      const verification = await UserModel.checkSecurityCode({
        email: user.email,
        security_code: verification_code,
      });

      if (!verification) {
        throw new HttpException(
          404,
          "Verification code does not match.",
          "INVALID_CODE"
        );
      }

      // Delete user account with all associated data
      const result = await UserModel.deleteWithAllData(userId);

      if (!result.success) {
        throw new HttpException(
          500,
          result.error || "Failed to delete account.",
          "DELETE_FAILED"
        );
      }

      // Delete avatar from S3 if exists
      if (result.deletedUser && result.deletedUser.avatar_url) {
        try {
          await deleteImageFromS3(result.deletedUser.avatar_url);
        } catch (s3Error) {
          // Log but don't fail the request if S3 delete fails
          console.error('Failed to delete avatar from S3:', s3Error);
        }
      }

      res.status(200).json({
        success: true,
        message: "Your account and all associated data have been successfully deleted.",
        data: {
          deleted_user_id: result.deletedUser.id,
          deleted_email: result.deletedUser.email,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  verifySecurityPin = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const userId = req.currentUser.id;
      const { security_pin } = req.body;

      const pinString = String(security_pin);

      // Validate PIN is exactly 4 digits
      if (!/^\d{4}$/.test(pinString)) {
        throw new HttpException(
          400,
          "Security PIN must be exactly 4 digits.",
          "INVALID_PIN_FORMAT"
        );
      }

      const status = await UserModel.checkSecurityPinStatus(userId);
      if (!status || !status.security_pin_enabled) {
        throw new HttpException(
          400,
          "Security PIN is not enabled for this account.",
          "SECURITY_PIN_NOT_ENABLED"
        );
      }

      const pinData = await UserModel.getSecurityPinHash(userId);

      if (!pinData || !pinData.security_pin) {
        throw new HttpException(
          500,
          "Security PIN data not found.",
          "SECURITY_PIN_DATA_NOT_FOUND"
        );
      }

      const hashedPin = Buffer.isBuffer(pinData.security_pin)
        ? pinData.security_pin.toString()
        : pinData.security_pin;

      const isPinValid = await bcrypt.compare(pinString, hashedPin);
      if (!isPinValid) {
        throw new HttpException(
          401,
          "Invalid security PIN. Please try again.",
          "INVALID_SECURITY_PIN"
        );
      }

      res.status(200).json({
        success: true,
        message: "Security PIN verified successfully.",
        data: {
          verified: true,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  // Send delete account verification email
  sendDeleteAccountEmail = async (
    req,
    res,
    next,
    memberName,
    recieverEmail,
    securityCode
  ) => {
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_NO_REPLY_HOST,
      port: process.env.MAIL_NO_REPLY_PORT,
      secure: true,
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const subject = "Delete Account Verification - Gigafaucet";
    const html =
      `<div>` +
      "Dear " +
      memberName +
      ",<br /><br />" +
      "We received a request to delete your Gigafaucet account." +
      "<br/><br/>" +
      "<strong>WARNING: This action is permanent and cannot be undone. All your data will be deleted.</strong>" +
      "<br/><br/>" +
      `Please use the following verification code to confirm account deletion: <br /><b><font style="font-size: 25px;">` +
      securityCode +
      `</font></b><br/><br/>` +
      "If you did not make this request, please ignore this email and your account will remain active. " +
      "We also recommend changing your password immediately if you did not request this." +
      "<br/><br/>" +
      "Yours Sincerely,<br/>" +
      "Gigafaucet Team<br/><br/>" +
      "<b>Gigafaucet</b><br/>" +
      `95/87, Moo 7, Soi Saiyuan,<br/>` +
      `A.Mueang, T.Rawai, Phuket, 83130<br/>` +
      "<div>" +
      "<br/><hr/>";

    const info = await transporter.sendMail({
      from: '"Gigafaucet" <projectdev.bit@gmail.com>',
      to: recieverEmail,
      subject: subject,
      text: "(TESTING) Delete account verification",
      html: html,
    });

    console.log("Delete account verification sent: %s", info.messageId);

    return true;
  };

}

/******************************************************************************
 *                               Export
 ******************************************************************************/
module.exports = new UserController();
