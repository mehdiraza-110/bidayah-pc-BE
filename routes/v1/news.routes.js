const express = require('express');
const router = express.Router();
const newsController = require('../../controllers/news.controller');
const { upload } = require('../../config/multer.config');

// A news post carries its own thumbnail (`featured_image`) and, separately,
// an optional social-share image (`og_image`) for SEO — both optional, both
// uploaded in the same multipart request.
const newsImageUpload = upload.fields([
  { name: 'featured_image', maxCount: 1 },
  { name: 'og_image', maxCount: 1 },
]);

// Create a new news post (with optional image uploads)
router.post('/', newsImageUpload, newsController.createNews.bind(newsController));

// Get all news posts
router.get('/', newsController.getAllNews.bind(newsController));

// Get news post by ID
router.get('/:id', newsController.getNewsById.bind(newsController));

// Update news post (with optional image uploads)
router.put('/:id', newsImageUpload, newsController.updateNews.bind(newsController));
router.patch('/:id', newsImageUpload, newsController.updateNews.bind(newsController));

// Delete news post
router.delete('/:id', newsController.deleteNews.bind(newsController));

module.exports = router;
