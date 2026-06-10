const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const s3Controller = require('../controllers/s3Controller');
const loanController = require('../controllers/loanController');
const authMiddleware = require('../middleware/auth');
const { loanRateLimiter } = require('../middleware/rateLimiter');

router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

router.post('/login', authController.login);
router.post('/signup', authController.signup);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);

// S3 Routes
router.post('/upload-url', s3Controller.generateUploadUrl);
router.get('/download-url', s3Controller.generateDownloadUrl);
router.post('/confirm-upload', authMiddleware, s3Controller.confirmUpload);

// Loan Routes
router.post('/request-loan', authMiddleware, loanRateLimiter, loanController.requestLoan);
router.put('/loan/:loanReqId/status', authMiddleware, loanRateLimiter, loanController.updateLoanStatus);
router.get('/loans/completed', authMiddleware, loanController.getCompletedLoans);
router.get('/loans/pending', authMiddleware, loanController.getPendingLoans);
router.get('/loans/pool', authMiddleware, loanController.getLoanPool);
router.delete('/loans/history', authMiddleware, loanController.clearCompletedLoans);

module.exports = router;
