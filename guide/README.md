# API Documentation Guide

This folder contains guides and documentation for the Bidayah PC Backend APIs.

## Available Guides

- **[User CRUD API Guide](./user-api-guide.md)** - Complete documentation for User CRUD operations
- **[Vendor & Category CRUD API Guide](./vendor-category-api-guide.md)** - Complete documentation for Vendor and Category CRUD operations

## Quick Start

1. Make sure all dependencies are installed:
   ```bash
   npm install
   ```

2. Set up your environment variables in `.env` file:
   ```
   PORT=3000
   DB_USER=your_db_user
   DB_HOST=localhost
   DB_DATABASE=your_database
   DB_PASSWORD=your_password
   DB_PORT=5432
   JWT_SECRET=your_jwt_secret
   AWS_ACCESS_KEY_ID=your_aws_access_key
   AWS_SECRET_ACCESS_KEY=your_aws_secret_key
   AWS_BUCKET_NAME=your_bucket_name
   ```

3. Run the database schema:
   ```bash
   psql -U your_db_user -d your_database -f schema/schema.sql
   ```

4. Start the server:
   ```bash
   node index.js
   ```

5. The API will be available at `http://localhost:3000/api/v1`

## API Base URL

All APIs are prefixed with: `/api/v1`

## Features

- ✅ User CRUD operations
- ✅ Automatic admin role assignment for new users
- ✅ Password hashing with bcrypt
- ✅ Soft delete functionality
- ✅ Role-based access control (RBAC) support
- ✅ Vendor CRUD operations
- ✅ Category CRUD operations with S3 image upload

## Need Help?

Refer to the specific API guide for detailed endpoint documentation and examples.
