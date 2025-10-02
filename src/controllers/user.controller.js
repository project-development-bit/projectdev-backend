const UserModel = require("../models/user.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();

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
    this.checkValidation(req);

    await this.hashPassword(req);

    const result = await UserModel.create(req.body);

    if (!result) {
      throw new HttpException(500, "Something went wrong");
    }

    res.status(201).send("User was created!");
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
    this.checkValidation(req);

    const { email, password: pass } = req.body;

    // const user = await UserModel.findOne({ email });
    const user = await UserModel.findOne({ username: email });

    if (!user) {
      throw new HttpException(
        401,
        "Your email is incorrect. Please try again."
      );
    }

    if (user.status != 1) {
      throw new HttpException(
        401,
        "Your account isn't verified. Please contact Luma Care."
      );
    }

    // Hash the password
    const hashedPassword = crypto
      .createHash("md5")
      .update(
        process.env.HASH_SALT +
          crypto.createHash("md5").update(pass).digest("hex")
      )
      .digest("hex");

    // Concatenate the uppercased memberID and hashed password
    const concatenatedString = user.memberID.toUpperCase() + hashedPassword;

    // Hash the concatenated string
    const finalHash = crypto
      .createHash("md5")
      .update(concatenatedString)
      .digest("hex");

    if (finalHash != user.password) {
      throw new HttpException(
        401,
        "Your password is incorrect. Please try again."
      );
    }

    // user matched!
    const secretKey = process.env.SECRET_JWT || "";
    // const token = jwt.sign({ user_id: user.user_id.toString() }, secretKey, {
    //   expiresIn: "24h",
    // });
    const token = jwt.sign({ user_id: user.user_id.toString() }, secretKey);

    const { password, ...userWithoutPassword } = user;

    res.send({ ...userWithoutPassword, token });
  };

  forgotPassword = async (req, res, next) => {
    this.checkForgotPassword(req);

    const user = await UserModel.checkEmail(req.body);

    if (!user) {
      throw new HttpException(
        401,
        "Your Email is incorrect. Please try again."
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
      user.m_name,
      user.m_surname,
      req.body.email, 
      securityCode,
      "forgot_password"
    );

    if (!sendEmailResult) {
      throw new HttpException(
        500,
        "Something went wrong when sending email notification"
      );
    }

    res.status(201).send("Reset password is completed!");
  };

  userRegister = async (req, res, next) => {
    this.checkRegisterValidation(req);

    const { status, m_email, m_name, m_surname } =
      await this.checkMemberIDEmailDOB(req);
    console.log(status);

    const securityCode = await this.saveNewUser(req, status);

    const sendEmailResult = await this.sendRegistrationEmail(
      req,
      res,
      next,
      m_name,
      m_surname,
      m_email,
      securityCode,
      "register"
    );

    if (!sendEmailResult) {
      throw new HttpException(
        500,
        "Something went wrong when sending email notification"
      );
    }

    res.status(201).send("Registration is completed!");
  };

  savePassword = async (req, res, next) => {
    this.checkConfirmPassword(req);

    const user = await UserModel.checkMember(req.body.email);

    if (!user) {
      throw new HttpException(
        401,
        "Something went wrong"
      );
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

  saveNewUser = async (req, status) => {
    const securityCode = this.securityCode();

    const result = await UserModel.register(req.body, {
      securityCode: securityCode,
      status: status,
    });

    if (!result) {
      throw new HttpException(500, "Something went wrong");
    }

    return securityCode;
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
      secure: false, // true for 465, false for other ports
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
      subject = "Luma Online Service Registration - Luma Health Insurance";
      html =
        `<div>` +
        "Dear " +
        memberName +
        " " +
        surname +
        ",<br /><br />" +
        "Thank you for signing up for our online service." +
        "<br/><br/>" +
        `Please use the following verification code: <br /><b><font style="font-size: 25px;">` +
        securityCode +
        `</font></b><br/><br/>` +
        "Yours Sincerely,<br/>" +
        "Client Services Team<br/><br/>" +
        `<img src="https://www.lumahealth.com/wp-content/uploads/2017/09/logo.png" width="90px"/><br><br>` +
        "<b>Luma Health Insurance</b><br/>" +
        `Unit 912, 9th Floor.<br/>` +
        `Park Ventures Ecoplex 57 Wireless Road,<br/>` +
        `Lumpini, Pathumwan, Bangkok, Thailand 10330<br/>` +
        `Tel. +66 2 494 3600<br/>` +
        `Email: cs@lumahealth.com<br/>` +
        "<div>" +
        // + "<br/><br/><br/><hr/>test server : "
        // + process.env.MAIL_NO_REPLY_SERVER_SEND
        "<br/><hr/>";
    } else {
      subject = "Forgot Password Request - Luma Health Insurance";
      html =
        `<div>` +
        "Dear " +
        memberName +
        " " +
        surname +
        ",<br /><br />" +
        "We received a request to reset your LUMA account password." +
        "<br/><br/>" +
        `Please use the following verification code: <br /><b><font style="font-size: 25px;">` +
        securityCode +
        `</font></b><br/><br/>` +
        "If you did not make a request to reset your password," +
        "<br/>" +
        "it is possible that someone else is trying to access" +
        "<br/>" +
        `your LUMA Account <a href="mailto:` + recieverEmail + `">` + recieverEmail + `</a>.` +
        "<br/>" +
        "If so, please ignore and do not forward this message to anyone." +
        "<br/><br/>" +
        "Yours Sincerely,<br/>" +
        "Client Services Team<br/><br/>" +
        `<img src="https://www.lumahealth.com/wp-content/uploads/2017/09/logo.png" width="90px"/><br><br>` +
        "<b>Luma Health Insurance</b><br/>" +
        `Unit 912, 9th Floor.<br/>` +
        `Park Ventures Ecoplex 57 Wireless Road,<br/>` +
        `Lumpini, Pathumwan, Bangkok, Thailand 10330<br/>` +
        `Tel. +66 2 494 3600<br/>` +
        `Email: cs@lumahealth.com<br/>` +
        "<div>" +
        // + "<br/><br/><br/><hr/>test server : "
        // + process.env.MAIL_NO_REPLY_SERVER_SEND
        "<br/><hr/>";
    }

    const info = await transporter.sendMail({
      // from: process.env.EMAIL_FROM, // sender email
      from: '"LUMA Member Portal" <application@lumahealth.com>',
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
    const user = await UserModel.checkSecurityCode({
      email: req.params.email,
      security_code: req.params.security_code,
    });

    if (!user) {
      throw new HttpException(404, "Verification code does not match.");
    }

    const { password, ...userWithoutPassword } = user;

    res.send(userWithoutPassword);
  };

  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(400, "Email and password are required.", errors);
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

  checkDocuments = async (req, res, next) => {
    const isDocuments = await UserModel.checkDocuments({
      insured_id: req.params.insured_id,
    });

    if (!isDocuments) {
      throw new HttpException(404, "Documents not found");
    }

    res.send(isDocuments);
  };
}

/******************************************************************************
 *                               Export
 ******************************************************************************/
module.exports = new UserController();
