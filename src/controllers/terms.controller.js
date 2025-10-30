const HttpException = require("../utils/HttpException.utils");
/******************************************************************************
 *                              Terms Controller
 ******************************************************************************/
class TermsController {
    getTermsAndPrivacy = async (req, res, next) => {
        try {
            const data = {
                terms: {
                    version: process.env.TERMS_VERSION || "1.0",
                    url: process.env.TERMS_URL || "https://doc.gigafaucet.com/terms/terms.html",
                },
                privacy: {
                    version: process.env.PRIVACY_VERSION || "1.0",
                    url: process.env.PRIVACY_URL || "https://doc.gigafaucet.com/terms/privacy.html",
                },
            };
            res.status(200).json(data);
        } catch (error) {
            throw new HttpException(500, "Internal Server Error");
        }
    };
}

/******************************************************************************
 *                               Export
 ******************************************************************************/
module.exports = new TermsController();
