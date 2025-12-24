const HttpException = require("../utils/HttpException.utils");

const PLAYTIME_API_BASE_URL = "https://api.playtimeads.com/Api";

const mapOffer = (offer) => {
  return {
    id: offer.campaignId,
    name: offer.campaignName,
    description: offer.description,
    totalPayout: offer.totalPayout,
    model: offer.model,
    status: offer.status,

    app: {
      title: offer.app?.title || "",
      packageName: offer.app?.packageName || "",
      storeUrl: offer.app?.previewUrl || "",
      logo: offer.app?.logo || "",
      banner: offer.app?.bannerImage || "",
    },

    currency: {
      name: offer.currency?.name || "USD",
      symbol: offer.currency?.symbol || "$",
    },

    events: (offer.payoutEvents || []).map((event) => ({
      key: event.event,
      title: event.eventTitle,
      payout: event.payoutAmount,
    })),

    targeting: {
      os: offer.targeting?.os || "",
      countries: (offer.targeting?.countries || []).map((c) => c.iso),
    },

    tracking: {
      clickUrl: offer.tracking?.clickUrl || "",
      impressionUrl: offer.tracking?.impressionUrl || "",
    },
  };
};

const fetchOffers = async (options = {}) => {
  const appKey = process.env.PLAYTIME_APP_KEY;
  const appSecretKey = process.env.PLAYTIME_SECRET_KEY;

  // Validate required credentials
  if (!appKey || !appSecretKey) {
    throw new HttpException(
      500,
      "Playtime API credentials not configured",
      "PLAYTIME_CONFIG_ERROR"
    );
  }

  // Extract pagination params for backend handling
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 10;
  const sortOrder = options.sort || "desc"; // desc = highest payout first

  // Build query parameters only for API filters (not pagination)
  const params = new URLSearchParams();
  if (options.os) params.append("os", options.os);
  if (options.country) params.append("country", options.country);

  const url = `${PLAYTIME_API_BASE_URL}/Offers${
    params.toString() ? `?${params.toString()}` : ""
  }`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        AppKey: appKey,
        AppSecretKey: appSecretKey,
        "Content-Type": "application/json",
      },
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to fetch offers from Playtime";

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorMessage;
      } catch (e) {
        // If response is not JSON, use the text as error message
        errorMessage = errorText || errorMessage;
      }

      throw new HttpException(
        response.status,
        errorMessage,
        "PLAYTIME_API_ERROR",
        { statusCode: response.status }
      );
    }

    const data = await response.json();

    // Map offers to normalized format
    let normalizedOffers = (data.Offers || []).map(mapOffer);

    // Sort by totalPayout (backend-side sorting)
    normalizedOffers.sort((a, b) => {
      if (sortOrder === "asc") {
        return a.totalPayout - b.totalPayout;
      }
      return b.totalPayout - a.totalPayout; // desc (default)
    });

    // Calculate pagination (backend-side pagination)
    const totalOffers = normalizedOffers.length;
    const totalPages = Math.ceil(totalOffers / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOffers = normalizedOffers.slice(startIndex, endIndex);

    // Return normalized response with backend pagination
    return {
      offers: paginatedOffers,
      pagination: {
        total: totalOffers,
        totalPages: totalPages,
        currentPage: page,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    // Re-throw HttpException as is
    if (error instanceof HttpException) {
      throw error;
    }

    // Handle network errors or other fetch errors
    throw new HttpException(
      503,
      "Unable to connect to Playtime API",
      "PLAYTIME_CONNECTION_ERROR",
      { originalError: error.message }
    );
  }
};

module.exports = {
  fetchOffers,
  mapOffer,
};
