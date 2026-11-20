import { PrismaClient, SellingMode } from "@prisma/client";
import bcrypt from "bcryptjs";
import { brandSeeds, categorySeeds, productSeeds, tr } from "./seed-catalog";

const prisma = new PrismaClient();

function assertSafeTarget() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  if (["localhost", "127.0.0.1", "::1"].includes(host) || process.env.SEED_ALLOW_REMOTE === "1") return;
  throw new Error(`Refusing to seed ${host}: the seed wipes all data. Set SEED_ALLOW_REMOTE=1 to seed a remote database.`);
}

async function main() {
  assertSafeTarget();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.clubCode.deleteMany();
  await prisma.clubPartner.deleteMany();
  await prisma.deliveryZone.deleteMany();
  await prisma.page.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.adminUser.deleteMany();

  await prisma.adminUser.create({
    data: { email: "admin@mountinox.am", passwordHash: await bcrypt.hash("mountinox", 10) },
  });

  await prisma.setting.createMany({
    data: [
      { key: "storeName", value: "Mountinox" },
      { key: "tagline", value: "hike shop" },
      { key: "preorderLeadDays", value: "7" },
      { key: "paymentCod", value: "true" },
      { key: "paymentBankTransfer", value: "true" },
      { key: "contactPhone", value: "+37400000000" },
    ],
  });

  const yerevan = await prisma.deliveryZone.create({
    data: { name: tr("Yerevan", "Ереван", "Երևան"), feeAmd: 1000, etaDays: 1 },
  });
  await prisma.deliveryZone.create({
    data: { name: tr("Regions", "Регионы", "Մարզեր"), feeAmd: 2500, etaDays: 3 },
  });

  const pages = [
    ["delivery", "Delivery", "Delivery across Yerevan and the regions."],
    ["returns", "Returns", "Unused items can be returned within 14 days."],
    ["contacts", "Contacts", "Mountinox hike shop, Yerevan."],
    ["privacy", "Privacy", "We use your phone number only to fulfill the order."],
    ["terms", "Terms", "Orders are confirmed by phone before shipping."],
    ["size-guide", "Size guide", "Measure chest, waist and inseam, then compare with each product's size table."],
    ["care", "Gear care", "Clean, dry fully and store loosely to keep your gear trail-ready for years."],
    ["about", "Our story", "Mountinox is an outdoor equipment shop from Yerevan, built by people who hike."],
    ["approach", "Our approach", "Fewer, better things: gear we have tested and would carry ourselves."],
    ["the-long-way", "Why we take the long way", "Slower routes, better views, and what we pack for them."],
    ["pack-less", "Pack less, see more", "Building a lighter kit without giving up comfort."],
    ["night-under-the-stars", "A night under the stars", "Our first-night camping checklist."],
  ] as const;
  for (const [slug, title, body] of pages) {
    await prisma.page.create({ data: { slug, title: tr(title), body: tr(body) } });
  }

  const categories = await Promise.all(
    categorySeeds.map((category, sort) => prisma.category.create({ data: { ...category, sort } })),
  );
  const categoryId = Object.fromEntries(categories.map((category) => [category.slug, category.id]));

  const brands = await Promise.all(brandSeeds.map((name) => prisma.brand.create({ data: { name } })));
  const brandId = Object.fromEntries(brands.map((brand) => [brand.name, brand.id]));

  const variants = new Map<string, { id: string; label: string; price: number; mode: SellingMode }>();
  for (const product of productSeeds) {
    const created = await prisma.product.create({
      data: {
        categoryId: categoryId[product.category],
        brandId: product.brand ? brandId[product.brand] : null,
        slug: product.slug,
        name: tr(product.name),
        description: product.tagline,
        tagline: product.tagline,
        specs: tr(product.specs),
        season: product.season,
        features: product.features,
        featured: product.featured,
        ratingAvg: product.rating,
        ratingCount: product.ratingCount,
        published: true,
        variants: {
          create: product.sizes.map((size, index) => ({
            sku: `${product.slug}-${String(index + 1).padStart(2, "0")}`,
            priceAmd: product.price,
            stockQty: product.mode === "in_stock" ? 12 : 0,
            sellingMode: product.mode,
            preorderLimit: product.mode === "preorder" ? 20 : null,
            label: tr(size),
          })),
        },
        images: { create: { url: `/products/${product.slug}.jpg`, sort: 0 } },
      },
      include: { variants: { orderBy: { sku: "asc" } } },
    });
    variants.set(product.slug, {
      id: created.variants[0].id,
      label: product.sizes[0],
      price: product.price,
      mode: product.mode === "out_of_stock" ? "in_stock" : product.mode,
    });
  }

  let orderIndex = 0;
  for (const product of productSeeds) {
    const variant = variants.get(product.slug);
    if (!variant) continue;
    const placedAt = new Date(Date.UTC(2026, 10, 2 + (orderIndex % 14), 9, 0, 0));
    orderIndex += 1;
    await prisma.order.create({
      data: {
        number: `MNX-${1000 + orderIndex}`,
        customerName: "Instagram customer",
        phone: `+37499${String(100000 + orderIndex).slice(0, 6)}`,
        addressKind: "yerevan",
        district: "Kentron",
        addressLine: "Instagram DM",
        paymentMethod: "instagram",
        status: "delivered",
        channel: "instagram",
        deliveryZoneId: yerevan.id,
        placedAt,
        lines: {
          create: {
            variantId: variant.id,
            productName: product.name,
            variantLabel: variant.label,
            qty: product.sold,
            priceAmd: product.price,
            sellingMode: variant.mode,
          },
        },
      },
    });
  }

  const aktiv = await prisma.clubPartner.create({
    data: {
      name: "Aktiv Up",
      slug: "aktiv-up",
      accent: "blue",
      cashbackBps: 0,
      validUntil: new Date("2026-12-31T00:00:00.000Z"),
      message: "Mountinox x Aktiv Up. Share code MNX-ACT2024 with your members.",
    },
  });
  await prisma.clubCode.create({ data: { partnerId: aktiv.id, code: "MNX-ACT2024", active: true } });

  const lavash = await prisma.clubPartner.create({
    data: {
      name: "Lavash Tour",
      slug: "lavash-tour",
      accent: "gold",
      cashbackBps: 0,
      validUntil: new Date("2026-12-31T00:00:00.000Z"),
      message: "Mountinox x Lavash Tour. Share code MNX-LAV847 with your members.",
    },
  });
  await prisma.clubCode.create({ data: { partnerId: lavash.id, code: "MNX-LAV847", active: true } });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
