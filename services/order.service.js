const db = require('../config/db.config');

class OrderService {
  // Generate unique order number
  generateOrderNumber() {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `ORD-${year}-${random}`;
  }
  
  // Create order with bank transfer payment
  async createBankTransferOrder(orderData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Generate unique order number
      let orderNumber = this.generateOrderNumber();
      let exists = true;
      let attempts = 0;
      
      // Ensure order number is unique
      while (exists && attempts < 10) {
        const check = await client.query(
          'SELECT id FROM orders WHERE order_number = $1',
          [orderNumber]
        );
        if (check.rows.length === 0) {
          exists = false;
        } else {
          orderNumber = this.generateOrderNumber();
          attempts++;
        }
      }
      
      // Calculate totals
      const subtotal = orderData.items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);
      const shipping = 0; // Shipping is always 0
      const tax = subtotal * 0.05; // VAT is 5% of subtotal
      const total = subtotal + shipping + tax;
      
      // Insert order
      const orderResult = await client.query(
        `INSERT INTO orders (
          order_number, status, payment_method,
          shipping_first_name, shipping_last_name, shipping_email, shipping_phone,
          shipping_address, shipping_city, shipping_state, shipping_zip_code, shipping_country,
          billing_first_name, billing_last_name, billing_email,
          billing_address, billing_city, billing_state, billing_zip_code, billing_country,
          subtotal, shipping, tax, total, payment_screenshot_url,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          orderNumber,
          'pending_payment',
          'bank-transfer',
          orderData.shipping_first_name,
          orderData.shipping_last_name,
          orderData.shipping_email,
          orderData.shipping_phone,
          orderData.shipping_address,
          orderData.shipping_city,
          orderData.shipping_state,
          orderData.shipping_zip_code,
          orderData.shipping_country,
          orderData.billing_first_name,
          orderData.billing_last_name,
          orderData.billing_email,
          orderData.billing_address,
          orderData.billing_city,
          orderData.billing_state,
          orderData.billing_zip_code,
          orderData.billing_country,
          subtotal,
          shipping,
          tax,
          total,
          orderData.payment_screenshot_url || null
        ]
      );
      
      const newOrder = orderResult.rows[0];
      
      // Insert order items
      for (const item of orderData.items) {
        const itemSubtotal = parseFloat(item.price) * parseInt(item.quantity);
        await client.query(
          `INSERT INTO order_items (
            order_id, product_id, product_name, price, quantity, subtotal,
            category, vendor_id, product_image, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            newOrder.id,
            item.id,
            item.name,
            parseFloat(item.price),
            parseInt(item.quantity),
            itemSubtotal,
            item.category || null,
            item.vendor_id || null,
            item.image || null
          ]
        );
      }
      
      await client.query('COMMIT');
      
      // Get order with items
      const orderWithItems = await this.getOrderById(newOrder.id);
      
      return orderWithItems;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Create order with agent payment
  async createAgentOrder(orderData) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Generate unique order number
      let orderNumber = this.generateOrderNumber();
      let exists = true;
      let attempts = 0;
      
      // Ensure order number is unique
      while (exists && attempts < 10) {
        const check = await client.query(
          'SELECT id FROM orders WHERE order_number = $1',
          [orderNumber]
        );
        if (check.rows.length === 0) {
          exists = false;
        } else {
          orderNumber = this.generateOrderNumber();
          attempts++;
        }
      }
      
      // Calculate totals
      const subtotal = orderData.items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);
      const shipping = 0; // Shipping is always 0
      const tax = subtotal * 0.05; // VAT is 5% of subtotal
      const total = subtotal + shipping + tax;
      
      // Insert order
      const orderResult = await client.query(
        `INSERT INTO orders (
          order_number, status, payment_method,
          shipping_first_name, shipping_last_name, shipping_email, shipping_phone,
          shipping_address, shipping_city, shipping_state, shipping_zip_code, shipping_country,
          billing_first_name, billing_last_name, billing_email,
          billing_address, billing_city, billing_state, billing_zip_code, billing_country,
          subtotal, shipping, tax, total,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          orderNumber,
          'agent_review',
          'agent',
          orderData.shipping_first_name,
          orderData.shipping_last_name,
          orderData.shipping_email,
          orderData.shipping_phone,
          orderData.shipping_address,
          orderData.shipping_city,
          orderData.shipping_state,
          orderData.shipping_zip_code,
          orderData.shipping_country,
          orderData.billing_first_name,
          orderData.billing_last_name,
          orderData.billing_email,
          orderData.billing_address,
          orderData.billing_city,
          orderData.billing_state,
          orderData.billing_zip_code,
          orderData.billing_country,
          subtotal,
          shipping,
          tax,
          total
        ]
      );
      
      const newOrder = orderResult.rows[0];
      
      // Insert order items
      for (const item of orderData.items) {
        const itemSubtotal = parseFloat(item.price) * parseInt(item.quantity);
        await client.query(
          `INSERT INTO order_items (
            order_id, product_id, product_name, price, quantity, subtotal,
            category, vendor_id, product_image, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            newOrder.id,
            item.id,
            item.name,
            parseFloat(item.price),
            parseInt(item.quantity),
            itemSubtotal,
            item.category || null,
            item.vendor_id || null,
            item.image || null
          ]
        );
      }
      
      await client.query('COMMIT');
      
      // Get order with items
      const orderWithItems = await this.getOrderById(newOrder.id);
      
      return orderWithItems;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  // Get order by ID with items
  async getOrderById(orderId) {
    const orderResult = await db.query(
      `SELECT * FROM orders WHERE id = $1`,
      [orderId]
    );
    
    if (orderResult.rows.length === 0) {
      return null;
    }
    
    const order = orderResult.rows[0];
    
    // Get order items
    const itemsResult = await db.query(
      `SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
      [orderId]
    );
    
    order.items = itemsResult.rows;
    
    // Format response
    return {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      payment_method: order.payment_method,
      shipping_info: {
        first_name: order.shipping_first_name,
        last_name: order.shipping_last_name,
        email: order.shipping_email,
        phone: order.shipping_phone,
        address: order.shipping_address,
        city: order.shipping_city,
        state: order.shipping_state,
        zip_code: order.shipping_zip_code,
        country: order.shipping_country
      },
      billing_info: {
        first_name: order.billing_first_name,
        last_name: order.billing_last_name,
        email: order.billing_email,
        address: order.billing_address,
        city: order.billing_city,
        state: order.billing_state,
        zip_code: order.billing_zip_code,
        country: order.billing_country
      },
      items: order.items.map(item => ({
        id: item.product_id,
        name: item.product_name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        subtotal: parseFloat(item.subtotal),
        category: item.category,
        vendor_id: item.vendor_id,
        image: item.product_image
      })),
      subtotal: parseFloat(order.subtotal),
      shipping: parseFloat(order.shipping),
      tax: parseFloat(order.tax),
      total: parseFloat(order.total),
      payment_screenshot_url: order.payment_screenshot_url,
      created_at: order.created_at,
      updated_at: order.updated_at
    };
  }
  
  // Get all orders with optional filters
  async getAllOrders(filters = {}) {
    let query = `
      SELECT 
        o.*,
        COUNT(oi.id) as items_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (filters.status) {
      query += ` AND o.status = $${paramCount++}`;
      params.push(filters.status);
    }
    
    if (filters.payment_method) {
      query += ` AND o.payment_method = $${paramCount++}`;
      params.push(filters.payment_method);
    }
    
    if (filters.order_number) {
      query += ` AND o.order_number ILIKE $${paramCount++}`;
      params.push(`%${filters.order_number}%`);
    }
    
    if (filters.shipping_email) {
      query += ` AND o.shipping_email ILIKE $${paramCount++}`;
      params.push(`%${filters.shipping_email}%`);
    }
    
    if (filters.date_from) {
      query += ` AND o.created_at >= $${paramCount++}`;
      params.push(filters.date_from);
    }
    
    if (filters.date_to) {
      query += ` AND o.created_at <= $${paramCount++}`;
      params.push(filters.date_to);
    }
    
    query += ` GROUP BY o.id ORDER BY o.created_at DESC`;
    
    // Add pagination
    if (filters.limit) {
      query += ` LIMIT $${paramCount++}`;
      params.push(parseInt(filters.limit));
    }
    
    if (filters.offset) {
      query += ` OFFSET $${paramCount++}`;
      params.push(parseInt(filters.offset));
    }
    
    const result = await db.query(query, params);
    
    // Get items for each order
    const orders = [];
    for (const order of result.rows) {
      const itemsResult = await db.query(
        `SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
        [order.id]
      );
      
      orders.push({
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_method: order.payment_method,
        shipping_info: {
          first_name: order.shipping_first_name,
          last_name: order.shipping_last_name,
          email: order.shipping_email,
          phone: order.shipping_phone,
          address: order.shipping_address,
          city: order.shipping_city,
          state: order.shipping_state,
          zip_code: order.shipping_zip_code,
          country: order.shipping_country
        },
        billing_info: {
          first_name: order.billing_first_name,
          last_name: order.billing_last_name,
          email: order.billing_email,
          address: order.billing_address,
          city: order.billing_city,
          state: order.billing_state,
          zip_code: order.billing_zip_code,
          country: order.billing_country
        },
        items: itemsResult.rows.map(item => ({
          id: item.product_id,
          name: item.product_name,
          price: parseFloat(item.price),
          quantity: item.quantity,
          subtotal: parseFloat(item.subtotal),
          category: item.category,
          vendor_id: item.vendor_id,
          image: item.product_image
        })),
        items_count: parseInt(order.items_count),
        subtotal: parseFloat(order.subtotal),
        shipping: parseFloat(order.shipping),
        tax: parseFloat(order.tax),
        total: parseFloat(order.total),
        payment_screenshot_url: order.payment_screenshot_url,
        created_at: order.created_at,
        updated_at: order.updated_at
      });
    }
    
    return orders;
  }
  
  // Update order status
  async updateOrderStatus(orderId, status) {
    // Validate status
    const validStatuses = ['pending', 'pending_payment', 'agent_review', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }
    
    const result = await db.query(
      `UPDATE orders 
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [status, orderId]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Order not found');
    }
    
    // Get updated order with items
    const updatedOrder = await this.getOrderById(orderId);
    
    return updatedOrder;
  }
}

module.exports = new OrderService();
