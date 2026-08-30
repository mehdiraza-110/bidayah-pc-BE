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
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_name ON vendors(vendor_name);
CREATE INDEX idx_created_at ON vendors(created_at);
CREATE INDEX idx_vendors_is_published ON vendors(is_published);


CREATE TABLE categories (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name VARCHAR(255) NOT NULL UNIQUE,
   image TEXT NULL,
    is_published BOOLEAN NOT NULL DEFAULT true,
    hero_image TEXT NULL,
    hero_tagline VARCHAR(255) NULL,
    hero_description TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_created_at ON categories(created_at);
CREATE INDEX idx_categories_is_published ON categories(is_published);


-- ============================================
-- PRODUCTS TABLE
-- ============================================

CREATE TYPE product_status AS ENUM ('published', 'draft');

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NULL UNIQUE,
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
CREATE INDEX idx_products_slug ON products(slug);


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
-- BLOGS TABLE
-- Admin-authored blog posts. `category` is a free-text tag (not tied to the
-- product categories taxonomy). SEO fields are fully admin-editable so a
-- post's title/description/keywords/social image can differ from its own
-- title/excerpt/featured_image where needed.
-- ============================================

CREATE TYPE blog_status AS ENUM ('published', 'draft');

CREATE TABLE blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NULL UNIQUE,
    category VARCHAR(255) NULL,
    excerpt TEXT NULL,
    content TEXT NOT NULL,
    featured_image TEXT NULL,
    status blog_status NOT NULL DEFAULT 'draft',
    featured BOOLEAN NOT NULL DEFAULT FALSE,

    -- SEO
    seo_title VARCHAR(255) NULL,
    seo_description VARCHAR(500) NULL,
    seo_keywords VARCHAR(500) NULL,
    og_image TEXT NULL,

    published_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_blogs_status ON blogs(status);
CREATE INDEX idx_blogs_featured ON blogs(featured);
CREATE INDEX idx_blogs_slug ON blogs(slug);
CREATE INDEX idx_blogs_created_at ON blogs(created_at);

CREATE TRIGGER update_blogs_updated_at BEFORE UPDATE ON blogs
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
-- PC BUILDER CATEGORIES TABLE
-- Controls which categories appear as steps in the
-- PC Builder wizard, and in what order
-- ============================================

CREATE TABLE pc_builder_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL UNIQUE,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    max_quantity INTEGER NOT NULL DEFAULT 1 CHECK (max_quantity >= 1),
    -- When true (and max_quantity > 1), a customer can add the SAME product to
    -- this step more than once (e.g. 2x of one fan) instead of only being able
    -- to pick that many DIFFERENT products.
    allow_duplicate_products BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX idx_pc_builder_categories_is_active ON pc_builder_categories(is_active);
CREATE INDEX idx_pc_builder_categories_display_order ON pc_builder_categories(display_order);

CREATE TRIGGER update_pc_builder_categories_updated_at BEFORE UPDATE ON pc_builder_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed existing categories so the PC Builder keeps working exactly as it
-- does today until an admin curates the list from the new admin panel.
INSERT INTO pc_builder_categories (category_id, display_order, is_active)
SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1), TRUE
FROM categories
ON CONFLICT (category_id) DO NOTHING;


-- ============================================
-- PC BUILDER CATEGORY VENDORS TABLE
-- Which vendors are valid options for a category's
-- step in the PC Builder (e.g. CPU -> Intel, AMD only).
-- No rows for a category means "no restriction" (all
-- vendors are shown), so this is safe to leave unconfigured.
-- ============================================

CREATE TABLE pc_builder_category_vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL,
    vendor_id UUID NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
    CONSTRAINT unique_pc_builder_category_vendor UNIQUE (category_id, vendor_id)
);

CREATE INDEX idx_pc_builder_category_vendors_category_id ON pc_builder_category_vendors(category_id);
CREATE INDEX idx_pc_builder_category_vendors_vendor_id ON pc_builder_category_vendors(vendor_id);

CREATE TRIGGER update_pc_builder_category_vendors_updated_at BEFORE UPDATE ON pc_builder_category_vendors
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
-- HERO CONTENT TABLE (Homepage Hero Section text/buttons/mode)
-- Singleton table: exactly one row, enforced in the application layer.
-- mode = 'single'    -> use only hero_media at display_index 0, no slideshow controls
-- mode = 'slideshow' -> cycle through every hero_media row with arrows/dots
-- ============================================

CREATE TYPE hero_mode AS ENUM ('single', 'slideshow');

CREATE TABLE hero_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode hero_mode NOT NULL DEFAULT 'single',
    headline_line_1 VARCHAR(255) NOT NULL DEFAULT 'Gaming PCs,',
    headline_line_2 VARCHAR(255) NOT NULL DEFAULT 'Built To Win.',
    subtext TEXT NOT NULL DEFAULT 'Hand-built rigs with real component transparency and a 3-year warranty. Configure your own build or shop ready-to-ship systems today.',
    button_1_text VARCHAR(100) NOT NULL DEFAULT 'Shop Gaming PCs',
    button_1_link VARCHAR(500) NOT NULL DEFAULT '/products',
    button_2_text VARCHAR(100) NOT NULL DEFAULT 'Start Custom Build',
    button_2_link VARCHAR(500) NOT NULL DEFAULT '/pc-builder',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_hero_content_updated_at BEFORE UPDATE ON hero_content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- SITE SETTINGS TABLE
-- Singleton table: exactly one row, enforced in the application layer.
-- ============================================

CREATE TABLE site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    whatsapp_number VARCHAR(32),
    -- How many active Featured Gaming PCs show on the homepage, admin-managed
    -- from the Featured Gaming PCs page alongside the builds themselves.
    featured_gaming_pcs_limit INTEGER NOT NULL DEFAULT 4 CHECK (featured_gaming_pcs_limit >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- STORE LOCATIONS TABLE
-- ============================================

CREATE TABLE store_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_store_location_active ON store_locations(is_active);

CREATE TRIGGER update_store_locations_updated_at BEFORE UPDATE ON store_locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- FEATURED GAMING PCS TABLES
-- Admin-curated builds shown on the homepage before "Shop By Category".
-- Each has its own price (the bundle price, not a sum of parts) and adds to
-- the cart as a single bundle item listing its component products.
-- ============================================

CREATE TABLE featured_gaming_pcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    -- Clean storefront URL (/gaming-pc/<slug>) instead of exposing the raw id —
    -- same convention as products. Regenerated whenever the name changes.
    slug VARCHAR(255) NULL UNIQUE,
    description TEXT NULL,
    price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    key_features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    -- Optional PC Series placement: assigning a series_type_id is what makes
    -- this build show up as a card on that series' landing page (grouped by
    -- tier_name, color-switched by color_name) instead of/in addition to the
    -- plain homepage "Featured Gaming PCs" row. The FK to pc_series_types is
    -- added further down (that table is defined later in this file).
    series_type_id UUID NULL,
    -- Groups color siblings of the "same" build together on the series
    -- landing page (e.g. "PLUS") — leave null for a one-off build with no
    -- color variants.
    tier_name VARCHAR(100) NULL,
    color_name VARCHAR(100) NULL,
    color_swatch_hex VARCHAR(7) NULL,
    -- Manually entered — no automated benchmarking.
    fps_score INTEGER NULL CHECK (fps_score IS NULL OR fps_score >= 0),
    fps_settings_label VARCHAR(100) NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_featured_gaming_pcs_is_active ON featured_gaming_pcs(is_active);
CREATE INDEX idx_featured_gaming_pcs_display_order ON featured_gaming_pcs(display_order);
CREATE INDEX idx_featured_gaming_pcs_slug ON featured_gaming_pcs(slug);
CREATE INDEX idx_featured_gaming_pcs_series_type_id ON featured_gaming_pcs(series_type_id);

CREATE TRIGGER update_featured_gaming_pcs_updated_at BEFORE UPDATE ON featured_gaming_pcs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Up to 5 gallery photos per build (at least 1 required, enforced in the app layer).
CREATE TABLE featured_gaming_pc_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gaming_pc_id UUID NOT NULL,
    url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0 AND display_order < 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (gaming_pc_id) REFERENCES featured_gaming_pcs(id) ON DELETE CASCADE,
    CONSTRAINT unique_gaming_pc_image_order UNIQUE (gaming_pc_id, display_order)
);

CREATE INDEX idx_featured_gaming_pc_images_gaming_pc_id ON featured_gaming_pc_images(gaming_pc_id);

-- Which real products this build is made of — shown to the customer both on
-- the homepage card and inside the cart bundle line item. `quantity` lets the
-- same product appear more than once (e.g. 2x 32GB RAM sticks) instead of
-- only being addable a single time.
CREATE TABLE featured_gaming_pc_products (
    gaming_pc_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),

    PRIMARY KEY (gaming_pc_id, product_id),
    FOREIGN KEY (gaming_pc_id) REFERENCES featured_gaming_pcs(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE INDEX idx_featured_gaming_pc_products_gaming_pc_id ON featured_gaming_pc_products(gaming_pc_id);
CREATE INDEX idx_featured_gaming_pc_products_product_id ON featured_gaming_pc_products(product_id);


-- ============================================
-- PC SERIES (prebuilt PC lines, e.g. "PLAY" / "LUMEN")
-- Hierarchy: pc_series -> pc_series_types -> pc_series_variants -> pc_series_variant_colors.
-- A "variant" is one spec tier (e.g. "PLUS") shared across its colors — the
-- component list and FPS score live on the variant; price/photos/swatch live
-- on each color, since those are the only things that actually change per color.
-- ============================================

CREATE TYPE pc_series_badge_status AS ENUM ('in_stock', 'made_to_order');

CREATE TABLE pc_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    -- Homepage card CTA text — admin-editable per series (e.g. "Configurations
    -- and prices" vs "Configurator" for a build-your-own-style series).
    action_button_text VARCHAR(100) NOT NULL DEFAULT 'Configurations and prices',
    card_image TEXT NULL,
    hero_video TEXT NULL,
    badge_status pc_series_badge_status NOT NULL DEFAULT 'in_stock',
    -- One or two short lines shown on the homepage card under the name (e.g.
    -- "Any configuration to your specs" / "Custom gaming PC") — admin enters
    -- each line on its own row in a textarea, rendered as separate lines.
    card_description TEXT NULL,
    -- Overrides the computed price_from (MIN of active colors) on the
    -- homepage card. Mainly for the "Build your own" card below, which has no
    -- real colors to compute a price from, but any series can set one.
    starting_price DECIMAL(10, 2) NULL CHECK (starting_price IS NULL OR starting_price >= 0),
    -- Paired with starting_price to show "from AED X to AED Y" on the
    -- homepage card instead of a single price. Ignored unless starting_price
    -- is also set — there's nothing to pair it with otherwise (the computed
    -- price_to already covers series with real priced builds).
    ending_price DECIMAL(10, 2) NULL CHECK (ending_price IS NULL OR ending_price >= 0),
    -- At most one series may have this set (enforced by the partial unique
    -- index below) — the pinned "Build your own" homepage card. It always
    -- sorts last regardless of display_order and links straight to the PC
    -- Builder instead of a series landing page.
    is_custom_build BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pc_series_is_active ON pc_series(is_active);
CREATE INDEX idx_pc_series_display_order ON pc_series(display_order);
CREATE INDEX idx_pc_series_slug ON pc_series(slug);
CREATE UNIQUE INDEX idx_pc_series_one_custom_build ON pc_series(is_custom_build) WHERE is_custom_build = true;

CREATE TRIGGER update_pc_series_updated_at BEFORE UPDATE ON pc_series
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- One section on the series landing page (e.g. "PLAY 1").
CREATE TABLE pc_series_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    series_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    subtitle TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (series_id) REFERENCES pc_series(id) ON DELETE CASCADE
);

CREATE INDEX idx_pc_series_types_series_id ON pc_series_types(series_id);
CREATE INDEX idx_pc_series_types_is_active ON pc_series_types(is_active);

CREATE TRIGGER update_pc_series_types_updated_at BEFORE UPDATE ON pc_series_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- A series type's actual purchasable builds are featured_gaming_pcs rows
-- with this type_id set (see the series_type_id column on that table,
-- defined earlier in this file) — grouped by tier_name and color-switched by
-- color_name on the series landing page. Deferred here since pc_series_types
-- didn't exist yet when featured_gaming_pcs was created above.
ALTER TABLE featured_gaming_pcs
    ADD CONSTRAINT featured_gaming_pcs_series_type_id_fkey
    FOREIGN KEY (series_type_id) REFERENCES pc_series_types(id) ON DELETE SET NULL;


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


-- ============================================
-- MIGRATION: add hero content (text/buttons/mode)
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- CREATE TYPE hero_mode AS ENUM ('single', 'slideshow');
-- CREATE TABLE IF NOT EXISTS hero_content (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     mode hero_mode NOT NULL DEFAULT 'single',
--     headline_line_1 VARCHAR(255) NOT NULL DEFAULT 'Gaming PCs,',
--     headline_line_2 VARCHAR(255) NOT NULL DEFAULT 'Built To Win.',
--     subtext TEXT NOT NULL DEFAULT 'Hand-built rigs with real component transparency and a 3-year warranty. Configure your own build or shop ready-to-ship systems today.',
--     button_1_text VARCHAR(100) NOT NULL DEFAULT 'Shop Gaming PCs',
--     button_1_link VARCHAR(500) NOT NULL DEFAULT '/products',
--     button_2_text VARCHAR(100) NOT NULL DEFAULT 'Start Custom Build',
--     button_2_link VARCHAR(500) NOT NULL DEFAULT '/pc-builder',
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE TRIGGER update_hero_content_updated_at BEFORE UPDATE ON hero_content
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- MIGRATION: add site settings (whatsapp number)
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- CREATE TABLE IF NOT EXISTS site_settings (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     whatsapp_number VARCHAR(32),
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE TRIGGER update_site_settings_updated_at BEFORE UPDATE ON site_settings
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- MIGRATION: add store locations
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- CREATE TABLE IF NOT EXISTS store_locations (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name VARCHAR(255) NOT NULL,
--     address TEXT NOT NULL,
--     city VARCHAR(255),
--     is_active BOOLEAN NOT NULL DEFAULT true,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE INDEX IF NOT EXISTS idx_store_location_active ON store_locations(is_active);
-- CREATE TRIGGER update_store_locations_updated_at BEFORE UPDATE ON store_locations
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- MIGRATION: add per-category hero banner fields
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- ALTER TABLE categories
--   ADD COLUMN IF NOT EXISTS hero_image TEXT NULL,
--   ADD COLUMN IF NOT EXISTS hero_tagline VARCHAR(255) NULL,
--   ADD COLUMN IF NOT EXISTS hero_description TEXT NULL;


-- ============================================
-- MIGRATION: add max_quantity to PC builder categories
-- Lets admins allow a builder step (e.g. Storage, Fans) to accept more
-- than one selected product. Defaults to 1 so existing steps keep
-- today's single-select behavior until an admin raises the limit.
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- ALTER TABLE pc_builder_categories
--   ADD COLUMN IF NOT EXISTS max_quantity INTEGER NOT NULL DEFAULT 1 CHECK (max_quantity >= 1);


-- ============================================
-- MIGRATION: add allow_duplicate_products to PC builder categories
-- Lets a customer add the SAME product to a builder step more than once
-- (e.g. 2x of one fan) instead of only being able to pick that many
-- DIFFERENT products. Defaults to false so existing steps keep today's
-- behavior until an admin turns it on. Run this block against an existing
-- database instead of the full schema above.
-- ============================================
-- ALTER TABLE pc_builder_categories
--   ADD COLUMN IF NOT EXISTS allow_duplicate_products BOOLEAN NOT NULL DEFAULT FALSE;


-- ============================================
-- MIGRATION: add slug to products
-- Clean storefront URLs (/product/<category>/<slug>) instead of exposing the
-- raw product id. Existing rows are backfilled by a one-off script, not here
-- — this block only adds the column/index; new + edited products populate it
-- via ProductService#createProduct / #updateProduct.
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- ALTER TABLE products
--   ADD COLUMN IF NOT EXISTS slug VARCHAR(255) NULL UNIQUE;
-- CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);


-- ============================================
-- HOMEPAGE SECTIONS TABLE
-- Admin-managed, ordered list of category showcase rows on the homepage
-- (e.g. "Graphics Cards", "Monitors"). Replaces the previous hardcoded
-- CATEGORY_SHOWCASES array in the frontend. bg_color_light/bg_color_dark
-- are free-form CSS color strings (hex/hsl/etc) applied as the section's
-- background per theme; NULL means "no override, use the page default".
-- ============================================

CREATE TABLE homepage_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    product_limit INTEGER NOT NULL DEFAULT 12 CHECK (product_limit > 0),
    bg_color_light VARCHAR(32) NULL,
    bg_color_dark VARCHAR(32) NULL,
    -- Optional full-bleed photo for the section's pinned "category tile" on the
    -- homepage. NULL falls back to the plain icon tile.
    image TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX idx_homepage_sections_is_active ON homepage_sections(is_active);
CREATE INDEX idx_homepage_sections_display_order ON homepage_sections(display_order);
CREATE INDEX idx_homepage_sections_category_id ON homepage_sections(category_id);

CREATE TRIGGER update_homepage_sections_updated_at BEFORE UPDATE ON homepage_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed the sections that exist on the homepage today (matching the previous
-- hardcoded CATEGORY_SHOWCASES list), so the storefront keeps working exactly
-- as it does now until an admin curates the list from the new admin panel.
-- "Gaming Laptops" is intentionally skipped — there's no matching category.
INSERT INTO homepage_sections (category_id, title, display_order, is_active, product_limit)
SELECT id, 'Graphics Cards', 0, TRUE, 12 FROM categories WHERE category_name ILIKE '%gpu%' OR category_name ILIKE '%graphic%'
UNION ALL
SELECT id, 'Monitors', 1, TRUE, 6 FROM categories WHERE category_name ILIKE '%monitor%'
UNION ALL
SELECT id, 'Processors', 2, TRUE, 6 FROM categories WHERE category_name ILIKE '%cpu%' OR category_name ILIKE '%processor%'
UNION ALL
SELECT id, 'Motherboards', 3, TRUE, 6 FROM categories WHERE category_name ILIKE '%motherboard%' OR category_name ILIKE '%mobo%'
UNION ALL
SELECT id, 'RAM', 4, TRUE, 6 FROM categories WHERE category_name ILIKE '%ram%' OR category_name ILIKE '%memory%'
ON CONFLICT (category_id) DO NOTHING;


-- ============================================
-- MIGRATION: add blogs
-- Admin-authored blog posts with full SEO field control + a "featured" flag
-- for homepage placement. Run this block against an existing database
-- instead of the full schema above.
-- ============================================
-- CREATE TYPE blog_status AS ENUM ('published', 'draft');
-- CREATE TABLE IF NOT EXISTS blogs (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     title VARCHAR(255) NOT NULL,
--     slug VARCHAR(255) NULL UNIQUE,
--     category VARCHAR(255) NULL,
--     excerpt TEXT NULL,
--     content TEXT NOT NULL,
--     featured_image TEXT NULL,
--     status blog_status NOT NULL DEFAULT 'draft',
--     featured BOOLEAN NOT NULL DEFAULT FALSE,
--     seo_title VARCHAR(255) NULL,
--     seo_description VARCHAR(500) NULL,
--     seo_keywords VARCHAR(500) NULL,
--     og_image TEXT NULL,
--     published_at TIMESTAMP WITH TIME ZONE NULL,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE INDEX IF NOT EXISTS idx_blogs_status ON blogs(status);
-- CREATE INDEX IF NOT EXISTS idx_blogs_featured ON blogs(featured);
-- CREATE INDEX IF NOT EXISTS idx_blogs_slug ON blogs(slug);
-- CREATE INDEX IF NOT EXISTS idx_blogs_created_at ON blogs(created_at);
-- CREATE TRIGGER update_blogs_updated_at BEFORE UPDATE ON blogs
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- MIGRATION: add homepage sections
-- Admin-managed, ordered list of category showcase rows on the homepage.
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- CREATE TABLE IF NOT EXISTS homepage_sections (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     category_id UUID NOT NULL UNIQUE,
--     title VARCHAR(255) NOT NULL,
--     display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
--     is_active BOOLEAN NOT NULL DEFAULT TRUE,
--     product_limit INTEGER NOT NULL DEFAULT 12 CHECK (product_limit > 0),
--     bg_color_light VARCHAR(32) NULL,
--     bg_color_dark VARCHAR(32) NULL,
--     image TEXT NULL,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
-- );
-- CREATE INDEX IF NOT EXISTS idx_homepage_sections_is_active ON homepage_sections(is_active);
-- CREATE INDEX IF NOT EXISTS idx_homepage_sections_display_order ON homepage_sections(display_order);
-- CREATE INDEX IF NOT EXISTS idx_homepage_sections_category_id ON homepage_sections(category_id);
-- CREATE TRIGGER update_homepage_sections_updated_at BEFORE UPDATE ON homepage_sections
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- INSERT INTO homepage_sections (category_id, title, display_order, is_active, product_limit)
-- SELECT id, 'Graphics Cards', 0, TRUE, 12 FROM categories WHERE category_name ILIKE '%gpu%' OR category_name ILIKE '%graphic%'
-- UNION ALL
-- SELECT id, 'Monitors', 1, TRUE, 6 FROM categories WHERE category_name ILIKE '%monitor%'
-- UNION ALL
-- SELECT id, 'Processors', 2, TRUE, 6 FROM categories WHERE category_name ILIKE '%cpu%' OR category_name ILIKE '%processor%'
-- UNION ALL
-- SELECT id, 'Motherboards', 3, TRUE, 6 FROM categories WHERE category_name ILIKE '%motherboard%' OR category_name ILIKE '%mobo%'
-- UNION ALL
-- SELECT id, 'RAM', 4, TRUE, 6 FROM categories WHERE category_name ILIKE '%ram%' OR category_name ILIKE '%memory%'
-- ON CONFLICT (category_id) DO NOTHING;


-- ============================================
-- MIGRATION: add image to homepage sections
-- Optional full-bleed photo for the pinned category tile. Run this block
-- against a database that already has homepage_sections from the migration
-- above.
-- ============================================
-- ALTER TABLE homepage_sections
--   ADD COLUMN IF NOT EXISTS image TEXT NULL;


-- ============================================
-- MIGRATION: add featured gaming PCs
-- Admin-curated builds shown on the homepage before "Shop By Category".
-- Run this block against an existing database instead of the full schema above.
-- ============================================
-- ALTER TABLE site_settings
--   ADD COLUMN IF NOT EXISTS featured_gaming_pcs_limit INTEGER NOT NULL DEFAULT 4 CHECK (featured_gaming_pcs_limit >= 0);
--
-- CREATE TABLE IF NOT EXISTS featured_gaming_pcs (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name VARCHAR(255) NOT NULL,
--     slug VARCHAR(255) NULL UNIQUE,
--     description TEXT NULL,
--     price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
--     key_features TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
--     is_active BOOLEAN NOT NULL DEFAULT TRUE,
--     display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
-- CREATE INDEX IF NOT EXISTS idx_featured_gaming_pcs_is_active ON featured_gaming_pcs(is_active);
-- CREATE INDEX IF NOT EXISTS idx_featured_gaming_pcs_display_order ON featured_gaming_pcs(display_order);
-- CREATE INDEX IF NOT EXISTS idx_featured_gaming_pcs_slug ON featured_gaming_pcs(slug);
-- CREATE TRIGGER update_featured_gaming_pcs_updated_at BEFORE UPDATE ON featured_gaming_pcs
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--
-- CREATE TABLE IF NOT EXISTS featured_gaming_pc_images (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     gaming_pc_id UUID NOT NULL,
--     url TEXT NOT NULL,
--     display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0 AND display_order < 5),
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     FOREIGN KEY (gaming_pc_id) REFERENCES featured_gaming_pcs(id) ON DELETE CASCADE,
--     CONSTRAINT unique_gaming_pc_image_order UNIQUE (gaming_pc_id, display_order)
-- );
-- CREATE INDEX IF NOT EXISTS idx_featured_gaming_pc_images_gaming_pc_id ON featured_gaming_pc_images(gaming_pc_id);
--
-- CREATE TABLE IF NOT EXISTS featured_gaming_pc_products (
--     gaming_pc_id UUID NOT NULL,
--     product_id UUID NOT NULL,
--     quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
--     display_order INTEGER NOT NULL DEFAULT 0 CHECK (display_order >= 0),
--     PRIMARY KEY (gaming_pc_id, product_id),
--     FOREIGN KEY (gaming_pc_id) REFERENCES featured_gaming_pcs(id) ON DELETE CASCADE,
--     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
-- );
-- CREATE INDEX IF NOT EXISTS idx_featured_gaming_pc_products_gaming_pc_id ON featured_gaming_pc_products(gaming_pc_id);
-- CREATE INDEX IF NOT EXISTS idx_featured_gaming_pc_products_product_id ON featured_gaming_pc_products(product_id);


-- ============================================
-- MIGRATION: add quantity to featured gaming PC products
-- Lets the same product appear more than once in a build (e.g. 2x RAM sticks).
-- Run this block against a database that already has featured_gaming_pc_products
-- from the migration above.
-- ============================================
-- ALTER TABLE featured_gaming_pc_products
--   ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1);


-- ============================================
-- MIGRATION: add slug to featured gaming PCs
-- Clean storefront URL (/gaming-pc/<slug>) instead of exposing the raw id.
-- Existing rows are backfilled by a one-off script, not here — this block
-- only adds the column/index; new + edited builds populate it via
-- FeaturedGamingPcService#create/#update.
-- ============================================
-- ALTER TABLE featured_gaming_pcs
--   ADD COLUMN IF NOT EXISTS slug VARCHAR(255) NULL UNIQUE;
-- CREATE INDEX IF NOT EXISTS idx_featured_gaming_pcs_slug ON featured_gaming_pcs(slug);
