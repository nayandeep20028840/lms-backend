const serverless = require('serverless-http');
const app = require('./app');

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log('Local server running on port 3000'));
}

module.exports.handler = serverless(app);
