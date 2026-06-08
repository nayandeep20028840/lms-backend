const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

router.post('/login', authController.login);
router.post('/signup', authController.signup);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
