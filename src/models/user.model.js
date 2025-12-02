const { coinQuery } = require("../config/db");
const { multipleColumnSet } = require("../utils/common.utils");
const Role = require("../utils/userRoles.utils");
class UserModel {
  tableName = "users";
  profilesTableName = "user_profiles";

  //Find users with optional profile data
  find = async (params = {}, includeProfile = true) => {
    let sql = includeProfile
      ? `SELECT
          u.*,
          up.name,
          up.avatar_url,
          up.country_id,
          up.language,
          up.interest_enable,
          up.risk_score,
          up.show_onboarding,
          up.notifications_enabled,
          up.show_stats_enabled,
          up.anonymous_in_contests
         FROM ${this.tableName} u
         LEFT JOIN ${this.profilesTableName} up ON u.id = up.user_id`
      : `SELECT * FROM ${this.tableName}`;

    if (!Object.keys(params).length) {
      return await coinQuery(sql);
    }

    const { columnSet, values } = multipleColumnSet(params);
    sql += ` WHERE ${includeProfile ? 'u.' : ''}${columnSet.replace(/,/g, includeProfile ? ' AND u.' : ' AND ')}`;

    return await coinQuery(sql, [...values]);
  };

  //Find a single user by parameters
  findOne = async (params, includeProfile = true) => {
    const { columnSet, values } = multipleColumnSet(params);

    const sql = includeProfile
      ? `SELECT
          u.*,
          up.name,
          up.avatar_url,
          up.country_id,
          up.language,
          up.interest_enable,
          up.risk_score,
          up.show_onboarding,
          up.notifications_enabled,
          up.show_stats_enabled,
          up.anonymous_in_contests
         FROM ${this.tableName} u
         LEFT JOIN ${this.profilesTableName} up ON u.id = up.user_id
         WHERE ${columnSet.split(',').map(col => 'u.' + col.trim()).join(' AND ')}`
      : `SELECT * FROM ${this.tableName} WHERE ${columnSet}`;

    const result = await coinQuery(sql, [...values]);
    return result[0];
  };

  checkEmail = async ({ email }) => {
    const sql = `SELECT
      u.id,
      up.name,
      u.email
    FROM ${this.tableName} u
    LEFT JOIN ${this.profilesTableName} up ON u.id = up.user_id
    WHERE u.email = ?`;

    const result = await coinQuery(sql, [email]);
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
    { name, password, email, role = Role.NormalUser, interest_enable = 0, referred_by = null, country_id = null, language = null, show_onboarding = 1 },
    { securityCode, referralCode }
  ) => {
    try {
      // Insert into users table (core authentication data)
      const userSql = `
        INSERT INTO ${this.tableName}
        (email, password, role, security_code, referral_code, referred_by, is_verified, is_banned)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0)
      `;

      const userResult = await coinQuery(userSql, [
        email,
        password,
        role,
        securityCode,
        referralCode,
        referred_by
      ]);

      const userId = userResult.insertId;

      // Insert into user_profiles table
      const profileSql = `
        INSERT INTO ${this.profilesTableName}
        (user_id, name, country_id, language, interest_enable, risk_score, show_onboarding, notifications_enabled, show_stats_enabled, anonymous_in_contests)
        VALUES (?, ?, ?, ?, ?, 0, ?, 1, 1, 0)
      `;

      await coinQuery(profileSql, [
        userId,
        name || '',
        country_id,
        language,
        interest_enable,
        show_onboarding
      ]);

      // Return created user object
      return {
        id: userId,
        name,
        email,
        role,
        interest_enable,
        referralCode,
        securityCode,
        referred_by,
        country_id,
        language,
        show_onboarding,
        createdAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error('User creation failed:', error);
      throw error;
    }
  };

  //Update user (handles both users and user_profiles tables
  update = async (params, id) => {
    // Separate parameters into users table columns and profile columns
    const userColumns = ['email', 'password', 'role', 'refresh_token', 'security_code',
                        'twofa_enabled', 'twofa_secret', 'is_banned', 'is_verified',
                        'referral_code', 'referred_by', 'last_login_at', 'offer_token', 'security_pin_enabled'];

    const profileColumns = ['name', 'avatar_url', 'country_id', 'language', 'interest_enable', 'risk_score', 'show_onboarding', 'notifications_enabled', 'show_stats_enabled', 'anonymous_in_contests'];

    const userParams = {};
    const profileParams = {};

    Object.keys(params).forEach(key => {
      if (userColumns.includes(key)) {
        userParams[key] = params[key];
      } else if (profileColumns.includes(key)) {
        profileParams[key] = params[key];
      }
    });

    try {
      let userResult = null;
      let profileResult = null;

      // Update users table if there are user-related changes
      if (Object.keys(userParams).length > 0) {
        const { columnSet, values } = multipleColumnSet(userParams);
        const userSql = `UPDATE ${this.tableName} SET ${columnSet} WHERE id = ?`;
        userResult = await coinQuery(userSql, [...values, id]);

      }

      // Update user_profiles table if there are profile-related changes
      if (Object.keys(profileParams).length > 0) {
        // First check if profile exists, if not create it
        const checkProfileSql = `SELECT user_id FROM ${this.profilesTableName} WHERE user_id = ?`;
        const profileExists = await coinQuery(checkProfileSql, [id]);

        if (!profileExists || profileExists.length === 0) {
          // Create profile if it doesn't exist
          const insertProfileSql = `INSERT INTO ${this.profilesTableName}
            (user_id, name, country_id, language, interest_enable, risk_score, show_onboarding, notifications_enabled, show_stats_enabled, anonymous_in_contests)
            VALUES (?, '', NULL, NULL, 0, 0, 1, 1, 1, 0)`;
          await coinQuery(insertProfileSql, [id]);
          console.log('Created missing user_profile for user_id:', id);
        }

        const { columnSet, values } = multipleColumnSet(profileParams);
        const profileSql = `UPDATE ${this.profilesTableName} SET ${columnSet} WHERE user_id = ?`;
        profileResult = await coinQuery(profileSql, [...values, id]);
      }

      // Return actual affected rows
      const affectedRows = (userResult?.affectedRows || 0) + (profileResult?.affectedRows || 0);
      const changedRows = (userResult?.changedRows || 0) + (profileResult?.changedRows || 0);

      console.log('Final result - affectedRows:', affectedRows, 'changedRows:', changedRows);

      return {
        success: true,
        affectedRows: affectedRows,
        changedRows: changedRows
      };

    } catch (error) {
      console.error('User update failed:', error);
      throw error;
    }
  };

  
  updateTerms = async (params, email) => {
    const { columnSet, values } = multipleColumnSet(params);
    const sql = `UPDATE ${this.tableName} SET ${columnSet} WHERE email = ?`;
    const result = await coinQuery(sql, [...values, email]);
    return result;
  };

  checkSecurityCode = async ({ email, security_code }) => {
    const sql = `SELECT id FROM ${this.tableName} WHERE email = ? AND security_code = ?`;
    const result = await coinQuery(sql, [email, security_code]);
    return result[0];
  };

  updateRegistrationStatus = async (email) => {
    const sql = `UPDATE ${this.tableName} SET is_verified = 1 WHERE email = ?`;
    const result = await coinQuery(sql, [email]);
    return result;
  };

  updatePassword = async ({ email, password }) => {
    const sql = `UPDATE ${this.tableName} SET password = ?, security_code = NULL WHERE email = ?`;
    const result = await coinQuery(sql, [password, email]);
    return result;
  };

  delete = async (id) => {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    const result = await coinQuery(sql, [id]);
    const affectedRows = result ? result.affectedRows : 0;
    return affectedRows;
  };

  deleteWithAllData = async (id) => {
    try {
      const user = await this.findOne({ id }, true);

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Delete all related data

      // Delete balances
      await coinQuery('DELETE FROM balances WHERE user_id = ?', [id]);

      // Delete deposits
      await coinQuery('DELETE FROM deposits WHERE user_id = ?', [id]);

      // Delete faucet claims
      await coinQuery('DELETE FROM faucet_claims WHERE user_id = ?', [id]);

      // Delete withdrawals
      await coinQuery('DELETE FROM withdrawals WHERE user_id = ?', [id]);

      // Delete user addresses
      await coinQuery('DELETE FROM user_addresses WHERE user_id = ?', [id]);

      // Delete user promotions
      await coinQuery('DELETE FROM user_promotions WHERE user_id = ?', [id]);

      // Update risk_events - set user_id to NULL (has ON DELETE SET NULL)
      await coinQuery('UPDATE risk_events SET user_id = NULL WHERE user_id = ?', [id]);

      // Delete offer_conversions (has ON DELETE CASCADE, but explicit delete for safety)
      await coinQuery('DELETE FROM offer_conversions WHERE user_id = ?', [id]);

      // Delete user_sessions (has ON DELETE CASCADE, but explicit delete for safety)
      await coinQuery('DELETE FROM user_sessions WHERE user_id = ?', [id]);

      // Update referrals - set referred_by to NULL for users referred by this user
      await coinQuery(`UPDATE ${this.tableName} SET referred_by = NULL WHERE referred_by = ?`, [id]);

      // Delete from referrals table (where user is referrer or referee)
      await coinQuery('DELETE FROM referrals WHERE referrer_id = ? OR referee_id = ?', [id, id]);

      // Delete user_profiles (has ON DELETE CASCADE, but explicit delete for safety)
      await coinQuery(`DELETE FROM ${this.profilesTableName} WHERE user_id = ?`, [id]);

      // Finally, delete the user record
      const deleteUserSql = `DELETE FROM ${this.tableName} WHERE id = ?`;
      const result = await coinQuery(deleteUserSql, [id]);

      const affectedRows = result ? result.affectedRows : 0;

      if (affectedRows === 0) {
        return { success: false, error: 'Failed to delete user' };
      }

      return {
        success: true,
        affectedRows: affectedRows,
        deletedUser: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar_url: user.avatar_url
        }
      };

    } catch (error) {
      console.error('User deletion failed:', error);
      throw error;
    }
  };

  refreshToken = async ({ refreshToken, userID }) => {
    try {
      const sql = `UPDATE ${this.tableName} SET refresh_token = ? WHERE id = ?`;
      const result = await coinQuery(sql, [refreshToken, userID]);
      return result;
    } catch (error) {
      console.error(error);
      return { success: false, error: "Internal server error" };
    }
  };


  // Get complete user profile with country information
  getProfileWithCountry = async (userId) => {
    const sql = `
      SELECT
        u.id,
        u.email,
        u.offer_token,
        u.twofa_enabled,
        u.security_pin_enabled,
        u.created_at,
        up.name as username,
        up.avatar_url,
        up.country_id,
        up.language,
        up.notifications_enabled,
        up.show_stats_enabled,
        up.anonymous_in_contests,
        c.code as country_code,
        c.name as country_name,
        c.flag as country_flag
      FROM ${this.tableName} u
      LEFT JOIN ${this.profilesTableName} up ON u.id = up.user_id
      LEFT JOIN countries c ON up.country_id = c.id
      WHERE u.id = ?
    `;

    const result = await coinQuery(sql, [userId]);
    return result[0];
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

  //Get user's XP by user ID
  getUserXp = async (userId) => {
    const sql = `
      SELECT id, xp
      FROM ${this.tableName}
      WHERE id = ?
    `;

    const result = await coinQuery(sql, [userId]);

    if (!result || result.length === 0) {
      return null;
    }

    return result[0];
  };

  // Check if email exists (for another user)
  emailExists = async (email, excludeUserId = null) => {
    let sql = `SELECT id FROM ${this.tableName} WHERE email = ?`;
    const params = [email];

    if (excludeUserId) {
      sql += ` AND id != ?`;
      params.push(excludeUserId);
    }

    const result = await coinQuery(sql, params);
    return result.length > 0;
  };

  // Update user email
  updateEmail = async (userId, newEmail) => {
    const sql = `UPDATE ${this.tableName} SET email = ? WHERE id = ?`;
    const result = await coinQuery(sql, [newEmail, userId]);
    return result;
  };
  // Update user password by ID and invalidate refresh token
  updatePasswordById = async (userId, hashedPassword) => {
    const sql = `UPDATE ${this.tableName} SET password = ?, refresh_token = NULL WHERE id = ?`;
    const result = await coinQuery(sql, [hashedPassword, userId]);
    return result;
  };

  // Get user password hash for verification
  getPasswordHash = async (userId) => {
    const sql = `SELECT password FROM ${this.tableName} WHERE id = ?`;
    const result = await coinQuery(sql, [userId]);
    return result[0];
  };

  // Security PIN methods
  enableSecurityPin = async (userId, hashedPin) => {
    const sql = `UPDATE ${this.tableName} SET security_pin_enabled = 1, security_pin = ? WHERE id = ?`;
    const result = await coinQuery(sql, [hashedPin, userId]);
    return result;
  };

  disableSecurityPin = async (userId) => {
    const sql = `UPDATE ${this.tableName} SET security_pin_enabled = 0, security_pin = NULL WHERE id = ?`;
    const result = await coinQuery(sql, [userId]);
    return result;
  };

  getSecurityPinHash = async (userId) => {
    const sql = `SELECT security_pin, security_pin_enabled FROM ${this.tableName} WHERE id = ?`;
    const result = await coinQuery(sql, [userId]);
    return result[0];
  };

  checkSecurityPinStatus = async (userId) => {
    const sql = `SELECT security_pin_enabled FROM ${this.tableName} WHERE id = ?`;
    const result = await coinQuery(sql, [userId]);
    return result[0];
  };

  // Password History
  getPasswordHistory = async (userId, limit = 5) => {
    // Ensure limit is an integer to prevent SQL injection
    const limitValue = parseInt(limit) || 5;

    const sql = `
      SELECT password_hash, created_at
      FROM password_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ${limitValue}
    `;
    const result = await coinQuery(sql, [userId]);
    return result;
  };

  // Add password to history
  addPasswordToHistory = async (userId, passwordHash) => {
    const sql = `
      INSERT INTO password_history (user_id, password_hash)
      VALUES (?, ?)
    `;
    const result = await coinQuery(sql, [userId, passwordHash]);
    return result;
  };

  cleanOldPasswordHistory = async (userId, keepCount = 5) => {
    const keepValue = parseInt(keepCount) || 5;

    const sql = `
      DELETE FROM password_history
      WHERE user_id = ?
      AND id NOT IN (
        SELECT id FROM (
          SELECT id
          FROM password_history
          WHERE user_id = ?
          ORDER BY created_at DESC
          LIMIT ${keepValue}
        ) AS keep_passwords
      )
    `;
    const result = await coinQuery(sql, [userId, userId]);
    return result;
  };
}

module.exports = new UserModel();
