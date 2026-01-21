# Product CRUD API Guide

This guide provides documentation for the Product CRUD APIs.

## Base URL
All endpoints are prefixed with: `/api/v1/products`

---

## Endpoints

### 1. Create Product
**POST** `/api/v1/products`

Creates a new product with main image, optional media (up to 5 images/videos), and optional specifications.

#### Request
- **Content-Type**: `multipart/form-data`
- **Required Fields**:
  - `name` (string) - Product name
  - `price` (number/string) - Product price
  - `main_image` (file) - Main product image
- **Optional Fields**:
  - `category_id` (UUID string) - Category ID
  - `original_price` (number/string) - Original price (for discounts)
  - `description` (string) - Product description
  - `stock` (number/string) - Stock quantity (default: 0)
  - `vendor_id` (UUID string) - Vendor ID
  - `status` (string) - 'published' or 'draft' (default: 'published')
  - `featured` (boolean/string) - Featured product flag (default: false)
  - `new_product` (boolean/string) - New product flag (default: false)
  - `rating` (number/string) - Product rating 0-5 (default: 0.00)
  - `reviews_count` (number/string) - Number of reviews (default: 0)
  - `media` (files) - Up to 5 additional images/videos
  - `specs` (string/array) - Product specifications (comma-separated string or JSON array)

#### Success Response (201)
```json
{
  "success": true,
  "message": "Product created successfully",
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
      },
      {
        "id": "aa0e8400-e29b-41d4-a716-446655440005",
        "spec_text": "A17 Pro chip",
        "display_order": 1
      }
    ]
  }
}
```

#### Error Responses
- **400 Bad Request**: Missing required fields or invalid data
- **500 Internal Server Error**: Server error or S3 upload error

---

### 2. Get All Products
**GET** `/api/v1/products`

Retrieves a list of all products with optional filters.

#### Query Parameters (all optional)
- `status` (string) - Filter by status: 'published' or 'draft'
- `category_id` (UUID) - Filter by category
- `vendor_id` (UUID) - Filter by vendor
- `featured` (boolean/string) - Filter featured products: 'true' or 'false'
- `in_stock` (boolean/string) - Filter by stock: 'true' or 'false'
- `search` (string) - Search in product name and description

#### Examples
```
GET /api/v1/products?status=published
GET /api/v1/products?category_id=660e8400-e29b-41d4-a716-446655440001
GET /api/v1/products?featured=true&in_stock=true
GET /api/v1/products?search=iphone
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

### 3. Get Product by ID
**GET** `/api/v1/products/:id`

Retrieves a specific product by its ID.

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
- **404 Not Found**: Product not found
- **500 Internal Server Error**: Server error

---

### 4. Update Product
**PUT** or **PATCH** `/api/v1/products/:id`

Updates product information. You can update any combination of fields.

#### URL Parameters
- `id` (UUID) - Product ID

#### Request
- **Content-Type**: `multipart/form-data`
- **All fields are optional** (only include fields you want to update):
  - `name` (string)
  - `category_id` (UUID string)
  - `price` (number/string)
  - `original_price` (number/string)
  - `description` (string)
  - `stock` (number/string)
  - `vendor_id` (UUID string)
  - `status` (string) - 'published' or 'draft'
  - `featured` (boolean/string)
  - `new_product` (boolean/string)
  - `rating` (number/string)
  - `reviews_count` (number/string)
  - `main_image` (file) - New main image (replaces old one)
  - `media` (files) - Up to 5 new media files (replaces all existing media)
  - `specs` (string/array) - New specifications (replaces all existing specs)

#### Success Response (200)
```json
{
  "success": true,
  "message": "Product updated successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "iPhone 15 Pro Max",
    "category_id": "660e8400-e29b-41d4-a716-446655440001",
    "category_name": "Electronics",
    "price": "1099.99",
    "original_price": "1199.99",
    "image": "https://your-bucket.s3.ca-central-1.amazonaws.com/products/xyz789.webp",
    "description": "Updated description",
    "stock": 30,
    "in_stock": true,
    "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
    "vendor_name": "Apple Inc.",
    "status": "published",
    "featured": true,
    "new_product": false,
    "rating": "4.75",
    "reviews_count": 150,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T12:00:00.000Z",
    "media": [],
    "specs": []
  }
}
```

#### Error Responses
- **400 Bad Request**: No fields to update
- **404 Not Found**: Product not found
- **500 Internal Server Error**: Server error or S3 upload error

**Note**: 
- When updating `main_image`, the old main image is automatically deleted from S3
- When updating `media`, all old media files are deleted from S3 and replaced with new ones
- When updating `specs`, all old specs are replaced with new ones

---

### 5. Toggle Featured Status
**PUT** or **PATCH** `/api/v1/products/:id/featured`

Toggles the featured status of a product. This is useful for marking products to display on the homepage.

#### URL Parameters
- `id` (UUID) - Product ID

#### Request Body
```json
{
  "featured": true
}
```

or

```json
{
  "featured": false
}
```

#### Required Fields
- `featured` (boolean) - true to mark as featured, false to unmark

#### Success Response (200)
```json
{
  "success": true,
  "message": "Product marked as featured successfully",
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
    "updated_at": "2024-01-15T12:00:00.000Z",
    "media": [],
    "specs": []
  }
}
```

#### Error Responses
- **400 Bad Request**: Featured status (boolean) is required
- **404 Not Found**: Product not found
- **500 Internal Server Error**: Server error

---

### 6. Delete Product
**DELETE** `/api/v1/products/:id`

Permanently deletes a product from the database. All associated images and media are also deleted from S3.

#### URL Parameters
- `id` (UUID) - Product ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Product deleted successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "iPhone 15 Pro"
  }
}
```

#### Error Responses
- **404 Not Found**: Product not found
- **500 Internal Server Error**: Server error

**Note**: The main product image and all media files are automatically deleted from S3 when the product is deleted.

---

## Important Notes

### Product Images
- **Main Image**: Required when creating, optional when updating
- **Media**: Up to 5 additional images/videos per product
- All images are uploaded to AWS S3:
  - Main images: `products/` folder
  - Media files: `products/media/` folder
- Images are automatically converted to WebP format
- Old images are automatically deleted when updated or product is deleted
- Maximum file size: 500MB per file

### Product Specifications
- Specifications can be provided as:
  - Comma-separated string: `"Spec 1, Spec 2, Spec 3"`
  - JSON array: `["Spec 1", "Spec 2", "Spec 3"]`
  - Array in form data
- When updating specs, all existing specs are replaced with new ones

### Product Status
- `published`: Product is visible to customers
- `draft`: Product is saved but not visible

### Stock Management
- `stock`: Number of items available
- `in_stock`: Automatically calculated (true if stock > 0)

### Product Media
- Up to 5 media items per product
- Can be images or videos
- Type is automatically detected from file MIME type
- Display order is set automatically (0-4)

### Foreign Keys
- `category_id`: References categories table (can be null)
- `vendor_id`: References vendors table (can be null)
- Both are set to NULL on delete (ON DELETE SET NULL)

---

## Example cURL Commands

### Create Product (with all fields)
```bash
curl -X POST http://localhost:3000/api/v1/products \
  -F "name=iPhone 15 Pro" \
  -F "category_id=660e8400-e29b-41d4-a716-446655440001" \
  -F "price=999.99" \
  -F "original_price=1099.99" \
  -F "description=Latest iPhone with advanced features" \
  -F "stock=50" \
  -F "vendor_id=550e8400-e29b-41d4-a716-446655440000" \
  -F "status=published" \
  -F "featured=true" \
  -F "new_product=true" \
  -F "rating=4.50" \
  -F "reviews_count=120" \
  -F "main_image=@/path/to/main-image.jpg" \
  -F "media=@/path/to/media1.jpg" \
  -F "media=@/path/to/media2.jpg" \
  -F "specs=6.1-inch display, A17 Pro chip, 256GB storage"
```

### Create Product (minimal)
```bash
curl -X POST http://localhost:3000/api/v1/products \
  -F "name=iPhone 15 Pro" \
  -F "price=999.99" \
  -F "main_image=@/path/to/main-image.jpg"
```

### Get All Products
```bash
curl -X GET http://localhost:3000/api/v1/products
```

### Get Products with Filters
```bash
curl -X GET "http://localhost:3000/api/v1/products?status=published&featured=true&in_stock=true"
```

### Search Products
```bash
curl -X GET "http://localhost:3000/api/v1/products?search=iphone"
```

### Get Product by ID
```bash
curl -X GET http://localhost:3000/api/v1/products/770e8400-e29b-41d4-a716-446655440002
```

### Update Product (name and price only)
```bash
curl -X PUT http://localhost:3000/api/v1/products/770e8400-e29b-41d4-a716-446655440002 \
  -F "name=iPhone 15 Pro Max" \
  -F "price=1099.99"
```

### Update Product (with new main image)
```bash
curl -X PUT http://localhost:3000/api/v1/products/770e8400-e29b-41d4-a716-446655440002 \
  -F "name=iPhone 15 Pro Max" \
  -F "main_image=@/path/to/new-main-image.jpg"
```

### Update Product (with new media)
```bash
curl -X PUT http://localhost:3000/api/v1/products/770e8400-e29b-41d4-a716-446655440002 \
  -F "media=@/path/to/media1.jpg" \
  -F "media=@/path/to/media2.jpg" \
  -F "media=@/path/to/media3.jpg"
```

### Update Product (with new specs)
```bash
curl -X PUT http://localhost:3000/api/v1/products/770e8400-e29b-41d4-a716-446655440002 \
  -F "specs=New Spec 1, New Spec 2, New Spec 3"
```

### Delete Product
```bash
curl -X DELETE http://localhost:3000/api/v1/products/770e8400-e29b-41d4-a716-446655440002
```

---

## Frontend Integration Examples

### JavaScript/Fetch API

#### Create Product
```javascript
const formData = new FormData();
formData.append('name', 'iPhone 15 Pro');
formData.append('price', '999.99');
formData.append('category_id', '660e8400-e29b-41d4-a716-446655440001');
formData.append('main_image', fileInput.files[0]);

// Add media files
for (let i = 0; i < mediaFiles.length; i++) {
  formData.append('media', mediaFiles[i]);
}

// Add specs
formData.append('specs', JSON.stringify(['Spec 1', 'Spec 2', 'Spec 3']));

fetch('http://localhost:3000/api/v1/products', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

#### Get Products with Filters
```javascript
const params = new URLSearchParams({
  status: 'published',
  featured: 'true',
  in_stock: 'true'
});

fetch(`http://localhost:3000/api/v1/products?${params}`)
  .then(response => response.json())
  .then(data => console.log(data));
```

#### Update Product
```javascript
const formData = new FormData();
formData.append('name', 'Updated Product Name');
formData.append('price', '1099.99');

if (newMainImage) {
  formData.append('main_image', newMainImage);
}

fetch(`http://localhost:3000/api/v1/products/${productId}`, {
  method: 'PUT',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error message description",
  "error": "Detailed error message"
}
```

---

## Database Schema Reference

### Products Table
- `id` - Primary key (UUID, auto-generated)
- `name` - VARCHAR(255) NOT NULL
- `category_id` - UUID (FK to categories, nullable)
- `price` - DECIMAL(10, 2) NOT NULL (>= 0)
- `original_price` - DECIMAL(10, 2) (>= 0, nullable)
- `image` - VARCHAR(500) NOT NULL (S3 URL)
- `description` - TEXT (nullable)
- `stock` - INTEGER NOT NULL DEFAULT 0 (>= 0)
- `in_stock` - BOOLEAN (generated, true if stock > 0)
- `vendor_id` - UUID (FK to vendors, nullable)
- `status` - ENUM('published', 'draft') NOT NULL DEFAULT 'published'
- `featured` - BOOLEAN DEFAULT FALSE
- `new_product` - BOOLEAN DEFAULT FALSE
- `rating` - DECIMAL(3, 2) DEFAULT 0.00 (0-5)
- `reviews_count` - INTEGER DEFAULT 0 (>= 0)
- `created_at` - TIMESTAMP WITH TIME ZONE
- `updated_at` - TIMESTAMP WITH TIME ZONE (auto-updated)

### Product Media Table
- `id` - Primary key (UUID, auto-generated)
- `product_id` - UUID (FK to products, CASCADE DELETE)
- `url` - VARCHAR(500) NOT NULL (S3 URL)
- `type` - ENUM('image', 'video') NOT NULL
- `display_order` - INTEGER NOT NULL DEFAULT 0 (0-4)
- `created_at` - TIMESTAMP WITH TIME ZONE
- **Constraint**: Unique (product_id, display_order)
- **Limit**: Maximum 5 media items per product

### Product Specs Table
- `id` - Primary key (UUID, auto-generated)
- `product_id` - UUID (FK to products, CASCADE DELETE)
- `spec_text` - VARCHAR(255) NOT NULL
- `display_order` - INTEGER NOT NULL DEFAULT 0
- `created_at` - TIMESTAMP WITH TIME ZONE
