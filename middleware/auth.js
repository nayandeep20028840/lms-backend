const jwt = require("jsonwebtoken");
const logger = require("../utils/logger");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.user = {
      id: decoded.ulid,
      role: decoded.role,
      email: decoded.email
    };

    next();
  } catch (error) {
    logger.error("JWT Verification Error:", error);
    return res.status(401).json({ error: "Unauthorized: Token is invalid or expired" });
  }
};

module.exports = authMiddleware;
