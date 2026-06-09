const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const s3Controller = require('../controllers/s3Controller');
const loanController = require('../controllers/loanController');
const authMiddleware = require('../middleware/auth');

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
router.post('/request-loan', authMiddleware, loanController.requestLoan);
router.put('/loan/:loanReqId/status', authMiddleware, loanController.updateLoanStatus);
router.get('/loans/completed', authMiddleware, loanController.getCompletedLoans);

module.exports = router;
