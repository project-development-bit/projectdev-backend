const UserSessionModel = require("../models/userSession.model");
const RiskEventModel = require("../models/riskEvent.model");
const { RISK_EVENT_TYPES, RISK_SEVERITY } = require("../models/riskEvent.model");
const UserModel = require("../models/user.model");

//Risk Detection Service
class RiskDetectionService {

  async runRiskChecks(sessionData) {

    this.checkSameDeviceMultipleAccounts(sessionData).catch((err) => {
      console.error("Risk check failed (same device, multiple accounts):", err.message);
    });

    this.checkMultipleDevicesSameAccount(sessionData).catch((err) => {
      console.error("Risk check failed (multiple devices, same account):", err.message);
    });

    this.checkCountryChange(sessionData).catch((err) => {
      console.error("Risk check failed (country change):", err.message);
    });
  }

  //Check if the same device is used by multiple accounts (last 7 days)
  async checkSameDeviceMultipleAccounts(sessionData) {
    try {
      const { user_id, device_fp, ip } = sessionData;

      // Find other users who logged in with this device in last 7 days
      const otherUserIds = await UserSessionModel.findOtherUsersByDevice(
        device_fp,
        user_id,
        7
      );

      // If at least one other user found, create risk event
      if (otherUserIds.length > 0) {
        await RiskEventModel.create({
          user_id: user_id,
          type: RISK_EVENT_TYPES.SAME_DEVICE_MULTI_ACCOUNTS,
          severity: RISK_SEVERITY.MEDIUM,
          ip: ip,
          device_fp: device_fp,
          meta: {
            other_user_ids: otherUserIds,
            other_user_count: otherUserIds.length,
            detection_window_days: 7,
          },
        });

        console.log(
          `[RISK] Same device used by ${otherUserIds.length + 1} accounts. ` +
          `User: ${user_id}, Device: ${device_fp.substring(0, 16)}...`
        );
      }
    } catch (error) {
      console.error("Error in checkSameDeviceMultipleAccounts:", error);
    }
  }

  //Check if the same account is using many devices (last 7 days)
  async checkMultipleDevicesSameAccount(sessionData) {
    try {
      const { user_id, device_fp, ip } = sessionData;

      // Count distinct devices for this user in last 7 days
      const deviceCount = await UserSessionModel.countDistinctDevicesForUser(
        user_id,
        7
      );

      // If 3 or more devices, create risk event
      if (deviceCount >= 3) {
        await RiskEventModel.create({
          user_id: user_id,
          type: RISK_EVENT_TYPES.MULTI_DEVICE_SAME_ACCOUNT,
          severity: RISK_SEVERITY.MEDIUM,
          ip: ip,
          device_fp: device_fp,
          meta: {
            device_count: deviceCount,
            detection_window_days: 7,
          },
        });

        console.log(
          `[RISK] User ${user_id} logged in from ${deviceCount} different devices ` +
          `in the last 7 days.`
        );
      }
    } catch (error) {
      console.error("Error in checkMultipleDevicesSameAccount:", error);
    }
  }

  //Check if user's country suddenly changed
  async checkCountryChange(sessionData) {
    try {
      const { user_id, device_fp, ip, country } = sessionData;

      // Skip if no country info available
      if (!country) {
        return;
      }
      // Get user's profile country code
      const userProfile = await UserModel.getProfileWithCountry(user_id);

      // If user has a country code in their profile and it matches the session country, skip
      if (userProfile?.country_code && userProfile.country_code === country) {
        return;
      }

      // Get previous country (not current)
      const previousCountry = await UserSessionModel.getPreviousCountry(
        user_id,
        country
      );

      // If previous country exists and is different, create risk event
      if (previousCountry && previousCountry !== country) {
        await RiskEventModel.create({
          user_id: user_id,
          type: RISK_EVENT_TYPES.COUNTRY_CHANGED,
          severity: RISK_SEVERITY.LOW,
          ip: ip,
          device_fp: device_fp,
          meta: {
            previous_country: previousCountry,
            current_country: country,
            profile_country: userProfile?.country_code || null,
          },
        });

        console.log(
          `[RISK] User ${user_id} country changed from ${previousCountry} to ${country}.`
        );
      }
    } catch (error) {
      console.error("Error in checkCountryChange:", error);
    }
  }

  //Get risk score for a user based on recent events
  async getUserRiskScore(userId, daysBack = 7) {
    try {
      const riskSummary = await RiskEventModel.getUserRiskSummary(userId, daysBack);

      let riskScore = 0;
      const eventCounts = {
        low: 0,
        medium: 0,
        high: 0,
      };

      // Calculate risk score using severity values directly
      riskSummary.forEach((event) => {
        if (event.severity === RISK_SEVERITY.LOW) {
          eventCounts.low += event.count;
          riskScore += event.count * event.severity; // 1 point per event
        } else if (event.severity === RISK_SEVERITY.MEDIUM) {
          eventCounts.medium += event.count;
          riskScore += event.count * event.severity; // 2 points per event
        } else if (event.severity === RISK_SEVERITY.HIGH) {
          eventCounts.high += event.count;
          riskScore += event.count * event.severity; // 3 points per event
        }
      });

      return {
        userId,
        riskScore,
        eventCounts,
        riskLevel: this.getRiskLevel(riskScore),
        events: riskSummary,
      };
    } catch (error) {
      console.error("Error in getUserRiskScore:", error);
      return {
        userId,
        riskScore: 0,
        eventCounts: { low: 0, medium: 0, high: 0 },
        riskLevel: "UNKNOWN",
        events: [],
      };
    }
  }

  //Determine risk level based on score
  getRiskLevel(score) {
    if (score >= 10) return "HIGH";   // ~3-4 MEDIUM events or 10 LOW events
    if (score >= 5) return "MEDIUM";  // ~2-3 MEDIUM events or 5 LOW events
    if (score > 0) return "LOW";
    return "NONE";
  }
}

module.exports = new RiskDetectionService();
