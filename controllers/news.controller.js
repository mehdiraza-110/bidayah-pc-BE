const newsService = require('../services/news.service');
const { uploadToS3, deleteFromS3 } = require('../utils/s3.util');

class NewsController {
  // Create a new news post
  async createNews(req, res) {
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
          featuredImageUrl = await uploadToS3(featuredImageFile, 'news');
        }
        if (ogImageFile) {
          ogImageUrl = await uploadToS3(ogImageFile, 'news-seo');
        }
      } catch (uploadError) {
        console.error('Error uploading news image to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to S3',
          error: uploadError.message,
        });
      }

      const featured = req.body.featured === true || req.body.featured === 'true';

      const newNews = await newsService.createNews({
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
        message: 'News post created successfully',
        data: newNews,
      });
    } catch (error) {
      console.error('Error creating news post:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating news post',
        error: error.message,
      });
    }
  }

  // Get all news posts
  async getAllNews(req, res) {
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

      const news = await newsService.getAllNews(filters);

      res.status(200).json({
        success: true,
        message: 'News posts retrieved successfully',
        data: news,
        count: news.length,
      });
    } catch (error) {
      console.error('Error fetching news posts:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching news posts',
        error: error.message,
      });
    }
  }

  async getNewsById(req, res) {
    try {
      const { id } = req.params;
      const newsPost = await newsService.getNewsById(id);

      if (!newsPost) {
        return res.status(404).json({
          success: false,
          message: 'News post not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'News post retrieved successfully',
        data: newsPost,
      });
    } catch (error) {
      console.error('Error fetching news post:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching news post',
        error: error.message,
      });
    }
  }

  // Get news post by slug (public storefront URLs)
  async getNewsBySlug(req, res) {
    try {
      const { slug } = req.params;
      const newsPost = await newsService.getNewsBySlug(slug);

      if (!newsPost) {
        return res.status(404).json({
          success: false,
          message: 'News post not found',
        });
      }

      res.status(200).json({
        success: true,
        message: 'News post retrieved successfully',
        data: newsPost,
      });
    } catch (error) {
      console.error('Error fetching news post by slug:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching news post',
        error: error.message,
      });
    }
  }

  // Update news post
  async updateNews(req, res) {
    try {
      const { id } = req.params;
      const currentNews = await newsService.getNewsById(id);

      if (!currentNews) {
        return res.status(404).json({
          success: false,
          message: 'News post not found',
        });
      }

      const {
        title, category, excerpt, content, status,
        seo_title, seo_description, seo_keywords,
      } = req.body;

      const newsData = {};

      if (title !== undefined) newsData.title = title;
      if (category !== undefined) newsData.category = category || null;
      if (excerpt !== undefined) newsData.excerpt = excerpt || null;
      if (content !== undefined) newsData.content = content;
      if (status !== undefined) newsData.status = status;
      if (req.body.featured !== undefined) {
        newsData.featured = req.body.featured === true || req.body.featured === 'true';
      }
      if (seo_title !== undefined) newsData.seo_title = seo_title || null;
      if (seo_description !== undefined) newsData.seo_description = seo_description || null;
      if (seo_keywords !== undefined) newsData.seo_keywords = seo_keywords || null;

      // A plain URL string for an image field (no new file) is passed straight through
      if (req.body.featured_image !== undefined && !req.files?.featured_image?.[0]) {
        newsData.featured_image = req.body.featured_image || null;
      }
      if (req.body.og_image !== undefined && !req.files?.og_image?.[0]) {
        newsData.og_image = req.body.og_image || null;
      }

      const featuredImageFile = req.files?.featured_image?.[0] || null;
      const ogImageFile = req.files?.og_image?.[0] || null;

      try {
        if (featuredImageFile) {
          const newUrl = await uploadToS3(featuredImageFile, 'news');
          if (currentNews.featured_image) {
            try { await deleteFromS3(currentNews.featured_image); } catch (e) { console.error('Error deleting old featured image:', e); }
          }
          newsData.featured_image = newUrl;
        }
        if (ogImageFile) {
          const newUrl = await uploadToS3(ogImageFile, 'news-seo');
          if (currentNews.og_image) {
            try { await deleteFromS3(currentNews.og_image); } catch (e) { console.error('Error deleting old og image:', e); }
          }
          newsData.og_image = newUrl;
        }
      } catch (uploadError) {
        console.error('Error uploading news image to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading image to S3',
          error: uploadError.message,
        });
      }

      if (Object.keys(newsData).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields to update',
        });
      }

      const updatedNews = await newsService.updateNews(id, newsData);

      res.status(200).json({
        success: true,
        message: 'News post updated successfully',
        data: updatedNews,
      });
    } catch (error) {
      console.error('Error updating news post:', error);

      if (error.message === 'News post not found') {
        return res.status(404).json({ success: false, message: 'News post not found' });
      }
      if (error.message === 'No fields to update') {
        return res.status(400).json({ success: false, message: 'No fields to update' });
      }

      res.status(500).json({
        success: false,
        message: 'Error updating news post',
        error: error.message,
      });
    }
  }

  // Delete news post
  async deleteNews(req, res) {
    try {
      const { id } = req.params;
      const result = await newsService.deleteNews(id);

      if (result.featured_image) {
        try { await deleteFromS3(result.featured_image); } catch (e) { console.error('Error deleting featured image from S3:', e); }
      }
      if (result.og_image) {
        try { await deleteFromS3(result.og_image); } catch (e) { console.error('Error deleting og image from S3:', e); }
      }

      res.status(200).json({
        success: true,
        message: 'News post deleted successfully',
        data: { id: result.id, title: result.title },
      });
    } catch (error) {
      console.error('Error deleting news post:', error);

      if (error.message === 'News post not found') {
        return res.status(404).json({ success: false, message: 'News post not found' });
      }

      res.status(500).json({
        success: false,
        message: 'Error deleting news post',
        error: error.message,
      });
    }
  }
}

module.exports = new NewsController();
