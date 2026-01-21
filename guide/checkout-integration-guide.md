# Checkout API Integration Guide

This guide provides comprehensive documentation for integrating the two checkout APIs: Bank Transfer and Agent Payment.

## Base URL
All checkout endpoints are prefixed with: `/api/v1/orders`

---

## API Endpoints

### 1. Bank Transfer Checkout
**POST** `/api/v1/orders/bank-transfer`

Creates an order with bank transfer payment method. Requires payment screenshot upload.

### 2. Agent Payment Checkout
**POST** `/api/v1/orders/agent`

Creates an order with agent payment method. No file upload required.

---

## Bank Transfer Checkout API

### Endpoint
**POST** `/api/v1/orders/bank-transfer`

### Authentication
- Not required (public endpoint)

### Content-Type
- `multipart/form-data` (required for file upload)

### Request Body

All fields should be sent as form data:

#### Required Fields

**Shipping Information:**
- `shipping_first_name` (string)
- `shipping_last_name` (string)
- `shipping_email` (string) - Valid email format
- `shipping_phone` (string) - Minimum 10 characters
- `shipping_address` (string)
- `shipping_city` (string)
- `shipping_state` (string)
- `shipping_zip_code` (string)
- `shipping_country` (string)

**Billing Information:**
- `billing_first_name` (string)
- `billing_last_name` (string)
- `billing_email` (string) - Valid email format
- `billing_address` (string)
- `billing_city` (string)
- `billing_state` (string)
- `billing_zip_code` (string)
- `billing_country` (string)

**Order Information:**
- `items` (string) - JSON array as string
- `payment_screenshot` (file) - Image file (required)
  - File types: JPEG, PNG, GIF, WebP
  - Max size: 10MB

**Note**: Shipping and tax are automatically calculated:
- `shipping` is always set to 0 (free shipping)
- `tax` is automatically calculated as 5% VAT of the subtotal
- Do not send `shipping` or `tax` in the request - they will be ignored

### Items Format

Items must be provided as a JSON string array:

```json
[
  {
    "id": "product-123",
    "name": "Product Name",
    "price": 100,
    "quantity": 2,
    "category": "Category Name",
    "vendor_id": "vendor-123",
    "image": "https://example.com/image.jpg"
  }
]
```

**Required item fields:**
- `id` (string) - Product ID
- `name` (string) - Product name
- `price` (number) - Product price (must be > 0)
- `quantity` (number) - Quantity (must be >= 1)

**Optional item fields:**
- `category` (string)
- `vendor_id` (string)
- `image` (string) - Product image URL

### Success Response (201)

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440006",
    "order_number": "ORD-2024-001",
    "status": "pending_payment",
    "payment_method": "bank-transfer",
    "shipping_info": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+971501234567",
      "address": "123 Main Street",
      "city": "Dubai",
      "state": "Dubai",
      "zip_code": "12345",
      "country": "United Arab Emirates"
    },
    "billing_info": {
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "address": "123 Main Street",
      "city": "Dubai",
      "state": "Dubai",
      "zip_code": "12345",
      "country": "United Arab Emirates"
    },
    "items": [
      {
        "id": "product-123",
        "name": "Product Name",
        "price": 100,
        "quantity": 2,
        "subtotal": 200,
        "category": "Category Name",
        "vendor_id": "vendor-123",
        "image": "https://example.com/image.jpg"
      }
    ],
    "subtotal": 200,
    "shipping": 0,
    "tax": 10,
    "total": 210,
    "payment_screenshot_url": "https://your-bucket.s3.ca-central-1.amazonaws.com/orders/payments/abc123.webp",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Responses

- **400 Bad Request**: Missing required fields or validation errors
- **422 Unprocessable Entity**: Invalid file type or size
- **500 Internal Server Error**: Server error

---

## Agent Payment Checkout API

### Endpoint
**POST** `/api/v1/orders/agent`

### Authentication
- Not required (public endpoint)

### Content-Type
- `application/json`

### Request Body

```json
{
  "shipping_first_name": "Jane",
  "shipping_last_name": "Smith",
  "shipping_email": "jane.smith@example.com",
  "shipping_phone": "+971509876543",
  "shipping_address": "456 Business Avenue",
  "shipping_city": "Abu Dhabi",
  "shipping_state": "Abu Dhabi",
  "shipping_zip_code": "54321",
  "shipping_country": "United Arab Emirates",
  "billing_first_name": "Jane",
  "billing_last_name": "Smith",
  "billing_email": "jane.smith@example.com",
  "billing_address": "456 Business Avenue",
  "billing_city": "Abu Dhabi",
  "billing_state": "Abu Dhabi",
  "billing_zip_code": "54321",
  "billing_country": "United Arab Emirates",
  "items": [
    {
      "id": "product-123",
      "name": "Product Name",
      "price": 100,
      "quantity": 2,
      "category": "Category Name",
      "vendor_id": "vendor-123",
      "image": "https://example.com/image.jpg"
    }
  ]
}
```

### Required Fields

Same as Bank Transfer, except:
- **No `payment_screenshot` field required**
- `items` is a JSON array (not a string)

### Success Response (201)

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": "bb0e8400-e29b-41d4-a716-446655440007",
    "order_number": "ORD-2024-002",
    "status": "agent_review",
    "payment_method": "agent",
    "shipping_info": {
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@example.com",
      "phone": "+971509876543",
      "address": "456 Business Avenue",
      "city": "Abu Dhabi",
      "state": "Abu Dhabi",
      "zip_code": "54321",
      "country": "United Arab Emirates"
    },
    "billing_info": {
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@example.com",
      "address": "456 Business Avenue",
      "city": "Abu Dhabi",
      "state": "Abu Dhabi",
      "zip_code": "54321",
      "country": "United Arab Emirates"
    },
    "items": [
      {
        "id": "product-123",
        "name": "Product Name",
        "price": 100,
        "quantity": 2,
        "subtotal": 200,
        "category": "Category Name",
        "vendor_id": "vendor-123",
        "image": "https://example.com/image.jpg"
      }
    ],
    "subtotal": 200,
    "shipping": 0,
    "tax": 10,
    "total": 210,
    "payment_screenshot_url": null,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Responses

- **400 Bad Request**: Missing required fields or validation errors
- **500 Internal Server Error**: Server error

---

## Validation Rules

### Email Validation
- Must be valid email format (regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
- Both shipping and billing emails are validated

### Phone Validation
- Minimum length: 10 characters
- Accepts international format (e.g., +971501234567)

### Payment Screenshot (Bank Transfer Only)
- **File type**: Must be an image
  - Allowed: `image/jpeg`, `image/jpg`, `image/png`, `image/gif`, `image/webp`
- **Max file size**: 10MB
- **Required**: Yes (for bank-transfer only)

### Items Validation
- At least one item required
- Each item must have: `id`, `name`, `price`, `quantity`
- `quantity` must be >= 1
- `price` must be > 0

### Order Status
- **Bank Transfer**: Automatically set to `"pending_payment"`
- **Agent**: Automatically set to `"agent_review"`

---

## Frontend Integration

### React/JavaScript Example

#### Bank Transfer Checkout

```javascript
const handleBankTransferCheckout = async (checkoutData, paymentScreenshot) => {
  const formData = new FormData();
  
  // Shipping Information
  formData.append('shipping_first_name', checkoutData.shipping.firstName);
  formData.append('shipping_last_name', checkoutData.shipping.lastName);
  formData.append('shipping_email', checkoutData.shipping.email);
  formData.append('shipping_phone', checkoutData.shipping.phone);
  formData.append('shipping_address', checkoutData.shipping.address);
  formData.append('shipping_city', checkoutData.shipping.city);
  formData.append('shipping_state', checkoutData.shipping.state);
  formData.append('shipping_zip_code', checkoutData.shipping.zipCode);
  formData.append('shipping_country', checkoutData.shipping.country);
  
  // Billing Information
  formData.append('billing_first_name', checkoutData.billing.firstName);
  formData.append('billing_last_name', checkoutData.billing.lastName);
  formData.append('billing_email', checkoutData.billing.email);
  formData.append('billing_address', checkoutData.billing.address);
  formData.append('billing_city', checkoutData.billing.city);
  formData.append('billing_state', checkoutData.billing.state);
  formData.append('billing_zip_code', checkoutData.billing.zipCode);
  formData.append('billing_country', checkoutData.billing.country);
  
  // Order Information
  formData.append('items', JSON.stringify(checkoutData.items));
  
  // Note: Shipping and tax are automatically calculated
  // Shipping is always 0, Tax is 5% VAT of subtotal
  
  // Payment Screenshot
  if (paymentScreenshot) {
    formData.append('payment_screenshot', paymentScreenshot);
  }
  
  try {
    const response = await fetch('http://localhost:3000/api/v1/orders/bank-transfer', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Order created:', data.data);
      // Redirect to success page with order number
      return data.data;
    } else {
      console.error('Error:', data.message);
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Checkout error:', error);
    throw error;
  }
};
```

#### Agent Payment Checkout

```javascript
const handleAgentCheckout = async (checkoutData) => {
  const orderData = {
    // Shipping Information
    shipping_first_name: checkoutData.shipping.firstName,
    shipping_last_name: checkoutData.shipping.lastName,
    shipping_email: checkoutData.shipping.email,
    shipping_phone: checkoutData.shipping.phone,
    shipping_address: checkoutData.shipping.address,
    shipping_city: checkoutData.shipping.city,
    shipping_state: checkoutData.shipping.state,
    shipping_zip_code: checkoutData.shipping.zipCode,
    shipping_country: checkoutData.shipping.country,
    
    // Billing Information
    billing_first_name: checkoutData.billing.firstName,
    billing_last_name: checkoutData.billing.lastName,
    billing_email: checkoutData.billing.email,
    billing_address: checkoutData.billing.address,
    billing_city: checkoutData.billing.city,
    billing_state: checkoutData.billing.state,
    billing_zip_code: checkoutData.billing.zipCode,
    billing_country: checkoutData.billing.country,
    
    // Order Information
    items: checkoutData.items.map(item => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.category,
      vendor_id: item.vendor_id,
      image: item.image
    }))
    // Note: Shipping and tax are automatically calculated
    // Shipping is always 0, Tax is 5% VAT of subtotal
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/v1/orders/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData)
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Order created:', data.data);
      // Redirect to success page with order number
      return data.data;
    } else {
      console.error('Error:', data.message);
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Checkout error:', error);
    throw error;
  }
};
```

### Complete React Component Example

```javascript
import React, { useState } from 'react';

const CheckoutPage = () => {
  const [paymentMethod, setPaymentMethod] = useState('bank-transfer');
  const [paymentScreenshot, setPaymentScreenshot] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let order;
      
      if (paymentMethod === 'bank-transfer') {
        if (!paymentScreenshot) {
          alert('Please upload payment screenshot');
          setLoading(false);
          return;
        }
        order = await handleBankTransferCheckout(checkoutData, paymentScreenshot);
      } else {
        order = await handleAgentCheckout(checkoutData);
      }
      
      // Redirect to success page
      window.location.href = `/order-success?orderNumber=${order.order_number}`;
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Payment method selection */}
      <div>
        <label>
          <input
            type="radio"
            value="bank-transfer"
            checked={paymentMethod === 'bank-transfer'}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          Bank Transfer
        </label>
        <label>
          <input
            type="radio"
            value="agent"
            checked={paymentMethod === 'agent'}
            onChange={(e) => setPaymentMethod(e.target.value)}
          />
          Agent Payment
        </label>
      </div>
      
      {/* Payment screenshot upload (only for bank-transfer) */}
      {paymentMethod === 'bank-transfer' && (
        <div>
          <label>Payment Screenshot *</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPaymentScreenshot(e.target.files[0])}
            required
          />
          <small>Max size: 10MB. Formats: JPEG, PNG, GIF, WebP</small>
        </div>
      )}
      
      {/* Other form fields */}
      {/* ... */}
      
      <button type="submit" disabled={loading}>
        {loading ? 'Processing...' : 'Place Order'}
      </button>
    </form>
  );
};
```

---

## cURL Examples

### Bank Transfer Checkout

```bash
curl -X POST http://localhost:3000/api/v1/orders/bank-transfer \
  -F "shipping_first_name=John" \
  -F "shipping_last_name=Doe" \
  -F "shipping_email=john.doe@example.com" \
  -F "shipping_phone=+971501234567" \
  -F "shipping_address=123 Main Street" \
  -F "shipping_city=Dubai" \
  -F "shipping_state=Dubai" \
  -F "shipping_zip_code=12345" \
  -F "shipping_country=United Arab Emirates" \
  -F "billing_first_name=John" \
  -F "billing_last_name=Doe" \
  -F "billing_email=john.doe@example.com" \
  -F "billing_address=123 Main Street" \
  -F "billing_city=Dubai" \
  -F "billing_state=Dubai" \
  -F "billing_zip_code=12345" \
  -F "billing_country=United Arab Emirates" \
  -F 'items=[{"id":"product-123","name":"Product Name","price":100,"quantity":2}]' \
  -F "shipping=0" \
  -F "tax=16" \
  -F "payment_screenshot=@/path/to/screenshot.jpg"
```

### Agent Payment Checkout

```bash
curl -X POST http://localhost:3000/api/v1/orders/agent \
  -H "Content-Type: application/json" \
  -d '{
    "shipping_first_name": "Jane",
    "shipping_last_name": "Smith",
    "shipping_email": "jane.smith@example.com",
    "shipping_phone": "+971509876543",
    "shipping_address": "456 Business Avenue",
    "shipping_city": "Abu Dhabi",
    "shipping_state": "Abu Dhabi",
    "shipping_zip_code": "54321",
    "shipping_country": "United Arab Emirates",
    "billing_first_name": "Jane",
    "billing_last_name": "Smith",
    "billing_email": "jane.smith@example.com",
    "billing_address": "456 Business Avenue",
    "billing_city": "Abu Dhabi",
    "billing_state": "Abu Dhabi",
    "billing_zip_code": "54321",
    "billing_country": "United Arab Emirates",
    "items": [
      {
        "id": "product-123",
        "name": "Product Name",
        "price": 100,
        "quantity": 2,
        "category": "Category Name",
        "vendor_id": "vendor-123"
      }
    ]
  }'
```

---

## Error Handling

### Common Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "All shipping fields are required",
  "error": "Missing required field: shipping_first_name"
}
```

#### 422 Unprocessable Entity (Bank Transfer Only)
```json
{
  "success": false,
  "message": "Payment screenshot must be an image file (JPEG, PNG, GIF, or WebP)",
  "error": "Invalid file type"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error creating order",
  "error": "Database connection error"
}
```

### Error Handling in Frontend

```javascript
const handleCheckout = async () => {
  try {
    const order = await handleBankTransferCheckout(data, screenshot);
    // Success
  } catch (error) {
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          alert(`Validation Error: ${data.message}`);
          break;
        case 422:
          alert(`File Error: ${data.message}`);
          break;
        case 500:
          alert(`Server Error: ${data.message}`);
          break;
        default:
          alert(`Error: ${data.message}`);
      }
    } else {
      alert(`Network Error: ${error.message}`);
    }
  }
};
```

---

## Order Number Format

Order numbers are automatically generated in the format:
- `ORD-YYYY-XXXX`
- Example: `ORD-2024-001`, `ORD-2024-1234`

---

## Database Schema

### Orders Table
- `id` - UUID (Primary Key)
- `order_number` - VARCHAR(50) UNIQUE
- `status` - ENUM('pending', 'pending_payment', 'agent_review', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
- `payment_method` - ENUM('bank-transfer', 'agent')
- Shipping and billing fields (as specified)
- `subtotal`, `shipping`, `tax`, `total` - DECIMAL(10, 2)
- `payment_screenshot_url` - VARCHAR(500) (nullable)
- `created_at`, `updated_at` - TIMESTAMP

### Order Items Table
- `id` - UUID (Primary Key)
- `order_id` - UUID (Foreign Key)
- `product_id`, `product_name`, `price`, `quantity`, `subtotal`
- `category`, `vendor_id`, `product_image` (nullable)
- `created_at`, `updated_at` - TIMESTAMP

---

## Summary

| Endpoint | Method | Payment Method | Content-Type | File Upload | Status |
|----------|--------|---------------|--------------|-------------|--------|
| `/api/v1/orders/bank-transfer` | POST | Bank Transfer | multipart/form-data | Required | pending_payment |
| `/api/v1/orders/agent` | POST | Agent | application/json | Not required | agent_review |

### Key Differences

1. **Content-Type**: Bank transfer uses `multipart/form-data`, Agent uses `application/json`
2. **File Upload**: Bank transfer requires payment screenshot, Agent does not
3. **Items Format**: Bank transfer uses JSON string, Agent uses JSON array
4. **Order Status**: Bank transfer → `pending_payment`, Agent → `agent_review`

---

## Best Practices

1. **Validate on Frontend**: Always validate form data before submission
2. **File Size Check**: Check file size before upload (max 10MB)
3. **Error Handling**: Implement comprehensive error handling
4. **Loading States**: Show loading indicators during submission
5. **Success Redirect**: Redirect to success page with order number
6. **Email Confirmation**: Send confirmation email to customer (implement separately)

---

## Testing Checklist

- [ ] Bank transfer checkout with valid data
- [ ] Bank transfer checkout with missing fields
- [ ] Bank transfer checkout with invalid email
- [ ] Bank transfer checkout with invalid file type
- [ ] Bank transfer checkout with file > 10MB
- [ ] Agent checkout with valid data
- [ ] Agent checkout with missing fields
- [ ] Agent checkout with invalid items
- [ ] Verify order number generation
- [ ] Verify order status assignment
- [ ] Verify totals calculation
