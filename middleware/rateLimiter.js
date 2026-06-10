const rateLimit = require('express-rate-limit');

const loanRateLimiter = rateLimit({
    windowMs: 30 * 1000,
    max: 1,
    keyGenerator: (req) => {
        return req.user ? req.user.id : 'unauthenticated_user';
    },
    handler: (req, res) => {
        res.status(429).json({
            error: "Too many requests. Please wait 30 seconds before trying again."
        });
    }
});

module.exports = {
    loanRateLimiter
};
 