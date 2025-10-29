const express = require("express");
const router = express.Router();
const termsController = require("../controllers/terms.controller");

router.get(
  "/",
    termsController.getTermsAndPrivacy
); 

module.exports = router;
