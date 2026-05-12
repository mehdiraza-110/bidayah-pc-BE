


# Key Features API Guide

Use these APIs to manage category-based key feature filters for products.

Key features are different from plain product specs:
- `category_key_features` are reusable keys for a category, such as `Ram Speed`, `Ram Size`, or `Color Type`.
- `product_key_features` are product-specific values for those keys, such as `3200MHz`, `16GB`, or `RGB`.

All admin endpoints are prefixed with: `/api/v1`

---

## Admin Flow

1. Admin selects a product category.
2. Frontend calls `GET /api/v1/key-features?category_id=<category_id>&is_active=true`.
3. Frontend shows a Key Features section under Specifications.
4. Admin selects existing keys or types new key names.
5. Admin enters a new value for each key.
6. Frontend sends `key_features` with product create/update.

---

## Key Feature Management

### 1. Create Key Feature
**POST** `/api/v1/key-features`

Creates a reusable key for a category.

#### Request Body
```json
{
  "category_id": "ram-category-id",
  "feature_key": "Ram Speed",
  "display_order": 0,
  "is_active": true
}
```

#### Success Response (201)
```json
{
  "success": true,
  "message": "Key feature created successfully",
  "data": {
    "id": "key-feature-id",
    "category_id": "ram-category-id",
    "category_name": "Ram",
    "feature_key": "Ram Speed",
    "display_order": 0,
    "is_active": true,
    "created_at": "2026-05-12T10:30:00.000Z",
    "updated_at": "2026-05-12T10:30:00.000Z"
  }
}
```

---

### 2. Get Key Features
**GET** `/api/v1/key-features`

#### Query Parameters
- `category_id` (UUID, optional) - Filter keys by category
- `is_active` (boolean/string, optional) - Filter active/inactive keys

#### Examples
```
GET /api/v1/key-features
GET /api/v1/key-features?category_id=ram-category-id
GET /api/v1/key-features?category_id=ram-category-id&is_active=true
```

#### Success Response (200)
```json
{
  "success": true,
  "message": "Key features retrieved successfully",
  "data": [
    {
      "id": "key-feature-id",
      "category_id": "ram-category-id",
      "category_name": "Ram",
      "feature_key": "Ram Speed",
      "display_order": 0,
      "is_active": true,
      "created_at": "2026-05-12T10:30:00.000Z",
      "updated_at": "2026-05-12T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

### 3. Get Key Feature by ID
**GET** `/api/v1/key-features/:id`

---

### 4. Update Key Feature
**PUT/PATCH** `/api/v1/key-features/:id`

#### Request Body
```json
{
  "feature_key": "Memory Speed",
  "display_order": 1,
  "is_active": true
}
```

---

### 5. Delete Key Feature
**DELETE** `/api/v1/key-features/:id`

Deleting a key also deletes saved values for that key because product values depend on the key.

---

## Product Create/Update Integration

The existing product create/update APIs now accept `key_features`.

- **POST** `/api/v1/products`
- **PUT/PATCH** `/api/v1/products/:id`

Because product APIs use multipart form data, send `key_features` as a JSON string.

### Payload Shape

Use an existing key:
```json
{
  "key_feature_id": "existing-key-feature-id",
  "value": "3200MHz"
}
```

Create/reuse a key inline by name:
```json
{
  "feature_key": "Ram Size",
  "value": "16GB"
}
```

Full `key_features` example:
```json
[
  {
    "key_feature_id": "ram-speed-key-id",
    "value": "3200MHz"
  },
  {
    "feature_key": "Ram Size",
    "value": "16GB"
  },
  {
    "feature_key": "Color Type",
    "value": "RGB"
  }
]
```

### Create Product Example
```bash
curl -X POST http://localhost:3000/api/v1/products \
  -F "name=Corsair Vengeance RGB 16GB" \
  -F "category_id=ram-category-id" \
  -F "price=79.99" \
  -F "stock=20" \
  -F "vendor_ids=[\"vendor-id\"]" \
  -F "specs=[\"DDR4\", \"Desktop memory\"]" \
  -F "key_features=[{\"key_feature_id\":\"ram-speed-key-id\",\"value\":\"3200MHz\"},{\"feature_key\":\"Ram Size\",\"value\":\"16GB\"},{\"feature_key\":\"Color Type\",\"value\":\"RGB\"}]" \
  -F "main_image=@/path/to/image.webp"
```

### Update Product Key Features Example
```bash
curl -X PATCH http://localhost:3000/api/v1/products/product-id \
  -F "key_features=[{\"key_feature_id\":\"ram-speed-key-id\",\"value\":\"3600MHz\"},{\"feature_key\":\"Ram Size\",\"value\":\"32GB\"}]"
```

When `key_features` is provided on update, all existing key feature values for that product are replaced with the submitted list.

---

## Product Response

Product list and product detail responses now include `key_features`.

```json
{
  "id": "product-id",
  "name": "Corsair Vengeance RGB 16GB",
  "category_id": "ram-category-id",
  "category_name": "Ram",
  "key_features": [
    {
      "id": "product-key-feature-id",
      "key_feature_id": "ram-speed-key-id",
      "feature_key": "Ram Speed",
      "feature_value": "3200MHz",
      "display_order": 0
    }
  ]
}
```

---

## Frontend Notes

- Hide the Key Features section until `category_id` is selected.
- Refetch keys whenever `category_id` changes.
- Existing keys should populate the dropdown from `GET /api/v1/key-features?category_id=<id>&is_active=true`.
- Let admins add a new key by sending `feature_key` in the product payload or by calling `POST /api/v1/key-features` first.
- Values are product-specific, so do not reuse old values from another product.
- If the product category changes, submit key features that belong to the new category.
