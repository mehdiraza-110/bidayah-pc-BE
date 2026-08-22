const db = require('../config/db.config');
const { generateUniqueSlug } = require('../utils/slug.util');

const BLOG_COLUMNS = `
  id, title, slug, category, excerpt, content, featured_image, status, featured,
  seo_title, seo_description, seo_keywords, og_image, published_at, created_at, updated_at
`;

class BlogService {
  // Create a new blog post
  async createBlog(blogData) {
    const slug = await generateUniqueSlug(blogData.title, 'blogs');
    const status = blogData.status || 'draft';

    const result = await db.query(
      `INSERT INTO blogs (
        title, slug, category, excerpt, content, featured_image, status, featured,
        seo_title, seo_description, seo_keywords, og_image, published_at,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING ${BLOG_COLUMNS}`,
      [
        blogData.title,
        slug,
        blogData.category || null,
        blogData.excerpt || null,
        blogData.content,
        blogData.featured_image || null,
        status,
        blogData.featured || false,
        blogData.seo_title || null,
        blogData.seo_description || null,
        blogData.seo_keywords || null,
        blogData.og_image || null,
        status === 'published' ? new Date() : null,
      ]
    );

    return result.rows[0];
  }

  // Get all blogs. Pass { status: 'published' } / { featured: true } (set by
  // the public route middleware) to filter what the storefront can see;
  // admin calls this with no filter so it sees everything.
  async getAllBlogs(filters = {}) {
    let query = `SELECT ${BLOG_COLUMNS} FROM blogs`;
    const conditions = [];
    const params = [];

    if (filters.status !== undefined) {
      params.push(filters.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filters.featured !== undefined) {
      params.push(filters.featured);
      conditions.push(`featured = $${params.length}`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY COALESCE(published_at, created_at) DESC`;

    if (filters.limit) {
      params.push(filters.limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  async getBlogById(blogId) {
    const result = await db.query(
      `SELECT ${BLOG_COLUMNS} FROM blogs WHERE id = $1`,
      [blogId]
    );

    return result.rows[0] || null;
  }

  async getBlogBySlug(slug) {
    const result = await db.query(
      `SELECT ${BLOG_COLUMNS} FROM blogs WHERE slug = $1`,
      [slug]
    );

    return result.rows[0] || null;
  }

  async isPubliclyVisibleBySlug(slug) {
    const result = await db.query('SELECT status FROM blogs WHERE slug = $1', [slug]);
    return result.rows.length > 0 && result.rows[0].status === 'published';
  }

  // Update blog
  async updateBlog(blogId, blogData) {
    // Renaming a post regenerates its slug (unless the caller explicitly set
    // one) so the URL stays readable — old links to the previous slug simply
    // 404 like any renamed page would; nothing else depends on it.
    if (blogData.title !== undefined && blogData.slug === undefined) {
      blogData.slug = await generateUniqueSlug(blogData.title, 'blogs', { excludeId: blogId });
    }

    // Publishing for the first time stamps published_at; nothing else touches it.
    if (blogData.status === 'published') {
      const current = await this.getBlogById(blogId);
      if (current && !current.published_at) {
        blogData.published_at = new Date();
      }
    }

    const updateFields = [];
    const values = [];
    let paramCount = 1;

    const allowedFields = [
      'title', 'slug', 'category', 'excerpt', 'content', 'featured_image', 'status', 'featured',
      'seo_title', 'seo_description', 'seo_keywords', 'og_image', 'published_at',
    ];

    allowedFields.forEach((field) => {
      if (blogData[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount++}`);
        values.push(blogData[field]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(blogId);

    const result = await db.query(
      `UPDATE blogs SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING ${BLOG_COLUMNS}`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Blog not found');
    }

    return result.rows[0];
  }

  async deleteBlog(blogId) {
    const result = await db.query(
      `DELETE FROM blogs WHERE id = $1 RETURNING id, title, featured_image, og_image`,
      [blogId]
    );

    if (result.rows.length === 0) {
      throw new Error('Blog not found');
    }

    return result.rows[0];
  }
}

module.exports = new BlogService();
