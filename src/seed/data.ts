import type { Category } from '../models/product.model.js'

interface SeedProduct {
  publicId: string
  slug: string
  name: string
  subtitle: string
  description: string
  price: number
  compareAtPrice?: number
  category: Category
  collectionSlug: string
  silhouette: string
  images: { url: string; alt: string; angle?: string }[]
  colourways: { name: string; hex: string }[]
  sizes: { size: number; ukSize: number; footLengthCm: number; stock: number }[]
  materials: { upper: string; lining: string; sole: string; construction: string }
  origin: string
  featured: boolean
  isBestSeller: boolean
  isNewArrival: boolean
  careInstructions: string[]
  isActive: boolean
  createdAt: Date
}

interface SeedCollection {
  publicId: string
  slug: string
  title: string
  subtitle: string
  description: string
  coverImage: string
  sortOrder: number
  isActive: boolean
}

const SIZE_TABLE = [
  { size: 38, ukSize: 5, footLengthCm: 24.1 },
  { size: 39, ukSize: 6, footLengthCm: 24.8 },
  { size: 40, ukSize: 7, footLengthCm: 25.4 },
  { size: 41, ukSize: 8, footLengthCm: 26.0 },
  { size: 42, ukSize: 9, footLengthCm: 26.7 },
  { size: 43, ukSize: 10, footLengthCm: 27.3 },
  { size: 44, ukSize: 11, footLengthCm: 27.9 },
]

const sizes = (stock: number[], from = 0) =>
  stock.map((s, i) => ({ ...SIZE_TABLE[from + i]!, stock: s }))

export const collections: SeedCollection[] = [
  {
    publicId: 'col_cork_01',
    slug: 'natural-cork-series',
    title: 'The Natural Cork Series',
    subtitle: 'Purely Natural Footbeds • Handcrafted in Abuja',
    description: 'Contoured natural cork-latex slides with engraved DÁMS® buckles.',
    coverImage: '/images/hero.png',
    sortOrder: 1,
    isActive: true,
  },
  {
    publicId: 'col_dress_02',
    slug: 'abuja-executive-line',
    title: 'Abuja Executive Line',
    subtitle: 'Full-Grain Sokoto Calfskin • Blake-Stitched',
    description: 'Hand-lasted derbies, penny loafers, and wholecut Chelsea boots.',
    coverImage: '/images/collections/executive.webp',
    sortOrder: 2,
    isActive: true,
  },
]

const ORIGIN = '100% Locally Made in Abuja, Nigeria'
const LEATHER_CARE = [
  'Wipe with a soft dry or slightly damp cloth.',
  'Keep away from direct heat and prolonged sunlight.',
  'Condition with a neutral leather balm every few weeks.',
]

export const products: SeedProduct[] = [
  {
    publicId: 'prod_dams_cork_slide_00',
    slug: 'dams-signature-natural-cork-slide',
    name: 'DÁMS Signature Cork Slide',
    subtitle: 'Purely Natural • 100% Original Local Product',
    description: 'Own every step in purely natural, locally made comfort. A contoured cork footbed under engraved DÁMS buckles.',
    price: 48000,
    compareAtPrice: 56000,
    category: 'unisex',
    collectionSlug: 'natural-cork-series',
    silhouette: 'Cork Slide',
    images: [{ url: '/images/hero.png', alt: 'DÁMS Signature Natural Cork Slide', angle: 'Top & Side Pair View' }],
    colourways: [
      { name: 'Earth Chocolate', hex: '#3B261E' },
      { name: 'Savannah Tan', hex: '#8B5A2B' },
    ],
    sizes: sizes([14, 12, 15, 13, 11, 9, 6]),
    materials: {
      upper: '100% Purely Natural Nigerian Leather with Engraved DÁMS Buckles',
      lining: 'Suede-Lined Contoured Natural Footbed',
      sole: 'Shock-Absorbing Natural Cork & High-Grip EVA Outsole',
      construction: 'Locally Manufactured Anatomical Moulded Assembly',
    },
    origin: ORIGIN,
    featured: true,
    isBestSeller: true,
    isNewArrival: true,
    careInstructions: ['Wipe leather straps with a soft dry or slightly damp cloth.'],
    isActive: true,
    createdAt: new Date('2026-11-01T10:00:00Z'),
  },
  {
    publicId: 'prod_dams_cork_slide_01',
    slug: 'dams-classic-two-strap-slide',
    name: 'DÁMS Classic Two-Strap Slide',
    subtitle: 'Everyday Comfort • Handcrafted in Abuja',
    description: 'A two-strap everyday slide on a natural cork-latex footbed with a flexible grip outsole.',
    price: 42000,
    category: 'unisex',
    collectionSlug: 'natural-cork-series',
    silhouette: 'Slide',
    images: [{ url: '/images/hero.png', alt: 'DÁMS Classic Two-Strap Slide', angle: 'Side View' }],
    colourways: [
      { name: 'Natural Tan', hex: '#B07A4A' },
      { name: 'Midnight Black', hex: '#1A1A1A' },
    ],
    sizes: sizes([10, 10, 12, 10, 8, 5, 3]),
    materials: {
      upper: 'Natural Nigerian Leather Straps',
      lining: 'Suede-Lined Natural Footbed',
      sole: 'Natural Cork & EVA Outsole',
      construction: 'Locally Manufactured Moulded Assembly',
    },
    origin: ORIGIN,
    featured: false,
    isBestSeller: true,
    isNewArrival: true,
    careInstructions: ['Wipe leather straps with a soft dry or slightly damp cloth.'],
    isActive: true,
    createdAt: new Date('2026-10-20T10:00:00Z'),
  },
  {
    publicId: 'prod_dams_derby_02',
    slug: 'abuja-executive-derby',
    name: 'Abuja Executive Derby',
    subtitle: 'Full-Grain Sokoto Calfskin • Blake-Stitched',
    description: 'A hand-lasted derby in full-grain Sokoto calfskin with a Blake-stitched leather sole.',
    price: 135000,
    compareAtPrice: 150000,
    category: 'men',
    collectionSlug: 'abuja-executive-line',
    silhouette: 'Derby',
    images: [{ url: '/images/collections/executive.webp', alt: 'Abuja Executive Derby', angle: 'Three-Quarter View' }],
    colourways: [
      { name: 'Oxblood', hex: '#4A0E0E' },
      { name: 'Espresso', hex: '#2B1B14' },
    ],
    sizes: sizes([4, 6, 8, 8, 6, 4, 2], 0),
    materials: {
      upper: 'Full-Grain Sokoto Calfskin',
      lining: 'Full Leather Lining',
      sole: 'Blake-Stitched Leather Sole with Rubber Heel Tap',
      construction: 'Hand-Lasted Blake Construction',
    },
    origin: ORIGIN,
    featured: true,
    isBestSeller: true,
    isNewArrival: false,
    careInstructions: LEATHER_CARE,
    isActive: true,
    createdAt: new Date('2026-09-15T10:00:00Z'),
  },
  {
    publicId: 'prod_dams_loafer_03',
    slug: 'abuja-executive-penny-loafer',
    name: 'Abuja Executive Penny Loafer',
    subtitle: 'Full-Grain Sokoto Calfskin • Hand-Finished',
    description: 'A refined penny loafer with a hand-burnished finish and a cushioned leather footbed.',
    price: 118000,
    category: 'unisex',
    collectionSlug: 'abuja-executive-line',
    silhouette: 'Penny Loafer',
    images: [{ url: '/images/collections/executive.webp', alt: 'Abuja Executive Penny Loafer', angle: 'Side View' }],
    colourways: [
      { name: 'Cognac', hex: '#9A4E1C' },
      { name: 'Black', hex: '#111111' },
    ],
    sizes: sizes([5, 7, 9, 9, 7, 5, 3]),
    materials: {
      upper: 'Full-Grain Sokoto Calfskin',
      lining: 'Soft Goat Leather Lining',
      sole: 'Leather Sole with Rubber Inlay',
      construction: 'Hand-Lasted Blake Construction',
    },
    origin: ORIGIN,
    featured: true,
    isBestSeller: true,
    isNewArrival: false,
    careInstructions: LEATHER_CARE,
    isActive: true,
    createdAt: new Date('2026-09-28T10:00:00Z'),
  },
  {
    publicId: 'prod_dams_chelsea_04',
    slug: 'abuja-executive-chelsea-boot',
    name: 'Abuja Executive Chelsea Boot',
    subtitle: 'Wholecut Sokoto Calfskin • Blake-Stitched',
    description: 'A wholecut Chelsea boot with elasticated side gussets and a sleek, polished profile.',
    price: 165000,
    compareAtPrice: 180000,
    category: 'men',
    collectionSlug: 'abuja-executive-line',
    silhouette: 'Chelsea Boot',
    images: [{ url: '/images/collections/executive.webp', alt: 'Abuja Executive Chelsea Boot', angle: 'Pair View' }],
    colourways: [
      { name: 'Black', hex: '#0F0F0F' },
      { name: 'Dark Brown', hex: '#3A2418' },
    ],
    sizes: sizes([3, 5, 7, 7, 5, 3, 2]),
    materials: {
      upper: 'Wholecut Sokoto Calfskin',
      lining: 'Full Leather Lining',
      sole: 'Blake-Stitched Leather Sole',
      construction: 'Hand-Lasted Blake Construction',
    },
    origin: ORIGIN,
    featured: false,
    isBestSeller: false,
    isNewArrival: true,
    careInstructions: LEATHER_CARE,
    isActive: true,
    createdAt: new Date('2026-10-28T10:00:00Z'),
  },
  {
    publicId: 'prod_dams_mule_05',
    slug: 'abuja-executive-leather-mule',
    name: 'Abuja Executive Leather Mule',
    subtitle: 'Soft Calfskin • Cushioned Footbed',
    description: 'A backless leather mule with a cushioned footbed and a low sculpted heel.',
    price: 95000,
    category: 'women',
    collectionSlug: 'abuja-executive-line',
    silhouette: 'Mule',
    images: [{ url: '/images/collections/executive.webp', alt: 'Abuja Executive Leather Mule', angle: 'Side View' }],
    colourways: [
      { name: 'Blush', hex: '#D9A38F' },
      { name: 'Black', hex: '#111111' },
    ],
    sizes: sizes([6, 8, 8, 6, 4], 0),
    materials: {
      upper: 'Soft Sokoto Calfskin',
      lining: 'Goat Leather Lining',
      sole: 'Leather Sole with Rubber Grip',
      construction: 'Hand-Finished Assembly',
    },
    origin: ORIGIN,
    featured: false,
    isBestSeller: false,
    isNewArrival: true,
    careInstructions: LEATHER_CARE,
    isActive: true,
    createdAt: new Date('2026-11-05T10:00:00Z'),
  },
  {
    publicId: 'prod_dams_slingback_06',
    slug: 'abuja-executive-slingback-flat',
    name: 'Abuja Executive Slingback Flat',
    subtitle: 'Soft Calfskin • Adjustable Heel Strap',
    description: 'A graceful slingback flat with an adjustable heel strap and a cushioned insole.',
    price: 89000,
    category: 'women',
    collectionSlug: 'abuja-executive-line',
    silhouette: 'Slingback Flat',
    images: [{ url: '/images/collections/executive.webp', alt: 'Abuja Executive Slingback Flat', angle: 'Three-Quarter View' }],
    colourways: [
      { name: 'Nude', hex: '#C9A58B' },
      { name: 'Ivory', hex: '#EFE6D8' },
    ],
    sizes: sizes([6, 7, 8, 6, 4], 0),
    materials: {
      upper: 'Soft Sokoto Calfskin',
      lining: 'Goat Leather Lining',
      sole: 'Leather Sole with Rubber Grip',
      construction: 'Hand-Finished Assembly',
    },
    origin: ORIGIN,
    featured: false,
    isBestSeller: false,
    isNewArrival: true,
    careInstructions: LEATHER_CARE,
    isActive: true,
    createdAt: new Date('2026-11-08T10:00:00Z'),
  },
]
