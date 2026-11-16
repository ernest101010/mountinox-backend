import { PrismaClient, SellingMode } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function tr(en: string, ru = en, hy = en) {
  return { hy, ru, en };
}

const products: { slug: string; en: string; sold: number; mode: SellingMode; price: number; category: string }[] = [
  { slug: "backpack", en: "Backpack", sold: 6, mode: "in_stock", price: 45000, category: "packs" },
  { slug: "qartal-boots", en: "Qartal Boots (Hiking + Mountaineering)", sold: 5, mode: "in_stock", price: 89000, category: "footwear" },
  { slug: "scarf-buff", en: "Scarf / Buff", sold: 5, mode: "preorder", price: 8000, category: "accessories" },
  { slug: "sunglasses", en: "Sunglasses / Glasses", sold: 4, mode: "in_stock", price: 18000, category: "accessories" },
  { slug: "double-jacket", en: "Double Jacket", sold: 2, mode: "preorder", price: 72000, category: "apparel" },
  { slug: "trekking-poles", en: "Trekking Poles", sold: 2, mode: "in_stock", price: 24000, category: "accessories" },
  { slug: "gaiter", en: "Gaiter", sold: 2, mode: "preorder", price: 12000, category: "footwear" },
  { slug: "fleece", en: "Fleece / Polar Half-Zip", sold: 2, mode: "in_stock", price: 32000, category: "apparel" },
  { slug: "shoes", en: "Shoes", sold: 1, mode: "preorder", price: 54000, category: "footwear" },
  { slug: "waterproof-jacket", en: "Waterproof Jacket", sold: 1, mode: "in_stock", price: 68000, category: "apparel" },
  { slug: "jacket", en: "Jacket", sold: 1, mode: "preorder", price: 61000, category: "apparel" },
  { slug: "gloves", en: "Gloves", sold: 1, mode: "in_stock", price: 9000, category: "accessories" },
  { slug: "thermos", en: "Thermos", sold: 1, mode: "preorder", price: 15000, category: "accessories" },
  { slug: "pants", en: "Pants", sold: 1, mode: "out_of_stock", price: 28000, category: "apparel" },
];

async function main() {
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.variant.deleteMany();
  await prisma.product.deleteMany();
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
  ] as const;
  for (const [slug, title, body] of pages) {
    await prisma.page.create({ data: { slug, title: tr(title), body: tr(body) } });
  }

  const categories = await Promise.all(
    [
      ["packs", "Packs"],
      ["footwear", "Footwear"],
      ["apparel", "Apparel"],
      ["accessories", "Accessories"],
    ].map(([slug, name], sort) =>
      prisma.category.create({ data: { slug, name: tr(name), sort } }),
    ),
  );
  const categoryId = Object.fromEntries(categories.map((category) => [category.slug, category.id]));

  const variants = new Map<string, { id: string; price: number; mode: SellingMode }>();
  for (const product of products) {
    const created = await prisma.product.create({
      data: {
        categoryId: categoryId[product.category],
        slug: product.slug,
        name: tr(product.en),
        description: tr(`${product.en} from Mountinox.`),
        published: true,
        variants: {
          create: {
            sku: product.slug,
            priceAmd: product.price,
            stockQty: product.mode === "in_stock" ? 12 : 0,
            sellingMode: product.mode,
            preorderLimit: product.mode === "preorder" ? 20 : null,
            label: tr("One size"),
          },
        },
        images: { create: { url: `https://placehold.co/800x800?text=${encodeURIComponent(product.en)}`, sort: 0 } },
      },
      include: { variants: true },
    });
    variants.set(product.slug, { id: created.variants[0].id, price: product.price, mode: product.mode === "out_of_stock" ? "in_stock" : product.mode });
  }

  let orderIndex = 0;
  for (const product of products) {
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
            productName: product.en,
            variantLabel: "One size",
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
