const db = require('../config/db.config');

class BillingService {
  // Create or update billing information (UPSERT - only one record allowed)
  async setBillingInfo(billingData) {
    // First, check if a record exists
    const existing = await db.query('SELECT id FROM billing_information LIMIT 1');
    
    if (existing.rows.length > 0) {
      // Update existing record
      const result = await db.query(
        `UPDATE billing_information 
         SET 
           bank_account_name = $1,
           bank_account_number = $2,
           bank_name = $3,
           bank_branch = $4,
           bank_address = $5,
           account_type = $6,
           currency = $7,
           beneficiary_name = $8,
           contact_email = $9,
           contact_phone = $10,
           notes = $11,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $12
         RETURNING *`,
        [
          billingData.bank_account_name,
          billingData.bank_account_number,
          billingData.bank_name,
          billingData.bank_branch || null,
          billingData.bank_address || null,
          billingData.account_type,
          billingData.currency,
          billingData.beneficiary_name,
          billingData.contact_email,
          billingData.contact_phone || null,
          billingData.notes || null,
          existing.rows[0].id
        ]
      );
      
      return result.rows[0];
    } else {
      // Insert new record
      const result = await db.query(
        `INSERT INTO billing_information (
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
          notes,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          billingData.bank_account_name,
          billingData.bank_account_number,
          billingData.bank_name,
          billingData.bank_branch || null,
          billingData.bank_address || null,
          billingData.account_type,
          billingData.currency,
          billingData.beneficiary_name,
          billingData.contact_email,
          billingData.contact_phone || null,
          billingData.notes || null
        ]
      );
      
      return result.rows[0];
    }
  }
  
  // Get billing information
  async getBillingInfo() {
    const result = await db.query(
      `SELECT * FROM billing_information ORDER BY updated_at DESC LIMIT 1`
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }
}

module.exports = new BillingService();
