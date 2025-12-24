const express = require("express");
const router = express.Router();
const offerwallController = require("../controllers/offerwall.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

// Get offers from Playtime (protected route)
router.get(
  "/playtime/offers",
  //auth(),
  awaitHandlerFactory(offerwallController.getPlaytimeOffers)
);

// Postback endpoints (public for webhook callbacks)
router.get(
  "/postback/playtime",
  awaitHandlerFactory(async (req, res, next) => {
    return await offerwallController.handlePlaytimePostback(req, res, next);
  })
);

router.get(
  "/postback/bitlabs",
  awaitHandlerFactory(async (req, res, next) => {
    return await offerwallController.handleBitLabsPostback(req, res, next);
  })
);



module.exports = router;
