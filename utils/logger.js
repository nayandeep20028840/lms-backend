require('dotenv').config();
const { Logger } = require('@aws-lambda-powertools/logger');
const logger = new Logger();
module.exports = logger;
