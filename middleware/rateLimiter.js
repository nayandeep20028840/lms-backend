const { UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/dynamodb");

const TABLE_NAME = "CBS_POC_LMS";

const slidingWindowRateLimiter = (accessPatternName, limit) => {
    return async (req, res, next) => {
        try {
            const identifier = req.user?.id || req.body?.email || req.ip || 'anonymous';
            
            const now = Date.now();
            const currentMinute = Math.floor(now / 60000);
            const previousMinute = currentMinute - 1;
            const secondsIntoMinute = Math.floor((now % 60000) / 1000);
            
            const pk = `RATELIMIT#${accessPatternName}#${identifier}`;

            const getCommand = new GetCommand({
                TableName: TABLE_NAME,
                Key: { pk, sk: `BUCKET#${previousMinute}` }
            });
            const prevRes = await docClient.send(getCommand);
            const prevCount = prevRes.Item ? (prevRes.Item.reqCount || 0) : 0;

            const updateCommand = new UpdateCommand({
                TableName: TABLE_NAME,
                Key: { pk, sk: `BUCKET#${currentMinute}` },
                UpdateExpression: "ADD #count :inc SET expireAt = if_not_exists(expireAt, :expireAt)",
                ExpressionAttributeNames: { "#count": "reqCount" },
                ExpressionAttributeValues: { 
                    ":inc": 1,
                    ":expireAt": Math.floor(now / 1000) + 120 
                },
                ReturnValues: "UPDATED_NEW"
            });
            const currentRes = await docClient.send(updateCommand);
            const currentCount = currentRes.Attributes.reqCount;

            const previousWeight = (60 - secondsIntoMinute) / 60;
            const estimatedRequests = (prevCount * previousWeight) + currentCount;

            if (estimatedRequests > limit) {
                return res.status(429).json({ 
                    error: "Too Many Requests", 
                    message: "You have exceeded your request quota. Please try again later." 
                });
            }

            next();
        } catch (error) {
            console.error("Rate limiter error:", error);
            next();
        }
    };
};

module.exports = slidingWindowRateLimiter;
