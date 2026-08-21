const categoryService = require('../services/category.service');
const { uploadToS3, deleteFromS3 } = require('../utils/s3.util');

class CategoryController {
  // Create a new category
  async createCategory(req, res) {
    try {
      const { category_name, hero_tagline, hero_description } = req.body;
      let imageUrl = req.body.image || null;
      let heroImageUrl = req.body.hero_image || null;

      // Validation
      if (!category_name) {
        return res.status(400).json({
          success: false,
          message: 'Category name is required'
        });
      }

      // Check if category already exists
      const existingCategory = await categoryService.getCategoryByName(category_name);
      if (existingCategory) {
        return res.status(409).json({
          success: false,
          message: 'Category with this name already exists'
        });
      }

      // Upload image(s) to S3 if provided
      const imageFile = req.files?.image?.[0] || req.file || null;
      const heroImageFile = req.files?.hero_image?.[0] || null;

      try {
        if (imageFile) {
          imageUrl = await uploadToS3(imageFile, 'categories');
        }
        if (heroImageFile) {
          heroImageUrl = await uploadToS3(heroImageFile, 'category-hero');
        }
      } catch (uploadError) {
        console.error('Error uploading image to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to S3',
          error: uploadError.message
        });
      }

      const categoryData = {
        category_name,
        image: imageUrl,
        hero_image: heroImageUrl,
        hero_tagline: hero_tagline || null,
        hero_description: hero_description || null,
      };

      const newCategory = await categoryService.createCategory(categoryData);
      
      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: newCategory
      });
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating category',
        error: error.message
      });
    }
  }
  
  // Get all categories
  async getAllCategories(req, res) {
    try {
      const filters = {};
      if (req.query.is_published !== undefined) {
        filters.is_published = req.query.is_published === 'true';
      }

      const categories = await categoryService.getAllCategories(filters);

      res.status(200).json({
        success: true,
        message: 'Categories retrieved successfully',
        data: categories,
        count: categories.length
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching categories',
        error: error.message
      });
    }
  }
  
  // Get category by ID
  async getCategoryById(req, res) {
    try {
      const { id } = req.params;
      const category = await categoryService.getCategoryById(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Public route sets this so unpublished categories 404 like they don't exist
      if (req.query.public_only === 'true' && category.is_published === false) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Category retrieved successfully',
        data: category
      });
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching category',
        error: error.message
      });
    }
  }
  
  // Dynamic "Specifications" filters for this category's product-listing
  // page — see CategoryService#getCategoryFilters.
  async getCategoryFilters(req, res) {
    try {
      const { id } = req.params;
      const category = await categoryService.getCategoryById(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const filters = await categoryService.getCategoryFilters(id, req.query.vendor_id || null);

      res.status(200).json({
        success: true,
        message: 'Category filters retrieved successfully',
        data: filters
      });
    } catch (error) {
      console.error('Error fetching category filters:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching category filters',
        error: error.message
      });
    }
  }

  // Update category
  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const { category_name, hero_tagline, hero_description } = req.body;

      // Get current category to check for existing image
      const currentCategory = await categoryService.getCategoryById(id);
      if (!currentCategory) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const categoryData = {};

      if (category_name !== undefined) {
        // Check if category name is already taken by another category
        const existingCategory = await categoryService.getCategoryByName(category_name);
        if (existingCategory && existingCategory.id !== id) {
          return res.status(409).json({
            success: false,
            message: 'Category name is already taken by another category'
          });
        }
        categoryData.category_name = category_name;
      }

      if (hero_tagline !== undefined) {
        categoryData.hero_tagline = hero_tagline || null;
      }
      if (hero_description !== undefined) {
        categoryData.hero_description = hero_description || null;
      }
      // A plain URL string for image/hero_image (no new file) is passed straight through
      if (req.body.image !== undefined && !req.files?.image?.[0] && !req.file) {
        categoryData.image = req.body.image || null;
      }
      if (req.body.hero_image !== undefined && !req.files?.hero_image?.[0]) {
        categoryData.hero_image = req.body.hero_image || null;
      }

      // Handle image update(s)
      const imageFile = req.files?.image?.[0] || req.file || null;
      const heroImageFile = req.files?.hero_image?.[0] || null;

      try {
        if (imageFile) {
          const newImageUrl = await uploadToS3(imageFile, 'categories');

          if (currentCategory.image) {
            try {
              await deleteFromS3(currentCategory.image);
            } catch (deleteError) {
              console.error('Error deleting old image from S3:', deleteError);
              // Continue even if deletion fails
            }
          }

          categoryData.image = newImageUrl;
        }

        if (heroImageFile) {
          const newHeroImageUrl = await uploadToS3(heroImageFile, 'category-hero');

          if (currentCategory.hero_image) {
            try {
              await deleteFromS3(currentCategory.hero_image);
            } catch (deleteError) {
              console.error('Error deleting old hero image from S3:', deleteError);
              // Continue even if deletion fails
            }
          }

          categoryData.hero_image = newHeroImageUrl;
        }
      } catch (uploadError) {
        console.error('Error uploading image to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to S3',
          error: uploadError.message
        });
      }

      if (Object.keys(categoryData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }
      
      const updatedCategory = await categoryService.updateCategory(id, categoryData);
      
      res.status(200).json({
        success: true,
        message: 'Category updated successfully',
        data: updatedCategory
      });
    } catch (error) {
      console.error('Error updating category:', error);
      
      if (error.message === 'Category not found') {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      if (error.message === 'No fields to update') {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating category',
        error: error.message
      });
    }
  }
  
  // Preview how many currently-published vendors (and their currently-
  // published products) would be unpublished if this category were
  // unpublished (read-only, for a confirmation prompt)
  async getUnpublishImpact(req, res) {
    try {
      const { id } = req.params;
      const category = await categoryService.getCategoryById(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const impact = await categoryService.getUnpublishImpact(id);

      res.status(200).json({
        success: true,
        message: 'Category unpublish impact retrieved successfully',
        data: impact
      });
    } catch (error) {
      console.error('Error fetching category unpublish impact:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching category unpublish impact',
        error: error.message
      });
    }
  }

  // Preview the actual currently-published products that would be
  // unpublished (paginated) if this category were unpublished
  async getUnpublishImpactProducts(req, res) {
    try {
      const { id } = req.params;
      const category = await categoryService.getCategoryById(id);

      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 7;
      const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;

      const { products, hasMore } = await categoryService.getUnpublishImpactProducts(id, { limit, offset });

      res.status(200).json({
        success: true,
        message: 'Category unpublish impact products retrieved successfully',
        data: products,
        has_more: hasMore
      });
    } catch (error) {
      console.error('Error fetching category unpublish impact products:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching category unpublish impact products',
        error: error.message
      });
    }
  }

  // Publish/unpublish a category. Unpublishing cascades to its vendors and,
  // transitively, their products.
  async setPublishStatus(req, res) {
    try {
      const { id } = req.params;
      const { is_published } = req.body;

      if (typeof is_published !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'is_published (boolean) is required'
        });
      }

      const result = await categoryService.setPublished(id, is_published);

      res.status(200).json({
        success: true,
        message: is_published
          ? 'Category published successfully'
          : `Category unpublished successfully (${result.unpublishedVendorCount} vendor(s), ${result.unpublishedProductCount} product(s) unpublished)`,
        data: result
      });
    } catch (error) {
      console.error('Error updating category publish status:', error);

      if (error.message === 'Category not found') {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating category publish status',
        error: error.message
      });
    }
  }

  // Delete category
  async deleteCategory(req, res) {
    try {
      const { id } = req.params;
      const result = await categoryService.deleteCategory(id);
      
      // Delete image(s) from S3 if they exist
      if (result.image) {
        try {
          await deleteFromS3(result.image);
        } catch (deleteError) {
          console.error('Error deleting image from S3:', deleteError);
          // Continue even if deletion fails
        }
      }
      if (result.hero_image) {
        try {
          await deleteFromS3(result.hero_image);
        } catch (deleteError) {
          console.error('Error deleting hero image from S3:', deleteError);
          // Continue even if deletion fails
        }
      }

      res.status(200).json({
        success: true,
        message: result.message,
        data: { id: result.id, category_name: result.category_name }
      });
    } catch (error) {
      console.error('Error deleting category:', error);
      
      if (error.message === 'Category not found') {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting category',
        error: error.message
      });
    }
  }
}

module.exports = new CategoryController();
