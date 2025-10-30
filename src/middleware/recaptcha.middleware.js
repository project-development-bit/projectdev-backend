const HttpException = require('../utils/HttpException.utils');
const dotenv = require('dotenv');
dotenv.config();

const verifyRecaptcha = (options = {}) => {
    const {
        version = 'v3',
        expectedAction = null,
        minScore = 0.5
    } = options;

    return async (req, res, next) => {

        try {
            const { recaptchaToken } = req.body;

            if (!recaptchaToken) {
                // throw new HttpException(
                //     400,
                //     'reCAPTCHA token is required',
                //     'RECAPTCHA_TOKEN_REQUIRED'
                // );
                
                return next();
            }

            const secretKey = process.env.RECAPTCHA_SECRET_KEY;

            if (!secretKey) {
                throw new HttpException(
                    500,
                    'reCAPTCHA is not configured on the server',
                    'RECAPTCHA_NOT_CONFIGURED'
                );
            }

            // Prepare form data
            const params = new URLSearchParams();
            params.append('secret', secretKey);
            params.append('response', recaptchaToken);

            // Verify with Google
            const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString()
            });

            if (!response.ok) {
                throw new HttpException(
                    502,
                    'Failed to verify reCAPTCHA with Google',
                    'RECAPTCHA_SERVICE_ERROR'
                );
            }

            const data = await response.json();

            // Check verification success
            if (!data.success) {
                throw new HttpException(
                    403,
                    'reCAPTCHA verification failed',
                    'RECAPTCHA_VERIFICATION_FAILED',
                    { data }
                );
            }

            // For v3: validate score
            if (version === 'v3') {
                if (expectedAction && data.action && data.action !== expectedAction) {
                    throw new HttpException(
                        403,
                        `reCAPTCHA action mismatch`,
                        'RECAPTCHA_ACTION_MISMATCH',
                        { expectedAction, got: data.action }
                    );
                }

                if (typeof data.score === 'number' && data.score < Number(minScore)) {
                    throw new HttpException(
                        429,
                        'reCAPTCHA score too low',
                        'RECAPTCHA_LOW_SCORE',{
                            score:data.score
                        }
                    );
                }
            }

            next();

        } catch (e) {
            if (e instanceof HttpException) {
                next(e);
            } else {
                next(new HttpException(
                    500,
                    'reCAPTCHA verification error',
                    'RECAPTCHA_ERROR',
                    { error: e.message }
                ));
            }
        }
    };
};

module.exports = verifyRecaptcha;
