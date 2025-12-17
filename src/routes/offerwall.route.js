const express = require("express");
const router = express.Router();
const offerwallController = require("../controllers/offerwall.controller");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

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
