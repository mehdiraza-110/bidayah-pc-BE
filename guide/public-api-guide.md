# Public API Guide

This guide provides documentation for the Public GET APIs. These endpoints are read-only and do not require authentication.

## Base URL
All public endpoints are prefixed with: `/api/v1/public`

---

## Public Products API

### 1. Get Featured Products
**GET** `/api/v1/public/products/featured`

Retrieves a list of all **featured and published** products. Perfect for displaying on the homepage.

#### Query Parameters (optional)
- `in_stock` (boolean/string) - Filter by stock: 'true' or 'false'

#### Examples
```
GET /api/v1/public/products/featured
GET /api/v1/public/products/featured?in_stock=true
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Featured products retrieved successfully",
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "iPhone 15 Pro",
      "category_id": "660e8400-e29b-41d4-a716-446655440001",
      "category_name": "Electronics",
      "price": "999.99",
      "original_price": "1099.99",
      "image": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/abc123.webp",
      "description": "Latest iPhone with advanced features",
      "stock": 50,
      "in_stock": true,
      "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
      "vendor_name": "Apple Inc.",
      "status": "published",
      "featured": true,
      "new_product": true,
      "rating": "4.50",
      "reviews_count": 120,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "media": [],
      "specs": []
    }
  ],
  "count": 1
}
```

**Note**: This endpoint automatically filters by:
- `status = 'published'` (only published products)
- `featured = true` (only featured products)

---

### 2. Get All Published Products
**GET** `/api/v1/public/products`

Retrieves a list of all **published** products only. Draft products are excluded.

#### Query Parameters (all optional)
- `category_id` (UUID) - Filter by category
- `vendor_id` (UUID) - Filter by vendor
- `featured` (boolean/string) - Filter featured products: 'true' or 'false'
- `in_stock` (boolean/string) - Filter by stock: 'true' or 'false'
- `search` (string) - Search in product name and description

**Note**: The `status` filter is automatically set to `published` and cannot be overridden.

#### Examples
```
GET /api/v1/public/products
GET /api/v1/public/products?category_id=660e8400-e29b-41d4-a716-446655440001
GET /api/v1/public/products?featured=true&in_stock=true
GET /api/v1/public/products?search=iphone
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Products retrieved successfully",
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "iPhone 15 Pro",
      "category_id": "660e8400-e29b-41d4-a716-446655440001",
      "category_name": "Electronics",
      "price": "999.99",
      "original_price": "1099.99",
      "image": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/abc123.webp",
      "description": "Latest iPhone with advanced features",
      "stock": 50,
      "in_stock": true,
      "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
      "vendor_name": "Apple Inc.",
      "status": "published",
      "featured": true,
      "new_product": true,
      "rating": "4.50",
      "reviews_count": 120,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "media": [],
      "specs": []
    }
  ],
  "count": 1
}
```

---

### 3. Get Published Product by ID
**GET** `/api/v1/public/products/:id`

Retrieves a specific product by its ID. **Only published products** are accessible through this endpoint.

#### URL Parameters
- `id` (UUID) - Product ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Product retrieved successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "iPhone 15 Pro",
    "category_id": "660e8400-e29b-41d4-a716-446655440001",
    "category_name": "Electronics",
    "price": "999.99",
    "original_price": "1099.99",
    "image": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/abc123.webp",
    "description": "Latest iPhone with advanced features",
    "stock": 50,
    "in_stock": true,
    "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
    "vendor_name": "Apple Inc.",
    "status": "published",
    "featured": true,
    "new_product": true,
    "rating": "4.50",
    "reviews_count": 120,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "media": [
      {
        "id": "880e8400-e29b-41d4-a716-446655440003",
        "url": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/media/def456.webp",
        "type": "image",
        "display_order": 0
      }
    ],
    "specs": [
      {
        "id": "990e8400-e29b-41d4-a716-446655440004",
        "spec_text": "6.1-inch Super Retina XDR display",
        "display_order": 0
      }
    ]
  }
}
```

#### Error Responses
- **404 Not Found**: Product not found or product is not published (draft products are hidden)
- **500 Internal Server Error**: Server error

---

## Public Vendors API

### 1. Get All Vendors
**GET** `/api/v1/public/vendors`

Retrieves a list of all vendors.

#### Success Response (200)
```json
{
  "success": true,
  "message": "Vendors retrieved successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "vendor_name": "Apple Inc.",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Get Vendor by ID
**GET** `/api/v1/public/vendors/:id`

Retrieves a specific vendor by its ID.

#### URL Parameters
- `id` (UUID) - Vendor ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Vendor retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "vendor_name": "Apple Inc.",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses
- **404 Not Found**: Vendor not found
- **500 Internal Server Error**: Server error

---

## Public Categories API

### 1. Get All Categories
**GET** `/api/v1/public/categories`

Retrieves a list of all categories.

#### Success Response (200)
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "category_name": "Electronics",
      "image": "https://your-bucket.s3.ca-central-1.amazonaws.com/categories/abc123def456.webp",
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 2. Get Category by ID
**GET** `/api/v1/public/categories/:id`

Retrieves a specific category by its ID.

#### URL Parameters
- `id` (UUID) - Category ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Category retrieved successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "category_name": "Electronics",
    "image": "https://your-bucket.s3.ca-central-1.amazonaws.com/categories/abc123def456.webp",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses
- **404 Not Found**: Category not found
- **500 Internal Server Error**: Server error

---

## Important Notes

### Public vs Admin Endpoints

**Public Endpoints** (`/api/v1/public/*`):
- No authentication required
- Read-only (GET requests only)
- Products: Only shows published products
- Vendors: Shows all vendors
- Categories: Shows all categories

**Admin Endpoints** (`/api/v1/products/*`, `/api/v1/vendors/*`, `/api/v1/categories/*`):
- May require authentication (depends on implementation)
- Full CRUD operations (GET, POST, PUT, PATCH, DELETE)
- Products: Shows both published and draft products

### Product Status Filtering
- Public product endpoints **automatically filter** by `status = 'published'`
- Draft products are **not accessible** through public endpoints
- Attempting to access a draft product by ID will return 404 (Product not found)

---

## Example cURL Commands

### Public Products

#### Get All Published Products
```bash
curl -X GET http://localhost:3000/api/v1/public/products
```

#### Get Published Products with Filters
```bash
curl -X GET "http://localhost:3000/api/v1/public/products?featured=true&in_stock=true"
```

#### Search Published Products
```bash
curl -X GET "http://localhost:3000/api/v1/public/products?search=iphone"
```

#### Get Published Product by ID
```bash
curl -X GET http://localhost:3000/api/v1/public/products/770e8400-e29b-41d4-a716-446655440002
```

### Public Vendors

#### Get All Vendors
```bash
curl -X GET http://localhost:3000/api/v1/public/vendors
```

#### Get Vendor by ID
```bash
curl -X GET http://localhost:3000/api/v1/public/vendors/550e8400-e29b-41d4-a716-446655440000
```

### Public Categories

#### Get All Categories
```bash
curl -X GET http://localhost:3000/api/v1/public/categories
```

#### Get Category by ID
```bash
curl -X GET http://localhost:3000/api/v1/public/categories/660e8400-e29b-41d4-a716-446655440001
```

---

## Frontend Integration Examples

### JavaScript/Fetch API

#### Get All Published Products
```javascript
fetch('http://localhost:3000/api/v1/public/products')
  .then(response => response.json())
  .then(data => {
    console.log(data.data); // Array of published products
  });
```

#### Get Featured Products (Homepage)
```javascript
fetch('http://localhost:3000/api/v1/public/products/featured')
  .then(response => response.json())
  .then(data => {
    console.log(data.data); // Array of featured, published products
  });
```

#### Get Featured Products (In Stock Only)
```javascript
fetch('http://localhost:3000/api/v1/public/products/featured?in_stock=true')
  .then(response => response.json())
  .then(data => {
    console.log(data.data); // Array of featured, published, in-stock products
  });
```

#### Get Products by Category
```javascript
const categoryId = '660e8400-e29b-41d4-a716-446655440001';

fetch(`http://localhost:3000/api/v1/public/products?category_id=${categoryId}`)
  .then(response => response.json())
  .then(data => {
    console.log(data.data); // Array of products in the category
  });
```

#### Search Products
```javascript
const searchTerm = 'iphone';

fetch(`http://localhost:3000/api/v1/public/products?search=${encodeURIComponent(searchTerm)}`)
  .then(response => response.json())
  .then(data => {
    console.log(data.data); // Array of matching products
  });
```

#### Get All Vendors
```javascript
fetch('http://localhost:3000/api/v1/public/vendors')
  .then(response => response.json())
  .then(data => {
    console.log(data.data); // Array of vendors
  });
```

#### Get All Categories
```javascript
fetch('http://localhost:3000/api/v1/public/categories')
  .then(response => response.json())
  .then(data => {
    console.log(data.data); // Array of categories
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
  "data": [...],
  "count": 1  // For list endpoints
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

## Summary

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/v1/public/products/featured` | GET | Get featured published products | Not required |
| `/api/v1/public/products` | GET | Get all published products | Not required |
| `/api/v1/public/products/:id` | GET | Get published product by ID | Not required |
| `/api/v1/public/vendors` | GET | Get all vendors | Not required |
| `/api/v1/public/vendors/:id` | GET | Get vendor by ID | Not required |
| `/api/v1/public/categories` | GET | Get all categories | Not required |
| `/api/v1/public/categories/:id` | GET | Get category by ID | Not required |
