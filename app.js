require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const router = require('./router/route');
const app = express();

app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors());
app.use('/api/v1', router);

module.exports = app;
