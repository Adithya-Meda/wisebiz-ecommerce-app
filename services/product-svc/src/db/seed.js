'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../../.env') });

const { connect, disconnect } = require('./connection');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { createLogger } = require('@Adithya-Meda/wisebiz-shared');

const logger = createLogger('product-svc:seed');

const CATEGORIES = [
  { name: 'Electronics', slug: 'electronics', description: 'Gadgets, devices and accessories', sort_order: 1 },
  { name: 'Fashion', slug: 'fashion', description: 'Clothing, footwear and accessories', sort_order: 2 },
  { name: 'Home & Living', slug: 'home-living', description: 'Furniture, decor and kitchen', sort_order: 3 },
  { name: 'Sports & Fitness', slug: 'sports-fitness', description: 'Sportswear and equipment', sort_order: 4 },
  { name: 'Books', slug: 'books', description: 'Fiction, non-fiction and textbooks', sort_order: 5 },
  { name: 'Beauty & Health', slug: 'beauty-health', description: 'Skincare, wellness and grooming', sort_order: 6 },
];

async function seed() {
  await connect();
  logger.info('Seeding database...');

  await Category.deleteMany({});
  await Product.deleteMany({});

  const cats = await Category.insertMany(CATEGORIES);
  logger.info(`Inserted ${cats.length} categories`);

  const electronicsId = cats.find((c) => c.slug === 'electronics')._id;
  const fashionId = cats.find((c) => c.slug === 'fashion')._id;
  const homeId = cats.find((c) => c.slug === 'home-living')._id;
  const sportsId = cats.find((c) => c.slug === 'sports-fitness')._id;
  const beautyId = cats.find((c) => c.slug === 'beauty-health')._id;

  const PRODUCTS = [
    {
      name: 'ProSound X7 Wireless Earbuds',
      slug: 'prosound-x7-wireless-earbuds',
      description: 'Experience crystal-clear audio with 40-hour battery life, active noise cancellation, and IPX5 water resistance. Perfect for workouts and daily commutes.',
      short_description: '40hr battery | ANC | IPX5',
      sku: 'ELEC-EARB-001',
      category_id: electronicsId,
      brand: 'ProSound',
      base_price: 4999,
      discount_percent: 20,
      currency: 'INR',
      stock: 145,
      is_featured: true,
      is_new_arrival: true,
      images: [{ url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800', alt: 'ProSound X7 Earbuds', is_primary: true }],
      tags: ['earbuds', 'wireless', 'anc', 'audio'],
      attributes: new Map([['battery_life', '40 hours'], ['connectivity', 'Bluetooth 5.3'], ['noise_cancellation', 'Active']]),
      rating_avg: 4.5,
      rating_count: 238,
    },
    {
      name: 'UltraView 4K Smart Monitor 27"',
      slug: 'ultraview-4k-smart-monitor-27',
      description: 'A stunning 27-inch 4K IPS display with 144Hz refresh rate, HDR600, and built-in USB-C hub. Designed for professionals and gamers alike.',
      short_description: '27" 4K | 144Hz | HDR600 | USB-C Hub',
      sku: 'ELEC-MON-002',
      category_id: electronicsId,
      brand: 'UltraView',
      base_price: 32999,
      discount_percent: 10,
      currency: 'INR',
      stock: 43,
      is_featured: true,
      is_new_arrival: false,
      images: [{ url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800', alt: 'UltraView 4K Monitor', is_primary: true }],
      tags: ['monitor', '4k', 'gaming', 'usb-c'],
      attributes: new Map([['panel_type', 'IPS'], ['refresh_rate', '144Hz'], ['resolution', '3840x2160']]),
      rating_avg: 4.7,
      rating_count: 91,
    },
    {
      name: 'SnapCharge 65W GaN Charger',
      slug: 'snapcharge-65w-gan-charger',
      description: 'Charge your laptop, phone, and tablet simultaneously with this compact 65W GaN charger. Supports PD 3.0, QC 4.0 and has 3 ports.',
      short_description: '65W GaN | 3 ports | PD 3.0',
      sku: 'ELEC-CHG-003',
      category_id: electronicsId,
      brand: 'SnapCharge',
      base_price: 2499,
      discount_percent: 15,
      currency: 'INR',
      stock: 320,
      is_featured: false,
      is_new_arrival: true,
      images: [{ url: 'https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800', alt: 'GaN Charger', is_primary: true }],
      tags: ['charger', 'gan', 'usb-c', 'fast-charge'],
      attributes: new Map([['wattage', '65W'], ['ports', '3'], ['protocol', 'PD 3.0 / QC 4.0']]),
      rating_avg: 4.3,
      rating_count: 512,
    },
    {
      name: 'AeroFit Pro Running Shoes',
      slug: 'aerofit-pro-running-shoes',
      description: 'Engineered for serious runners with carbon fibre plate, responsive foam midsole, and breathable knit upper. Available in multiple sizes.',
      short_description: 'Carbon plate | Responsive foam | Knit upper',
      sku: 'FASH-SHOE-001',
      category_id: fashionId,
      brand: 'AeroFit',
      base_price: 8999,
      discount_percent: 25,
      currency: 'INR',
      stock: 210,
      is_featured: true,
      is_new_arrival: true,
      images: [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', alt: 'AeroFit Pro Running Shoes', is_primary: true }],
      tags: ['running', 'shoes', 'sports', 'carbon'],
      attributes: new Map([['material', 'Mesh + Knit'], ['sole', 'Carbon Fibre Plate'], ['drop_mm', '8mm']]),
      rating_avg: 4.6,
      rating_count: 344,
    },
    {
      name: 'Urban Casual Slim Fit Jeans',
      slug: 'urban-casual-slim-fit-jeans',
      description: 'Premium stretch denim with slim fit silhouette. Four-way stretch fabric for all-day comfort. Available in dark wash, grey, and black.',
      short_description: 'Slim fit | 4-way stretch | Premium denim',
      sku: 'FASH-JEAN-002',
      category_id: fashionId,
      brand: 'UrbanStyle',
      base_price: 1999,
      discount_percent: 30,
      currency: 'INR',
      stock: 495,
      is_featured: false,
      is_new_arrival: true,
      images: [{ url: 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800', alt: 'Slim Fit Jeans', is_primary: true }],
      tags: ['jeans', 'denim', 'casual', 'slim-fit'],
      attributes: new Map([['material', '98% Cotton, 2% Elastane'], ['fit', 'Slim'], ['rise', 'Mid-rise']]),
      rating_avg: 4.1,
      rating_count: 728,
    },
    {
      name: 'LuxeComfort Memory Foam Pillow',
      slug: 'luxecomfort-memory-foam-pillow',
      description: 'Orthopedic memory foam pillow with cooling gel layer and removable bamboo cover. Supports natural spine alignment for a restful night.',
      short_description: 'Cooling gel | Bamboo cover | Orthopedic',
      sku: 'HOME-PIL-001',
      category_id: homeId,
      brand: 'LuxeComfort',
      base_price: 1499,
      discount_percent: 10,
      currency: 'INR',
      stock: 180,
      is_featured: false,
      is_new_arrival: false,
      images: [{ url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800', alt: 'Memory Foam Pillow', is_primary: true }],
      tags: ['pillow', 'memory-foam', 'sleeping', 'orthopedic'],
      attributes: new Map([['fill', 'Memory Foam + Gel'], ['cover', 'Bamboo'], ['size', 'Standard']]),
      rating_avg: 4.4,
      rating_count: 156,
    },
    {
      name: 'PowerCore Resistance Band Set',
      slug: 'powercore-resistance-band-set',
      description: 'Set of 5 progressive resistance bands (10–50lbs) with door anchor, handles, and carry bag. Suitable for full-body strength training at home.',
      short_description: '5-band set | 10-50lbs | Full body',
      sku: 'SPRT-BAND-001',
      category_id: sportsId,
      brand: 'PowerCore',
      base_price: 999,
      discount_percent: 0,
      currency: 'INR',
      stock: 620,
      is_featured: false,
      is_new_arrival: true,
      images: [{ url: 'https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=800', alt: 'Resistance Bands', is_primary: true }],
      tags: ['fitness', 'bands', 'home-gym', 'strength'],
      attributes: new Map([['bands', '5'], ['resistance_range', '10-50 lbs'], ['material', 'Natural Latex']]),
      rating_avg: 4.2,
      rating_count: 943,
    },
    {
      name: 'GlowSkin Vitamin C Serum',
      slug: 'glowskin-vitamin-c-serum',
      description: '20% Vitamin C + Hyaluronic Acid + Niacinamide brightening serum for dark spot reduction and even skin tone. Dermatologist tested, fragrance-free.',
      short_description: '20% Vit C | Hyaluronic | Fragrance-free',
      sku: 'BEAU-SER-001',
      category_id: beautyId,
      brand: 'GlowSkin',
      base_price: 799,
      discount_percent: 5,
      currency: 'INR',
      stock: 410,
      is_featured: true,
      is_new_arrival: false,
      images: [{ url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=800', alt: 'Vitamin C Serum', is_primary: true }],
      tags: ['serum', 'vitamin-c', 'skincare', 'brightening'],
      attributes: new Map([['volume', '30ml'], ['skin_type', 'All skin types'], ['spf', 'None']]),
      rating_avg: 4.6,
      rating_count: 1205,
    },
  ];

  const products = await Product.insertMany(PRODUCTS);
  logger.info(`Inserted ${products.length} products`);

  await disconnect();
  logger.info('Seed complete');
}

seed().catch((err) => {
  logger.error('Seed failed', { error: err.message });
  process.exit(1);
});
