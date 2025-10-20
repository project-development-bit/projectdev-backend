const { coinQuery } = require("../config/db");
const { multipleColumnSet } = require("../utils/common.utils");
const Role = require("../utils/userRoles.utils");
class UserModel {
  tableName = "users";

  find = async (params = {}) => {
    let sql = `SELECT * FROM ${this.tableName}`;

    if (!Object.keys(params).length) {
      return await coinQuery(sql);
    }

    const { columnSet, values } = multipleColumnSet(params);
    sql += ` WHERE ${columnSet}`;

    return await coinQuery(sql, [...values]);
  };

  findOne = async (params) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = `SELECT * FROM ${this.tableName}
        WHERE ${columnSet}`;

    const result = await coinQuery(sql, [...values]);

    // return back the first row (user)
    return result[0];
  };

  checkEmail = async ({ email }) => {
    const sql = `SELECT 
    name, email
    FROM ${this.tableName}
    where email = ?`;

    const result = await coinQuery(sql, [email]);

    // return back the first row (user)
    return result[0];
  };

  savePassword = async ({ email }, { securityCode }) => {
    const sql = `UPDATE ${this.tableName} SET security_code = ? WHERE email = ?`;

    const result = await coinQuery(sql, [securityCode, email]);

    const affectedRows = result ? result.affectedRows : 0;

    return affectedRows;
  };

  register = async ({ member_id, email }, { securityCode, status }) => {
    let sql = "";
    let result = "";

    if (status == 0) {
      sql = `UPDATE users SET verification_code = ? WHERE username = ?`;

      result = await coinQuery(sql, [securityCode, email]);
    } else {
      sql = `INSERT INTO users (user_type,memberID,username,verification_code,status, password) VALUES (1, ?, ?, ?, 0, "-")`;

      result = await coinQuery(sql, [member_id, email, securityCode]);
    }

    const affectedRows = result ? result.affectedRows : 0;

    return affectedRows;
  };

  create = async (
    { name, password, email, role = Role.NormalUser },
    { securityCode }
  ) => {
    const sql = `
    INSERT INTO ${this.tableName} (name, password, email, role, security_code)
    VALUES (?, ?, ?, ?, ?)
  `;

    const result = await coinQuery(sql, [
      name,
      password,
      email,
      role,
      securityCode,
    ]);

    // Get inserted ID (MySQL usually returns insertId)
    if (result && result.insertId) {
      return {
        id: result.insertId,
        name,
        email,
        role,
        securityCode,
        createdAt: new Date().toISOString(),
      };
    }

    return null;
  };

  updateTerms = async (params, email) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = `UPDATE users SET ${columnSet} WHERE username = ?`;

    const result = await coinQuery(sql, [...values, email]);

    return result;
  };

  update = async (params, id) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = `UPDATE users SET ${columnSet} WHERE id = ?`;

    const result = await coinQuery(sql, [...values, id]);

    return result;
  };

  checkSecurityCode = async ({ email, security_code }) => {
    const sql = `
    Select id from users where email = ? and security_code = ?
  `;

    const result = await coinQuery(sql, [email, security_code]);

    // return back the first row (user)
    return result[0];
  };

  updateRegistrationStatus = async (email) => {
    const sql = `UPDATE users
    SET is_verified = 1
    where email = ?`;

    const result = await coinQuery(sql, [email]);

    return result;
  };

  updatePassword = async ({ email, password }) => {
    const sql = `UPDATE ${this.tableName}
    SET password = ?, security_code = NULL, is_verified = 1
    WHERE email = ?`;

    const result = await coinQuery(sql, [password, email]);

    return result;
  };

  delete = async (id) => {
    const sql = `DELETE FROM ${this.tableName}
        WHERE id = ?`;
    const result = await coinQuery(sql, [id]);
    const affectedRows = result ? result.affectedRows : 0;

    return affectedRows;
  };

  findPersonalInfo = async (params) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = `
    SELECT
	m.m_name,
	m.m_surname,
	m.m_birthDate,
	m.m_gender,
	m.m_email,
	m.m_nationality,
	m.m_occupation,
	m.m_cardNo AS passport,
	m.m_mobile,
	(
		SELECT
			adrss.m_address1
		FROM
			datamart.m_address adrss
		WHERE
			adrss.m_referenceNo = m.m_insuredno
			AND adrss.m_addrID = 1) AS address, (
			SELECT
				coalesce(adrss.m_address1, m.m_preferAddr)
			FROM
				datamart.m_address adrss
			WHERE
				adrss.m_referenceNo = m.m_insuredno
				AND adrss.m_addrID = 2) AS billingAddress, m.m_bank_name, m.m_bank_account_name, m.m_bank_account_no, m.m_insuredDependenceNo, u.user_id, m.m_insuredNo, m.m_insuredRelationType, m.m_relationType, u.username
		FROM
			online_service.users u
		LEFT JOIN datamart.m_insured m ON m.m_email = u.username
			AND m.m_insuredDependenceNo = u.memberID
	WHERE
		u.memberID = ?
		AND u.username LIKE ?
  `;

    const result = await coinQuery(sql, [values[1], values[0]]);

    // return back the first row (user)
    return result[0];
  };

  checkDocuments = async (params) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = `
    SELECT DISTINCT
	(
		SELECT
			COUNT(*)
		FROM
			lumaportal.lp_file
		WHERE
			file_type_id IN('7')
			AND deleted = 'No'
			AND c_insuredID = ?) AS PassportUploadCount, (
			SELECT
				COUNT(*)
			FROM
				lumaportal.lp_file
			WHERE
				file_type_id IN('8')
				AND deleted = 'No'
				AND c_insuredID = ?) AS BookbankUploadCount
		FROM
			lumaportal.lp_file;
  `;

    const result = await coinQuery(sql, [values[0], values[0]]);

    return result[0];
  };

  refreshToken = async ({ refreshToken, userID }) => {
    try {
      const sql = `UPDATE users SET refresh_token = ? WHERE id = ?`;
      const result = await coinQuery(sql, [refreshToken, userID]);

      return result;
    } catch (error) {
      console.error(error);
      return { success: false, error: "Internal server error" };
    }
  };
}

module.exports = new UserModel();
