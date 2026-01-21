const productService = require('../services/product.service');
const { uploadToS3, deleteFromS3 } = require('../utils/s3.util');

class ProductController {
  // Create a new product
  async createProduct(req, res) {
    try {
      const {
        name,
        category_id,
        price,
        original_price,
        description,
        stock,
        vendor_id,
        status,
        featured,
        new_product,
        rating,
        reviews_count,
        specs
      } = req.body;
      
      // Validation
      if (!name || !price) {
        return res.status(400).json({
          success: false,
          message: 'Product name and price are required'
        });
      }
      
      if (!req.files || !req.files.main_image) {
        return res.status(400).json({
          success: false,
          message: 'Main product image is required'
        });
      }
      
      // Upload main product image to S3
      let mainImageUrl;
      try {
        mainImageUrl = await uploadToS3(req.files.main_image[0], 'products');
      } catch (uploadError) {
        console.error('Error uploading main image to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading main image to S3',
          error: uploadError.message
        });
      }
      
      // Upload product media (up to 5 images/videos)
      const media = [];
      if (req.files.media && req.files.media.length > 0) {
        for (let i = 0; i < Math.min(req.files.media.length, 5); i++) {
          try {
            const file = req.files.media[i];
            const mediaUrl = await uploadToS3(file, 'products/media');
            media.push({
              url: mediaUrl,
              type: file.mimetype.startsWith('video/') ? 'video' : 'image',
              display_order: i
            });
          } catch (uploadError) {
            console.error(`Error uploading media ${i} to S3:`, uploadError);
            // Continue with other media files
          }
        }
      }
      
      // Parse specs if provided as string
      let parsedSpecs = [];
      if (specs) {
        if (typeof specs === 'string') {
          try {
            parsedSpecs = JSON.parse(specs);
          } catch (e) {
            parsedSpecs = specs.split(',').map(s => s.trim()).filter(s => s);
          }
        } else if (Array.isArray(specs)) {
          parsedSpecs = specs;
        }
      }
      
      const productData = {
        name,
        category_id: category_id || null,
        price: parseFloat(price),
        original_price: original_price ? parseFloat(original_price) : null,
        image: mainImageUrl,
        description: description || null,
        stock: stock ? parseInt(stock) : 0,
        vendor_id: vendor_id || null,
        status: status || 'published',
        featured: featured === 'true' || featured === true,
        new_product: new_product === 'true' || new_product === true,
        rating: rating ? parseFloat(rating) : 0.00,
        reviews_count: reviews_count ? parseInt(reviews_count) : 0,
        media: media,
        specs: parsedSpecs
      };
      
      const newProduct = await productService.createProduct(productData);
      
      res.status(201).json({
        success: true,
        message: 'Product created successfully',
        data: newProduct
      });
    } catch (error) {
      console.error('Error creating product:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating product',
        error: error.message
      });
    }
  }
  
  // Get all products with optional filters
  async getAllProducts(req, res) {
    try {
      const filters = {
        status: req.query.status,
        category_id: req.query.category_id,
        vendor_id: req.query.vendor_id,
        featured: req.query.featured === 'true' ? true : req.query.featured === 'false' ? false : undefined,
        in_stock: req.query.in_stock === 'true' ? true : req.query.in_stock === 'false' ? false : undefined,
        search: req.query.search
      };
      
      // Remove undefined filters
      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
      
      const products = await productService.getAllProducts(filters);
      
      res.status(200).json({
        success: true,
        message: 'Products retrieved successfully',
        data: products,
        count: products.length
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching products',
        error: error.message
      });
    }
  }
  
  // Get product by ID
  async getProductById(req, res) {
    try {
      const { id } = req.params;
      const product = await productService.getProductById(id);
      
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Product retrieved successfully',
        data: product
      });
    } catch (error) {
      console.error('Error fetching product:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching product',
        error: error.message
      });
    }
  }
  
  // Update product
  async updateProduct(req, res) {
    try {
      const { id } = req.params;
      
      // Get current product to check for existing images
      const currentProduct = await productService.getProductById(id);
      if (!currentProduct) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      const productData = {};
      
      // Handle main image update
      if (req.files && req.files.main_image) {
        try {
          // Upload new main image to S3
          const newImageUrl = await uploadToS3(req.files.main_image[0], 'products');
          
          // Delete old main image from S3 if it exists
          if (currentProduct.image) {
            try {
              await deleteFromS3(currentProduct.image);
            } catch (deleteError) {
              console.error('Error deleting old main image from S3:', deleteError);
            }
          }
          
          productData.image = newImageUrl;
        } catch (uploadError) {
          console.error('Error uploading main image to S3:', uploadError);
          return res.status(500).json({
            success: false,
            message: 'Error uploading main image to S3',
            error: uploadError.message
          });
        }
      }
      
      // Handle product media update
      if (req.files && req.files.media && req.files.media.length > 0) {
        // Delete old media from S3
        if (currentProduct.media && currentProduct.media.length > 0) {
          for (const mediaItem of currentProduct.media) {
            try {
              await deleteFromS3(mediaItem.url);
            } catch (deleteError) {
              console.error('Error deleting old media from S3:', deleteError);
            }
          }
        }
        
        // Upload new media
        const media = [];
        for (let i = 0; i < Math.min(req.files.media.length, 5); i++) {
          try {
            const file = req.files.media[i];
            const mediaUrl = await uploadToS3(file, 'products/media');
            media.push({
              url: mediaUrl,
              type: file.mimetype.startsWith('video/') ? 'video' : 'image',
              display_order: i
            });
          } catch (uploadError) {
            console.error(`Error uploading media ${i} to S3:`, uploadError);
          }
        }
        
        productData.media = media;
      }
      
      // Handle other fields
      const {
        name,
        category_id,
        price,
        original_price,
        description,
        stock,
        vendor_id,
        status,
        featured,
        new_product,
        rating,
        reviews_count,
        specs
      } = req.body;
      
      if (name !== undefined) productData.name = name;
      if (category_id !== undefined) productData.category_id = category_id || null;
      if (price !== undefined) productData.price = parseFloat(price);
      if (original_price !== undefined) productData.original_price = original_price ? parseFloat(original_price) : null;
      if (description !== undefined) productData.description = description || null;
      if (stock !== undefined) productData.stock = parseInt(stock);
      if (vendor_id !== undefined) productData.vendor_id = vendor_id || null;
      if (status !== undefined) productData.status = status;
      if (featured !== undefined) productData.featured = featured === 'true' || featured === true;
      if (new_product !== undefined) productData.new_product = new_product === 'true' || new_product === true;
      if (rating !== undefined) productData.rating = parseFloat(rating);
      if (reviews_count !== undefined) productData.reviews_count = parseInt(reviews_count);
      
      // Handle specs
      if (specs !== undefined) {
        let parsedSpecs = [];
        if (typeof specs === 'string') {
          try {
            parsedSpecs = JSON.parse(specs);
          } catch (e) {
            parsedSpecs = specs.split(',').map(s => s.trim()).filter(s => s);
          }
        } else if (Array.isArray(specs)) {
          parsedSpecs = specs;
        }
        productData.specs = parsedSpecs;
      }
      
      if (Object.keys(productData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update'
        });
      }
      
      const updatedProduct = await productService.updateProduct(id, productData);
      
      res.status(200).json({
        success: true,
        message: 'Product updated successfully',
        data: updatedProduct
      });
    } catch (error) {
      console.error('Error updating product:', error);
      
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
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
        message: 'Error updating product',
        error: error.message
      });
    }
  }
  
  // Delete product
  async deleteProduct(req, res) {
    try {
      const { id } = req.params;
      const result = await productService.deleteProduct(id);
      
      // Delete main image from S3
      if (result.image) {
        try {
          await deleteFromS3(result.image);
        } catch (deleteError) {
          console.error('Error deleting main image from S3:', deleteError);
        }
      }
      
      // Delete media from S3
      if (result.media && result.media.length > 0) {
        for (const mediaItem of result.media) {
          try {
            await deleteFromS3(mediaItem.url);
          } catch (deleteError) {
            console.error('Error deleting media from S3:', deleteError);
          }
        }
      }
      
      res.status(200).json({
        success: true,
        message: result.message,
        data: { id: result.id, name: result.name }
      });
    } catch (error) {
      console.error('Error deleting product:', error);
      
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error deleting product',
        error: error.message
      });
    }
  }
  
  // Toggle featured status
  async toggleFeatured(req, res) {
    try {
      const { id } = req.params;
      const { featured } = req.body;
      
      // Validation
      if (featured === undefined || typeof featured !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'Featured status (boolean) is required'
        });
      }
      
      const updatedProduct = await productService.toggleFeatured(id, featured);
      
      res.status(200).json({
        success: true,
        message: `Product ${featured ? 'marked as featured' : 'unmarked as featured'} successfully`,
        data: updatedProduct
      });
    } catch (error) {
      console.error('Error toggling featured status:', error);
      
      if (error.message === 'Product not found') {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error toggling featured status',
        error: error.message
      });
    }
  }
  
  // Get featured products (for public use)
  async getFeaturedProducts(req, res) {
    try {
      const filters = {
        status: 'published',
        featured: true,
        in_stock: req.query.in_stock === 'true' ? true : req.query.in_stock === 'false' ? false : undefined
      };
      
      // Remove undefined filters
      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
      
      const products = await productService.getAllProducts(filters);
      
      res.status(200).json({
        success: true,
        message: 'Featured products retrieved successfully',
        data: products,
        count: products.length
      });
    } catch (error) {
      console.error('Error fetching featured products:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching featured products',
        error: error.message
      });
    }
  }
}

module.exports = new ProductController();
