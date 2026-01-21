const billingService = require('../services/billing.service');

class BillingController {
  // Set billing information (admin only)
  async setBillingInfo(req, res) {
    try {
      const {
        bank_account_name,
        bank_account_number,
        bank_name,
        bank_branch,
        bank_address,
        account_type,
        currency,
        beneficiary_name,
        contact_email,
        contact_phone,
        notes
      } = req.body;
      
      // Validation
      if (!bank_account_name || !bank_account_number || !bank_name || 
          !account_type || !currency || !beneficiary_name || !contact_email) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: bank_account_name, bank_account_number, bank_name, account_type, currency, beneficiary_name, contact_email'
        });
      }
      
      // Validate account_type
      const validAccountTypes = ['checking', 'savings', 'current', 'business'];
      if (!validAccountTypes.includes(account_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid account_type. Must be one of: ${validAccountTypes.join(', ')}`
        });
      }
      
      // Validate currency
      const validCurrencies = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR'];
      if (!validCurrencies.includes(currency)) {
        return res.status(400).json({
          success: false,
          message: `Invalid currency. Must be one of: ${validCurrencies.join(', ')}`
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact_email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
      
      const billingData = {
        bank_account_name,
        bank_account_number,
        bank_name,
        bank_branch: bank_branch || null,
        bank_address: bank_address || null,
        account_type,
        currency,
        beneficiary_name,
        contact_email,
        contact_phone: contact_phone || null,
        notes: notes || null
      };
      
      const billingInfo = await billingService.setBillingInfo(billingData);
      
      res.status(200).json({
        success: true,
        message: 'Billing information saved successfully',
        data: billingInfo
      });
    } catch (error) {
      console.error('Error setting billing information:', error);
      res.status(500).json({
        success: false,
        message: 'Error setting billing information',
        error: error.message
      });
    }
  }
  
  // Get billing information (public)
  async getBillingInfo(req, res) {
    try {
      const billingInfo = await billingService.getBillingInfo();
      
      if (!billingInfo) {
        return res.status(404).json({
          success: false,
          message: 'Billing information not found'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Billing information retrieved successfully',
        data: billingInfo
      });
    } catch (error) {
      console.error('Error fetching billing information:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching billing information',
        error: error.message
      });
    }
  }
}

module.exports = new BillingController();
