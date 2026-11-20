import { Season, SellingMode } from "@prisma/client";

export type Translated = { hy: string; ru: string; en: string };

export function tr(en: string, ru = en, hy = en): Translated {
  return { hy, ru, en };
}

export const categorySeeds: { slug: string; name: Translated; imageUrl: string }[] = [
  { slug: "clothing", name: tr("Clothing", "Одежда", "Հագուստ"), imageUrl: "/design/dept-clothing.jpg" },
  { slug: "footwear", name: tr("Footwear", "Обувь", "Կոշիկներ"), imageUrl: "/design/dept-footwear.jpg" },
  { slug: "backpacks", name: tr("Backpacks", "Рюкзаки", "Ուսապարկեր"), imageUrl: "/design/dept-backpacks.jpg" },
  {
    slug: "tents-camping",
    name: tr("Tents & camping", "Палатки и кемпинг", "Վրաններ և քեմփինգ"),
    imageUrl: "/design/dept-tents.jpg",
  },
  { slug: "climbing", name: tr("Climbing", "Альпинизм", "Լեռնագնացություն"), imageUrl: "/design/dept-climbing.jpg" },
  { slug: "accessories", name: tr("Accessories", "Аксессуары", "Աքսեսուարներ"), imageUrl: "/design/dept-accessories.jpg" },
];

export const brandSeeds = ["Mountinox", "Qartal", "SUNREI"];

export type ProductSeed = {
  slug: string;
  name: string;
  category: string;
  brand?: string;
  tagline: Translated;
  specs: string;
  sizes: string[];
  price: number;
  season?: Season;
  features: string[];
  featured: boolean;
  rating: number;
  ratingCount: number;
  sold: number;
  mode: SellingMode;
};

const euSizes = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => `EU ${from + index}`);

export const productSeeds: ProductSeed[] = [
  {
    slug: "trek-carbon-poles",
    name: "Trek Carbon Poles",
    category: "accessories",
    brand: "Mountinox",
    tagline: tr("Steady steps. Lighter miles.", "Уверенный шаг. Лёгкие километры.", "Կայուն քայլեր։ Թեթև կիլոմետրեր։"),
    specs: "100–125 cm · 110–135 cm",
    sizes: ["100–125 cm", "110–135 cm"],
    price: 8000,
    season: "three_season",
    features: ["lightweight"],
    featured: true,
    rating: 4.9,
    ratingCount: 41,
    sold: 6,
    mode: "in_stock",
  },
  {
    slug: "ridge-38l-backpack",
    name: "Ridge 38L Backpack",
    category: "backpacks",
    brand: "Mountinox",
    tagline: tr(
      "Light on your back. Big on adventure.",
      "Лёгкий на спине. Большой для приключений.",
      "Թեթև ուսերին։ Մեծ արկածների համար։",
    ),
    specs: "S/M · M/L",
    sizes: ["S/M", "M/L"],
    price: 12000,
    season: "three_season",
    features: ["lightweight"],
    featured: true,
    rating: 4.9,
    ratingCount: 33,
    sold: 5,
    mode: "in_stock",
  },
  {
    slug: "sunrei-muye-3-headlamp",
    name: "SUNREI Muye 3 Headlamp",
    category: "accessories",
    brand: "SUNREI",
    tagline: tr(
      "570 lm · 110 m beam · 86 h runtime · Rotary knob",
      "570 лм · луч 110 м · 86 ч работы · Поворотная ручка",
      "570 լմ · 110 մ լույս · 86 ժ աշխատանք · Պտտվող կոճակ",
    ),
    specs: "570 lm · Full Kit",
    sizes: ["Full kit"],
    price: 21000,
    season: "all_season",
    features: ["waterproof", "lightweight"],
    featured: true,
    rating: 4.9,
    ratingCount: 27,
    sold: 4,
    mode: "in_stock",
  },
  {
    slug: "qartal-b2-hiking-shoes",
    name: "Qartal B2 Hiking Shoes",
    category: "footwear",
    brand: "Qartal",
    tagline: tr(
      "Lightweight hydrophobic leather · 2–3 season climbs",
      "Лёгкая гидрофобная кожа · 2–3 сезона",
      "Թեթև ջրակայուն կաշի · 2–3 սեզոնի վերելքներ",
    ),
    specs: "EU 37–47",
    sizes: euSizes(37, 47),
    price: 49900,
    season: "three_season",
    features: ["waterproof"],
    featured: true,
    rating: 4.83,
    ratingCount: 52,
    sold: 5,
    mode: "in_stock",
  },
  {
    slug: "summit-55l-expedition-pack",
    name: "Summit 55L Expedition Pack",
    category: "backpacks",
    brand: "Mountinox",
    tagline: tr(
      "55L alpine load carrier · Ice axe loops & alloy buckles",
      "55 л для альпинизма · Петли для ледоруба и металлические пряжки",
      "55լ ալպյան ուսապարկ · Սառցակացնի օղակներ և մետաղյա ճարմանդներ",
    ),
    specs: "S/M · M/L",
    sizes: ["S/M", "M/L"],
    price: 52000,
    season: "winter",
    features: ["waterproof"],
    featured: true,
    rating: 4.94,
    ratingCount: 18,
    sold: 2,
    mode: "in_stock",
  },
  {
    slug: "stormcrest-3l-gore-tex-jacket",
    name: "Stormcrest 3L GORE-TEX Jacket",
    category: "clothing",
    brand: "Mountinox",
    tagline: tr(
      "Waterproof 3-layer hardshell · Windproof ridge barrier",
      "Водонепроницаемая 3-слойная мембрана · Защита от ветра",
      "Ջրակայուն 3-շերտ բաճկոն · Քամուց պաշտպանություն",
    ),
    specs: "S · M · L · XL",
    sizes: ["S", "M", "L", "XL"],
    price: 68000,
    season: "winter",
    features: ["waterproof"],
    featured: true,
    rating: 4.88,
    ratingCount: 24,
    sold: 2,
    mode: "in_stock",
  },
  {
    slug: "alpine-2p-tent",
    name: "Alpine 2P Tent",
    category: "tents-camping",
    brand: "Mountinox",
    tagline: tr("Your home beyond the treeline.", "Ваш дом за линией леса.", "Ձեր տունը անտառից այն կողմ։"),
    specs: "2P · 3P",
    sizes: ["2P", "3P"],
    price: 76000,
    season: "three_season",
    features: ["waterproof"],
    featured: true,
    rating: 4.9,
    ratingCount: 15,
    sold: 1,
    mode: "in_stock",
  },
  {
    slug: "qartal-alpine-boots",
    name: "Qartal Alpine 1.5-Layer Boots",
    category: "footwear",
    brand: "Qartal",
    tagline: tr(
      "Crampon-fit winter boot · YKK waterproof gaiter",
      "Зимние ботинки под кошки · Водонепроницаемый гамаш YKK",
      "Ձմեռային կոշիկ կատուների համար · YKK ջրակայուն գետր",
    ),
    specs: "EU 40–47",
    sizes: euSizes(40, 47),
    price: 139400,
    season: "winter",
    features: [],
    featured: true,
    rating: 4.29,
    ratingCount: 7,
    sold: 1,
    mode: "preorder",
  },
  {
    slug: "mountinox-locking-carabiner",
    name: "Mountinox Locking Carabiner",
    category: "climbing",
    tagline: tr("Screwgate aluminium · 24 kN", "Алюминий с муфтой · 24 кН", "Պտուտակավոր ալյումին · 24 կՆ"),
    specs: "HMS · One size",
    sizes: ["One size"],
    price: 6500,
    season: "all_season",
    features: ["lightweight"],
    featured: false,
    rating: 4.8,
    ratingCount: 12,
    sold: 3,
    mode: "in_stock",
  },
  {
    slug: "mountinox-trail-headlamp",
    name: "Mountinox Trail Headlamp",
    category: "accessories",
    tagline: tr("350 lm · USB-C rechargeable", "350 лм · Зарядка USB-C", "350 լմ · USB-C լիցքավորում"),
    specs: "350 lm",
    sizes: ["One size"],
    price: 9500,
    season: "all_season",
    features: ["lightweight"],
    featured: false,
    rating: 4.7,
    ratingCount: 9,
    sold: 2,
    mode: "in_stock",
  },
];
