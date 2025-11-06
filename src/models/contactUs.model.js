const { coinQuery } = require("../config/db");
const { multipleColumnSet } = require("../utils/common.utils");

class ContactUsModel {
  tableName = "contact_us";

  /**
   * Find contact submissions with optional filters
   * @param {Object} params - Filter parameters (e.g., { category: 'Technical', status: 'New' })
   * @returns {Promise<Array>} Array of contact submissions
   */
  find = async (params = {}) => {
    let sql = `SELECT * FROM ${this.tableName}`;

    if (!Object.keys(params).length) {
      return await coinQuery(sql);
    }

    const { columnSet, values } = multipleColumnSet(params);
    sql += ` WHERE ${columnSet}`;

    return await coinQuery(sql, [...values]);
  };

  /**
   * Find a single contact submission
   * @param {Object} params - Filter parameters
   * @returns {Promise<Object|undefined>} Contact submission or undefined
   */
  findOne = async (params) => {
    const { columnSet, values } = multipleColumnSet(params);
    const sql = `SELECT * FROM ${this.tableName} WHERE ${columnSet}`;
    const result = await coinQuery(sql, [...values]);
    return result[0];
  };

  /**
   * Create a new contact submission
   * @param {Object} contactData - Contact submission data
   * @returns {Promise<Object|null>} Created contact submission or null
   */
  create = async ({ name, email, phone, category, subject, message, ip_address, user_agent }) => {
    const sql = `
      INSERT INTO ${this.tableName}
      (name, email, phone, category, subject, message, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await coinQuery(sql, [
      name,
      email,
      phone || null,
      category,
      subject,
      message,
      ip_address || null,
      user_agent || null,
    ]);

    if (result && result.insertId) {
      return {
        id: result.insertId,
        name,
        email,
        phone,
        category,
        subject,
        message,
        status: "New",
        ip_address,
        user_agent,
        createdAt: new Date().toISOString(),
      };
    }

    return null;
  };

  /**
   * Update a contact submission (e.g., change status)
   * @param {Object} params - Fields to update
   * @param {number} id - Contact submission ID
   * @returns {Promise<Object>} Update result
   */
  update = async (params, id) => {
    const { columnSet, values } = multipleColumnSet(params);
    const sql = `UPDATE ${this.tableName} SET ${columnSet} WHERE id = ?`;
    const result = await coinQuery(sql, [...values, id]);
    return result;
  };

  /**
   * Delete a contact submission
   * @param {number} id - Contact submission ID
   * @returns {Promise<number>} Number of affected rows
   */
  delete = async (id) => {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await coinQuery(sql, [id]);
    const affectedRows = result ? result.affectedRows : 0;
    return affectedRows;
  };

  /**
   * Get contact submissions with pagination
   * @param {number} page - Page number (starts from 1)
   * @param {number} limit - Number of items per page
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Paginated results with metadata
   */
  findWithPagination = async (page = 1, limit = 10, filters = {}) => {
    // Ensure page and limit are numbers
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "";
    let values = [];

    if (Object.keys(filters).length) {
      // Build WHERE clause with AND instead of comma
      const keys = Object.keys(filters);
      const filterValues = Object.values(filters);
      const conditions = keys.map(key => `${key} = ?`).join(' AND ');
      whereClause = ` WHERE ${conditions}`;
      values = [...filterValues];
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM ${this.tableName}${whereClause}`;
    const countResult = await coinQuery(countSql, values);
    const total = countResult[0].total;

    // Get paginated results - use string interpolation for LIMIT/OFFSET to avoid prepared statement issues
    const sql = `SELECT * FROM ${this.tableName}${whereClause} ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}`;
    const data = await coinQuery(sql, values);

    return {
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  };
}

module.exports = new ContactUsModel();
