# Billing Information API Guide

This guide provides documentation for the Billing Information APIs used to manage admin banking details for checkout.

## Base URLs
- Admin: `/api/v1/billing`
- Public: `/api/v1/public/billing`

---

## Admin API

### Set Billing Information
**POST** `/api/v1/billing`

Sets or updates the admin's banking information. This endpoint uses UPSERT logic - if billing information already exists, it will be updated; otherwise, a new record will be created.

#### Authentication
- Requires valid JWT token (admin authentication)

#### Request Body
```json
{
  "bank_account_name": "John Doe",
  "bank_account_number": "1234567890",
  "bank_name": "ABC Bank",
  "bank_branch": "Main Branch",
  "bank_address": "123 Main Street, City, Country",
  "account_type": "checking",
  "currency": "USD",
  "beneficiary_name": "John Doe",
  "contact_email": "billing@example.com",
  "contact_phone": "+1234567890",
  "notes": "Additional notes for payment instructions"
}
```

#### Required Fields
- `bank_account_name` (string)
- `bank_account_number` (string)
- `bank_name` (string)
- `account_type` (string) - Must be one of: `"checking"`, `"savings"`, `"current"`, `"business"`
- `currency` (string) - Must be one of: `"AED"`, `"USD"`, `"EUR"`, `"GBP"`, `"SAR"`, `"INR"`
- `beneficiary_name` (string)
- `contact_email` (string) - Must be valid email format

#### Optional Fields
- `bank_branch` (string)
- `bank_address` (string)
- `contact_phone` (string)
- `notes` (string)

#### Success Response (200)
```json
{
  "success": true,
  "message": "Billing information saved successfully",
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440006",
    "bank_account_name": "John Doe",
    "bank_account_number": "1234567890",
    "bank_name": "ABC Bank",
    "bank_branch": "Main Branch",
    "bank_address": "123 Main Street, City, Country",
    "account_type": "checking",
    "currency": "USD",
    "beneficiary_name": "John Doe",
    "contact_email": "billing@example.com",
    "contact_phone": "+1234567890",
    "notes": "Additional notes for payment instructions",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses
- **400 Bad Request**: Missing required fields or invalid values
- **401 Unauthorized**: Not authenticated
- **500 Internal Server Error**: Server error

---

## Public API

### Get Billing Information
**GET** `/api/v1/public/billing`

Retrieves the admin's banking information for display on the checkout page. No authentication required.

#### Success Response (200)
```json
{
  "success": true,
  "message": "Billing information retrieved successfully",
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440006",
    "bank_account_name": "John Doe",
    "bank_account_number": "1234567890",
    "bank_name": "ABC Bank",
    "bank_branch": "Main Branch",
    "bank_address": "123 Main Street, City, Country",
    "account_type": "checking",
    "currency": "USD",
    "beneficiary_name": "John Doe",
    "contact_email": "billing@example.com",
    "contact_phone": "+1234567890",
    "notes": "Additional notes for payment instructions",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses
- **404 Not Found**: Billing information not found (not set yet)
- **500 Internal Server Error**: Server error

---

## Important Notes

### Account Type Values
- `checking` - Checking account
- `savings` - Savings account
- `current` - Current account
- `business` - Business account

### Currency Values
- `AED` - UAE Dirham
- `USD` - US Dollar
- `EUR` - Euro
- `GBP` - British Pound
- `SAR` - Saudi Riyal
- `INR` - Indian Rupee

### Single Record System
- Only one billing information record can exist at a time
- POST endpoint uses UPSERT logic (update if exists, insert if not)
- Each new POST will update the existing record

### Email Validation
- `contact_email` must be in valid email format
- Email format is validated using regex pattern

---

## Example cURL Commands

### Set Billing Information (Admin)
```bash
curl -X POST http://localhost:3000/api/v1/billing \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your_jwt_token" \
  -d '{
    "bank_account_name": "John Doe",
    "bank_account_number": "1234567890",
    "bank_name": "ABC Bank",
    "bank_branch": "Main Branch",
    "bank_address": "123 Main Street, City, Country",
    "account_type": "checking",
    "currency": "USD",
    "beneficiary_name": "John Doe",
    "contact_email": "billing@example.com",
    "contact_phone": "+1234567890",
    "notes": "Additional notes for payment instructions"
  }'
```

### Get Billing Information (Public)
```bash
curl -X GET http://localhost:3000/api/v1/public/billing
```

---

## Frontend Integration Examples

### JavaScript/Fetch API

#### Set Billing Information (Admin)
```javascript
const billingData = {
  bank_account_name: "John Doe",
  bank_account_number: "1234567890",
  bank_name: "ABC Bank",
  bank_branch: "Main Branch",
  bank_address: "123 Main Street, City, Country",
  account_type: "checking",
  currency: "USD",
  beneficiary_name: "John Doe",
  contact_email: "billing@example.com",
  contact_phone: "+1234567890",
  notes: "Additional notes for payment instructions"
};

fetch('http://localhost:3000/api/v1/billing', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include', // Include cookies for authentication
  body: JSON.stringify(billingData)
})
.then(response => response.json())
.then(data => {
  console.log(data);
});
```

#### Get Billing Information (Checkout Page)
```javascript
fetch('http://localhost:3000/api/v1/public/billing')
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      const billingInfo = data.data;
      // Display billing information on checkout page
      console.log('Bank Name:', billingInfo.bank_name);
      console.log('Account Number:', billingInfo.bank_account_number);
      console.log('Beneficiary:', billingInfo.beneficiary_name);
    } else {
      console.log('Billing information not available');
    }
  });
```

---

## Response Format

All responses follow this format:

#### Success Response
```json
{
  "success": true,
  "message": "Description message",
  "data": {
    // Billing information object
  }
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Error message description",
  "error": "Detailed error message"
}
```

---

## Database Schema Reference

### Billing Information Table
- `id` - Primary key (UUID, auto-generated)
- `bank_account_name` - VARCHAR(255) NOT NULL
- `bank_account_number` - VARCHAR(100) NOT NULL
- `bank_name` - VARCHAR(255) NOT NULL
- `bank_branch` - VARCHAR(255) (nullable)
- `bank_address` - TEXT (nullable)
- `account_type` - ENUM('checking', 'savings', 'current', 'business') NOT NULL
- `currency` - ENUM('AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR') NOT NULL
- `beneficiary_name` - VARCHAR(255) NOT NULL
- `contact_email` - VARCHAR(350) NOT NULL
- `contact_phone` - VARCHAR(50) (nullable)
- `notes` - TEXT (nullable)
- `created_at` - TIMESTAMP WITH TIME ZONE
- `updated_at` - TIMESTAMP WITH TIME ZONE (auto-updated)

---

## Summary

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/v1/billing` | POST | Set/update billing information | Required (Admin) |
| `/api/v1/public/billing` | GET | Get billing information | Not required |
