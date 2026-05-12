# PC Builder Filter Rules Integration Guide

Use these APIs to manage the admin rules that decide which products appear in the Build Your PC flow after a user selects a category/vendor combination.

## Base URL
All endpoints are prefixed with: `/api/v1/pc-builder-filter-rules`

---

## Rule Concept
A rule means:

> When user selects `selected_category_id` and optionally `selected_vendor_id`, show products from `result_category_id`, optionally limited by `result_vendor_id`, and optionally filtered by product specification text.

Example:

```json
{
  "rule_name": "AMD CPU shows AM5 motherboards",
  "selected_category_id": "cpu-category-id",
  "selected_vendor_id": "amd-vendor-id",
  "result_category_id": "motherboard-category-id",
  "result_vendor_id": null,
  "spec_match_terms": ["AM5", "AMD"],
  "spec_match_mode": "any",
  "priority": 10,
  "is_active": true
}
```

`spec_match_mode`:
- `any` - product is shown if any term exists in its specs
- `all` - product is shown only if all terms exist in its specs

---

## Admin CRUD APIs

### Create Rule
**POST** `/api/v1/pc-builder-filter-rules`

#### Request Body
```json
{
  "rule_name": "AMD CPU shows AM5 motherboards",
  "selected_category_id": "cpu-category-id",
  "selected_vendor_id": "amd-vendor-id",
  "result_category_id": "motherboard-category-id",
  "result_vendor_id": null,
  "spec_match_terms": ["AM5"],
  "spec_match_mode": "any",
  "priority": 10,
  "is_active": true
}
```

#### Required Fields
- `rule_name`
- `selected_category_id`
- `result_category_id`

---

### Get Rules
**GET** `/api/v1/pc-builder-filter-rules`

#### Optional Query Params
- `selected_category_id`
- `selected_vendor_id`
- `result_category_id`
- `result_vendor_id`
- `is_active=true|false`

---

### Get Rule by ID
**GET** `/api/v1/pc-builder-filter-rules/:id`

---

### Update Rule
**PUT/PATCH** `/api/v1/pc-builder-filter-rules/:id`

Send only the fields that need updating.

---

### Delete Rule
**DELETE** `/api/v1/pc-builder-filter-rules/:id`

---

## Preview APIs

### Preview One Rule
**GET** `/api/v1/pc-builder-filter-rules/:id/preview`

#### Optional Query Params
- `status=published|draft`
- `in_stock=true|false`

Returns the products matched by that single rule.

---

### Preview User Selection
**GET** `/api/v1/pc-builder-filter-rules/preview`

Use this in the Build Your PC page after a user selects a part.

#### Query Params
- `selected_category_id` required
- `selected_vendor_id` optional
- `result_category_id` optional, recommended when loading the next part type
- `status=published` recommended for frontend
- `in_stock=true` optional

#### Example
```http
GET /api/v1/pc-builder-filter-rules/preview?selected_category_id=cpu-category-id&selected_vendor_id=amd-vendor-id&result_category_id=motherboard-category-id&status=published&in_stock=true
```

#### Success Response
```json
{
  "success": true,
  "message": "Matching PC builder products retrieved successfully",
  "data": [
    {
      "id": "product-id",
      "name": "B650 Gaming Motherboard",
      "category_id": "motherboard-category-id",
      "category_name": "Motherboards",
      "price": "199.99",
      "image": "https://example.com/product.webp",
      "in_stock": true,
      "vendors": [],
      "media": [],
      "specs": [
        {
          "id": "spec-id",
          "spec_text": "AMD AM5 Socket",
          "display_order": 0
        }
      ]
    }
  ],
  "rules": [],
  "count": 1
}
```

---

## Frontend Integration Flow

1. Load categories/vendors using existing APIs.
2. User selects a product, for example CPU category + AMD vendor.
3. For the next step, call:
   ```http
   GET /api/v1/pc-builder-filter-rules/preview?selected_category_id=<cpu_category_id>&selected_vendor_id=<amd_vendor_id>&result_category_id=<motherboard_category_id>&status=published
   ```
4. Render the returned `data` products.
5. When admin updates rules, no frontend deployment is needed.

## Notes
- Product specs are matched using text search against `product_specs.spec_text`.
- Add useful specs while creating products, such as `AM5`, `DDR5`, `Intel LGA1700`, `RTX 4070 compatible`.
- Rules with `selected_vendor_id = null` act as fallback rules for a selected category.
