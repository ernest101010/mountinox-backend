import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma, SellingMode } from "@prisma/client";
import { Translation } from "../shared";
import { PrismaService } from "../prisma.service";
import { CatalogFilters, CatalogSort, queryCatalog } from "./catalog-query";

const productInclude = {
  category: true,
  brand: true,
  images: { orderBy: { sort: "asc" as const } },
  variants: { orderBy: { sku: "asc" as const }, include: { images: true } },
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  categories() {
    return this.prisma.category.findMany({ orderBy: { sort: "asc" } });
  }

  async products(query: { mode?: SellingMode; q?: string }) {
    const rows = await this.prisma.product.findMany({
      where: { published: true },
      include: productInclude,
      orderBy: { slug: "asc" },
    });
    return rows.filter((product) => {
      const matchesMode = query.mode
        ? product.variants.some((variant) => variant.sellingMode === query.mode)
        : true;
      if (!matchesMode) return false;
      if (!query.q) return true;
      const haystack = JSON.stringify(product.name).toLowerCase();
      return haystack.includes(query.q.toLowerCase());
    });
  }

  async catalog(filters: CatalogFilters, options: { sort: CatalogSort; page: number; pageSize: number }) {
    const rows = await this.prisma.product.findMany({ where: { published: true }, include: productInclude });
    return queryCatalog(rows, filters, options);
  }

  productBySlug(slug: string) {
    return this.prisma.product.findFirst({
      where: { slug, published: true },
      include: productInclude,
    });
  }

  adminProducts() {
    return this.prisma.product.findMany({ include: productInclude, orderBy: { slug: "asc" } });
  }

  async createCategory(data: { slug: string; name: Translation; sort: number; parentId?: string }) {
    return this.prisma.category.create({ data });
  }

  async updateCategory(id: string, data: { slug?: string; name?: Translation; sort?: number; parentId?: string | null }) {
    return this.prisma.category.update({ where: { id }, data });
  }

  async deleteCategory(id: string) {
    const count = await this.prisma.product.count({ where: { categoryId: id } });
    if (count > 0) throw new BadRequestException("Category still has products");
    return this.prisma.category.delete({ where: { id } });
  }

  createProduct(data: {
    categoryId: string;
    slug: string;
    name: Translation;
    description: Translation;
    published: boolean;
    brandId?: string | null;
  }) {
    return this.prisma.product.create({ data, include: productInclude });
  }

  updateProduct(
    id: string,
    data: Partial<{
      categoryId: string;
      slug: string;
      name: Translation;
      description: Translation;
      published: boolean;
      brandId: string | null;
    }>,
  ) {
    return this.prisma.product.update({ where: { id }, data, include: productInclude });
  }

  async deleteProduct(id: string) {
    return this.prisma.product.delete({ where: { id } });
  }

  createVariant(data: {
    productId: string;
    sku: string;
    priceAmd: number;
    stockQty: number;
    sellingMode: SellingMode;
    preorderLimit?: number;
    barcode?: string;
    costAmd?: number;
    label: Translation;
  }) {
    return this.prisma.variant.create({ data });
  }

  updateVariant(
    id: string,
    data: Partial<{
      sku: string;
      priceAmd: number;
      stockQty: number;
      sellingMode: SellingMode;
      preorderLimit: number | null;
      barcode: string | null;
      costAmd: number;
      label: Translation;
    }>,
  ) {
    return this.prisma.variant.update({ where: { id }, data });
  }

  deleteVariant(id: string) {
    return this.prisma.variant.delete({ where: { id } });
  }

  createImage(data: { productId: string; variantId?: string; url: string; sort: number }) {
    return this.prisma.productImage.create({ data });
  }

  deleteImage(id: string) {
    return this.prisma.productImage.delete({ where: { id } });
  }
}

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;
