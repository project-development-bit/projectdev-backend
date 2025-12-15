const express = require("express");
const router = express.Router();
const offerwallController = require("../controllers/offerwall.controller");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");

router.get(
  "/postback/:provider",
  awaitHandlerFactory(async (req, res, next) => {
    const provider = req.params.provider.toLowerCase();
  //     https://your-domain.com/api/v1/offerwall/postback/playtime?user_id={user_id}&offer_id={offer_id}&offer_name={offer_name}&payout={payo
  //    ut}&signature={signature}&event={event}&conversionDatetime={conversionDatetime}&clickDatetime={clickDatetime}&callback_type={callback
  //    _type}
    if (provider === "playtime") {
      return await offerwallController.handlePlaytimePostback(req, res, next);
    }

    return res.status(404).json({
      success: false,
      message: `Provider ${provider} not supported`,
      code: "PROVIDER_NOT_SUPPORTED",
    });
  })
);



module.exports = router;
