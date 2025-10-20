const UserModel = require("../models/user.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

const {
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/token.utils");

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
    const user = await UserModel.findOne({ user_id: req.params.id });
    if (!user) {
      throw new HttpException(404, "User not found");
    }

    const { password, ...userWithoutPassword } = user;

    res.send(userWithoutPassword);
  };

  getUserByuserName = async (req, res, next) => {
    const user = await UserModel.findOne({ username: req.params.username });
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

      const userData = await this.saveNewUser(req);

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
        data: userData,
      });
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req, res, next) => {
    this.checkValidation(req);

    await this.hashPassword(req);

    const { confirm_password, ...restOfUpdates } = req.body;

    // do the update query and get the result
    // it can be partial edit
    const result = await UserModel.update(restOfUpdates, req.params.id);

    if (!result) {
      throw new HttpException(404, "Something went wrong");
    }

    const { affectedRows, changedRows, info } = result;

    const message = !affectedRows
      ? "User not found"
      : affectedRows && changedRows
      ? "User updated successfully"
      : "Updated faild";

    res.send({ message, info });
  };

  deleteUser = async (req, res, next) => {
    const result = await UserModel.delete(req.params.id);
    if (!result) {
      throw new HttpException(404, "User not found");
    }
    res.send("User has been deleted");
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

      const tokens = await this.generateToken(user);

      res.status(200).json({
        success: true,
        message: "Login successful.",
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
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

    const user = await UserModel.checkMember(req.body.email);

    if (!user) {
      throw new HttpException(401, "Something went wrong");
    }

    const hashedPassword = crypto
      .createHash("md5")
      .update(
        process.env.HASH_SALT +
          crypto.createHash("md5").update(req.body.password).digest("hex")
      )
      .digest("hex");
    const concatenatedString = user.memberID.toUpperCase() + hashedPassword;
    const finalHash = crypto
      .createHash("md5")
      .update(concatenatedString)
      .digest("hex");

    const result = await UserModel.updatePassword({
      memberID: user.memberID,
      password: finalHash,
    });

    if (!result) {
      throw new HttpException(500, "Something went wrong");
    }

    res.status(201).send("Password was saved successfully!");
  };

  securityCode = () => {
    const min = 1000;
    const max = 9999;
    const generateSecurityCode =
      Math.floor(Math.random() * (max - min + 1)) + min;

    return generateSecurityCode;
  };

  checkMemberIDEmailDOB = async (req) => {
    const user = await UserModel.checkMemberIDEmailDOB(req.body);
    if (!user) {
      throw new HttpException(
        401,
        "Your Member ID, Email, or Date of Birth is incorrect. Please try again."
      );
    }

    if (user.status == 1) {
      throw new HttpException(
        401,
        "You have already registered. Please log in."
      );
    }

    return user;
  };

  saveNewUser = async (req) => {
    const securityCode = this.securityCode();

    const userData = await UserModel.create(req.body, {
      securityCode: securityCode,
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

    console.log("Verification result:", verification);

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
        },
        tokens: tokens,
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
}

/******************************************************************************
 *                               Export
 ******************************************************************************/
module.exports = new UserController();
