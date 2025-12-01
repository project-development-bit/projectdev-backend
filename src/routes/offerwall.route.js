const express = require("express");
const router = express.Router();
const offerwallController = require("../controllers/offerwall.controller");
const auth = require("../middleware/auth.middleware");
const awaitHandlerFactory = require("../middleware/awaitHandlerFactory.middleware");


// POST endpoint for providers that use POST method with type
router.post(
  "/:provider/:type/postback",
  awaitHandlerFactory(offerwallController.handlePostback)
);

// GET endpoint for providers that use GET method with type
router.get(
  "/:provider/:type/postback",
  awaitHandlerFactory(offerwallController.handlePostback)
);

// Backward compatibility: Support old /:provider/postback format
router.post(
  "/:provider/postback",
  awaitHandlerFactory(offerwallController.handlePostback)
);

router.get(
  "/:provider/postback",
  awaitHandlerFactory(offerwallController.handlePostback)
);

/**
 * Protected user endpoints (authentication required)
 */

// Get user's conversion history
router.get(
  "/conversions",
  auth(),
  awaitHandlerFactory(offerwallController.getUserConversions)
); // /api/v1/offerwalls/conversions

// Get user's conversion statistics
router.get(
  "/conversions/stats",
  auth(),
  awaitHandlerFactory(offerwallController.getUserConversionStats)
); // /api/v1/offerwalls/conversions/stats

// Get specific conversion by ID
router.get(
  "/conversions/:id",
  auth(),
  awaitHandlerFactory(offerwallController.getConversionById)
); // /api/v1/offerwalls/conversions/:id

module.exports = router;
