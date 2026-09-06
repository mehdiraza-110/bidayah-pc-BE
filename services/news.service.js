const db = require('../config/db.config');
const { generateUniqueSlug } = require('../utils/slug.util');

const NEWS_COLUMNS = `
  id, title, slug, category, excerpt, content, featured_image, status, featured,
  seo_title, seo_description, seo_keywords, og_image, published_at, created_at, updated_at
`;

class NewsService {
  // Create a new news post
  async createNews(newsData) {
    const slug = await generateUniqueSlug(newsData.title, 'news');
    const status = newsData.status || 'draft';

    const result = await db.query(
      `INSERT INTO news (
        title, slug, category, excerpt, content, featured_image, status, featured,
        seo_title, seo_description, seo_keywords, og_image, published_at,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING ${NEWS_COLUMNS}`,
      [
        newsData.title,
        slug,
        newsData.category || null,
        newsData.excerpt || null,
        newsData.content,
        newsData.featured_image || null,
        status,
        newsData.featured || false,
        newsData.seo_title || null,
        newsData.seo_description || null,
        newsData.seo_keywords || null,
        newsData.og_image || null,
        status === 'published' ? new Date() : null,
      ]
    );

    return result.rows[0];
  }

  // Get all news posts. Pass { status: 'published' } / { featured: true } (set
  // by the public route middleware) to filter what the storefront can see;
  // admin calls this with no filter so it sees everything.
  async getAllNews(filters = {}) {
    let query = `SELECT ${NEWS_COLUMNS} FROM news`;
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

  async getNewsById(newsId) {
    const result = await db.query(
      `SELECT ${NEWS_COLUMNS} FROM news WHERE id = $1`,
      [newsId]
    );

    return result.rows[0] || null;
  }

  async getNewsBySlug(slug) {
    const result = await db.query(
      `SELECT ${NEWS_COLUMNS} FROM news WHERE slug = $1`,
      [slug]
    );

    return result.rows[0] || null;
  }

  async isPubliclyVisibleBySlug(slug) {
    const result = await db.query('SELECT status FROM news WHERE slug = $1', [slug]);
    return result.rows.length > 0 && result.rows[0].status === 'published';
  }

  // Update news post
  async updateNews(newsId, newsData) {
    // Renaming a post regenerates its slug (unless the caller explicitly set
    // one) so the URL stays readable — old links to the previous slug simply
    // 404 like any renamed page would; nothing else depends on it.
    if (newsData.title !== undefined && newsData.slug === undefined) {
      newsData.slug = await generateUniqueSlug(newsData.title, 'news', { excludeId: newsId });
    }

    // Publishing for the first time stamps published_at; nothing else touches it.
    if (newsData.status === 'published') {
      const current = await this.getNewsById(newsId);
      if (current && !current.published_at) {
        newsData.published_at = new Date();
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
      if (newsData[field] !== undefined) {
        updateFields.push(`${field} = $${paramCount++}`);
        values.push(newsData[field]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(newsId);

    const result = await db.query(
      `UPDATE news SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING ${NEWS_COLUMNS}`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('News post not found');
    }

    return result.rows[0];
  }

  async deleteNews(newsId) {
    const result = await db.query(
      `DELETE FROM news WHERE id = $1 RETURNING id, title, featured_image, og_image`,
      [newsId]
    );

    if (result.rows.length === 0) {
      throw new Error('News post not found');
    }

    return result.rows[0];
  }
}

module.exports = new NewsService();
