const db = require('../config/db.config');

class StatisticsService {
  // Get dashboard statistics
  async getDashboardStats() {
    try {
      // Get total published products
      const productsResult = await db.query(
        `SELECT COUNT(*) as count 
         FROM products 
         WHERE status = 'published'`
      );
      const totalPublishedProducts = parseInt(productsResult.rows[0].count);
      
      // Get total revenue this month (sum of all delivered/confirmed orders)
      const currentMonth = new Date();
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      
      const revenueResult = await db.query(
        `SELECT COALESCE(SUM(total), 0) as total_revenue
         FROM orders
         WHERE created_at >= $1 
         AND created_at <= $2
         AND status IN ('confirmed', 'processing', 'shipped', 'delivered')`,
        [firstDayOfMonth, lastDayOfMonth]
      );
      const totalRevenueThisMonth = parseFloat(revenueResult.rows[0].total_revenue || 0);
      
      // Get total orders this month
      const ordersResult = await db.query(
        `SELECT COUNT(*) as count
         FROM orders
         WHERE created_at >= $1 
         AND created_at <= $2`,
        [firstDayOfMonth, lastDayOfMonth]
      );
      const totalOrdersThisMonth = parseInt(ordersResult.rows[0].count);
      
      return {
        total_published_products: totalPublishedProducts,
        total_revenue_this_month: totalRevenueThisMonth,
        total_orders_this_month: totalOrdersThisMonth,
        month: currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
      };
    } catch (error) {
      throw error;
    }
  }
  
  // Get top products by sales this month
  async getTopProductsBySales(limit = 5) {
    try {
      // Get current month date range
      const currentMonth = new Date();
      const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59);
      
      const result = await db.query(
        `SELECT 
          oi.product_id,
          oi.product_name,
          SUM(oi.quantity) as total_quantity_sold,
          SUM(oi.subtotal) as total_revenue,
          COUNT(DISTINCT oi.order_id) as order_count,
          MAX(oi.product_image) as product_image,
          MAX(oi.category) as category,
          MAX(oi.vendor_id) as vendor_id
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('confirmed', 'processing', 'shipped', 'delivered')
        AND o.created_at >= $1
        AND o.created_at <= $2
        GROUP BY oi.product_id, oi.product_name
        ORDER BY total_quantity_sold DESC
        LIMIT $3`,
        [firstDayOfMonth, lastDayOfMonth, limit]
      );
      
      return result.rows.map(row => ({
        product_id: row.product_id,
        product_name: row.product_name,
        total_quantity_sold: parseInt(row.total_quantity_sold),
        total_revenue: parseFloat(row.total_revenue),
        order_count: parseInt(row.order_count),
        product_image: row.product_image,
        category: row.category,
        vendor_id: row.vendor_id
      }));
    } catch (error) {
      throw error;
    }
  }
  
  // Get monthly sales for the last 12 months with product details
  async getMonthlySales() {
    try {
      // Calculate date range for last 12 months
      const now = new Date();
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1); // Start from 12 months ago
      
      const result = await db.query(
        `SELECT 
          DATE_TRUNC('month', o.created_at) as month,
          oi.product_id,
          oi.product_name,
          SUM(oi.quantity) as sales_count,
          SUM(oi.subtotal) as revenue,
          COUNT(DISTINCT oi.order_id) as order_count,
          MAX(oi.product_image) as product_image,
          MAX(oi.category) as category,
          MAX(oi.vendor_id) as vendor_id
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.status IN ('confirmed', 'processing', 'shipped', 'delivered')
        AND o.created_at >= $1
        GROUP BY DATE_TRUNC('month', o.created_at), oi.product_id, oi.product_name
        ORDER BY month DESC, sales_count DESC`,
        [twelveMonthsAgo]
      );
      
      // Organize data by month
      const monthlyData = {};
      
      result.rows.forEach(row => {
        const monthKey = row.month.toISOString().substring(0, 7); // YYYY-MM format
        const monthName = row.month.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            month_name: monthName,
            products: []
          };
        }
        
        monthlyData[monthKey].products.push({
          product_id: row.product_id,
          product_name: row.product_name,
          sales_count: parseInt(row.sales_count),
          revenue: parseFloat(row.revenue),
          order_count: parseInt(row.order_count),
          product_image: row.product_image,
          category: row.category,
          vendor_id: row.vendor_id
        });
      });
      
      // Generate array for last 12 months (even if no sales)
      const months = [];
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = date.toISOString().substring(0, 7);
        const monthName = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        
        months.push({
          month: monthKey,
          month_name: monthName,
          products: monthlyData[monthKey]?.products || []
        });
      }
      
      return months;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new StatisticsService();
