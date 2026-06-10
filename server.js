const serverless = require('serverless-http');
const app = require('./app');
const logger = require('./utils/logger');

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => logger.info('Local server running on port 3000'));
}

module.exports.handler = serverless(app);
