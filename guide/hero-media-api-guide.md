# Hero Media Customization API Guide

This guide provides documentation for the Hero Media Customization APIs used to manage the homepage hero section.

## Base URLs
- Admin endpoints: `/api/v1/customization`
- Public endpoints: `/api/v1/public`

---

## Admin: Create or Update Hero Media

### Endpoint
**POST** `/api/v1/customization/hero-media`

Creates or updates hero media items for the homepage hero section. Supports up to 7 media items (indices 0-6).

### Authentication
- **Required**: Admin role
- Use JWT token in Authorization header: `Bearer <token>`

### Content-Type
- `multipart/form-data` (for file uploads)

### Request Body

The request should include:
1. A JSON string field `media` containing the media array
2. Optional file fields: `media_0`, `media_1`, `media_2`, etc. (one for each media item being uploaded)

#### Media Array Format (JSON string)

```json
{
  "media": [
    {
      "url": "string",           // File URL after upload (can be null if uploading file)
      "type": "image" | "video", // Media type
      "index": 0                 // Position/index (0-6)
    },
    {
      "url": null,               // Will be set after file upload
      "type": "video",
      "index": 1
    }
  ]
}
```

#### Request Fields

**Media Array (required):**
- `media` (string) - JSON string containing array of media objects

**Each Media Object:**
- `url` (string, optional) - Existing file URL. If not provided, must upload a file
- `type` (string, required) - Must be `"image"` or `"video"`
- `index` (number, required) - Display position (0-6)

**File Fields (optional, one per media item):**
- `media_0` (file) - File for media at index 0
- `media_1` (file) - File for media at index 1
- `media_2` (file) - File for media at index 2
- ... up to `media_6`

#### File Requirements

**Images:**
- Allowed types: JPEG, JPG, PNG, GIF, WebP
- Max size: 500MB

**Videos:**
- Allowed types: MP4, MPEG, MOV, AVI, WebM
- Max size: 500MB

### Success Response (200)

```json
{
  "success": true,
  "message": "Hero media updated successfully",
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440001",
      "url": "https://your-bucket.s3.ca-central-1.amazonaws.com/hero-media/abc123.webp",
      "type": "image",
      "index": 0,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440002",
      "url": "https://your-bucket.s3.ca-central-1.amazonaws.com/hero-media/def456.mp4",
      "type": "video",
      "index": 1,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Error Responses

#### 400 Bad Request
```json
{
  "success": false,
  "message": "Media array is required and must not be empty"
}
```

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Unauthorized"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error updating hero media",
  "error": "Detailed error message"
}
```

---

## Public: Get Hero Media

### Endpoint
**GET** `/api/v1/public/hero-media`

Retrieves all hero media items for the homepage hero section. Returns media sorted by display index.

### Authentication
- **Not required** (public endpoint)

### Success Response (200)

```json
{
  "success": true,
  "message": "Hero media retrieved successfully",
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440001",
      "url": "https://your-bucket.s3.ca-central-1.amazonaws.com/hero-media/abc123.webp",
      "type": "image",
      "index": 0,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440002",
      "url": "https://your-bucket.s3.ca-central-1.amazonaws.com/hero-media/def456.mp4",
      "type": "video",
      "index": 1,
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Response Fields
- `id` (string) - Media item ID
- `url` (string) - S3 URL of the media file
- `type` (string) - Media type: `"image"` or `"video"`
- `index` (number) - Display position (0-6)
- `created_at` (string) - ISO 8601 timestamp
- `updated_at` (string) - ISO 8601 timestamp

---

## Example cURL Commands

### Create/Update Hero Media (with file uploads)

```bash
curl -X POST http://localhost:3000/api/v1/customization/hero-media \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F 'media=[{"type":"image","index":0},{"type":"video","index":1}]' \
  -F "media_0=@/path/to/image.jpg" \
  -F "media_1=@/path/to/video.mp4"
```

### Create/Update Hero Media (with existing URLs)

```bash
curl -X POST http://localhost:3000/api/v1/customization/hero-media \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F 'media=[{"url":"https://example.com/image.jpg","type":"image","index":0},{"url":"https://example.com/video.mp4","type":"video","index":1}]'
```

### Get Hero Media (Public)

```bash
curl -X GET http://localhost:3000/api/v1/public/hero-media
```

---

## Frontend Integration Examples

### JavaScript/Fetch API

#### Create/Update Hero Media

```javascript
const updateHeroMedia = async (mediaArray, files, token) => {
  const formData = new FormData();
  
  // Add media array as JSON string
  formData.append('media', JSON.stringify(mediaArray));
  
  // Add files if provided
  mediaArray.forEach((media, index) => {
    if (files[`media_${index}`]) {
      formData.append(`media_${index}`, files[`media_${index}`]);
    }
  });
  
  try {
    const response = await fetch('http://localhost:3000/api/v1/customization/hero-media', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Hero media updated:', data.data);
      return data.data;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error updating hero media:', error);
    throw error;
  }
};

// Example usage
const mediaArray = [
  { type: 'image', index: 0 },
  { type: 'video', index: 1 }
];

const files = {
  media_0: imageFile,  // File object
  media_1: videoFile   // File object
};

await updateHeroMedia(mediaArray, files, jwtToken);
```

#### Get Hero Media (Public)

```javascript
const getHeroMedia = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/v1/public/hero-media');
    const data = await response.json();
    
    if (data.success) {
      console.log('Hero media:', data.data);
      return data.data;
    }
  } catch (error) {
    console.error('Error fetching hero media:', error);
  }
};
```

### React Component Example

```javascript
import React, { useState, useEffect } from 'react';

const HeroSection = () => {
  const [heroMedia, setHeroMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchHeroMedia();
  }, []);
  
  const fetchHeroMedia = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/v1/public/hero-media');
      const data = await response.json();
      
      if (data.success) {
        setHeroMedia(data.data);
      }
    } catch (error) {
      console.error('Error fetching hero media:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div>Loading hero section...</div>;
  }
  
  return (
    <div className="hero-section">
      {heroMedia.map((media) => (
        <div key={media.id} className="hero-media-item" style={{ order: media.index }}>
          {media.type === 'image' ? (
            <img src={media.url} alt={`Hero ${media.index}`} />
          ) : (
            <video src={media.url} autoPlay muted loop playsInline />
          )}
        </div>
      ))}
    </div>
  );
};

export default HeroSection;
```

### Admin Component Example

```javascript
import React, { useState } from 'react';

const HeroMediaAdmin = () => {
  const [mediaArray, setMediaArray] = useState([
    { type: 'image', index: 0, url: null },
    { type: 'video', index: 1, url: null }
  ]);
  const [files, setFiles] = useState({});
  
  const handleFileChange = (index, file) => {
    setFiles(prev => ({
      ...prev,
      [`media_${index}`]: file
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('media', JSON.stringify(mediaArray));
    
    // Add files
    Object.keys(files).forEach(key => {
      if (files[key]) {
        formData.append(key, files[key]);
      }
    });
    
    try {
      const response = await fetch('http://localhost:3000/api/v1/customization/hero-media', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Hero media updated successfully!');
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error updating hero media');
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {mediaArray.map((media, index) => (
        <div key={index}>
          <label>
            Type:
            <select
              value={media.type}
              onChange={(e) => {
                const newArray = [...mediaArray];
                newArray[index].type = e.target.value;
                setMediaArray(newArray);
              }}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </label>
          
          <label>
            File:
            <input
              type="file"
              accept={media.type === 'image' ? 'image/*' : 'video/*'}
              onChange={(e) => handleFileChange(index, e.target.files[0])}
            />
          </label>
        </div>
      ))}
      
      <button type="submit">Update Hero Media</button>
    </form>
  );
};

export default HeroMediaAdmin;
```

---

## Important Notes

### Display Index
- Must be between 0 and 6 (inclusive)
- Each index can only have one media item
- Media is displayed in ascending index order (0, 1, 2, ...)
- Updating an existing index replaces the old media

### File Upload vs URL
- If a file is provided, it will be uploaded to S3 and the URL will be generated
- If a URL is provided, it will be used directly (no upload)
- At least one of `url` or file must be provided for each media item

### Media Types
- **Image**: JPEG, JPG, PNG, GIF, WebP
- **Video**: MP4, MPEG, MOV, AVI, WebM

### S3 Storage
- All uploaded files are stored in the `hero-media/` folder in S3
- Files are given random names to prevent conflicts
- Old files are automatically deleted when replaced

### Ordering
- Media items are returned sorted by `index` (ascending)
- Frontend should display them in this order

---

## Summary

| Endpoint | Method | Description | Authentication |
|----------|--------|-------------|----------------|
| `/api/v1/customization/hero-media` | POST | Create/update hero media | Admin required |
| `/api/v1/public/hero-media` | GET | Get hero media for homepage | Not required |

### Features
- Support for up to 7 media items (indices 0-6)
- Support for both images and videos
- File upload to S3
- Automatic cleanup of old files
- Public API for homepage display

---

## Use Cases

### Homepage Hero Section
Perfect for creating dynamic hero sections with:
- Image carousels
- Video backgrounds
- Mixed media displays
- Customizable ordering

### Content Management
- Easy media management through admin panel
- No need to manually update frontend code
- Support for both new uploads and existing URLs
