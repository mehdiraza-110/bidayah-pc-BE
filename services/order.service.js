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
      const tax = 0; // VAT removed
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
            category, vendor_id, product_image, components, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            newOrder.id,
            item.id,
            item.name,
            parseFloat(item.price),
            parseInt(item.quantity),
            itemSubtotal,
            item.category || null,
            item.vendor_id || null,
            item.image || null,
            item.components ? JSON.stringify(item.components) : null
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
      const tax = 0; // VAT removed
      const total = subtotal + shipping + tax;
      
      // One combined name/email/phone/address is used for both shipping and
      // billing — the `orders` table still has separate shipping_*/billing_*
      // columns (unchanged schema, avoids a live migration), so the same
      // values are mirrored into both, and the city/state/zip/country columns
      // (no longer collected) are stored as empty strings.
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
          orderData.name,
          '',
          orderData.email,
          orderData.phone,
          orderData.address,
          '',
          '',
          '',
          '',
          orderData.name,
          '',
          orderData.email,
          orderData.address,
          '',
          '',
          '',
          '',
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
            category, vendor_id, product_image, components, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            newOrder.id,
            item.id,
            item.name,
            parseFloat(item.price),
            parseInt(item.quantity),
            itemSubtotal,
            item.category || null,
            item.vendor_id || null,
            item.image || null,
            item.components ? JSON.stringify(item.components) : null
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
        image: item.product_image,
        components: item.components || null
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
          image: item.product_image,
          components: item.components || null
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

  // Full admin edit: customer (shipping/billing) info, shipping/tax overrides,
  // and the item list itself (edit price/qty, add, remove) — items are
  // replaced wholesale each save since order_items has no stable id exposed
  // to the client (only product_id, which the client generates and isn't
  // guaranteed unique across edits), so a delete-and-reinsert is simplest and
  // always leaves subtotal/total consistent with what's on screen.
  async updateOrder(orderId, updateData) {
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      const existing = await client.query('SELECT id FROM orders WHERE id = $1', [orderId]);
      if (existing.rows.length === 0) {
        throw new Error('Order not found');
      }

      const { shipping_info, billing_info, items, shipping, tax, total: totalOverride } = updateData;

      if (!Array.isArray(items) || items.length === 0) {
        throw new Error('At least one item is required');
      }

      for (const item of items) {
        if (!item.name || item.price == null || item.quantity == null) {
          throw new Error('Each item must have: name, price, and quantity');
        }
        if (parseInt(item.quantity) < 1) {
          throw new Error('Item quantity must be at least 1');
        }
        if (parseFloat(item.price) <= 0) {
          throw new Error('Item price must be greater than 0');
        }
      }

      const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * parseInt(item.quantity)), 0);
      const shippingCost = shipping != null ? parseFloat(shipping) : 0;
      const taxCost = tax != null ? parseFloat(tax) : 0;
      // Total normally follows subtotal+shipping+tax, but the admin can type
      // a final quoted price directly (e.g. a manual discount) — when sent,
      // that explicit value wins instead of being re-derived from the items.
      const total = totalOverride != null && totalOverride !== ''
        ? parseFloat(totalOverride)
        : subtotal + shippingCost + taxCost;

      if (Number.isNaN(total) || total <= 0) {
        throw new Error('Total must be a positive number');
      }

      const si = shipping_info || {};
      const bi = billing_info || {};

      await client.query(
        `UPDATE orders SET
          shipping_first_name = COALESCE($1, shipping_first_name),
          shipping_last_name = COALESCE($2, shipping_last_name),
          shipping_email = COALESCE($3, shipping_email),
          shipping_phone = COALESCE($4, shipping_phone),
          shipping_address = COALESCE($5, shipping_address),
          shipping_city = COALESCE($6, shipping_city),
          shipping_state = COALESCE($7, shipping_state),
          shipping_zip_code = COALESCE($8, shipping_zip_code),
          shipping_country = COALESCE($9, shipping_country),
          billing_first_name = COALESCE($10, billing_first_name),
          billing_last_name = COALESCE($11, billing_last_name),
          billing_email = COALESCE($12, billing_email),
          billing_address = COALESCE($13, billing_address),
          billing_city = COALESCE($14, billing_city),
          billing_state = COALESCE($15, billing_state),
          billing_zip_code = COALESCE($16, billing_zip_code),
          billing_country = COALESCE($17, billing_country),
          subtotal = $18,
          shipping = $19,
          tax = $20,
          total = $21,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $22`,
        [
          si.first_name ?? null, si.last_name ?? null, si.email ?? null, si.phone ?? null,
          si.address ?? null, si.city ?? null, si.state ?? null, si.zip_code ?? null, si.country ?? null,
          bi.first_name ?? null, bi.last_name ?? null, bi.email ?? null,
          bi.address ?? null, bi.city ?? null, bi.state ?? null, bi.zip_code ?? null, bi.country ?? null,
          subtotal, shippingCost, taxCost, total,
          orderId
        ]
      );

      await client.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);

      for (const item of items) {
        const itemSubtotal = parseFloat(item.price) * parseInt(item.quantity);
        await client.query(
          `INSERT INTO order_items (
            order_id, product_id, product_name, price, quantity, subtotal,
            category, vendor_id, product_image, components, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            orderId,
            item.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            item.name,
            parseFloat(item.price),
            parseInt(item.quantity),
            itemSubtotal,
            item.category || null,
            item.vendor_id || null,
            item.image || null,
            item.components ? JSON.stringify(item.components) : null
          ]
        );
      }

      await client.query('COMMIT');

      return await this.getOrderById(orderId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new OrderService();
