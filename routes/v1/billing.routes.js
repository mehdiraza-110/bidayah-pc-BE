const express = require('express');
const router = express.Router();
const billingController = require('../../controllers/billing.controller');
const AuthGuard = require('../../middlewares/jwt.middleware');


router.post('/', billingController.setBillingInfo.bind(billingController));

module.exports = router;
