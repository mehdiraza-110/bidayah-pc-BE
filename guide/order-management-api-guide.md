# Order Management API Guide

This guide provides documentation for the Order Management APIs used by admins to view and manage orders.

## Base URL
All endpoints are prefixed with: `/api/v1/orders`

**Note**: All management endpoints require authentication (admin access).

---

## Endpoints

### 1. Get All Orders
**GET** `/api/v1/orders`

Retrieves a list of all orders with optional filters and pagination.

#### Authentication
- Requires valid JWT token (admin authentication)

#### Query Parameters (all optional)
- `status` (string) - Filter by order status
  - Values: `pending`, `pending_payment`, `agent_review`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`
- `payment_method` (string) - Filter by payment method
  - Values: `bank-transfer`, `agent`
- `order_number` (string) - Search by order number (partial match)
- `shipping_email` (string) - Search by shipping email (partial match)
- `date_from` (string) - Filter orders from this date (ISO format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`)
- `date_to` (string) - Filter orders to this date (ISO format: `YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`)
- `limit` (number) - Number of orders to return (for pagination)
- `offset` (number) - Number of orders to skip (for pagination)

#### Examples
```
GET /api/v1/orders
GET /api/v1/orders?status=pending_payment
GET /api/v1/orders?payment_method=bank-transfer&status=pending_payment
GET /api/v1/orders?order_number=ORD-2024
GET /api/v1/orders?shipping_email=john@example.com
GET /api/v1/orders?date_from=2024-01-01&date_to=2024-01-31
GET /api/v1/orders?limit=10&offset=0
GET /api/v1/orders?status=confirmed&limit=20&offset=0
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": [
    {
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
      "items_count": 1,
      "subtotal": 200,
      "shipping": 0,
      "tax": 16,
      "total": 216,
      "payment_screenshot_url": "https://your-bucket.s3.ca-central-1.amazonaws.com/orders/payments/abc123.webp",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

#### Error Responses
- **401 Unauthorized**: Not authenticated
- **500 Internal Server Error**: Server error

---

### 2. Get Order by ID
**GET** `/api/v1/orders/:id`

Retrieves a specific order by its ID with all details including items.

#### Authentication
- Requires valid JWT token (admin authentication)

#### URL Parameters
- `id` (UUID) - Order ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Order retrieved successfully",
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
    "tax": 16,
    "total": 216,
    "payment_screenshot_url": "https://your-bucket.s3.ca-central-1.amazonaws.com/orders/payments/abc123.webp",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses
- **401 Unauthorized**: Not authenticated
- **404 Not Found**: Order not found
- **500 Internal Server Error**: Server error

---

### 3. Update Order Status
**PUT** or **PATCH** `/api/v1/orders/:id/status`

Updates the status of an order.

#### Authentication
- Requires valid JWT token (admin authentication)

#### URL Parameters
- `id` (UUID) - Order ID

#### Request Body
```json
{
  "status": "confirmed"
}
```

#### Required Fields
- `status` (string) - New order status

#### Valid Status Values
- `pending` - Order is pending
- `pending_payment` - Waiting for payment confirmation (bank transfer)
- `agent_review` - Waiting for agent review (agent payment)
- `confirmed` - Order confirmed
- `processing` - Order is being processed
- `shipped` - Order has been shipped
- `delivered` - Order has been delivered
- `cancelled` - Order has been cancelled

#### Success Response (200)
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "id": "aa0e8400-e29b-41d4-a716-446655440006",
    "order_number": "ORD-2024-001",
    "status": "confirmed",
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
    "tax": 16,
    "total": 216,
    "payment_screenshot_url": "https://your-bucket.s3.ca-central-1.amazonaws.com/orders/payments/abc123.webp",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:00:00.000Z"
  }
}
```

#### Error Responses
- **400 Bad Request**: Missing status or invalid status value
- **401 Unauthorized**: Not authenticated
- **404 Not Found**: Order not found
- **500 Internal Server Error**: Server error

---

## Order Status Flow

### Bank Transfer Orders
1. `pending_payment` - Initial status when order is created
2. `confirmed` - Payment verified, order confirmed
3. `processing` - Order is being prepared
4. `shipped` - Order has been shipped
5. `delivered` - Order delivered to customer
6. `cancelled` - Order cancelled (can happen at any stage)

### Agent Payment Orders
1. `agent_review` - Initial status when order is created
2. `confirmed` - Agent confirmed the order
3. `processing` - Order is being prepared
4. `shipped` - Order has been shipped
5. `delivered` - Order delivered to customer
6. `cancelled` - Order cancelled (can happen at any stage)

---

## Example cURL Commands

### Get All Orders
```bash
curl -X GET http://localhost:3000/api/v1/orders \
  -H "Cookie: token=your_jwt_token"
```

### Get Orders with Filters
```bash
# Get pending payment orders
curl -X GET "http://localhost:3000/api/v1/orders?status=pending_payment" \
  -H "Cookie: token=your_jwt_token"

# Get bank transfer orders
curl -X GET "http://localhost:3000/api/v1/orders?payment_method=bank-transfer" \
  -H "Cookie: token=your_jwt_token"

# Search by order number
curl -X GET "http://localhost:3000/api/v1/orders?order_number=ORD-2024-001" \
  -H "Cookie: token=your_jwt_token"

# Get orders by date range
curl -X GET "http://localhost:3000/api/v1/orders?date_from=2024-01-01&date_to=2024-01-31" \
  -H "Cookie: token=your_jwt_token"

# Paginated results
curl -X GET "http://localhost:3000/api/v1/orders?limit=10&offset=0" \
  -H "Cookie: token=your_jwt_token"
```

### Get Order by ID
```bash
curl -X GET http://localhost:3000/api/v1/orders/aa0e8400-e29b-41d4-a716-446655440006 \
  -H "Cookie: token=your_jwt_token"
```

### Update Order Status
```bash
curl -X PATCH http://localhost:3000/api/v1/orders/aa0e8400-e29b-41d4-a716-446655440006/status \
  -H "Content-Type: application/json" \
  -H "Cookie: token=your_jwt_token" \
  -d '{
    "status": "confirmed"
  }'
```

---

## Frontend Integration Examples

### JavaScript/Fetch API

#### Get All Orders
```javascript
const getOrders = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.status) params.append('status', filters.status);
  if (filters.payment_method) params.append('payment_method', filters.payment_method);
  if (filters.order_number) params.append('order_number', filters.order_number);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);
  
  const response = await fetch(`http://localhost:3000/api/v1/orders?${params}`, {
    method: 'GET',
    credentials: 'include' // Include cookies for authentication
  });
  
  const data = await response.json();
  return data;
};
```

#### Get Order by ID
```javascript
const getOrderById = async (orderId) => {
  const response = await fetch(`http://localhost:3000/api/v1/orders/${orderId}`, {
    method: 'GET',
    credentials: 'include'
  });
  
  const data = await response.json();
  return data;
};
```

#### Update Order Status
```javascript
const updateOrderStatus = async (orderId, status) => {
  const response = await fetch(`http://localhost:3000/api/v1/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ status })
  });
  
  const data = await response.json();
  return data;
};
```

### React Component Example

```javascript
import React, { useState, useEffect } from 'react';

const OrderManagement = () => {
  const [orders, setOrders] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    payment_method: '',
    limit: 20,
    offset: 0
  });
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    fetchOrders();
  }, [filters]);
  
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await getOrders(filters);
      if (data.success) {
        setOrders(data.data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      const data = await updateOrderStatus(orderId, newStatus);
      if (data.success) {
        // Refresh orders list
        fetchOrders();
        alert('Order status updated successfully');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating order status');
    }
  };
  
  return (
    <div>
      <h1>Order Management</h1>
      
      {/* Filters */}
      <div>
        <select 
          value={filters.status} 
          onChange={(e) => setFilters({...filters, status: e.target.value})}
        >
          <option value="">All Statuses</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="agent_review">Agent Review</option>
          <option value="confirmed">Confirmed</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
        
        <select 
          value={filters.payment_method} 
          onChange={(e) => setFilters({...filters, payment_method: e.target.value})}
        >
          <option value="">All Payment Methods</option>
          <option value="bank-transfer">Bank Transfer</option>
          <option value="agent">Agent</option>
        </select>
      </div>
      
      {/* Orders List */}
      {loading ? (
        <p>Loading...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Order Number</th>
              <th>Status</th>
              <th>Payment Method</th>
              <th>Customer Email</th>
              <th>Total</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map(order => (
              <tr key={order.id}>
                <td>{order.order_number}</td>
                <td>{order.status}</td>
                <td>{order.payment_method}</td>
                <td>{order.shipping_info.email}</td>
                <td>${order.total}</td>
                <td>{new Date(order.created_at).toLocaleDateString()}</td>
                <td>
                  <select 
                    value={order.status}
                    onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                  >
                    <option value="pending_payment">Pending Payment</option>
                    <option value="agent_review">Agent Review</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
```

---

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized: No token"
}
```

#### 404 Not Found
```json
{
  "success": false,
  "message": "Order not found"
}
```

#### 400 Bad Request (Invalid Status)
```json
{
  "success": false,
  "message": "Invalid status. Must be one of: pending, pending_payment, agent_review, confirmed, processing, shipped, delivered, cancelled"
}
```

---

## Pagination

When using pagination with `limit` and `offset`:

```javascript
// First page (first 20 orders)
const page1 = await getOrders({ limit: 20, offset: 0 });

// Second page (next 20 orders)
const page2 = await getOrders({ limit: 20, offset: 20 });

// Third page (next 20 orders)
const page3 = await getOrders({ limit: 20, offset: 40 });
```

---

## Summary

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|---------------|
| `/api/v1/orders` | GET | Get all orders (with filters) | Required (Admin) |
| `/api/v1/orders/:id` | GET | Get order by ID | Required (Admin) |
| `/api/v1/orders/:id/status` | PUT/PATCH | Update order status | Required (Admin) |

### Order Status Values
- `pending` - Order is pending
- `pending_payment` - Waiting for payment (bank transfer)
- `agent_review` - Waiting for agent review (agent payment)
- `confirmed` - Order confirmed
- `processing` - Order being processed
- `shipped` - Order shipped
- `delivered` - Order delivered
- `cancelled` - Order cancelled

### Filter Options
- Filter by status
- Filter by payment method
- Search by order number
- Search by customer email
- Filter by date range
- Pagination support

---

## Best Practices

1. **Authentication**: Always include authentication token in requests
2. **Error Handling**: Implement comprehensive error handling
3. **Loading States**: Show loading indicators during API calls
4. **Pagination**: Use pagination for large order lists
5. **Status Updates**: Validate status transitions before updating
6. **Real-time Updates**: Consider implementing WebSocket or polling for real-time order updates
