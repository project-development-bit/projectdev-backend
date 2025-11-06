/**
 * Department Configuration Utility
 * Maps contact form categories to department emails and information
 */

/**
 * Get department email based on category
 * @param {string} category - Contact category (General Inquiry, Technical Support, Billing & Payments, Feedback, Bug Report, Feature Request)
 * @returns {string} Department email address
 */
exports.getDepartmentEmail = (category) => {
  const departmentEmails = {
    "General Inquiry": process.env.CONTACT_GENERAL_EMAIL,
    "Technical Support": process.env.CONTACT_TECHNICAL_EMAIL,
    "Billing & Payments": process.env.CONTACT_BILLING_EMAIL,
    "Feedback": process.env.CONTACT_FEEDBACK_EMAIL,
    "Bug Report": process.env.CONTACT_BUG_REPORT_EMAIL,
    "Feature Request": process.env.CONTACT_FEATURE_REQUEST_EMAIL,
  };

  // Return department-specific email or fallback to default
  return (
    departmentEmails[category] ||
    process.env.CONTACT_DEFAULT_EMAIL ||
    process.env.EMAIL_USERNAME ||
    "contact@gigafaucet.com"
  );
};

/**
 * Get department name for display purposes
 * @param {string} category - Contact category
 * @returns {string} Department display name
 */
exports.getDepartmentName = (category) => {
  const departmentNames = {
    "General Inquiry": "General Inquiries Department",
    "Technical Support": "Technical Support Department",
    "Billing & Payments": "Billing & Payments Department",
    "Feedback": "Customer Feedback Department",
    "Bug Report": "Quality Assurance & Bug Tracking Department",
    "Feature Request": "Product Development Department",
  };

  return departmentNames[category] || "Customer Service Department";
};

/**
 * Get department configuration including email, name, and metadata
 * @param {string} category - Contact category
 * @returns {Object} Department configuration
 */
exports.getDepartmentConfig = (category) => {
  return {
    email: this.getDepartmentEmail(category),
    name: this.getDepartmentName(category),
    category: category,
    priority: this.getDepartmentPriority(category),
    expectedResponseTime: this.getExpectedResponseTime(category),
  };
};

/**
 * Get priority level for department (for internal routing/SLA)
 * @param {string} category - Contact category
 * @returns {string} Priority level (High, Medium, Normal)
 */
exports.getDepartmentPriority = (category) => {
  const priorityMap = {
    "Technical Support": "High",     // Technical issues need fast response
    "Billing & Payments": "High",    // Billing issues are critical
    "Bug Report": "High",            // Bugs need immediate attention
    "Feature Request": "Medium",     // Feature requests are important
    "Feedback": "Medium",            // Feedback should be reviewed
    "General Inquiry": "Normal",     // General questions are normal priority
  };

  return priorityMap[category] || "Normal";
};

/**
 * Get expected response time based on department/category
 * @param {string} category - Contact category
 * @returns {string} Expected response time description
 */
exports.getExpectedResponseTime = (category) => {
  const responseTimeMap = {
    "Technical Support": "within 24 hours",
    "Billing & Payments": "within 24 hours",
    "Bug Report": "within 24 hours",
    "Feature Request": "within 3-5 business days",
    "Feedback": "within 2-3 business days",
    "General Inquiry": "within 24-48 hours",
  };

  return responseTimeMap[category] || "within 24-48 hours";
};

/**
 * Get all available departments with their configurations
 * @returns {Array} Array of department configurations
 */
exports.getAllDepartments = () => {
  const categories = [
    "General Inquiry",
    "Technical Support",
    "Billing & Payments",
    "Feedback",
    "Bug Report",
    "Feature Request"
  ];

  return categories.map((category) => ({
    category,
    email: this.getDepartmentEmail(category),
    name: this.getDepartmentName(category),
    priority: this.getDepartmentPriority(category),
    expectedResponseTime: this.getExpectedResponseTime(category),
  }));
};

/**
 * Validate if a department email is configured
 * @param {string} category - Contact category
 * @returns {boolean} True if department email is configured
 */
exports.isDepartmentEmailConfigured = (category) => {
  const email = this.getDepartmentEmail(category);
  return email && email !== "contact@gigafaucet.com"; // Check if not fallback
};
