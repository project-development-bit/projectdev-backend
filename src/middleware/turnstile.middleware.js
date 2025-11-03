const HttpException = require('../utils/HttpException.utils');
const dotenv = require('dotenv');
dotenv.config();

const verifyTurnstile = (options = {}) => {
    const {
        expectedAction = null,
        includeRemoteIp = false
    } = options;

    return async (req, res, next) => {

        try {
            const { turnstileToken } = req.body;

            if (!turnstileToken) {
                // throw new HttpException(
                //     400,
                //     'Turnstile token is required',
                //     'TURNSTILE_TOKEN_REQUIRED'
                // );

                return next();
            }

            const secretKey = process.env.TURNSTILE_SECRET_KEY;

            if (!secretKey) {
                throw new HttpException(
                    500,
                    'Turnstile is not configured on the server',
                    'TURNSTILE_NOT_CONFIGURED'
                );
            }

            // Prepare form data
            const params = new URLSearchParams();
            params.append('secret', secretKey);
            params.append('response', turnstileToken);

            // Optionally include remote IP for additional verification
            if (includeRemoteIp) {
                const remoteIp = req.ip || req.connection.remoteAddress;
                if (remoteIp) {
                    params.append('remoteip', remoteIp);
                }
            }

            // Verify with Cloudflare
            const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params.toString()
            });

            if (!response.ok) {
                throw new HttpException(
                    502,
                    'Failed to verify Turnstile with Cloudflare',
                    'TURNSTILE_SERVICE_ERROR'
                );
            }

            const data = await response.json();

            // Check verification success
            if (!data.success) {
                const errorCodes = data['error-codes'] || [];
                throw new HttpException(
                    403,
                    'Turnstile verification failed',
                    'TURNSTILE_VERIFICATION_FAILED',
                    { errorCodes }
                );
            }

            // Validate action if specified
            if (expectedAction && data.action && data.action !== expectedAction) {
                throw new HttpException(
                    403,
                    'Turnstile action mismatch',
                    'TURNSTILE_ACTION_MISMATCH',
                    { expectedAction, got: data.action }
                );
            }

            // Attach verification data to request for further use if needed
            // req.turnstileData = {
            //     success: data.success,
            //     challengeTs: data.challenge_ts,
            //     hostname: data.hostname,
            //     action: data.action,
            //     cdata: data.cdata
            // };

            next();

        } catch (e) {
            if (e instanceof HttpException) {
                next(e);
            } else {
                next(new HttpException(
                    500,
                    'Turnstile verification error',
                    'TURNSTILE_ERROR',
                    { error: e.message }
                ));
            }
        }
    };
};

module.exports = verifyTurnstile;
