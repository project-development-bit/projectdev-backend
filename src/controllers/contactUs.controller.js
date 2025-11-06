const ContactUsModel = require("../models/contactUs.model");
const HttpException = require("../utils/HttpException.utils");
const { validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const {
  getDepartmentConfig,
} = require("../utils/departmentConfig.utils");

class ContactUsController {
  //Validate request using express-validator
  checkValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new HttpException(
        400,
        "Validation failed. Please check your input fields.",
        "VALIDATION_ERROR",
        errors.array()
      );
    }
  };

  //Create a new contact submission and send notification email
  //POST /api/v1/contact
  
  createContact = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { name, email, phone, category, subject, message } = req.body;

      // Capture request metadata
      const ip_address = req.ip || req.connection.remoteAddress;
      const user_agent = req.get("user-agent");

      // Create contact submission in database
      const contactData = await ContactUsModel.create({
        name,
        email,
        phone,
        category,
        subject,
        message,
        ip_address,
        user_agent,
      });

      if (!contactData) {
        throw new HttpException(
          500,
          "Failed to submit contact form. Please try again.",
          "CONTACT_CREATION_FAILED"
        );
      }

      // Send notification email to admin
      try {
        await this.sendContactNotificationEmail({
          contactId: contactData.id,
          name,
          email,
          phone,
          category,
          subject,
          message,
          ip_address,
          user_agent,
        });
      } catch (emailError) {
        // Log email error but don't fail the request
        console.error("Failed to send notification email:", emailError);
      }

      // Send confirmation email to user
      try {
        await this.sendContactConfirmationEmail({
          name,
          email,
          category,
          subject,
        });
      } catch (emailError) {
        // Log email error but don't fail the request
        console.error("Failed to send confirmation email:", emailError);
      }

      res.status(201).json({
        success: true,
        message: "Thank you for contacting us! We will get back to you soon.",
        data: {
          id: contactData.id,
          name: contactData.name,
          email: contactData.email,
          category: contactData.category,
          subject: contactData.subject,
          status: contactData.status,
          createdAt: contactData.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  //Get all contact submissions (Admin only)
  //GET /api/v1/contact

  getAllContacts = async (req, res, next) => {
    try {
      const { page = 1, limit = 10, category, status, email } = req.query;

      // Build filters
      const filters = {};
      if (category) filters.category = category;
      if (status) filters.status = status;
      if (email) filters.email = email;

      const result = await ContactUsModel.findWithPagination(
        parseInt(page),
        parseInt(limit),
        filters
      );

      res.status(200).json({
        success: true,
        message: "Contact submissions retrieved successfully",
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  };

  
  //Get a single contact submission by ID (Admin only)
  //GET /api/v1/contact/:id
  getContactById = async (req, res, next) => {
    try {
      const contact = await ContactUsModel.findOne({ id: req.params.id });

      if (!contact) {
        throw new HttpException(404, "Contact submission not found", "CONTACT_NOT_FOUND");
      }

      res.status(200).json({
        success: true,
        message: "Contact submission retrieved successfully",
        data: contact,
      });
    } catch (error) {
      next(error);
    }
  };


  //Update contact submission status (Admin only)
  //PATCH /api/v1/contact/:id
   
  updateContactStatus = async (req, res, next) => {
    try {
      this.checkValidation(req);

      const { id } = req.params;
      const { status } = req.body;

      // Check if contact exists
      const contact = await ContactUsModel.findOne({ id });
      if (!contact) {
        throw new HttpException(404, "Contact submission not found", "CONTACT_NOT_FOUND");
      }

      // Update status
      const result = await ContactUsModel.update({ status }, id);

      if (!result || result.affectedRows === 0) {
        throw new HttpException(
          500,
          "Failed to update contact status",
          "UPDATE_FAILED"
        );
      }

      res.status(200).json({
        success: true,
        message: "Contact status updated successfully",
        data: { id, status },
      });
    } catch (error) {
      next(error);
    }
  };

  //Delete a contact submission (Admin only)
  //DELETE /api/v1/contact/:id
  deleteContact = async (req, res, next) => {
    try {
      const { id } = req.params;

      const affectedRows = await ContactUsModel.delete(id);

      if (affectedRows === 0) {
        throw new HttpException(404, "Contact submission not found", "CONTACT_NOT_FOUND");
      }

      res.status(200).json({
        success: true,
        message: "Contact submission deleted successfully",
        data: { id, deletedRows: affectedRows },
      });
    } catch (error) {
      next(error);
    }
  };

  //Send notification email to appropriate department based on category
  sendContactNotificationEmail = async (contactData) => {
    // Skip email sending if EMAIL_SECURE is not set (localhost environment)
    if (!process.env.EMAIL_SECURE) {
      return true;
    }

    const {
      contactId,
      name,
      email,
      phone,
      category,
      subject,
      message,
      ip_address,
      user_agent,
    } = contactData;

    // Get department configuration based on category
    const departmentConfig = getDepartmentConfig(category);
    const departmentEmail = departmentConfig.email;
    const departmentName = departmentConfig.name;

    // Determine if connection should use SSL/TLS
    const emailSecure = process.env.EMAIL_SECURE;
    const isSecure = emailSecure === "true" || emailSecure === "1" || parseInt(process.env.MAIL_NO_REPLY_PORT || process.env.EMAIL_PORT) === 465;

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_NO_REPLY_HOST || process.env.EMAIL_HOST,
      port: parseInt(process.env.MAIL_NO_REPLY_PORT || process.env.EMAIL_PORT || "587"),
      secure: isSecure, // true for 465, false for other ports (587 uses STARTTLS)
      auth: {
        user: process.env.MAIL_NO_REPLY_USERNAME || process.env.EMAIL_USERNAME,
        pass: process.env.MAIL_NO_REPLY_PASSWORD || process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 5000, // 5 second timeout
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USERNAME;
    const fromName = process.env.EMAIL_NAME || "Gigafaucet Contact Form";

    // Priority badge color based on department priority
    const priorityColors = {
      High: "#dc3545",
      Medium: "#ffc107",
      Normal: "#28a745",
    };
    const priorityColor = priorityColors[departmentConfig.priority] || "#6c757d";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #FF0066; padding-bottom: 10px;">
          New Contact Form Submission - ${departmentName}
        </h2>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h3 style="color: #FF0066; margin: 0;">Submission Details</h3>
            <span style="background-color: ${priorityColor}; color: white; padding: 5px 12px; border-radius: 15px; font-size: 12px; font-weight: bold;">
              ${departmentConfig.priority} Priority
            </span>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 150px;">Ticket ID:</td>
              <td style="padding: 8px;">#${contactId}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Department:</td>
              <td style="padding: 8px;">${departmentName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Category:</td>
              <td style="padding: 8px;"><span style="background-color: #FF0066; color: white; padding: 3px 10px; border-radius: 3px;">${category}</span></td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Response Time:</td>
              <td style="padding: 8px;">${departmentConfig.expectedResponseTime}</td>
            </tr>
            <tr style="border-top: 2px solid #ddd;">
              <td style="padding: 12px 8px 8px 8px; font-weight: bold;">Name:</td>
              <td style="padding: 12px 8px 8px 8px;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Email:</td>
              <td style="padding: 8px;"><a href="mailto:${email}" style="color: #FF0066;">${email}</a></td>
            </tr>
            ${phone ? `
            <tr>
              <td style="padding: 8px; font-weight: bold;">Phone:</td>
              <td style="padding: 8px;"><a href="tel:${phone}">${phone}</a></td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 8px; font-weight: bold;">Subject:</td>
              <td style="padding: 8px;">${subject}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Message</h3>
          <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
        </div>

        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; font-size: 12px; color: #666;">
          <h4 style="margin-top: 0; color: #333;">Technical Information</h4>
          <p style="margin: 5px 0;"><strong>IP Address:</strong> ${ip_address || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>User Agent:</strong> ${user_agent || 'N/A'}</p>
          <p style="margin: 5px 0;"><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
          <p>This message was automatically routed to <strong>${departmentName}</strong></p>
          <p style="margin-top: 5px;">Automated notification from the Gigafaucet contact form system</p>
        </div>
      </div>
    `;

    // Send email to department
    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: departmentEmail,
      subject: `[${category}] [${departmentConfig.priority}] New Contact: ${subject}`,
      html: html,
      replyTo: email, // Allow department to reply directly to customer
    });

    console.log(`Notification email sent to ${departmentName} (${departmentEmail}):`, info.messageId);

    return true;
  };

  //Send confirmation email to user with department-specific information
  sendContactConfirmationEmail = async ({ name, email, category, subject }) => {
    // Skip email sending if EMAIL_SECURE is not set (localhost environment)
    if (!process.env.EMAIL_SECURE) {
      return true;
    }

    // Get department configuration for personalized response
    const departmentConfig = getDepartmentConfig(category);
    const departmentEmail = departmentConfig.email;
    const departmentName = departmentConfig.name;

    // Determine if connection should use SSL/TLS
    const emailSecure = process.env.EMAIL_SECURE;
    const isSecure = emailSecure === "true" || emailSecure === "1" || parseInt(process.env.MAIL_NO_REPLY_PORT || process.env.EMAIL_PORT) === 465;

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.MAIL_NO_REPLY_HOST || process.env.EMAIL_HOST,
      port: parseInt(process.env.MAIL_NO_REPLY_PORT || process.env.EMAIL_PORT || "587"),
      secure: isSecure, // true for 465, false for other ports (587 uses STARTTLS)
      auth: {
        user: process.env.MAIL_NO_REPLY_USERNAME || process.env.EMAIL_USERNAME,
        pass: process.env.MAIL_NO_REPLY_PASSWORD || process.env.EMAIL_PASSWORD,
      },
      connectionTimeout: 5000, // 5 second timeout
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });

    const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USERNAME;
    const fromName = process.env.EMAIL_NAME || "Gigafaucet";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333; border-bottom: 2px solid #FF0066; padding-bottom: 10px;">
          Thank You for Contacting Us!
        </h2>

        <p style="font-size: 16px; line-height: 1.6;">Dear ${name},</p>

        <p style="font-size: 14px; line-height: 1.6;">
          Thank you for reaching out to us. We have received your message and our team will review it shortly.
        </p>

        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #FF0066; margin-top: 0;">Your Submission Summary</h3>
          <table style="width: 100%;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 120px;">Category:</td>
              <td style="padding: 8px;">${category}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Subject:</td>
              <td style="padding: 8px;">${subject}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold;">Submitted:</td>
              <td style="padding: 8px;">${new Date().toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="background-color: #e3f2fd; padding: 15px; border-left: 4px solid #2196f3; margin: 20px 0; border-radius: 3px;">
          <p style="margin: 0 0 8px 0; font-size: 14px;">
            <strong>Department:</strong> Your inquiry has been routed to our <strong>${departmentName}</strong>
          </p>
          <p style="margin: 0; font-size: 14px;">
            <strong>Expected Response:</strong> ${departmentConfig.expectedResponseTime}
          </p>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 3px;">
          <p style="margin: 0; font-size: 14px;">
            <strong>Need urgent assistance?</strong><br>
            You can reach our ${departmentName} directly at <a href="mailto:${departmentEmail}" style="color: #FF0066;">${departmentEmail}</a>
          </p>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
          <p>Best regards,<br><strong>The Gigafaucet Team</strong></p>
          <p style="margin-top: 10px;">This is an automated confirmation email. Please do not reply to this message.</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: `We Received Your Message - ${subject}`,
      html: html,
    });

    console.log("Confirmation email sent to user:", info.messageId);
    return true;
  };
}

module.exports = new ContactUsController();
