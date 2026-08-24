const featuredGamingPcService = require('../services/featuredGamingPc.service');
const siteSettingsService = require('../services/siteSettings.service');
const { uploadToS3, deleteFromS3 } = require('../utils/s3.util');

// Accepts a JSON-array string (multipart form field) or an actual array
// (JSON request body) — mirrors how vendor_ids/specs are parsed on products.
const parseArrayField = (value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
};

class FeaturedGamingPcController {
  async getAll(req, res) {
    try {
      const gamingPcs = await featuredGamingPcService.getAll();
      res.status(200).json({
        success: true,
        message: 'Featured gaming PCs retrieved successfully',
        data: gamingPcs,
        count: gamingPcs.length
      });
    } catch (error) {
      console.error('Error fetching featured gaming PCs:', error);
      res.status(500).json({ success: false, message: 'Error fetching featured gaming PCs', error: error.message });
    }
  }

  async getActiveForPublic(req, res) {
    try {
      const settings = await siteSettingsService.getSiteSettings();
      const limit = settings.featured_gaming_pcs_limit ?? 4;
      const gamingPcs = await featuredGamingPcService.getActiveOrdered(limit);
      res.status(200).json({
        success: true,
        message: 'Featured gaming PCs retrieved successfully',
        data: gamingPcs,
        count: gamingPcs.length
      });
    } catch (error) {
      console.error('Error fetching public featured gaming PCs:', error);
      res.status(500).json({ success: false, message: 'Error fetching featured gaming PCs', error: error.message });
    }
  }

  async getById(req, res) {
    try {
      const gamingPc = await featuredGamingPcService.getById(req.params.id);
      if (!gamingPc) {
        return res.status(404).json({ success: false, message: 'Featured gaming PC not found' });
      }
      res.status(200).json({ success: true, message: 'Featured gaming PC retrieved successfully', data: gamingPc });
    } catch (error) {
      console.error('Error fetching featured gaming PC:', error);
      res.status(500).json({ success: false, message: 'Error fetching featured gaming PC', error: error.message });
    }
  }

  // Public single-build lookup (storefront detail page) — 404s if inactive,
  // same "don't reveal it exists" behavior as unpublished products.
  async getByIdForPublic(req, res) {
    try {
      const gamingPc = await featuredGamingPcService.getById(req.params.id);
      if (!gamingPc || !gamingPc.is_active) {
        return res.status(404).json({ success: false, message: 'Featured gaming PC not found' });
      }
      res.status(200).json({ success: true, message: 'Featured gaming PC retrieved successfully', data: gamingPc });
    } catch (error) {
      console.error('Error fetching public featured gaming PC:', error);
      res.status(500).json({ success: false, message: 'Error fetching featured gaming PC', error: error.message });
    }
  }

  // Same as getByIdForPublic, but looked up by slug — used by the storefront's
  // clean detail URL (/gaming-pc/<slug>).
  async getBySlugForPublic(req, res) {
    try {
      const gamingPc = await featuredGamingPcService.getBySlug(req.params.slug);
      if (!gamingPc || !gamingPc.is_active) {
        return res.status(404).json({ success: false, message: 'Featured gaming PC not found' });
      }
      res.status(200).json({ success: true, message: 'Featured gaming PC retrieved successfully', data: gamingPc });
    } catch (error) {
      console.error('Error fetching public featured gaming PC by slug:', error);
      res.status(500).json({ success: false, message: 'Error fetching featured gaming PC', error: error.message });
    }
  }

  async create(req, res) {
    try {
      const { name, description, price, is_active } = req.body;
      const keyFeatures = parseArrayField(req.body.key_features) || [];
      // Each item: { product_id, quantity } — lets the same product appear
      // more than once in a build (e.g. 2x RAM sticks).
      const products = parseArrayField(req.body.products) || [];

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'name is required' });
      }
      const parsedPrice = parseFloat(price);
      if (price === undefined || isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ success: false, message: 'price must be a non-negative number' });
      }

      const imageFiles = req.files?.images || [];
      if (imageFiles.length === 0) {
        return res.status(400).json({ success: false, message: 'At least 1 image is required' });
      }

      const imageUrls = [];
      try {
        for (let i = 0; i < Math.min(imageFiles.length, 5); i++) {
          imageUrls.push(await uploadToS3(imageFiles[i], 'featured-gaming-pcs'));
        }
      } catch (uploadError) {
        console.error('Error uploading featured gaming PC images to S3:', uploadError);
        return res.status(500).json({ success: false, message: 'Error uploading images to S3', error: uploadError.message });
      }

      const gamingPc = await featuredGamingPcService.create({
        name,
        description,
        price: parsedPrice,
        key_features: keyFeatures,
        is_active: is_active !== undefined ? (is_active === 'true' || is_active === true) : true,
        images: imageUrls,
        products
      });

      res.status(201).json({ success: true, message: 'Featured gaming PC created successfully', data: gamingPc });
    } catch (error) {
      console.error('Error creating featured gaming PC:', error);
      res.status(400).json({ success: false, message: error.message || 'Error creating featured gaming PC' });
    }
  }

  async update(req, res) {
    try {
      const { id } = req.params;
      const currentGamingPc = await featuredGamingPcService.getById(id);
      if (!currentGamingPc) {
        return res.status(404).json({ success: false, message: 'Featured gaming PC not found' });
      }

      const { name, description, price, is_active } = req.body;
      const updateData = {};

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description || null;
      if (price !== undefined) {
        const parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          return res.status(400).json({ success: false, message: 'price must be a non-negative number' });
        }
        updateData.price = parsedPrice;
      }
      if (is_active !== undefined) updateData.is_active = is_active === 'true' || is_active === true;

      const keyFeatures = parseArrayField(req.body.key_features);
      if (keyFeatures !== undefined) updateData.key_features = keyFeatures;

      const products = parseArrayField(req.body.products);
      if (products !== undefined) updateData.products = products;

      // Images fully replace the existing set — only touched when new files
      // are uploaded this request (see service.update's comment).
      const imageFiles = req.files?.images || [];
      if (imageFiles.length > 0) {
        try {
          const imageUrls = [];
          for (let i = 0; i < Math.min(imageFiles.length, 5); i++) {
            imageUrls.push(await uploadToS3(imageFiles[i], 'featured-gaming-pcs'));
          }
          updateData.images = imageUrls;

          // Old images are only deleted from S3 after the DB swap succeeds, so a
          // failed update never leaves the row referencing images we just deleted.
          for (const oldUrl of currentGamingPc.images) {
            try {
              await deleteFromS3(oldUrl);
            } catch (deleteError) {
              console.error('Error deleting old featured gaming PC image from S3:', deleteError);
            }
          }
        } catch (uploadError) {
          console.error('Error uploading featured gaming PC images to S3:', uploadError);
          return res.status(500).json({ success: false, message: 'Error uploading images to S3', error: uploadError.message });
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      const gamingPc = await featuredGamingPcService.update(id, updateData);
      res.status(200).json({ success: true, message: 'Featured gaming PC updated successfully', data: gamingPc });
    } catch (error) {
      console.error('Error updating featured gaming PC:', error);
      res.status(400).json({ success: false, message: error.message || 'Error updating featured gaming PC' });
    }
  }

  async remove(req, res) {
    try {
      const deleted = await featuredGamingPcService.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Featured gaming PC not found' });
      }

      for (const url of deleted.images) {
        try {
          await deleteFromS3(url);
        } catch (deleteError) {
          console.error('Error deleting featured gaming PC image from S3:', deleteError);
        }
      }

      res.status(200).json({ success: true, message: 'Featured gaming PC deleted successfully' });
    } catch (error) {
      console.error('Error deleting featured gaming PC:', error);
      res.status(500).json({ success: false, message: 'Error deleting featured gaming PC', error: error.message });
    }
  }

  async reorder(req, res) {
    try {
      const { gaming_pcs } = req.body;
      if (!Array.isArray(gaming_pcs)) {
        return res.status(400).json({ success: false, message: 'gaming_pcs must be an array' });
      }
      const updated = await featuredGamingPcService.reorder(gaming_pcs);
      res.status(200).json({ success: true, message: 'Featured gaming PC order updated successfully', data: updated });
    } catch (error) {
      console.error('Error reordering featured gaming PCs:', error);
      res.status(400).json({ success: false, message: error.message || 'Error reordering featured gaming PCs' });
    }
  }
}

module.exports = new FeaturedGamingPcController();
