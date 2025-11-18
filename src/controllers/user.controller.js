const UserModel = require("../models/user.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const TwoFAController = require("./twofa.controller");
const { uploadImageToS3, deleteImageFromS3, validateImageFile } = require('../utils/imageUpload.utils');
dotenv.config();

const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/token.utils");

const { generateUniqueReferralCode } = require("../utils/referral.utils");
const ReferralModel = require("../models/referral.model");
const referralConfig = require("../config/referral.config");

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
    const { password, ...userWithoutPassword } = req.currentUser;

    res.send(userWithoutPassword);
  };

  createUser = async (req, res, next) => {
    try {
      this.checkValidation(req);
      await this.hashPassword(req);

      // Handle referral code if provided
      let referrerId = null;
      if (req.body.referral_code) {
        const referrer = await ReferralModel.getUserByReferralCode(req.body.referral_code);
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
      if (error.status === 409 || error.code === 'ER_DUP_ENTRY') {
        return next(new HttpException(
          409,
          "An account with this email already exists. Please use a different email or try logging in.",
          "EMAIL_ALREADY_EXISTS"
        ));
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
      'name',
      'country_id',
      'language',
      'notifications_enabled',
      'show_stats_enabled',
      'anonymous_in_contests',
      'security_pin_enabled',
      'interest_enable',
      'show_onboarding'
    ];

    // Filter request body to only include allowed fields
    const { confirm_password, ...restOfUpdates } = req.body;
    const filteredUpdates = {};

    Object.keys(restOfUpdates).forEach(key => {
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

    const message = affectedRows && changedRows
      ? "User updated successfully"
      : "No changes made";

    res.status(200).json({
      success: true,
      message: message,
    });
  };

  deleteUser = async (req, res, next) => {
    const result = await UserModel.delete(req.params.id);
    if (!result) {
      throw new HttpException(404, "User not found");
    }
    res.status(200).json({
        success: true,
        message: "User has been deleted.",
    });
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
        show_onboarding: user.show_onboarding
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
      const tokens = await this.generateToken(user);

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
      message: "Reset password is completed!",
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
      const tokens = await this.generateToken(user);

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
        message: "Password was saved successfully! Please verify your account to login.",
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

  generateToken = async (user) => {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    await UserModel.refreshToken({
      refreshToken,
      userID: user.id,
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

  verifyUser = async (req, res) => {
    const verification = await UserModel.checkSecurityCode({
      email: req.params.email,
      security_code: req.params.security_code,
    });

    if (!verification) {
      throw new HttpException(
        404,
        "Verification code does not match.",
        "INVALID_CODE"
      );
    } else {
      await UserModel.updateRegistrationStatus(req.params.email);
    }

    const user = await this.checkUserExists(req.params.email);

    const tokens = await this.generateToken(user);

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
    const verification = await UserModel.checkSecurityCode({
      email: req.params.email,
      security_code: req.params.security_code,
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
        email: req.params.email,
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
        search = '',
        sortBy = 'created_at',
        sortOrder = 'DESC',
        dateFrom = null,
        dateTo = null,
      } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));

      const options = {
        page: pageNum,
        limit: limitNum,
        search: search || '',
        sortBy: sortBy || 'created_at',
        sortOrder: sortOrder || 'DESC',
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
          username: userData.username || '',
          email: userData.email,
          avatar_url: userData.avatar_url || null,
          country: userData.country_id ? {
            id: userData.country_id,
            code: userData.country_code,
            name: userData.country_name,
            flag: userData.country_flag || null
          } : null,
          offer_token: userData.offer_token || null,
          created_at: userData.created_at
        },
        security: {
          twofa_enabled: Boolean(userData.twofa_enabled),
          security_pin_enabled: Boolean(userData.security_pin_enabled)
        },
        settings: {
          language: userData.language || 'en',
          notifications_enabled: Boolean(userData.notifications_enabled),
          show_stats_enabled: Boolean(userData.show_stats_enabled),
          anonymous_in_contests: Boolean(userData.anonymous_in_contests)
        }
      };

      res.status(200).json({
        success: true,
        message: "Profile retrieved successfully",
        data: profile
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
        throw new HttpException(400, 'No avatar file uploaded. Please provide an image file.', 'NO_FILE_UPLOADED');
      }

      // Validate file
      const maxSizeBytes = parseInt(process.env.AVATAR_MAX_SIZE_BYTES || 2097152); // Default 2MB
      const validation = validateImageFile(req.file, maxSizeBytes);

      if (!validation.valid) {
        throw new HttpException(400, validation.error, 'INVALID_AVATAR_FILE');
      }

      // Get current user to check for existing avatar
      const currentUser = await UserModel.findOne({ id: userId }, true);

      if (!currentUser) {
        throw new HttpException(404, 'User not found', 'USER_NOT_FOUND');
      }

      const oldAvatarUrl = currentUser.avatar_url;

      // Upload new avatar to S3
      let avatarUrl;
      try {
        avatarUrl = await uploadImageToS3(
          req.file.buffer,
          'avatars',
          userId,
          req.file.mimetype,
          req.file.originalname
        );
      } catch (error) {
        console.error('S3 upload failed:', error);
        throw new HttpException(500, 'Failed to upload avatar. Please try again.', 'S3_UPLOAD_FAILED');
      }

      // Update database with new avatar URL
      try {
        const updateResult = await UserModel.update({ avatar_url: avatarUrl }, userId);

        if (!updateResult || updateResult.affectedRows === 0) {
          // Rollback: delete uploaded S3 file
          await deleteImageFromS3(avatarUrl);
          throw new HttpException(500, 'Failed to update avatar. Please try again.', 'DB_UPDATE_FAILED');
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
        throw new HttpException(404, 'User not found', 'USER_NOT_FOUND');
      }

      const avatarUrl = currentUser.avatar_url;

      if (!avatarUrl) {
        return res.status(200).json({
          success: true,
          message: 'No avatar to delete',
        });
      }

      // Delete from S3
      await deleteImageFromS3(avatarUrl);

      // Update database to remove avatar URL
      await UserModel.update({ avatar_url: null }, userId);

      return res.status(200).json({
        success: true,
        message: 'Avatar deleted successfully',
      });

    } catch (error) {
      next(error);
    }
  };
}

/******************************************************************************
 *                               Export
 ******************************************************************************/
module.exports = new UserController();
