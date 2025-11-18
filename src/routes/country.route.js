const express = require("express");
const router = express.Router();
const countryController = require("../controllers/country.controller");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

// GET /api/v1/countries - Get list of countries (no authentication required)
router.get("/", awaitHandlerFactory(countryController.getCountries));

module.exports = router;
