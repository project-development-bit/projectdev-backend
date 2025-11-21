const express = require("express");
const router = express.Router();
const earningsController = require("../controllers/earnings.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

// Get earnings statistics
router.get(
  "/statistics",
  auth(),
  awaitHandlerFactory(earningsController.getEarningsStatistics)
); // GET /api/v1/earnings/statistics?days=30

// Get earnings history with filters
router.get(
  "/history",
  auth(),
  awaitHandlerFactory(earningsController.getEarningsHistory)
); // GET /api/v1/earnings/history?days=30&page=1&limit=20&category=app

module.exports = router;
