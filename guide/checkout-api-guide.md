# Checkout API Guide

This guide provides documentation for the Checkout/Order APIs used to create orders from the checkout page.

## Base URL
- Public: `/api/v1/orders`

---

## Create Order

**POST** `/api/v1/orders`

Creates a new order from the checkout page. Supports two payment methods: Bank Transfer and Agent.

### Authentication
- Not required (public endpoint)

### Request Body

#### For Bank Transfer (multipart/form-data)
```json
{
  "shipping_first_name": "John",
  "shipping_last_name": "Doe",
  "shipping_email": "john.doe@example.com",
  "shipping_phone": "+971501234567",
  "shipping_address": "123 Main Street",
  "shipping_city": "Dubai",
  "shipping_state": "Dubai",
  "shipping_zip_code": "12345",
  "shipping_country": "United Arab Emirates",
  "billing_first_name": "John",
  "billing_last_name": "Doe",
  "billing_email": "john.doe@example.com",
  "billing_address": "123 Main Street",
  "billing_city": "Dubai",
  "billing_state": "Dubai",
  "billing_zip_code": "12345",
  "billing_country": "United Arab Emirates",
  "payment_method": "bank-transfer",
  "items": "[{\"id\":\"product-123\",\"name\":\"Product Name\",\"price\":100,\"quantity\":2}]",
  "payment_screenshot": "<File>"
}
```

#### For Agent Payment (application/json)
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
  "payment_method": "agent",
  "items": [
    {
      "id": "product-123",
      "name": "Product Name",
      "category": "Category Name",
      "price": 100,
      "quantity": 2,
      "vendor_id": "vendor-123"
    }
  ]
}
```

### Required Fields

#### Shipping Information
- `shipping_first_name` (string)
- `shipping_last_name` (string)
- `shipping_email` (string) - Must be valid email format
- `shipping_phone` (string)
- `shipping_address` (string)
- `shipping_city` (string)
- `shipping_state` (string)
- `shipping_zip_code` (string)
- `shipping_country` (string)

#### Billing Information
- `billing_first_name` (string)
- `billing_last_name` (string)
- `billing_email` (string) - Must be valid email format
- `billing_address` (string)
- `billing_city` (string)
- `billing_state` (string)
- `billing_zip_code` (string)
- `billing_country` (string)

#### Order Information
- `payment_method` (string) - Must be `"bank-transfer"` or `"agent"`
- `items` (array or JSON string) - Array of order items

#### Bank Transfer Specific
- `payment_screenshot` (file) - Required when `payment_method === "bank-transfer"`
  - File type: Image only (`image/*`)
  - Max size: 10MB

### Order Items Structure

Each item in the `items` array should contain:
```json
{
  "id": "string",           // Product ID (required)
  "name": "string",         // Product name (required)
  "price": "number",        // Product price (required)
  "quantity": "number",     // Quantity (required, min: 1)
  "category": "string",     // Category name or ID (optional)
  "vendor_id": "string",    // Vendor ID (optional)
  "image": "string"         // Product image URL (optional)
}
```

### Order Status

- **Bank Transfer**: Order status should be set to `"pending"` or `"pending_payment"`
- **Agent**: Order status should be set to `"agent_review"`

### Success Response (200)

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440006",
    "order_number": "ORD-2024-001",
    "status": "pending" | "agent_review",
    "payment_method": "bank-transfer" | "agent",
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
        "subtotal": 200
      }
    ],
    "subtotal": 200,
    "shipping": 0,
    "tax": 16,
    "total": 216,
    "payment_screenshot_url": "https://example.com/screenshots/order-123.jpg", // Only for bank-transfer
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Responses

- **400 Bad Request**: Missing required fields, invalid data, or validation errors
- **422 Unprocessable Entity**: Invalid file type or size for payment screenshot
- **500 Internal Server Error**: Server error

---

## Validation Rules

### Email Validation
- Must be valid email format
- Both shipping and billing emails are validated

### Phone Validation
- Should accept international format (e.g., +971501234567)
- Minimum length: 10 characters

### Payment Screenshot (Bank Transfer)
- File type: Must be an image (`image/jpeg`, `image/png`, `image/gif`, `image/webp`)
- Max file size: 10MB
- Required when `payment_method === "bank-transfer"`

### Items Validation
- At least one item required
- Each item must have: `id`, `name`, `price`, `quantity`
- Quantity must be >= 1
- Price must be > 0

### Payment Method
- Must be exactly `"bank-transfer"` or `"agent"`
- Case-sensitive

---

## Example cURL Commands

### Create Order with Bank Transfer

```bash
curl -X POST http://localhost:3000/api/v1/orders \
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
  -F "payment_method=bank-transfer" \
  -F 'items=[{"id":"product-123","name":"Product Name","price":100,"quantity":2}]' \
  -F "payment_screenshot=@/path/to/screenshot.jpg"
```

### Create Order with Agent Payment

```bash
curl -X POST http://localhost:3000/api/v1/orders \
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
    "payment_method": "agent",
    "items": [
      {
        "id": "product-123",
        "name": "Product Name",
        "price": 100,
        "quantity": 2
      }
    ]
  }'
```

---

## Frontend Integration Example

### JavaScript/Fetch API

#### Bank Transfer Order
```javascript
const formData = new FormData();
formData.append('shipping_first_name', shippingInfo.firstName);
formData.append('shipping_last_name', shippingInfo.lastName);
formData.append('shipping_email', shippingInfo.email);
formData.append('shipping_phone', shippingInfo.phone);
formData.append('shipping_address', shippingInfo.address);
formData.append('shipping_city', shippingInfo.city);
formData.append('shipping_state', shippingInfo.state);
formData.append('shipping_zip_code', shippingInfo.zipCode);
formData.append('shipping_country', shippingInfo.country);

formData.append('billing_first_name', billingInfo.firstName);
formData.append('billing_last_name', billingInfo.lastName);
formData.append('billing_email', billingInfo.email);
formData.append('billing_address', billingInfo.address);
formData.append('billing_city', billingInfo.city);
formData.append('billing_state', billingInfo.state);
formData.append('billing_zip_code', billingInfo.zipCode);
formData.append('billing_country', billingInfo.country);

formData.append('payment_method', 'bank-transfer');
formData.append('items', JSON.stringify(items));
formData.append('payment_screenshot', paymentScreenshot);

fetch('http://localhost:3000/api/v1/orders', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Order created:', data.data);
  }
});
```

#### Agent Payment Order
```javascript
const orderData = {
  shipping_first_name: shippingInfo.firstName,
  shipping_last_name: shippingInfo.lastName,
  shipping_email: shippingInfo.email,
  shipping_phone: shippingInfo.phone,
  shipping_address: shippingInfo.address,
  shipping_city: shippingInfo.city,
  shipping_state: shippingInfo.state,
  shipping_zip_code: shippingInfo.zipCode,
  shipping_country: shippingInfo.country,
  billing_first_name: billingInfo.firstName,
  billing_last_name: billingInfo.lastName,
  billing_email: billingInfo.email,
  billing_address: billingInfo.address,
  billing_city: billingInfo.city,
  billing_state: billingInfo.state,
  billing_zip_code: billingInfo.zipCode,
  billing_country: billingInfo.country,
  payment_method: 'agent',
  items: items.map(item => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    category: item.category,
    vendor_id: item.vendor_id
  }))
};

fetch('http://localhost:3000/api/v1/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(orderData)
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Order created:', data.data);
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
    // Order object
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

### Orders Table
- `id` - Primary key (UUID, auto-generated)
- `order_number` - Unique order number (VARCHAR, auto-generated)
- `status` - ENUM('pending', 'agent_review', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
- `payment_method` - ENUM('bank-transfer', 'agent')
- `shipping_first_name` - VARCHAR(255) NOT NULL
- `shipping_last_name` - VARCHAR(255) NOT NULL
- `shipping_email` - VARCHAR(350) NOT NULL
- `shipping_phone` - VARCHAR(50) NOT NULL
- `shipping_address` - TEXT NOT NULL
- `shipping_city` - VARCHAR(255) NOT NULL
- `shipping_state` - VARCHAR(255) NOT NULL
- `shipping_zip_code` - VARCHAR(20) NOT NULL
- `shipping_country` - VARCHAR(255) NOT NULL
- `billing_first_name` - VARCHAR(255) NOT NULL
- `billing_last_name` - VARCHAR(255) NOT NULL
- `billing_email` - VARCHAR(350) NOT NULL
- `billing_address` - TEXT NOT NULL
- `billing_city` - VARCHAR(255) NOT NULL
- `billing_state` - VARCHAR(255) NOT NULL
- `billing_zip_code` - VARCHAR(20) NOT NULL
- `billing_country` - VARCHAR(255) NOT NULL
- `subtotal` - DECIMAL(10, 2) NOT NULL
- `shipping` - DECIMAL(10, 2) NOT NULL (default: 0)
- `tax` - DECIMAL(10, 2) NOT NULL
- `total` - DECIMAL(10, 2) NOT NULL
- `payment_screenshot_url` - VARCHAR(500) (nullable, only for bank-transfer)
- `created_at` - TIMESTAMP WITH TIME ZONE
- `updated_at` - TIMESTAMP WITH TIME ZONE (auto-updated)

### Order Items Table
- `id` - Primary key (UUID, auto-generated)
- `order_id` - Foreign key to orders table (UUID)
- `product_id` - VARCHAR(255) NOT NULL
- `product_name` - VARCHAR(255) NOT NULL
- `price` - DECIMAL(10, 2) NOT NULL
- `quantity` - INTEGER NOT NULL
- `subtotal` - DECIMAL(10, 2) NOT NULL (price * quantity)
- `category` - VARCHAR(255) (nullable)
- `vendor_id` - VARCHAR(255) (nullable)
- `created_at` - TIMESTAMP WITH TIME ZONE
- `updated_at` - TIMESTAMP WITH TIME ZONE

---

## Summary

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|---------------|
| `/api/v1/orders` | POST | Create new order | Not required |

### Payment Methods
- **bank-transfer**: Requires payment screenshot upload (multipart/form-data)
- **agent**: Creates order with `agent_review` status (application/json)

### Order Status
- Bank Transfer: `pending` or `pending_payment`
- Agent: `agent_review`
