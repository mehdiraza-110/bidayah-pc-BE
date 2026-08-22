const blogService = require('../services/blog.service');
const { uploadToS3, deleteFromS3 } = require('../utils/s3.util');

class BlogController {
  // Create a new blog post
  async createBlog(req, res) {
    try {
      const {
        title, category, excerpt, content, status,
        seo_title, seo_description, seo_keywords,
      } = req.body;

      if (!title || !content) {
        return res.status(400).json({
          success: false,
          message: 'Title and content are required',
        });
      }

      let featuredImageUrl = req.body.featured_image || null;
      let ogImageUrl = req.body.og_image || null;

      const featuredImageFile = req.files?.featured_image?.[0] || null;
      const ogImageFile = req.files?.og_image?.[0] || null;

      try {
        if (featuredImageFile) {
          featuredImageUrl = await uploadToS3(featuredImageFile, 'blogs');
        }
        if (ogImageFile) {
          ogImageUrl = await uploadToS3(ogImageFile, 'blog-seo');
        }
      } catch (uploadError) {
        console.error('Error uploading blog image to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to S3',
          error: uploadError.message,
        });
      }

      const featured = req.body.featured === true || req.body.featured === 'true';

      const newBlog = await blogService.createBlog({
        title,
        category: category || null,
        excerpt: excerpt || null,
        content,
        featured_image: featuredImageUrl,
        status: status || 'draft',
        featured,
        seo_title: seo_title || null,
        seo_description: seo_description || null,
        seo_keywords: seo_keywords || null,
        og_image: ogImageUrl,
      });

      res.status(201).json({
        success: true,
        message: 'Blog created successfully',
        data: newBlog,
      });
    } catch (error) {
      console.error('Error creating blog:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating blog',
        error: error.message,
      });
    }
  }

  // Get all blogs
  async getAllBlogs(req, res) {
    try {
      const filters = {};
      if (req.query.status !== undefined) {
        filters.status = req.query.status;
      }
      if (req.query.featured !== undefined) {
        filters.featured = req.query.featured === 'true';
      }
      if (req.query.limit !== undefined) {
        filters.limit = parseInt(req.query.limit, 10);
      }

      const blogs = await blogService.getAllBlogs(filters);

      res.status(200).json({
        success: true,
        message: 'Blogs retrieved successfully',
        data: blogs,
        count: blogs.length,
      });
    } catch (error) {
      console.error('Error fetching blogs:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching blogs',
        error: error.message,
      });
    }
  }

  async getBlogById(req, res) {
    try {
      const { id } = req.params;
      const blog = await blogService.getBlogById(id);

      if (!blog) {
        return res.status(404).json({
          success: false,
          message: 'Blog not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Blog retrieved successfully',
        data: blog,
      });
    } catch (error) {
      console.error('Error fetching blog:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching blog',
        error: error.message,
      });
    }
  }

  // Get blog by slug (public storefront URLs)
  async getBlogBySlug(req, res) {
    try {
      const { slug } = req.params;
      const blog = await blogService.getBlogBySlug(slug);

      if (!blog) {
        return res.status(404).json({
          success: false,
          message: 'Blog not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'Blog retrieved successfully',
        data: blog,
      });
    } catch (error) {
      console.error('Error fetching blog by slug:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching blog',
        error: error.message,
      });
    }
  }

  // Update blog
  async updateBlog(req, res) {
    try {
      const { id } = req.params;
      const currentBlog = await blogService.getBlogById(id);

      if (!currentBlog) {
        return res.status(404).json({
          success: false,
          message: 'Blog not found',
        });
      }

      const {
        title, category, excerpt, content, status,
        seo_title, seo_description, seo_keywords,
      } = req.body;

      const blogData = {};

      if (title !== undefined) blogData.title = title;
      if (category !== undefined) blogData.category = category || null;
      if (excerpt !== undefined) blogData.excerpt = excerpt || null;
      if (content !== undefined) blogData.content = content;
      if (status !== undefined) blogData.status = status;
      if (req.body.featured !== undefined) {
        blogData.featured = req.body.featured === true || req.body.featured === 'true';
      }
      if (seo_title !== undefined) blogData.seo_title = seo_title || null;
      if (seo_description !== undefined) blogData.seo_description = seo_description || null;
      if (seo_keywords !== undefined) blogData.seo_keywords = seo_keywords || null;

      // A plain URL string for an image field (no new file) is passed straight through
      if (req.body.featured_image !== undefined && !req.files?.featured_image?.[0]) {
        blogData.featured_image = req.body.featured_image || null;
      }
      if (req.body.og_image !== undefined && !req.files?.og_image?.[0]) {
        blogData.og_image = req.body.og_image || null;
      }

      const featuredImageFile = req.files?.featured_image?.[0] || null;
      const ogImageFile = req.files?.og_image?.[0] || null;

      try {
        if (featuredImageFile) {
          const newUrl = await uploadToS3(featuredImageFile, 'blogs');
          if (currentBlog.featured_image) {
            try { await deleteFromS3(currentBlog.featured_image); } catch (e) { console.error('Error deleting old featured image:', e); }
          }
          blogData.featured_image = newUrl;
        }
        if (ogImageFile) {
          const newUrl = await uploadToS3(ogImageFile, 'blog-seo');
          if (currentBlog.og_image) {
            try { await deleteFromS3(currentBlog.og_image); } catch (e) { console.error('Error deleting old og image:', e); }
          }
          blogData.og_image = newUrl;
        }
      } catch (uploadError) {
        console.error('Error uploading blog image to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to S3',
          error: uploadError.message,
        });
      }

      if (Object.keys(blogData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update',
        });
      }

      const updatedBlog = await blogService.updateBlog(id, blogData);

      res.status(200).json({
        success: true,
        message: 'Blog updated successfully',
        data: updatedBlog,
      });
    } catch (error) {
      console.error('Error updating blog:', error);

      if (error.message === 'Blog not found') {
        return res.status(404).json({ success: false, message: 'Blog not found' });
      }
      if (error.message === 'No fields to update') {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating blog',
        error: error.message,
      });
    }
  }

  // Delete blog
  async deleteBlog(req, res) {
    try {
      const { id } = req.params;
      const result = await blogService.deleteBlog(id);

      if (result.featured_image) {
        try { await deleteFromS3(result.featured_image); } catch (e) { console.error('Error deleting featured image from S3:', e); }
      }
      if (result.og_image) {
        try { await deleteFromS3(result.og_image); } catch (e) { console.error('Error deleting og image from S3:', e); }
      }

      res.status(200).json({
        success: true,
        message: 'Blog deleted successfully',
        data: { id: result.id, title: result.title },
      });
    } catch (error) {
      console.error('Error deleting blog:', error);

      if (error.message === 'Blog not found') {
        return res.status(404).json({ success: false, message: 'Blog not found' });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting blog',
        error: error.message,
      });
    }
  }
}

module.exports = new BlogController();
