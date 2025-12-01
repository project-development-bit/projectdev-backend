const crypto = require("crypto");

const providers = {
  ayetstudios: {
    name: "ayetstudios",
    displayName: "AyetStudios",
    types: ["offer", "survey", "rewards"], 
    requireSignature: false,
    allowedIPs: [], // Add AyetStudios IPs here when available
    validateSignature: (params, secretKey) => {
      // No signature validation documented
      return true;
    },
    /**
     * AyetStudios documentation:
     * https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks
     */
    parseParams: (params) => {
      // Detect chargeback - transaction_id starts with "r-" OR is_chargeback = 1
      const isChargeback =
        params.is_chargeback === "1" ||
        params.is_chargeback === 1 ||
        (params.transaction_id && params.transaction_id.startsWith("r-"));

      return {
        // CRITICAL: Use external_identifier for user ID
        externalUserId: params.external_identifier,

        // CRITICAL: Use transaction_id for conversion ID (NOT offer_id!)
        // transaction_id is unique per conversion, offer_id is same for multiple completions
        providerConversionId: params.transaction_id,

        // Offer identification
        offerId: params.offer_id || null,
        offerName: params.offer_name || null,

        // Financial data
        payoutUsd: params.payout_usd ? parseFloat(params.payout_usd) : null,
        currencyAmount: params.currency_amount ? parseFloat(params.currency_amount) : null,

        // Device and user info
        ip: params.ip || null,
        deviceUuid: params.device_uuid || null,
        deviceMake: params.device_make || null,
        deviceModel: params.device_model || null,
        advertisingId: params.advertising_id || null,

        // Chargeback information
        isChargeback: isChargeback,
        chargebackReason: params.chargeback_reason || null,
        chargebackDate: params.chargeback_date || null,

        // Status mapping
        status: isChargeback ? "reversed" : "credited",
      };
    },
    getResponse: (success = true) => {
      return "1"; // Always return 1 for success
    },
  },

  bitlabs: {
    name: "bitlabs",
    displayName: "BitLabs",
    types: ["offer", "survey", "rewards"],
    requireSignature: true, // BitLabs uses hash verification (SHA-1 HMAC)
    allowedIPs: [
      "20.76.54.40/29", // BitLabs IP range
      "18.199.243.90",
      "18.157.62.114",
      "18.193.24.206",
    ],

    /**
     *  BitLabs documentation:
     * https://developer.bitlabs.ai/docs/callbacks
     */
    validateSignature: (params, secretKey) => {
      if (!params.hash) {
        return false;
      }

      // Reconstruct the URI without the hash parameter
      const paramsWithoutHash = { ...params };
      delete paramsWithoutHash.hash;

      // Build query string from remaining parameters
      const queryString = Object.keys(paramsWithoutHash)
        .sort() // Sort for consistency
        .map((key) => `${key}=${paramsWithoutHash[key]}`)
        .join("&");

      // Calculate SHA-1 HMAC hash
      const calculatedHash = crypto
        .createHmac("sha1", secretKey)
        .update(queryString)
        .digest("hex");

      return calculatedHash === params.hash;
    },

    /**
     * https://developer.bitlabs.ai/docs/offer-callbacks
     * https://developer.bitlabs.ai/docs/survey-callbacks
     * https://developer.bitlabs.ai/docs/general-reward-callbacks
     */
    parseParams: (params) => {
      // BitLabs callback states
      // Surveys: COMPLETE, SCREENOUT, RECONCILIATION, START_BONUS
      // Offers: COMPLETED, PENDING, RECONCILED
      const callbackType = params.type || params.TYPE || null;
      const state = params.state || params.STATE || callbackType;

      // Determine status based on callback state
      let status = "credited";
      if (state === "SCREENOUT" || state === "PENDING") {
        status = "pending";
      } else if (state === "RECONCILIATION" || state === "RECONCILED") {
        status = "reconciled";
      }

      return {
        // User identification - BitLabs uses UID macro
        externalUserId: params.uid || params.UID || params.user_id,

        // Transaction ID for deduplication
        providerConversionId: params.tx || params.TX || params.transaction_id,

        // Offer/Survey identification
        offerId: params.offer_id || params.OFFER_ID || params.survey_id || params.SURVEY_ID || null,
        offerName: params.offer_name || params.survey_name || null,

        // Financial data
        // VAL = user reward in app currency
        // RAW = publisher payment in USD
        payoutUsd: params.raw || params.RAW ? parseFloat(params.raw || params.RAW) : null,
        currencyAmount: params.val || params.VAL || params.value ? parseFloat(params.val || params.VAL || params.value) : null,

        // Additional BitLabs-specific data
        country: params.country || params.COUNTRY || null,
        surveyRating: params.rating || params.RATING || null,
        surveyLoi: params.loi || params.LOI || null, // Length of interview in minutes
        surveyReason: params.reason || params.REASON || null, // Screenout reason
        activityType: params.activity_type || params.ACTIVITY_TYPE || callbackType,

        // Reference to previous transaction (for reconciliations)
        referenceTransaction: params.ref || params.REF || null,

        // IP address
        ip: params.ip || params.IP || null,

        // Callback state/type
        callbackState: state,
        status: status,
      };
    },
    getResponse: (success = true) => {
      return success ? "OK" : "ERROR";
    },
  },

  adgem: {
    name: "adgem",
    displayName: "AdGem",
    types: ["offer", "offerwall"], 
    requireSignature: true, // AdGem supports HMAC-SHA256 signature verification (v2/v3)
    allowedIPs: [],

    /**
     * AdGem documentation:
     * https://docs.adgem.com/publisher-support/offer-api-postback-setup
     */
    validateSignature: (params, secretKey, req = null) => {
      // v3 POST method - check Signature header
      if (req && req.headers && req.headers['signature']) {
        const signature = req.headers['signature'];
        const body = JSON.stringify(req.body);

        const calculatedHash = crypto
          .createHmac("sha256", secretKey)
          .update(body)
          .digest("hex");

        return calculatedHash === signature;
      }

      // v2 GET method - check verifier parameter
      if (!params.verifier || !params.request_id) {
        return false;
      }

      // Reconstruct URL without verifier
      const paramsWithoutVerifier = { ...params };
      delete paramsWithoutVerifier.verifier;

      // Build query string from remaining parameters (order matters)
      const queryString = Object.keys(paramsWithoutVerifier)
        .sort() // Sort for consistency
        .map((key) => `${key}=${encodeURIComponent(paramsWithoutVerifier[key])}`)
        .join("&");

      // Calculate HMAC-SHA256 hash
      const calculatedHash = crypto
        .createHmac("sha256", secretKey)
        .update(queryString)
        .digest("hex");

      return calculatedHash === params.verifier;
    },
    parseParams: (params) => {
      return {
        // User identification
        externalUserId: params.player_id || params.user_id,

        // Transaction ID for deduplication (recommended parameter)
        providerConversionId: params.transaction_id,

        // Offer/Campaign identification
        offerId: params.campaign_id || params.offer_id || null,
        offerName: params.campaign_name || params.offer_name || null,
        goalId: params.goal_id || null, // Multi-reward tracking

        // Financial data
        // payout = publisher revenue in USD (REQUIRED per docs)
        // amount = user reward amount
        payoutUsd: params.payout ? parseFloat(params.payout) : null,
        currencyAmount: params.amount ? parseFloat(params.amount) : null,

        // Device and user info
        ip: params.ip || null,
        country: params.country || null,
        platform: params.platform || null, // ios, android, web
        gaid: params.gaid || null, // Google Advertising ID
        idfa: params.idfa || null, // iOS Identifier for Advertisers

        // Timestamps
        conversionDatetime: params.conversion_datetime || null,
        clickDatetime: params.click_datetime || null,

        // AdGem-specific tracking
        requestId: params.request_id || null, // UUID for v2 hashing
        verifier: params.verifier || null, // Hash signature

        // Status - AdGem doesn't specify chargeback in docs, default to credited
        status: "credited",
      };
    },

    getResponse: (success = true) => {
      return success ? "OK" : "ERROR";
    },
  },

  playtimeads: {
    name: "playtimeads",
    displayName: "PlaytimeAds",
    types: ["playtime", "offerwall", "offer"], // Playtime-focused with level/task tracking
    requireSignature: true, // PlaytimeAds uses SHA1 signature validation
    allowedIPs: [], // No IP whitelisting documented

    /**
     * PlaytimeAds documentation:
     * https://docs.playtimeads.com/sdk-integration/setup-s2s-postback
     */
    validateSignature: (params, secretKey) => {
      if (!params.signature) {
        return false;
      }

      // PlaytimeAds requires both app_key and app_secret
      // Format: OFFERWALL_PLAYTIMEADS_SECRET should be "app_key:app_secret"
      const [appKey, appSecret] = secretKey.split(':');

      if (!appKey || !appSecret) {
        console.error('[playtimeads] Invalid secret format. Expected "app_key:app_secret"');
        return false;
      }

      // Build signature string: user_id + offer_id + amount + app_key + app_secret
      const signatureString = `${params.user_id}${params.offer_id}${params.amount}${appKey}${appSecret}`;

      // Calculate SHA1 hash
      const calculatedSignature = crypto
        .createHash("sha1")
        .update(signatureString)
        .digest("hex");

      return calculatedSignature === params.signature;
    },
    parseParams: (params) => {
      return {
        // User identification
        externalUserId: params.user_id,

        providerConversionId: params.task_id
          ? `${params.offer_id}_${params.task_id}_${Date.now()}`
          : `${params.offer_id}_${Date.now()}`,

        // Offer identification
        offerId: params.offer_id || null,
        offerName: params.offer_name || null,

        // Task information (for level/playtime offers)
        taskId: params.task_id || null,
        taskName: params.task_name || null,

        // Financial data
        // payout = publisher earnings per milestone
        // amount = user reward value (in configured currency)
        payoutUsd: params.payout ? parseFloat(params.payout) : null,
        currencyAmount: params.amount ? parseFloat(params.amount) : null,

        // Currency info
        currencyName: params.currency_name || null,

        // Signature for validation
        signature: params.signature || null,

        // Status - PlaytimeAds doesn't specify chargeback in docs, default to credited
        status: "credited",
      };
    },

    getResponse: (success = true) => {
      return success ? "OK" : "ERROR";
    },
  },

};

//Get provider configuration by name
const getProvider = (providerName) => {
  const provider = providers[providerName.toLowerCase()];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }
  return provider;
};

//Check if IP is allowed for provider
const isIpAllowed = (providerName, ip) => {
  const provider = getProvider(providerName);

  // If no IPs specified, allow all
  if (!provider.allowedIPs || provider.allowedIPs.length === 0) {
    return true;
  }

  // Check if IP is in allowed list
  return provider.allowedIPs.includes(ip);
};

const getAllProviders = () => {
  return Object.keys(providers);
};

module.exports = {
  providers,
  getProvider,
  isIpAllowed,
  getAllProviders,
};
