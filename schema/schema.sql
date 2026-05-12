CREATE TABLE users (
	id SERIAL PRIMARY KEY,
	first_name VARCHAR(300),
	last_name VARCHAR(300),
	email VARCHAR(350) NOT NULL,
	phone VARCHAR(350) NOT NULL,
	password_hash VARCHAR(500) NOT NULL,
	profile_image VARCHAR(500),
	is_verified boolean,
	is_admin_user BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP,
	updated_at TIMESTAMP,
	is_deleted boolean
);


-- Roles table
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL
);

-- Role assignments
CREATE TABLE user_roles (
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Routes (permissions)
CREATE TABLE routes (
  id SERIAL PRIMARY KEY,
  route VARCHAR(255) UNIQUE NOT NULL
);

-- Role permissions (which roles can access which routes)
CREATE TABLE role_permissions (
  role_id INT REFERENCES roles(id) ON DELETE CASCADE,
  route_id INT REFERENCES routes(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, route_id)
);

INSERT INTO roles (name) VALUES ('admin');
INSERT INTO roles (name) VALUES ('agent');
INSERT INTO roles (name) VALUES ('commoner');



CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_name ON vendors(vendor_name);
CREATE INDEX idx_created_at ON vendors(created_at);


CREATE TABLE categories (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name VARCHAR(255) NOT NULL UNIQUE,
   image TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_created_at ON categories(created_at);


-- ============================================
-- PRODUCTS TABLE
-- ============================================

CREATE TYPE product_status AS ENUM ('published', 'draft');

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category_id UUID NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    original_price DECIMAL(10, 2) NULL CHECK (original_price >= 0),
    image VARCHAR(500) NOT NULL,
    description TEXT NULL,
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    in_stock BOOLEAN GENERATED ALWAYS AS (stock > 0) STORED,
    status product_status NOT NULL DEFAULT 'published',
    featured BOOLEAN DEFAULT FALSE,
    new_product BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3, 2) DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
    reviews_count INTEGER DEFAULT 0 CHECK (reviews_count >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_products_in_stock ON products(in_stock);
CREATE INDEX idx_products_created_at ON products(created_at);
CREATE INDEX idx_products_name ON products(name);


-- ============================================
-- PRODUCT VENDORS TABLE (many-to-many)
-- ============================================

CREATE TABLE product_vendors (
    product_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    PRIMARY KEY (product_id, vendor_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_vendors_product_id ON product_vendors(product_id);
CREATE INDEX idx_product_vendors_vendor_id ON product_vendors(vendor_id);


-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- PRODUCT MEDIA TABLE (for up to 5 media items per product)
-- ============================================

CREATE TYPE media_type AS ENUM ('image', 'video');

CREATE TABLE product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    url VARCHAR(500) NOT NULL,
    type media_type NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0 AND display_order < 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    
    CONSTRAINT unique_product_order UNIQUE (product_id, display_order)
);

CREATE INDEX idx_product_media_product_id ON product_media(product_id);
CREATE INDEX idx_product_media_display_order ON product_media(display_order);


-- ============================================
-- PRODUCT SPECS TABLE (for product specifications array)
-- ============================================

CREATE TABLE product_specs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    spec_text VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_product_specs_product_id ON product_specs(product_id);
CREATE INDEX idx_product_specs_display_order ON product_specs(display_order);


-- ============================================
-- CATEGORY KEY FEATURES TABLE
-- Reusable filter keys available for a category
-- ============================================

CREATE TABLE category_key_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL,
    feature_key VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    CONSTRAINT unique_category_feature_key UNIQUE (category_id, feature_key)
);

CREATE INDEX idx_category_key_features_category_id ON category_key_features(category_id);
CREATE INDEX idx_category_key_features_is_active ON category_key_features(is_active);
CREATE INDEX idx_category_key_features_display_order ON category_key_features(display_order);

CREATE TRIGGER update_category_key_features_updated_at BEFORE UPDATE ON category_key_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- PRODUCT KEY FEATURES TABLE
-- Product-specific values for reusable category keys
-- ============================================

CREATE TABLE product_key_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    category_key_feature_id UUID NOT NULL,
    feature_value VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_key_feature_id) REFERENCES category_key_features(id) ON DELETE CASCADE,
    CONSTRAINT unique_product_key_feature UNIQUE (product_id, category_key_feature_id)
);

CREATE INDEX idx_product_key_features_product_id ON product_key_features(product_id);
CREATE INDEX idx_product_key_features_category_key_feature_id ON product_key_features(category_key_feature_id);
CREATE INDEX idx_product_key_features_feature_value ON product_key_features(feature_value);

CREATE TRIGGER update_product_key_features_updated_at BEFORE UPDATE ON product_key_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- PC BUILDER FILTER RULES TABLE
-- ============================================

CREATE TYPE pc_builder_spec_match_mode AS ENUM ('any', 'all');

CREATE TABLE pc_builder_filter_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    selected_category_id UUID NOT NULL,
    selected_vendor_id UUID NULL,
    result_category_id UUID NOT NULL,
    result_vendor_id UUID NULL,
    spec_match_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    spec_match_mode pc_builder_spec_match_mode NOT NULL DEFAULT 'any',
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (selected_category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (selected_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
    FOREIGN KEY (result_category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (result_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

CREATE INDEX idx_pc_builder_rules_selected_category_id ON pc_builder_filter_rules(selected_category_id);
CREATE INDEX idx_pc_builder_rules_selected_vendor_id ON pc_builder_filter_rules(selected_vendor_id);
CREATE INDEX idx_pc_builder_rules_result_category_id ON pc_builder_filter_rules(result_category_id);
CREATE INDEX idx_pc_builder_rules_result_vendor_id ON pc_builder_filter_rules(result_vendor_id);
CREATE INDEX idx_pc_builder_rules_is_active ON pc_builder_filter_rules(is_active);
CREATE INDEX idx_pc_builder_rules_priority ON pc_builder_filter_rules(priority);

CREATE TRIGGER update_pc_builder_filter_rules_updated_at BEFORE UPDATE ON pc_builder_filter_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- BILLING INFORMATION TABLE (Admin Banking Info)
-- ============================================

CREATE TYPE account_type_enum AS ENUM ('checking', 'savings', 'current', 'business');
CREATE TYPE currency_enum AS ENUM ('AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR');

CREATE TABLE billing_information (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_account_name VARCHAR(255) NOT NULL,
    bank_account_number VARCHAR(100) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    bank_branch VARCHAR(255),
    bank_address TEXT,
    account_type account_type_enum NOT NULL,
    currency currency_enum NOT NULL,
    beneficiary_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(350) NOT NULL,
    contact_phone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- ORDERS TABLE
-- ============================================

CREATE TYPE order_status AS ENUM ('pending', 'pending_payment', 'agent_review', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE payment_method_enum AS ENUM ('bank-transfer', 'agent');

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    payment_method payment_method_enum NOT NULL,
    
    -- Shipping Information
    shipping_first_name VARCHAR(255) NOT NULL,
    shipping_last_name VARCHAR(255) NOT NULL,
    shipping_email VARCHAR(350) NOT NULL,
    shipping_phone VARCHAR(50) NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city VARCHAR(255) NOT NULL,
    shipping_state VARCHAR(255) NOT NULL,
    shipping_zip_code VARCHAR(20) NOT NULL,
    shipping_country VARCHAR(255) NOT NULL,
    
    -- Billing Information
    billing_first_name VARCHAR(255) NOT NULL,
    billing_last_name VARCHAR(255) NOT NULL,
    billing_email VARCHAR(350) NOT NULL,
    billing_address TEXT NOT NULL,
    billing_city VARCHAR(255) NOT NULL,
    billing_state VARCHAR(255) NOT NULL,
    billing_zip_code VARCHAR(20) NOT NULL,
    billing_country VARCHAR(255) NOT NULL,
    
    -- Order Totals
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    shipping DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tax DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL DEFAULT 0,
    
    -- Payment Screenshot (for bank-transfer)
    payment_screenshot_url VARCHAR(500),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_method ON orders(payment_method);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_shipping_email ON orders(shipping_email);


-- ============================================
-- ORDER ITEMS TABLE
-- ============================================

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal DECIMAL(10, 2) NOT NULL,
    category VARCHAR(255),
    vendor_id VARCHAR(255),
    product_image VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);


-- ============================================
-- HERO MEDIA TABLE (Homepage Hero Section)
-- ============================================

CREATE TYPE hero_media_type AS ENUM ('image', 'video');

CREATE TABLE hero_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url VARCHAR(500) NOT NULL,
    type hero_media_type NOT NULL,
    display_index INTEGER NOT NULL CHECK (display_index >= 0 AND display_index <= 6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_hero_index UNIQUE (display_index)
);

CREATE INDEX idx_hero_media_display_index ON hero_media(display_index);
CREATE INDEX idx_hero_media_type ON hero_media(type);


-- ============================================
-- MIGRATION: products vendor_id -> product_vendors
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- ALTER TABLE products DROP CONSTRAINT IF EXISTS products_vendor_id_fkey;
-- ALTER TABLE products DROP COLUMN IF EXISTS vendor_id;
-- CREATE TABLE IF NOT EXISTS product_vendors (
--     product_id UUID NOT NULL,
--     vendor_id  UUID NOT NULL,
--     PRIMARY KEY (product_id, vendor_id),
--     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
--     FOREIGN KEY (vendor_id)  REFERENCES vendors(id)  ON DELETE CASCADE
-- );
-- CREATE INDEX IF NOT EXISTS idx_product_vendors_product_id ON product_vendors(product_id);
-- CREATE INDEX IF NOT EXISTS idx_product_vendors_vendor_id  ON product_vendors(vendor_id);


-- ============================================
-- MIGRATION: add PC builder filter rules
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- CREATE TYPE pc_builder_spec_match_mode AS ENUM ('any', 'all');
-- CREATE TABLE IF NOT EXISTS pc_builder_filter_rules (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     rule_name VARCHAR(255) NOT NULL,
--     selected_category_id UUID NOT NULL,
--     selected_vendor_id UUID NULL,
--     result_category_id UUID NOT NULL,
--     result_vendor_id UUID NULL,
--     spec_match_terms TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
--     spec_match_mode pc_builder_spec_match_mode NOT NULL DEFAULT 'any',
--     priority INTEGER NOT NULL DEFAULT 0,
--     is_active BOOLEAN NOT NULL DEFAULT TRUE,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (selected_category_id) REFERENCES categories(id) ON DELETE CASCADE,
--     FOREIGN KEY (selected_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL,
--     FOREIGN KEY (result_category_id) REFERENCES categories(id) ON DELETE CASCADE,
--     FOREIGN KEY (result_vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
-- );
-- CREATE INDEX IF NOT EXISTS idx_pc_builder_rules_selected_category_id ON pc_builder_filter_rules(selected_category_id);
-- CREATE INDEX IF NOT EXISTS idx_pc_builder_rules_selected_vendor_id ON pc_builder_filter_rules(selected_vendor_id);
-- CREATE INDEX IF NOT EXISTS idx_pc_builder_rules_result_category_id ON pc_builder_filter_rules(result_category_id);
-- CREATE INDEX IF NOT EXISTS idx_pc_builder_rules_result_vendor_id ON pc_builder_filter_rules(result_vendor_id);
-- CREATE INDEX IF NOT EXISTS idx_pc_builder_rules_is_active ON pc_builder_filter_rules(is_active);
-- CREATE INDEX IF NOT EXISTS idx_pc_builder_rules_priority ON pc_builder_filter_rules(priority);
-- CREATE TRIGGER update_pc_builder_filter_rules_updated_at BEFORE UPDATE ON pc_builder_filter_rules
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- MIGRATION: add category/product key features
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- CREATE TABLE IF NOT EXISTS category_key_features (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     category_id UUID NOT NULL,
--     feature_key VARCHAR(255) NOT NULL,
--     display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
--     is_active BOOLEAN NOT NULL DEFAULT TRUE,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
--     CONSTRAINT unique_category_feature_key UNIQUE (category_id, feature_key)
-- );
-- CREATE INDEX IF NOT EXISTS idx_category_key_features_category_id ON category_key_features(category_id);
-- CREATE INDEX IF NOT EXISTS idx_category_key_features_is_active ON category_key_features(is_active);
-- CREATE INDEX IF NOT EXISTS idx_category_key_features_display_order ON category_key_features(display_order);
-- CREATE TRIGGER update_category_key_features_updated_at BEFORE UPDATE ON category_key_features
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--
-- CREATE TABLE IF NOT EXISTS product_key_features (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     product_id UUID NOT NULL,
--     category_key_feature_id UUID NOT NULL,
--     feature_value VARCHAR(255) NOT NULL,
--     display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
--     FOREIGN KEY (category_key_feature_id) REFERENCES category_key_features(id) ON DELETE CASCADE,
--     CONSTRAINT unique_product_key_feature UNIQUE (product_id, category_key_feature_id)
-- );
-- CREATE INDEX IF NOT EXISTS idx_product_key_features_product_id ON product_key_features(product_id);
-- CREATE INDEX IF NOT EXISTS idx_product_key_features_category_key_feature_id ON product_key_features(category_key_feature_id);
-- CREATE INDEX IF NOT EXISTS idx_product_key_features_feature_value ON product_key_features(feature_value);
-- CREATE TRIGGER update_product_key_features_updated_at BEFORE UPDATE ON product_key_features
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
