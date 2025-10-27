const https = require('https');
const querystring = require('querystring');
const HttpException = require('../utils/HttpException.utils');
const dotenv = require('dotenv');
dotenv.config();

const verifyRecaptcha = async (req, res, next) => {
    try {
        const { recaptchaToken } = req.body;

        const secretKey = process.env.RECAPTCHA_SECRET_KEY;

        if (!secretKey) {
            throw new HttpException(500, 'reCAPTCHA is not configured on the server', 'RECAPTCHA_NOT_CONFIGURED');
        }

        const postData = querystring.stringify({
            secret: secretKey,
            response: recaptchaToken
        });

        const options = {
            hostname: 'www.google.com',
            path: '/recaptcha/api/siteverify',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const googleResponse = await new Promise((resolve, reject) => {
            const request = https.request(options, (resp) => {
                let data = '';

                resp.on('data', (chunk) => {
                    data += chunk;
                });

                resp.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            request.on('error', (err) => {
                reject(err);
            });

            request.write(postData);
            request.end();
        });

        if (!googleResponse.success) {
            throw new HttpException(400, 'reCAPTCHA verification failed', 'RECAPTCHA_VERIFICATION_FAILED');
        }

        // Optional: Check score for reCAPTCHA v3
        // if (googleResponse.score && googleResponse.score < 0.5) {
        //     throw new HttpException(400, 'reCAPTCHA score too low', 'RECAPTCHA_LOW_SCORE');
        // }

        next();

    } catch (e) {
        e.status = e.status || 400;
        next(e);
    }
};


module.exports = verifyRecaptcha;
