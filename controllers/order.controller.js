const orderService = require('../services/order.service');
const { uploadToS3 } = require('../utils/s3.util');

class OrderController {
  // Create order with bank transfer payment
  async createBankTransferOrder(req, res) {
    try {
      const {
        shipping_first_name,
        shipping_last_name,
        shipping_email,
        shipping_phone,
        shipping_address,
        shipping_city,
        shipping_state,
        shipping_zip_code,
        shipping_country,
        billing_first_name,
        billing_last_name,
        billing_email,
        billing_address,
        billing_city,
        billing_state,
        billing_zip_code,
        billing_country,
        items
      } = req.body;
      
      // Validation
      if (!shipping_first_name || !shipping_last_name || !shipping_email || !shipping_phone ||
          !shipping_address || !shipping_city || !shipping_state || !shipping_zip_code || !shipping_country) {
        return res.status(400).json({
          success: false,
          message: 'All shipping fields are required'
        });
      }
      
      if (!billing_first_name || !billing_last_name || !billing_email ||
          !billing_address || !billing_city || !billing_state || !billing_zip_code || !billing_country) {
        return res.status(400).json({
          success: false,
          message: 'All billing fields are required'
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(shipping_email) || !emailRegex.test(billing_email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
      
      // Validate phone
      if (shipping_phone.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be at least 10 characters'
        });
      }
      
      // Validate payment screenshot
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Payment screenshot is required for bank transfer'
        });
      }
      
      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(422).json({
          success: false,
          message: 'Payment screenshot must be an image file (JPEG, PNG, GIF, or WebP)'
        });
      }
      
      // Validate file size (10MB max)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        return res.status(422).json({
          success: false,
          message: 'Payment screenshot size must be less than 10MB'
        });
      }
      
      // Parse items
      let parsedItems = [];
      if (typeof items === 'string') {
        try {
          parsedItems = JSON.parse(items);
        } catch (e) {
          return res.status(400).json({
            success: false,
            message: 'Invalid items format. Must be valid JSON array'
          });
        }
      } else if (Array.isArray(items)) {
        parsedItems = items;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Items must be an array'
        });
      }
      
      // Validate items
      if (!parsedItems || parsedItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one item is required'
        });
      }
      
      for (const item of parsedItems) {
        if (!item.id || !item.name || !item.price || !item.quantity) {
          return res.status(400).json({
            success: false,
            message: 'Each item must have: id, name, price, and quantity'
          });
        }
        if (parseInt(item.quantity) < 1) {
          return res.status(400).json({
            success: false,
            message: 'Item quantity must be at least 1'
          });
        }
        if (parseFloat(item.price) <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Item price must be greater than 0'
          });
        }
      }
      
      // Upload payment screenshot to S3
      let paymentScreenshotUrl;
      try {
        paymentScreenshotUrl = await uploadToS3(req.file, 'orders/payments');
      } catch (uploadError) {
        console.error('Error uploading payment screenshot to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Error uploading payment screenshot',
          error: uploadError.message
        });
      }
      
      const orderData = {
        shipping_first_name,
        shipping_last_name,
        shipping_email,
        shipping_phone,
        shipping_address,
        shipping_city,
        shipping_state,
        shipping_zip_code,
        shipping_country,
        billing_first_name,
        billing_last_name,
        billing_email,
        billing_address,
        billing_city,
        billing_state,
        billing_zip_code,
        billing_country,
        items: parsedItems,
        payment_screenshot_url: paymentScreenshotUrl
      };
      
      const newOrder = await orderService.createBankTransferOrder(orderData);
      
      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: newOrder
      });
    } catch (error) {
      console.error('Error creating bank transfer order:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating order',
        error: error.message
      });
    }
  }
  
  // Create order with agent payment
  async createAgentOrder(req, res) {
    try {
      const {
        shipping_first_name,
        shipping_last_name,
        shipping_email,
        shipping_phone,
        shipping_address,
        shipping_city,
        shipping_state,
        shipping_zip_code,
        shipping_country,
        billing_first_name,
        billing_last_name,
        billing_email,
        billing_address,
        billing_city,
        billing_state,
        billing_zip_code,
        billing_country,
        items
      } = req.body;
      
      // Validation
      if (!shipping_first_name || !shipping_last_name || !shipping_email || !shipping_phone ||
          !shipping_address || !shipping_city || !shipping_state || !shipping_zip_code || !shipping_country) {
        return res.status(400).json({
          success: false,
          message: 'All shipping fields are required'
        });
      }
      
      if (!billing_first_name || !billing_last_name || !billing_email ||
          !billing_address || !billing_city || !billing_state || !billing_zip_code || !billing_country) {
        return res.status(400).json({
          success: false,
          message: 'All billing fields are required'
        });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(shipping_email) || !emailRegex.test(billing_email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
      
      // Validate phone
      if (shipping_phone.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Phone number must be at least 10 characters'
        });
      }
      
      // Validate items
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one item is required'
        });
      }
      
      for (const item of items) {
        if (!item.id || !item.name || !item.price || !item.quantity) {
          return res.status(400).json({
            success: false,
            message: 'Each item must have: id, name, price, and quantity'
          });
        }
        if (parseInt(item.quantity) < 1) {
          return res.status(400).json({
            success: false,
            message: 'Item quantity must be at least 1'
          });
        }
        if (parseFloat(item.price) <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Item price must be greater than 0'
          });
        }
      }
      
      const orderData = {
        shipping_first_name,
        shipping_last_name,
        shipping_email,
        shipping_phone,
        shipping_address,
        shipping_city,
        shipping_state,
        shipping_zip_code,
        shipping_country,
        billing_first_name,
        billing_last_name,
        billing_email,
        billing_address,
        billing_city,
        billing_state,
        billing_zip_code,
        billing_country,
        items
      };
      
      const newOrder = await orderService.createAgentOrder(orderData);
      
      res.status(201).json({
        success: true,
        message: 'Order created successfully',
        data: newOrder
      });
    } catch (error) {
      console.error('Error creating agent order:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating order',
        error: error.message
      });
    }
  }
  
  // Get all orders (with filters)
  async getAllOrders(req, res) {
    try {
      const filters = {
        status: req.query.status,
        payment_method: req.query.payment_method,
        order_number: req.query.order_number,
        shipping_email: req.query.shipping_email,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        limit: req.query.limit,
        offset: req.query.offset
      };
      
      // Remove undefined filters
      Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);
      
      const orders = await orderService.getAllOrders(filters);
      
      res.status(200).json({
        success: true,
        message: 'Orders retrieved successfully',
        data: orders,
        count: orders.length
      });
    } catch (error) {
      console.error('Error fetching orders:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching orders',
        error: error.message
      });
    }
  }
  
  // Get order by ID
  async getOrderById(req, res) {
    try {
      const { id } = req.params;
      const order = await orderService.getOrderById(id);
      
      if (!order) {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Order retrieved successfully',
        data: order
      });
    } catch (error) {
      console.error('Error fetching order:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching order',
        error: error.message
      });
    }
  }
  
  // Update order status
  async updateOrderStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }
      
      const updatedOrder = await orderService.updateOrderStatus(id, status);
      
      res.status(200).json({
        success: true,
        message: 'Order status updated successfully',
        data: updatedOrder
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      
      if (error.message === 'Order not found') {
        return res.status(404).json({
          success: false,
          message: 'Order not found'
        });
      }
      
      if (error.message.includes('Invalid status')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating order status',
        error: error.message
      });
    }
  }
}

module.exports = new OrderController();
