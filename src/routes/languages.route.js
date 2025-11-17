const express = require("express");
const router = express.Router();
const languagesController = require("../controllers/languages.controller");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

// Get all supported languages
router.get(
  "/",
  awaitHandlerFactory(languagesController.getAllLanguages)
); // GET /api/v1/languages

module.exports = router;
