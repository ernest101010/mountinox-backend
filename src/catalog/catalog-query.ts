import { Season } from "@prisma/client";
import type { ProductWithRelations } from "./catalog.service";

export type CatalogSort = "recommended" | "price_asc" | "price_desc" | "rating" | "name";

export type CatalogFilters = {
  categories: string[];
  brands: string[];
  sizes: string[];
  seasons: Season[];
  features: string[];
  inStock: boolean;
  featured: boolean;
  minPrice?: number;
  maxPrice?: number;
  q?: string;
};

type Dimension = "category" | "brand" | "size" | "season" | "feature" | "stock" | "price" | "featured" | "q";

const letterSizes = ["XS", "S", "M", "L", "XL", "XXL", "S/M", "M/L", "L/XL"];

export function priceOf(product: ProductWithRelations): number {
  return Math.min(...product.variants.map((variant) => variant.priceAmd));
}

export function isInStock(product: ProductWithRelations): boolean {
  return product.variants.some((variant) => variant.sellingMode === "in_stock" && variant.stockQty > 0);
}

function sizeLabels(product: ProductWithRelations): string[] {
  return product.variants.map((variant) => (variant.label as { en?: string }).en ?? "").filter(Boolean);
}

const predicates: Record<Dimension, (product: ProductWithRelations, filters: CatalogFilters) => boolean> = {
  category: (product, filters) => !filters.categories.length || filters.categories.includes(product.category.slug),
  brand: (product, filters) => !filters.brands.length || filters.brands.includes(product.brand?.name ?? ""),
  size: (product, filters) => !filters.sizes.length || sizeLabels(product).some((size) => filters.sizes.includes(size)),
  season: (product, filters) => !filters.seasons.length || (!!product.season && filters.seasons.includes(product.season)),
  feature: (product, filters) => filters.features.every((feature) => product.features.includes(feature)),
  stock: (product, filters) => !filters.inStock || isInStock(product),
  price: (product, filters) => {
    const price = priceOf(product);
    return (filters.minPrice === undefined || price >= filters.minPrice) && (filters.maxPrice === undefined || price <= filters.maxPrice);
  },
  featured: (product, filters) => !filters.featured || product.featured,
  q: (product, filters) => !filters.q || JSON.stringify(product.name).toLowerCase().includes(filters.q.toLowerCase()),
};

function matches(product: ProductWithRelations, filters: CatalogFilters, except?: Dimension) {
  return (Object.keys(predicates) as Dimension[]).every(
    (dimension) => dimension === except || predicates[dimension](product, filters),
  );
}

function countBy(products: ProductWithRelations[], keysOf: (product: ProductWithRelations) => string[]) {
  const counts = new Map<string, number>();
  for (const product of products) {
    for (const key of new Set(keysOf(product))) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function compareSizes(a: string, b: string) {
  const letterA = letterSizes.indexOf(a);
  const letterB = letterSizes.indexOf(b);
  if (letterA !== -1 || letterB !== -1) {
    return (letterA === -1 ? Infinity : letterA) - (letterB === -1 ? Infinity : letterB);
  }
  return a.localeCompare(b, "en", { numeric: true });
}

export function buildFacets(products: ProductWithRelations[], filters: CatalogFilters) {
  const without = (dimension: Dimension) => products.filter((product) => matches(product, filters, dimension));
  const categoryCounts = countBy(without("category"), (product) => [product.category.slug]);
  const brandCounts = countBy(without("brand"), (product) => (product.brand ? [product.brand.name] : []));
  const sizeCounts = countBy(without("size"), sizeLabels);
  const seasonCounts = countBy(without("season"), (product) => (product.season ? [product.season] : []));
  const featureCounts = countBy(without("feature"), (product) => product.features);
  const prices = products.map(priceOf);

  return {
    brands: [...brandCounts].map(([name, count]) => ({ value: name, count })).sort((a, b) => b.count - a.count),
    categoryCounts: Object.fromEntries(categoryCounts),
    categoryTotal: without("category").length,
    sizes: [...sizeCounts].map(([value, count]) => ({ value, count })).sort((a, b) => compareSizes(a.value, b.value)),
    seasons: [...seasonCounts].map(([value, count]) => ({ value, count })),
    features: [...featureCounts].map(([value, count]) => ({ value, count })),
    inStockCount: without("stock").filter(isInStock).length,
    price: { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 },
  };
}

const sorters: Record<CatalogSort, (a: ProductWithRelations, b: ProductWithRelations) => number> = {
  recommended: (a, b) => Number(b.featured) - Number(a.featured) || b.ratingCount - a.ratingCount,
  price_asc: (a, b) => priceOf(a) - priceOf(b),
  price_desc: (a, b) => priceOf(b) - priceOf(a),
  rating: (a, b) => (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0),
  name: (a, b) => a.slug.localeCompare(b.slug),
};

export function queryCatalog(
  products: ProductWithRelations[],
  filters: CatalogFilters,
  options: { sort: CatalogSort; page: number; pageSize: number },
) {
  const filtered = products.filter((product) => matches(product, filters)).sort(sorters[options.sort]);
  const start = (options.page - 1) * options.pageSize;
  return {
    items: filtered.slice(start, start + options.pageSize),
    total: filtered.length,
    page: options.page,
    pageSize: options.pageSize,
    facets: buildFacets(products, filters),
  };
}
