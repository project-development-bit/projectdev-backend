const express = require("express");
const router = express.Router();
const balanceController = require("../controllers/balance.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

// Get user's balance for all currencies
router.get(
  "/",
  auth(),
  awaitHandlerFactory(balanceController.getBalance)
); // GET /api/v1/balance

// Get user's balance for a specific currency
router.get(
  "/:currency",
  auth(),
  awaitHandlerFactory(balanceController.getBalanceByCurrency)
); // GET /api/v1/balance/COIN

module.exports = router;
