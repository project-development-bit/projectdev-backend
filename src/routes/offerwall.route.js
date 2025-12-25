const express = require("express");
const router = express.Router();
const offerwallController = require("../controllers/offerwall.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

// Get offers
router.get(
  "/offers",
  auth(),
  awaitHandlerFactory(offerwallController.getPlaytimeOffers)
);

// Get surveys 
router.get(
  "/surveys",
  auth(),
  awaitHandlerFactory(offerwallController.getBitLabsSurveys)
);

// Get webhook logs
router.get(
  "/webhook-logs",
  auth(),
  awaitHandlerFactory(offerwallController.getWebhookLogs)
);

// Get offer
router.get(
  "/conversions",
  auth(),
  awaitHandlerFactory(offerwallController.getOfferConversions)
);

// Postback endpoints (public for webhook callbacks)
router.get(
  "/postback/playtime",
  awaitHandlerFactory(offerwallController.handlePlaytimePostback)
);

// Postback endpoints (public for webhook callbacks)
router.get(
  "/postback/bitlabs",
  awaitHandlerFactory(async (req, res, next) => {
    return await offerwallController.handleBitLabsPostback(req, res, next);
  })
);



module.exports = router;
