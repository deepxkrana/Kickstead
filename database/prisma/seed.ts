/**
 * Repeatable catalogue seed. Safe to run more than once:
 * - Categories and products are matched by slug and updated in place.
 * - Stock is set only when a product is first created (with a SEED inventory movement),
 *   so re-running the seed never silently overwrites stock changed by orders or admins.
 *
 * - Demo users are created in Supabase Auth (email/password, pre-confirmed) and mirrored
 *   into our users table with the same id. Their password is reset to the documented
 *   demo value on every run. Requires SUPABASE_URL + SUPABASE_SECRET_KEY; skipped otherwise.
 *
 * Brand names are fictional. Images are free Unsplash photos.
 * Demo credentials are dummy values, published in the README on purpose.
 */
import { PrismaClient, type Role } from '@prisma/client';
import { createClient, type SupabaseClient, type User as AuthUser } from '@supabase/supabase-js';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'Kickstead@Demo1';

const demoUsers: { email: string; name: string; role: Role }[] = [
  { email: 'admin@kickstead.dev', name: 'Demo Admin', role: 'ADMIN' },
  { email: 'customer@kickstead.dev', name: 'Demo Customer', role: 'CUSTOMER' },
];

const demoAddress = {
  fullName: 'Demo Customer',
  phone: '+91 98765 43210',
  line1: '221 Linking Road',
  line2: 'Flat 4B, Sea Breeze Apartments',
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400050',
  country: 'India',
  isDefault: true,
};

const img = (id: string) => `https://images.unsplash.com/photo-${id}?w=800&q=80`;

const categories = [
  { slug: 'running', name: 'Running', description: 'Lightweight trainers built for distance and pace.' },
  { slug: 'basketball', name: 'Basketball', description: 'Court-ready support and grip.' },
  { slug: 'lifestyle', name: 'Lifestyle', description: 'Everyday sneakers for the street.' },
  { slug: 'skate', name: 'Skate', description: 'Durable, flat-soled shoes for the board.' },
] as const;

type CategorySlug = (typeof categories)[number]['slug'];

interface SeedProduct {
  slug: string;
  name: string;
  brand: string;
  category: CategorySlug;
  description: string;
  pricePaise: number;
  stock: number;
  image: string;
  featured?: boolean;
  active?: boolean;
}

const products: SeedProduct[] = [
  {
    slug: 'stridewell-tempo-red',
    name: 'Tempo Runner',
    brand: 'Stridewell',
    category: 'running',
    description: 'A responsive daily trainer with a breathable mesh upper and foam midsole.',
    pricePaise: 649_900,
    stock: 24,
    image: img('1542291026-7eec264c27ff'),
    featured: true,
  },
  {
    slug: 'northline-glide-2',
    name: 'Glide 2',
    brand: 'Northline',
    category: 'running',
    description: 'Cushioned long-distance runner with a rocker sole for smooth transitions.',
    pricePaise: 879_900,
    stock: 15,
    image: img('1606107557195-0e29a4b5b4aa'),
  },
  {
    slug: 'aerofold-pace-lite',
    name: 'Pace Lite',
    brand: 'Aerofold',
    category: 'running',
    description: 'Featherweight racer for tempo days and race day.',
    pricePaise: 1_099_900,
    stock: 3,
    image: img('1608231387042-66d1773070a5'),
  },
  {
    slug: 'courtside-elevate-hi',
    name: 'Elevate Hi',
    brand: 'Courtside Co.',
    category: 'basketball',
    description: 'High-top with ankle support, herringbone traction and a padded collar.',
    pricePaise: 1_249_900,
    stock: 10,
    image: img('1600185365483-26d7a4cc7519'),
    featured: true,
  },
  {
    slug: 'courtside-baseline-low',
    name: 'Baseline Low',
    brand: 'Courtside Co.',
    category: 'basketball',
    description: 'Low-profile court shoe for quick cuts and guards who live on the perimeter.',
    pricePaise: 949_900,
    stock: 8,
    image: img('1595950653106-6c9ebd614d3a'),
  },
  {
    slug: 'voltvale-rebound-mid',
    name: 'Rebound Mid',
    brand: 'Volt & Vale',
    category: 'basketball',
    description: 'Mid-top hybrid with responsive cushioning for indoor and outdoor courts.',
    // Exactly one unit: used to demonstrate insufficient-stock and last-unit checkout.
    pricePaise: 799_900,
    stock: 1,
    image: img('1549298916-b41d501d3772'),
  },
  {
    slug: 'kerbclub-city-classic',
    name: 'City Classic',
    brand: 'Kerb Club',
    category: 'lifestyle',
    description: 'Clean leather low-top that goes with everything.',
    pricePaise: 459_900,
    stock: 40,
    image: img('1460353581641-37baddab0fa2'),
    featured: true,
  },
  {
    slug: 'kerbclub-weekend-canvas',
    name: 'Weekend Canvas',
    brand: 'Kerb Club',
    category: 'lifestyle',
    description: 'Vulcanised canvas sneaker with a cushioned insole.',
    pricePaise: 249_900,
    stock: 55,
    image: img('1525966222134-fcfa99b8ae77'),
  },
  {
    slug: 'northline-metro-knit',
    name: 'Metro Knit',
    brand: 'Northline',
    category: 'lifestyle',
    description: 'Slip-on knit upper with a sculpted sole for all-day wear.',
    pricePaise: 589_900,
    stock: 18,
    image: img('1491553895911-0055eca6402d'),
    featured: true,
  },
  {
    slug: 'voltvale-retro-90',
    name: 'Retro 90',
    brand: 'Volt & Vale',
    category: 'lifestyle',
    description: 'Chunky nineties-inspired runner with suede overlays.',
    pricePaise: 729_900,
    stock: 4,
    image: img('1514989940723-e8e51635b782'),
  },
  {
    slug: 'kerbclub-grindline-pro',
    name: 'Grindline Pro',
    brand: 'Kerb Club',
    category: 'skate',
    description: 'Suede skate shoe with reinforced ollie zone and grippy cupsole.',
    pricePaise: 399_900,
    stock: 22,
    image: img('1539185441755-769473a23570'),
  },
  {
    slug: 'aerofold-deck-slip',
    name: 'Deck Slip',
    brand: 'Aerofold',
    category: 'skate',
    description: 'Classic slip-on for the park. Discontinued — kept inactive to show catalogue filtering.',
    pricePaise: 299_900,
    stock: 12,
    image: img('1560769629-975ec94e6a86'),
    active: false,
  },
];

async function main() {
  const categoryIds = new Map<CategorySlug, string>();

  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
    categoryIds.set(category.slug, saved.id);
  }

  let created = 0;
  let updated = 0;

  for (const product of products) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`Unknown category ${product.category}`);

    const catalogueFields = {
      name: product.name,
      brand: product.brand,
      description: product.description,
      pricePaise: product.pricePaise,
      imageUrl: product.image,
      isFeatured: product.featured ?? false,
      isActive: product.active ?? true,
      categoryId,
    };

    const existing = await prisma.product.findUnique({ where: { slug: product.slug } });

    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data: catalogueFields });
      updated += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
      const saved = await tx.product.create({
        data: { ...catalogueFields, slug: product.slug, stockQuantity: product.stock },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: saved.id,
          quantityChange: product.stock,
          stockAfter: product.stock,
          reason: 'SEED',
          note: 'Initial seed stock',
        },
      });
    });
    created += 1;
  }

  console.log(
    `[seed] ${categories.length} categories upserted; products: ${created} created, ${updated} updated.`,
  );

  await seedDemoUsers();
}

async function findAuthUserByEmail(supabase: SupabaseClient, email: string): Promise<AuthUser | null> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
}

async function seedDemoUsers() {
  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    console.warn('[seed] SUPABASE_URL / SUPABASE_SECRET_KEY not set — skipping demo users.');
    return;
  }

  const supabase = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const demo of demoUsers) {
    let authUser = await findAuthUserByEmail(supabase, demo.email);

    if (authUser) {
      const { error } = await supabase.auth.admin.updateUserById(authUser.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: demo.name },
      });
      if (error) throw error;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demo.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: demo.name },
      });
      if (error) throw error;
      authUser = data.user;
    }

    // Mirror into our users table with the Supabase id. Demo roles are enforced on every run.
    await prisma.user.upsert({
      where: { id: authUser.id },
      create: { id: authUser.id, email: demo.email, name: demo.name, role: demo.role },
      update: { email: demo.email, name: demo.name, role: demo.role, isActive: true },
    });

    if (demo.role === 'CUSTOMER') {
      const hasAddress = await prisma.address.count({ where: { userId: authUser.id } });
      if (!hasAddress) {
        await prisma.address.create({ data: { ...demoAddress, userId: authUser.id } });
      }
    }

    console.log(`[seed] demo ${demo.role.toLowerCase()} ready: ${demo.email}`);
  }
}

main()
  .catch((err) => {
    console.error('[seed] failed', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
