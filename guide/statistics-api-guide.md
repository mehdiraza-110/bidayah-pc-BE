# Statistics API Guide

This guide provides documentation for the Statistics/Dashboard API.

## Base URL
All endpoints are prefixed with: `/api/v1/statistics`

---

## Dashboard Statistics

### Get Dashboard Statistics
**GET** `/api/v1/statistics/dashboard`

Retrieves dashboard statistics including total published products, total revenue this month, and total orders this month.

#### Authentication
- Not required (but can be added if needed)

#### Success Response (200)
```json
{
  "success": true,
  "message": "Statistics retrieved successfully",
  "data": {
    "total_published_products": 150,
    "total_revenue_this_month": 45230.50,
    "total_orders_this_month": 87,
    "month": "January 2024"
  }
}
```

#### Response Fields
- `total_published_products` (number) - Total count of published products
- `total_revenue_this_month` (number) - Total revenue from orders with status: confirmed, processing, shipped, or delivered, created this month
- `total_orders_this_month` (number) - Total count of orders created this month (all statuses)
- `month` (string) - Current month and year (e.g., "January 2024")

#### Error Responses
- **500 Internal Server Error**: Server error

---

## Important Notes

### Total Published Products
- Counts only products with `status = 'published'`
- Excludes draft products

### Total Revenue This Month
- Calculates sum of `total` field from orders
- Only includes orders with status:
  - `confirmed`
  - `processing`
  - `shipped`
  - `delivered`
- Only includes orders created in the current month
- Excludes: `pending`, `pending_payment`, `agent_review`, `cancelled`

### Total Orders This Month
- Counts all orders created in the current month
- Includes all order statuses
- Based on `created_at` timestamp

### Month Calculation
- Uses server's current date/time
- Month range: First day of month 00:00:00 to last day of month 23:59:59
- Timezone: Server timezone

---

## Example cURL Commands

### Get Dashboard Statistics
```bash
curl -X GET http://localhost:3000/api/v1/statistics/dashboard
```

---

## Frontend Integration Examples

### JavaScript/Fetch API

#### Get Dashboard Statistics
```javascript
const getDashboardStats = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/v1/statistics/dashboard');
    const data = await response.json();
    
    if (data.success) {
      const stats = data.data;
      console.log('Total Products:', stats.total_published_products);
      console.log('Revenue This Month:', stats.total_revenue_this_month);
      console.log('Orders This Month:', stats.total_orders_this_month);
      console.log('Month:', stats.month);
      
      return stats;
    }
  } catch (error) {
    console.error('Error fetching statistics:', error);
  }
};
```

### React Component Example

```javascript
import React, { useState, useEffect } from 'react';

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchStats();
  }, []);
  
  const fetchStats = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/statistics/dashboard');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div>Loading statistics...</div>;
  }
  
  if (!stats) {
    return <div>Error loading statistics</div>;
  }
  
  return (
    <div className="dashboard">
      <h1>Dashboard - {stats.month}</h1>
      
      <div className="stats-grid">
        <div className="stat-card">
          <h2>Total Products</h2>
          <p className="stat-value">{stats.total_published_products}</p>
          <p className="stat-label">Published Products</p>
        </div>
        
        <div className="stat-card">
          <h2>Revenue</h2>
          <p className="stat-value">${stats.total_revenue_this_month.toFixed(2)}</p>
          <p className="stat-label">This Month</p>
        </div>
        
        <div className="stat-card">
          <h2>Orders</h2>
          <p className="stat-value">{stats.total_orders_this_month}</p>
          <p className="stat-label">This Month</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
```

---

## Response Format

All responses follow this format:

#### Success Response
```json
{
  "success": true,
  "message": "Statistics retrieved successfully",
  "data": {
    "total_published_products": 150,
    "total_revenue_this_month": 45230.50,
    "total_orders_this_month": 87,
    "month": "January 2024"
  }
}
```

#### Error Response
```json
{
  "success": false,
  "message": "Error fetching statistics",
  "error": "Detailed error message"
}
```

---

## Top Products by Sales

### Get Top Products by Sales
**GET** `/api/v1/statistics/top-products`

Retrieves the top products by sales quantity **for the current month**. Products are ranked by total quantity sold from completed orders created this month.

#### Authentication
- Not required (but can be added if needed)

#### Query Parameters (optional)
- `limit` (number) - Number of top products to return (default: 5, max: 100)

#### Examples
```
GET /api/v1/statistics/top-products
GET /api/v1/statistics/top-products?limit=10
GET /api/v1/statistics/top-products?limit=3
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Top products by sales retrieved successfully",
  "data": [
    {
      "product_id": "770e8400-e29b-41d4-a716-446655440002",
      "product_name": "iPhone 15 Pro",
      "total_quantity_sold": 45,
      "total_revenue": 44955.00,
      "order_count": 23,
      "product_image": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/abc123.webp",
      "category": "Electronics",
      "vendor_id": "550e8400-e29b-41d4-a716-446655440000"
    },
    {
      "product_id": "880e8400-e29b-41d4-a716-446655440003",
      "product_name": "Samsung Galaxy S24",
      "total_quantity_sold": 32,
      "total_revenue": 31968.00,
      "order_count": 18,
      "product_image": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/def456.webp",
      "category": "Electronics",
      "vendor_id": "550e8400-e29b-41d4-a716-446655440001"
    }
  ],
  "count": 2
}
```

#### Response Fields
- `product_id` (string) - Product ID
- `product_name` (string) - Product name
- `total_quantity_sold` (number) - Total quantity sold this month from completed orders
- `total_revenue` (number) - Total revenue generated from this product this month
- `order_count` (number) - Number of orders containing this product this month
- `product_image` (string) - Product image URL (if available)
- `category` (string) - Product category (if available)
- `vendor_id` (string) - Vendor ID (if available)

#### Error Responses
- **400 Bad Request**: Invalid limit value (must be between 1 and 100)
- **500 Internal Server Error**: Server error

---

## Important Notes

### Sales Calculation
- Only includes orders with status:
  - `confirmed`
  - `processing`
  - `shipped`
  - `delivered`
- Excludes: `pending`, `pending_payment`, `agent_review`, `cancelled`
- **Only includes orders created in the current month**
- Products are ranked by `total_quantity_sold` (descending order)

### Total Quantity Sold
- Sum of all quantities sold for the product from completed orders **this month**
- Example: If product was sold in 3 orders this month with quantities 5, 3, and 2, total = 10

### Total Revenue
- Sum of all subtotals (price × quantity) for the product from completed orders **this month**
- Calculated from order items, not product price

### Order Count
- Number of distinct orders **this month** that contain this product
- A product can appear in multiple orders

### Month Filter
- Uses server's current date/time
- Month range: First day of month 00:00:00 to last day of month 23:59:59
- Only counts orders created within this month

---

## Example cURL Commands

### Get Top 5 Products by Sales
```bash
curl -X GET http://localhost:3000/api/v1/statistics/top-products
```

### Get Top 10 Products by Sales
```bash
curl -X GET "http://localhost:3000/api/v1/statistics/top-products?limit=10"
```

### Get Top 3 Products by Sales
```bash
curl -X GET "http://localhost:3000/api/v1/statistics/top-products?limit=3"
```

---

## Frontend Integration Examples

### JavaScript/Fetch API

#### Get Top Products by Sales
```javascript
const getTopProducts = async (limit = 5) => {
  try {
    const response = await fetch(`http://localhost:3000/api/v1/statistics/top-products?limit=${limit}`);
    const data = await response.json();
    
    if (data.success) {
      console.log('Top Products:', data.data);
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching top products:', error);
  }
};
```

### React Component Example

```javascript
import React, { useState, useEffect } from 'react';

const TopProducts = () => {
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchTopProducts();
  }, []);
  
  const fetchTopProducts = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/statistics/top-products?limit=5');
      const data = await response.json();
      
      if (data.success) {
        setTopProducts(data.data);
      }
    } catch (error) {
      console.error('Error fetching top products:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div>Loading top products...</div>;
  }
  
  return (
    <div className="top-products">
      <h2>Top 5 Products by Sales</h2>
      
      <div className="products-list">
        {topProducts.map((product, index) => (
          <div key={product.product_id} className="product-card">
            <div className="rank">#{index + 1}</div>
            {product.product_image && (
              <img src={product.product_image} alt={product.product_name} />
            )}
            <div className="product-info">
              <h3>{product.product_name}</h3>
              <p className="quantity">Quantity Sold: {product.total_quantity_sold}</p>
              <p className="revenue">Revenue: ${product.total_revenue.toFixed(2)}</p>
              <p className="orders">Orders: {product.order_count}</p>
              {product.category && <p className="category">Category: {product.category}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopProducts;
```

---

## Monthly Sales Report

### Get Monthly Sales (Last 12 Months)
**GET** `/api/v1/statistics/monthly-sales`

Retrieves sales data for the last 12 months. For each month, returns a list of products with their sales count, revenue, and order count.

#### Authentication
- Not required (but can be added if needed)

#### Success Response (200)
```json
{
  "success": true,
  "message": "Monthly sales retrieved successfully",
  "data": [
    {
      "month": "2024-01",
      "month_name": "January 2024",
      "products": [
        {
          "product_id": "770e8400-e29b-41d4-a716-446655440002",
          "product_name": "iPhone 15 Pro",
          "sales_count": 45,
          "revenue": 44955.00,
          "order_count": 23,
          "product_image": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/abc123.webp",
          "category": "Electronics",
          "vendor_id": "550e8400-e29b-41d4-a716-446655440000"
        },
        {
          "product_id": "880e8400-e29b-41d4-a716-446655440003",
          "product_name": "Samsung Galaxy S24",
          "sales_count": 32,
          "revenue": 31968.00,
          "order_count": 18,
          "product_image": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/def456.webp",
          "category": "Electronics",
          "vendor_id": "550e8400-e29b-41d4-a716-446655440001"
        }
      ]
    },
    {
      "month": "2023-12",
      "month_name": "December 2023",
      "products": [
        {
          "product_id": "770e8400-e29b-41d4-a716-446655440002",
          "product_name": "iPhone 15 Pro",
          "sales_count": 38,
          "revenue": 37962.00,
          "order_count": 19,
          "product_image": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/abc123.webp",
          "category": "Electronics",
          "vendor_id": "550e8400-e29b-41d4-a716-446655440000"
        }
      ]
    }
  ],
  "count": 12
}
```

#### Response Structure
- Array of 12 objects (one for each month)
- Each month object contains:
  - `month` (string) - Month in YYYY-MM format
  - `month_name` (string) - Human-readable month name (e.g., "January 2024")
  - `products` (array) - List of products sold in that month

#### Product Object Fields
- `product_id` (string) - Product ID
- `product_name` (string) - Product name
- `sales_count` (number) - Total quantity sold in that month
- `revenue` (number) - Total revenue from this product in that month
- `order_count` (number) - Number of orders containing this product in that month
- `product_image` (string) - Product image URL (if available)
- `category` (string) - Product category (if available)
- `vendor_id` (string) - Vendor ID (if available)

#### Error Responses
- **500 Internal Server Error**: Server error

---

## Important Notes

### Monthly Sales Calculation
- Returns data for the **last 12 months** from the current date
- Only includes orders with status:
  - `confirmed`
  - `processing`
  - `shipped`
  - `delivered`
- Excludes: `pending`, `pending_payment`, `agent_review`, `cancelled`
- Products are sorted by sales_count (descending) within each month
- Months with no sales will have an empty `products` array

### Month Ordering
- Months are ordered from oldest to newest (12 months ago to current month)
- Example: If current month is January 2024, returns: February 2023 → January 2024

### Sales Count
- Represents the total quantity sold for that product in that specific month
- Sum of all quantities from order_items for completed orders in that month

---

## Example cURL Commands

### Get Monthly Sales
```bash
curl -X GET http://localhost:3000/api/v1/statistics/monthly-sales
```

---

## Frontend Integration Examples

### JavaScript/Fetch API

#### Get Monthly Sales
```javascript
const getMonthlySales = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/v1/statistics/monthly-sales');
    const data = await response.json();
    
    if (data.success) {
      console.log('Monthly Sales:', data.data);
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching monthly sales:', error);
  }
};
```

### React Component Example

```javascript
import React, { useState, useEffect } from 'react';

const MonthlySalesReport = () => {
  const [monthlySales, setMonthlySales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchMonthlySales();
  }, []);
  
  const fetchMonthlySales = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/statistics/monthly-sales');
      const data = await response.json();
      
      if (data.success) {
        setMonthlySales(data.data);
      }
    } catch (error) {
      console.error('Error fetching monthly sales:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div>Loading monthly sales...</div>;
  }
  
  return (
    <div className="monthly-sales-report">
      <h2>Monthly Sales Report (Last 12 Months)</h2>
      
      {monthlySales.map((monthData) => (
        <div key={monthData.month} className="month-section">
          <h3>{monthData.month_name}</h3>
          
          {monthData.products.length === 0 ? (
            <p>No sales this month</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>Sales Count</th>
                  <th>Revenue</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {monthData.products.map((product) => (
                  <tr key={product.product_id}>
                    <td>{product.product_name}</td>
                    <td>{product.sales_count}</td>
                    <td>${product.revenue.toFixed(2)}</td>
                    <td>{product.order_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
};

export default MonthlySalesReport;
```

---

## Summary

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/v1/statistics/dashboard` | GET | Get dashboard statistics | Not required |
| `/api/v1/statistics/top-products` | GET | Get top products by sales (this month) | Not required |
| `/api/v1/statistics/monthly-sales` | GET | Get monthly sales for last 12 months | Not required |

### Statistics Included
- **Total Published Products**: Count of all published products
- **Total Revenue This Month**: Sum of revenue from confirmed/processing/shipped/delivered orders this month
- **Total Orders This Month**: Count of all orders created this month

### Top Products
- **Ranked by**: Total quantity sold
- **Includes**: Only products from completed orders (confirmed, processing, shipped, delivered)
- **Returns**: Product ID, name, total quantity sold, total revenue, order count, and product details

---

## Use Cases

### Dashboard Display
Perfect for displaying key metrics on an admin dashboard:
- Product count widget
- Revenue chart/total
- Order count widget
- Monthly performance overview
- **Top selling products widget**

### Analytics
Can be used for:
- Monthly performance tracking
- Revenue monitoring
- Order volume analysis
- Product catalog size tracking
- **Best-selling products analysis**
- **Product performance comparison**