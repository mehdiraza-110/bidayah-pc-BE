# User CRUD API Guide

This guide provides documentation for the User CRUD APIs.

## Base URL
All endpoints are prefixed with: `/api/v1/users`

---

## Endpoints

### 1. Login
**POST** `/api/v1/users/login`

Authenticates a user and returns a JWT token. The token is also set as an HTTP-only cookie.

#### Request Body
```json
{
  "email": "john.doe@example.com",
  "password": "securePassword123"
}
```

#### Required Fields
- `email` (string)
- `password` (string)

#### Success Response (200)
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "profile_image": "https://example.com/image.jpg",
      "is_verified": false,
      "is_admin_user": false,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "roles": [
        {
          "id": 1,
          "name": "admin"
        }
      ]
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Note**: The token is also automatically set as an HTTP-only cookie named `token`.

#### Error Responses
- **400 Bad Request**: Missing email or password
- **401 Unauthorized**: Invalid email or password
- **500 Internal Server Error**: Server error

---

### 2. Create User
**POST** `/api/v1/users`

Creates a new user and automatically assigns the "admin" role by default.

#### Request Body
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "password": "securePassword123",
  "profile_image": "https://example.com/image.jpg",  // Optional
  "is_verified": false,  // Optional, defaults to false
  "is_admin_user": false  // Optional, defaults to false
}
```

#### Required Fields
- `email` (string)
- `phone` (string)
- `password` (string)

#### Optional Fields
- `first_name` (string)
- `last_name` (string)
- `profile_image` (string)
- `is_verified` (boolean)
- `is_admin_user` (boolean)

#### Success Response (201)
```json
{
  "success": true,
  "message": "User created successfully",
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "profile_image": "https://example.com/image.jpg",
    "is_verified": false,
    "is_admin_user": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "roles": [
      {
        "id": 1,
        "name": "admin"
      }
    ]
  }
}
```

#### Error Responses
- **400 Bad Request**: Missing required fields
- **409 Conflict**: User with email already exists
- **500 Internal Server Error**: Server error

---

### 3. Get All Users
**GET** `/api/v1/users`

Retrieves a list of all users (excluding soft-deleted users).

#### Success Response (200)
```json
{
  "success": true,
  "message": "Users retrieved successfully",
  "data": [
    {
      "id": 1,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "phone": "+1234567890",
      "profile_image": "https://example.com/image.jpg",
      "is_verified": false,
      "is_admin_user": false,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "roles": [
        {
          "id": 1,
          "name": "admin"
        }
      ]
    }
  ],
  "count": 1
}
```

---

### 4. Get User by ID
**GET** `/api/v1/users/:id`

Retrieves a specific user by their ID.

#### URL Parameters
- `id` (integer) - User ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "User retrieved successfully",
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "profile_image": "https://example.com/image.jpg",
    "is_verified": false,
    "is_admin_user": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z",
    "roles": [
      {
        "id": 1,
        "name": "admin"
      }
    ]
  }
}
```

#### Error Responses
- **404 Not Found**: User not found
- **500 Internal Server Error**: Server error

---

### 5. Update User
**PUT** or **PATCH** `/api/v1/users/:id`

Updates user information. You can update any combination of fields.

#### URL Parameters
- `id` (integer) - User ID

#### Request Body
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "phone": "+9876543210",
  "password": "newPassword123",  // Will be hashed automatically
  "profile_image": "https://example.com/new-image.jpg",
  "is_verified": true,
  "is_admin_user": true
}
```

**Note**: All fields are optional. Only include the fields you want to update.

#### Success Response (200)
```json
{
  "success": true,
  "message": "User updated successfully",
  "data": {
    "id": 1,
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+9876543210",
    "profile_image": "https://example.com/new-image.jpg",
    "is_verified": true,
    "is_admin_user": true,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:45:00.000Z",
    "roles": [
      {
        "id": 1,
        "name": "admin"
      }
    ]
  }
}
```

#### Error Responses
- **400 Bad Request**: No fields to update
- **404 Not Found**: User not found
- **500 Internal Server Error**: Server error

---

### 6. Update User Profile
**PUT** or **PATCH** `/api/v1/users/profile`

Updates the authenticated user's own profile information. Requires authentication.

#### Authentication
- Requires valid JWT token in cookie or Authorization header

#### Request Body
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "phone": "+9876543210"
}
```

**Note**: All fields are optional. Only include the fields you want to update.

#### Success Response (200)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": 1,
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+9876543210",
    "profile_image": "https://example.com/image.jpg",
    "is_verified": false,
    "is_admin_user": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T11:45:00.000Z",
    "roles": [
      {
        "id": 1,
        "name": "admin"
      }
    ]
  }
}
```

#### Error Responses
- **400 Bad Request**: No fields to update
- **401 Unauthorized**: Not authenticated
- **404 Not Found**: User not found
- **409 Conflict**: Email is already taken by another user
- **500 Internal Server Error**: Server error

---

### 7. Update User Avatar
**PUT** or **PATCH** `/api/v1/users/avatar`

Updates the authenticated user's avatar image. The image is uploaded to AWS S3 and the old avatar is automatically deleted. Requires authentication.

#### Authentication
- Requires valid JWT token in cookie or Authorization header

#### Request
- **Content-Type**: `multipart/form-data`
- **Field name**: `avatar`
- **File type**: Image file (will be converted to WebP format)

#### Success Response (200)
```json
{
  "success": true,
  "message": "Avatar updated successfully",
  "data": {
    "id": 1,
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "profile_image": "https://your-bucket.s3.ca-central-1.amazonaws.com/avatars/abc123def456.webp",
    "is_verified": false,
    "is_admin_user": false,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T12:00:00.000Z",
    "roles": [
      {
        "id": 1,
        "name": "admin"
      }
    ]
  }
}
```

#### Error Responses
- **400 Bad Request**: No file uploaded
- **401 Unauthorized**: Not authenticated
- **404 Not Found**: User not found
- **500 Internal Server Error**: Server error or S3 upload error

**Note**: 
- Images are automatically converted to WebP format before upload
- Old avatar images are automatically deleted from S3 when a new one is uploaded
- Maximum file size: 500MB

---

### 8. Delete User (Soft Delete)
**DELETE** `/api/v1/users/:id`

Soft deletes a user by setting the `is_deleted` flag to `true`. The user record remains in the database but is excluded from queries.

#### URL Parameters
- `id` (integer) - User ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "User deleted successfully",
  "data": {
    "id": 1
  }
}
```

#### Error Responses
- **404 Not Found**: User not found
- **500 Internal Server Error**: Server error

---

### 9. Hard Delete User
**DELETE** `/api/v1/users/:id/hard`

Permanently deletes a user from the database. **Use with caution!**

#### URL Parameters
- `id` (integer) - User ID

#### Success Response (200)
```json
{
  "success": true,
  "message": "User permanently deleted",
  "data": {
    "id": 1
  }
}
```

#### Error Responses
- **404 Not Found**: User not found
- **500 Internal Server Error**: Server error

---

## Important Notes

### Default Admin Role
- Every new user is automatically assigned the "admin" role upon creation
- This happens automatically in the `createUser` function

### Password Security
- Passwords are automatically hashed using bcrypt (10 salt rounds)
- Passwords are never returned in API responses
- When updating a password, provide the plain text password; it will be hashed automatically

### Soft Delete vs Hard Delete
- **Soft Delete**: Sets `is_deleted = true`. User data remains in database but is excluded from queries
- **Hard Delete**: Permanently removes the user record from the database

### Role Information
- All user responses include role information in the `roles` array
- Roles are fetched from the `user_roles` and `roles` tables

### Authentication
- Login endpoint returns a JWT token that is stored in an HTTP-only cookie
- Protected endpoints (profile and avatar updates) require authentication
- The token contains user ID, email, and roles information
- Token expires after 1 hour

### Avatar Upload
- Avatar images are uploaded to AWS S3
- Images are automatically converted to WebP format
- Old avatars are automatically deleted when a new one is uploaded
- Maximum file size: 500MB

---

## Example cURL Commands

### Login
```bash
curl -X POST http://localhost:3000/api/v1/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "securePassword123"
  }' \
  -c cookies.txt
```

**Note**: The `-c cookies.txt` flag saves the authentication cookie. Use `-b cookies.txt` in subsequent requests to include the cookie.

### Create User
```bash
curl -X POST http://localhost:3000/api/v1/users \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+1234567890",
    "password": "securePassword123"
  }'
```

### Get All Users
```bash
curl -X GET http://localhost:3000/api/v1/users
```

### Get User by ID
```bash
curl -X GET http://localhost:3000/api/v1/users/1
```

### Update User
```bash
curl -X PUT http://localhost:3000/api/v1/users/1 \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "email": "jane.doe@example.com"
  }'
```

### Update User Profile (Authenticated)
```bash
curl -X PUT http://localhost:3000/api/v1/users/profile \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+9876543210"
  }'
```

### Update User Avatar (Authenticated)
```bash
curl -X PUT http://localhost:3000/api/v1/users/avatar \
  -b cookies.txt \
  -F "avatar=@/path/to/your/image.jpg"
```

**Note**: Replace `/path/to/your/image.jpg` with the actual path to your image file.

### Delete User (Soft Delete)
```bash
curl -X DELETE http://localhost:3000/api/v1/users/1
```

### Hard Delete User
```bash
curl -X DELETE http://localhost:3000/api/v1/users/1/hard
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

### Users Table
- `id` - Primary key (SERIAL)
- `first_name` - VARCHAR(300)
- `last_name` - VARCHAR(300)
- `email` - VARCHAR(350) NOT NULL
- `phone` - VARCHAR(350) NOT NULL
- `password_hash` - VARCHAR(500) NOT NULL
- `profile_image` - VARCHAR(500)
- `is_verified` - BOOLEAN
- `is_admin_user` - BOOLEAN DEFAULT FALSE
- `created_at` - TIMESTAMP
- `updated_at` - TIMESTAMP
- `is_deleted` - BOOLEAN

### Roles
- `admin` - Default role assigned to all new users
- `agent` - Available role
- `commoner` - Available role
