# Vendor & Category CRUD API Guide

This guide provides documentation for the Vendor and Category CRUD APIs.

## Base URLs
- Vendors: `/api/v1/vendors`
- Categories: `/api/v1/categories`

---

## Vendor APIs

### 1. Create Vendor
**POST** `/api/v1/vendors`

Creates a new vendor.

#### Request Body
```json
{
  "vendor_name": "Apple Inc."
}
```

#### Required Fields
- `vendor_name` (string) - Must be unique

#### Success Response (201)
```json
{
  "success": true,
  "message": "Vendor created successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "vendor_name": "Apple Inc.",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

#### Error Responses
- **400 Bad Request**: Vendor name is required
- **409 Conflict**: Vendor with this name already exists
- **500 Internal Server Error**: Server error

---

### 2. Get All Vendors
**GET** `/api/v1/vendors`

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

### 3. Get Vendor by ID
**GET** `/api/v1/vendors/:id`

Retrieves a specific vendor by their ID.

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

### 4. Update Vendor
**PUT** or **PATCH** `/api/v1/vendors/:id`

Updates vendor information.

#### URL Parameters
- `id` (UUID) - Vendor ID

#### Request Body
```json
{
  "vendor_name": "Apple Inc. (Updated)"
}
```

#### Required Fields
- `vendor_name` (string) - Must be unique

#### Success Response (200)
```json
{
  "success": true,
  "message": "Vendor updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "vendor_name": "Apple Inc. (Updated)",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:45:00.000Z"
  }
}
```

#### Error Responses
- **400 Bad Request**: Vendor name is required
- **404 Not Found**: Vendor not found
- **409 Conflict**: Vendor name is already taken by another vendor
- **500 Internal Server Error**: Server error

---

### 5. Delete Vendor
**DELETE** `/api/v1/vendors/:id`

Permanently deletes a vendor from the database.

#### URL Parameters
- `id` (UUID) - Vendor ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Vendor deleted successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "vendor_name": "Apple Inc."
  }
}
```

#### Error Responses
- **404 Not Found**: Vendor not found
- **500 Internal Server Error**: Server error

---

## Category APIs

### 1. Create Category
**POST** `/api/v1/categories`

Creates a new category with an optional image. The image is uploaded to AWS S3.

#### Request
- **Content-Type**: `multipart/form-data` (if image is included) or `application/json` (if no image)
- **Fields**:
  - `category_name` (string, required)
  - `image` (file, optional) - Image file to upload

#### Request Body (JSON)
```json
{
  "category_name": "Electronics"
}
```

#### Request Body (Form Data)
- `category_name`: "Electronics"
- `image`: [file]

#### Success Response (201)
```json
{
  "success": true,
  "message": "Category created successfully",
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
- **400 Bad Request**: Category name is required
- **409 Conflict**: Category with this name already exists
- **500 Internal Server Error**: Server error or S3 upload error

---

### 2. Get All Categories
**GET** `/api/v1/categories`

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

### 3. Get Category by ID
**GET** `/api/v1/categories/:id`

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

### 4. Update Category
**PUT** or **PATCH** `/api/v1/categories/:id`

Updates category information. You can update the name, image, or both.

#### URL Parameters
- `id` (UUID) - Category ID

#### Request
- **Content-Type**: `multipart/form-data` (if image is included) or `application/json` (if only updating name)
- **Fields**:
  - `category_name` (string, optional)
  - `image` (file, optional) - New image file to upload

#### Request Body (JSON - name only)
```json
{
  "category_name": "Electronics & Gadgets"
}
```

#### Request Body (Form Data - with image)
- `category_name`: "Electronics & Gadgets" (optional)
- `image`: [file] (optional)

#### Success Response (200)
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "category_name": "Electronics & Gadgets",
    "image": "https://your-bucket.s3.ca-central-1.amazonaws.com/categories/xyz789ghi012.webp",
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T12:00:00.000Z"
  }
}
```

#### Error Responses
- **400 Bad Request**: No fields to update
- **404 Not Found**: Category not found
- **409 Conflict**: Category name is already taken by another category
- **500 Internal Server Error**: Server error or S3 upload error

**Note**: 
- If you upload a new image, the old image is automatically deleted from S3
- Images are automatically converted to WebP format before upload
- Maximum file size: 500MB

---

### 5. Delete Category
**DELETE** `/api/v1/categories/:id`

Permanently deletes a category from the database. The associated image is also deleted from S3.

#### URL Parameters
- `id` (UUID) - Category ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "Category deleted successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "category_name": "Electronics"
  }
}
```

#### Error Responses
- **404 Not Found**: Category not found
- **500 Internal Server Error**: Server error

**Note**: The category image is automatically deleted from S3 when the category is deleted.

---

## Important Notes

### Vendor
- Vendor names must be unique
- Vendor IDs are UUIDs (not sequential integers)
- All timestamps are in UTC with timezone information

### Category
- Category names must be unique
- Category IDs are UUIDs (not sequential integers)
- Images are uploaded to AWS S3 in the `categories` folder
- Images are automatically converted to WebP format
- Old images are automatically deleted when updated or when category is deleted
- Maximum file size: 500MB
- Image field is optional - categories can be created without images

### AWS S3 Configuration
Make sure your `.env` file includes:
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=your_bucket_name
```

---

## Example cURL Commands

### Vendor APIs

#### Create Vendor
```bash
curl -X POST http://localhost:3000/api/v1/vendors \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Apple Inc."
  }'
```

#### Get All Vendors
```bash
curl -X GET http://localhost:3000/api/v1/vendors
```

#### Get Vendor by ID
```bash
curl -X GET http://localhost:3000/api/v1/vendors/550e8400-e29b-41d4-a716-446655440000
```

#### Update Vendor
```bash
curl -X PUT http://localhost:3000/api/v1/vendors/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_name": "Apple Inc. (Updated)"
  }'
```

#### Delete Vendor
```bash
curl -X DELETE http://localhost:3000/api/v1/vendors/550e8400-e29b-41d4-a716-446655440000
```

### Category APIs

#### Create Category (without image)
```bash
curl -X POST http://localhost:3000/api/v1/categories \
  -H "Content-Type: application/json" \
  -d '{
    "category_name": "Electronics"
  }'
```

#### Create Category (with image)
```bash
curl -X POST http://localhost:3000/api/v1/categories \
  -F "category_name=Electronics" \
  -F "image=@/path/to/your/image.jpg"
```

#### Get All Categories
```bash
curl -X GET http://localhost:3000/api/v1/categories
```

#### Get Category by ID
```bash
curl -X GET http://localhost:3000/api/v1/categories/660e8400-e29b-41d4-a716-446655440001
```

#### Update Category (name only)
```bash
curl -X PUT http://localhost:3000/api/v1/categories/660e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -d '{
    "category_name": "Electronics & Gadgets"
  }'
```

#### Update Category (with new image)
```bash
curl -X PUT http://localhost:3000/api/v1/categories/660e8400-e29b-41d4-a716-446655440001 \
  -F "category_name=Electronics & Gadgets" \
  -F "image=@/path/to/your/new-image.jpg"
```

#### Delete Category
```bash
curl -X DELETE http://localhost:3000/api/v1/categories/660e8400-e29b-41d4-a716-446655440001
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

### Vendors Table
- `id` - Primary key (UUID, auto-generated)
- `vendor_name` - VARCHAR(255) NOT NULL UNIQUE
- `created_at` - TIMESTAMP WITH TIME ZONE
- `updated_at` - TIMESTAMP WITH TIME ZONE

### Categories Table
- `id` - Primary key (UUID, auto-generated)
- `category_name` - VARCHAR(255) NOT NULL UNIQUE
- `image` - TEXT (stores S3 URL)
- `created_at` - TIMESTAMP WITH TIME ZONE
- `updated_at` - TIMESTAMP WITH TIME ZONE
