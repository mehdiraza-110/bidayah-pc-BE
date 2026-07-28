const categoryService = require('../services/category.service');
const { uploadToS3, deleteFromS3 } = require('../utils/s3.util');

class CategoryController {
  // Create a new category
  async createCategory(req, res) {
    try {
      const { category_name } = req.body;
      let imageUrl = null;
      
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
      
      // Upload image to S3 if provided
      if (req.file) {
        try {
          imageUrl = await uploadToS3(req.file, 'categories');
        } catch (uploadError) {
          console.error('Error uploading image to S3:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to S3',
            error: uploadError.message
          });
        }
      }
      
      const categoryData = { 
        category_name,
        image: imageUrl
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
  
  // Update category
  async updateCategory(req, res) {
    try {
      const { id } = req.params;
      const { category_name } = req.body;
      
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
      
      // Handle image update
      if (req.file) {
        try {
          // Upload new image to S3
          const newImageUrl = await uploadToS3(req.file, 'categories');
          
          // Delete old image from S3 if it exists
          if (currentCategory.image) {
            try {
              await deleteFromS3(currentCategory.image);
            } catch (deleteError) {
              console.error('Error deleting old image from S3:', deleteError);
              // Continue even if deletion fails
            }
          }
          
          categoryData.image = newImageUrl;
        } catch (uploadError) {
          console.error('Error uploading image to S3:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading image to S3',
            error: uploadError.message
          });
        }
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
      
      // Delete image from S3 if it exists
      if (result.image) {
        try {
          await deleteFromS3(result.image);
        } catch (deleteError) {
          console.error('Error deleting image from S3:', deleteError);
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
