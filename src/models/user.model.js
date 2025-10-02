const { onlineServiceQuery } = require("../config/db");
const { multipleColumnSet } = require("../utils/common.utils");
const Role = require("../utils/userRoles.utils");
class UserModel {
  tableName = "users";

  find = async (params = {}) => {
    let sql = `SELECT * FROM ${this.tableName}`;

    if (!Object.keys(params).length) {
      return await onlineServiceQuery(sql);
    }

    const { columnSet, values } = multipleColumnSet(params);
    sql += ` WHERE ${columnSet}`;

    return await onlineServiceQuery(sql, [...values]);
  };

  findOne = async (params) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = `SELECT * FROM ${this.tableName}
        WHERE ${columnSet}`;

    const result = await onlineServiceQuery(sql, [...values]);

    // return back the first row (user)
    return result[0];
  };

  checkEmail = async ({ email }) => {
    const sql = `SELECT 
    m.m_insuredNo,	
    m.m_email,
    m.m_name, 
    m.m_surname		
    FROM online_service.users u
    right  join datamart.m_insured m on m.m_insuredDependenceNo= u.memberID
    where u.username = ?`;

    const result = await onlineServiceQuery(sql, [email]);

    // return back the first row (user)
    return result[0];
  };

  checkMemberIDEmailDOB = async ({ member_id, email, dob }) => {
    const sql = `SELECT
    m.m_insuredNo,
    m.m_birthDate,
    m.m_email,
    m.m_name,
    m.m_surname,
    m.m_insuredDependenceNo,
    m.m_relationType,
    u.username,
    u.password,
    u.status
    FROM online_service.users u
    right  join datamart.m_insured m on m.m_insuredDependenceNo= u.memberID
    where m.m_email = ? and m.m_insuredDependenceNo = ? and m.m_birthDate= ?`;

    const result = await onlineServiceQuery(sql, [email, member_id, dob]);

    // return back the first row (user)
    return result[0];
  };

  checkMember = async (email) => {
    const sql = `Select memberID, username from users where username = ?`;

    const result = await onlineServiceQuery(sql, [email]);

    // return back the first row (user)
    return result[0];
  };

  savePassword = async ({ email }, { securityCode }) => {
    const sql = `UPDATE users SET verification_code = ? WHERE username = ?`;

    const result = await onlineServiceQuery(sql, [securityCode, email]);

    const affectedRows = result ? result.affectedRows : 0;

    return affectedRows;
  };

  register = async ({ member_id, email }, { securityCode, status }) => {
    let sql = "";
    let result = "";

    if (status == 0) {
      sql = `UPDATE users SET verification_code = ? WHERE username = ?`;

      result = await onlineServiceQuery(sql, [securityCode, email]);
    } else {
      sql = `INSERT INTO users (user_type,memberID,username,verification_code,status, password) VALUES (1, ?, ?, ?, 0, "-")`;

      result = await onlineServiceQuery(sql, [member_id, email, securityCode]);
    }

    const affectedRows = result ? result.affectedRows : 0;

    return affectedRows;
  };

  create = async ({
    username,
    password,
    first_name,
    last_name,
    email,
    role = Role.SuperUser,
    age = 0,
  }) => {
    const sql = `INSERT INTO ${this.tableName}
        (username, password, first_name, last_name, email, role, age) VALUES (?,?,?,?,?,?,?)`;

    const result = await onlineServiceQuery(sql, [
      username,
      password,
      first_name,
      last_name,
      email,
      role,
      age,
    ]);
    const affectedRows = result ? result.affectedRows : 0;

    return affectedRows;
  };

  updateTerms = async (params, email) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = `UPDATE users SET ${columnSet} WHERE username = ?`;

    const result = await onlineServiceQuery(sql, [...values, email]);

    return result;
  };

  update = async (params, id) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = `UPDATE users SET ${columnSet} WHERE id = ?`;

    const result = await onlineServiceQuery(sql, [...values, id]);

    return result;
  };

  checkSecurityCode = async ({ email, security_code }) => {
    const sql = `
    Select user_id, memberID from users where username = ? and verification_code = ?
  `;

    const result = await onlineServiceQuery(sql, [email, security_code]);

    // return back the first row (user)
    return result[0];
  };

  updateRegistrationStatus = async (id) => {
    const sql = `UPDATE users
    SET status = 1
    WHERE memberID = ?`;

    const result = await onlineServiceQuery(sql, [id]);

    return result;
  };

  updatePassword = async ({ memberID, password }) => {
    const sql = `UPDATE users
    SET password = ?, verification_code = NULL, status = 1
    WHERE memberID = ?`;

    const result = await onlineServiceQuery(sql, [password, memberID]);

    return result;
  };

  delete = async (id) => {
    const sql = `DELETE FROM ${this.tableName}
        WHERE id = ?`;
    const result = await onlineServiceQuery(sql, [id]);
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

    const result = await onlineServiceQuery(sql, [values[1], values[0]]);

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

    const result = await onlineServiceQuery(sql, [values[0], values[0]]);

    return result[0];
  };
}

module.exports = new UserModel();
