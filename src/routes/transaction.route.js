const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transaction.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

router.get(
  "/",
  auth(),
  awaitHandlerFactory(transactionController.getTransactionHistory)
); // GET /api/v1/transactions

module.exports = router;
