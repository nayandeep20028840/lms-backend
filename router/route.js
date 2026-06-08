const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

router.post('/login', authController.login);
router.post('/signup', authController.signup);

module.exports = router;
