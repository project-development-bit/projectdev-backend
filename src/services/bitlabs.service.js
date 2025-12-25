const HttpException = require("../utils/HttpException.utils");

const BITLABS_API_BASE_URL = "https://api.bitlabs.ai/v2/client";

const mapSurvey = (survey) => {
  return {
    id: survey.id,
    type: survey.type,
    clickUrl: survey.click_url,
    category: {
      name: survey.category?.name || "",
      nameInternal: survey.category?.name_internal || "",
      iconName: survey.category?.icon_name || "",
      iconUrl: survey.category?.icon_url || "",
    },
    country: survey.country,
    language: survey.language,
    loi: survey.loi, // Length of interview (in minutes)
    rating: survey.rating,
    cpi: survey.cpi, // Cost per interview
    value: survey.value, // Reward value in cents
    cr: survey.cr, // Conversion rate
    tags: survey.tags || [],
  };
};

const fetchSurveys = async (userId, options = {}) => {
  const apiToken = process.env.BITLABS_API_TOKEN;

  // Validate required credentials
  if (!apiToken) {
    throw new HttpException(
      500,
      "BitLabs API token not configured",
      "BITLABS_CONFIG_ERROR"
    );
  }

  // Validate required userId parameter
  if (!userId) {
    throw new HttpException(
      400,
      "User ID is required to fetch BitLabs surveys",
      "BITLABS_USER_ID_REQUIRED"
    );
  }

  // Extract pagination params for backend handling
  const page = parseInt(options.page) || 1;
  const limit = parseInt(options.limit) || 10;
  const sortOrder = options.sort || "desc"; // desc = highest value first

  const url = `${BITLABS_API_BASE_URL}/surveys`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Api-Token": apiToken,
        "X-User-Id": userId,
        "Content-Type": "application/json",
      },
    });

    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = "Failed to fetch surveys from BitLabs";

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error?.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }

      throw new HttpException(
        response.status,
        errorMessage,
        "BITLABS_API_ERROR",
        { statusCode: response.status }
      );
    }

    const data = await response.json();

    // Check for API error response
    if (data.status !== "success") {
      throw new HttpException(
        400,
        data.error?.message || "BitLabs API returned an error",
        "BITLABS_API_ERROR",
        { traceId: data.trace_id }
      );
    }

    // Map surveys to normalized format
    let normalizedSurveys = (data.data?.surveys || []).map(mapSurvey);

    // Sort by value (backend-side sorting)
    normalizedSurveys.sort((a, b) => {
      const aValue = parseInt(a.value) || 0;
      const bValue = parseInt(b.value) || 0;

      if (sortOrder === "asc") {
        return aValue - bValue;
      }
      return bValue - aValue; // desc (default)
    });

    // Calculate pagination (backend-side pagination)
    const totalSurveys = normalizedSurveys.length;
    const totalPages = Math.ceil(totalSurveys / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedSurveys = normalizedSurveys.slice(startIndex, endIndex);

    return {
      surveys: paginatedSurveys,
      pagination: {
        total: totalSurveys,
        totalPages: totalPages,
        currentPage: page,
        limit: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      traceId: data.trace_id,
    };
  } catch (error) {
    if (error instanceof HttpException) {
      throw error;
    }

    throw new HttpException(
      503,
      "Unable to connect to BitLabs API",
      "BITLABS_CONNECTION_ERROR",
      { originalError: error.message }
    );
  }
};

module.exports = {
  fetchSurveys,
  mapSurvey,
};
