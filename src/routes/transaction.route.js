const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transaction.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

// Get transaction summary/statistics
router.get(
  "/summary",
  auth(),
  awaitHandlerFactory(transactionController.getTransactionSummary)
); // GET /api/v1/transactions/summary

// Get user's transaction history with pagination
router.get(
  "/",
  auth(),
  awaitHandlerFactory(transactionController.getTransactionHistory)
); // GET /api/v1/transactions

module.exports = router;
