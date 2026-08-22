const express = require('express');
const router = express.Router();
const blogController = require('../../controllers/blog.controller');
const { upload } = require('../../config/multer.config');

// A blog post carries its own thumbnail (`featured_image`) and, separately,
// an optional social-share image (`og_image`) for SEO — both optional, both
// uploaded in the same multipart request.
const blogImageUpload = upload.fields([
  { name: 'featured_image', maxCount: 1 },
  { name: 'og_image', maxCount: 1 },
]);

// Create a new blog post (with optional image uploads)
router.post('/', blogImageUpload, blogController.createBlog.bind(blogController));

// Get all blogs
router.get('/', blogController.getAllBlogs.bind(blogController));

// Get blog by ID
router.get('/:id', blogController.getBlogById.bind(blogController));

// Update blog (with optional image uploads)
router.put('/:id', blogImageUpload, blogController.updateBlog.bind(blogController));
router.patch('/:id', blogImageUpload, blogController.updateBlog.bind(blogController));

// Delete blog
router.delete('/:id', blogController.deleteBlog.bind(blogController));

module.exports = router;
