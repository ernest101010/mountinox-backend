import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { Season, SellingMode } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { CatalogSort } from "./catalog-query";
import { CatalogService } from "./catalog.service";

class ProductQuery {
  @IsOptional()
  @IsEnum(SellingMode)
  mode?: SellingMode;

  @IsOptional()
  @IsString()
  q?: string;
}

const csv = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.split(",").map((item) => item.trim()).filter(Boolean) : value;
const flag = ({ value }: { value: unknown }) => value === true || value === "true" || value === "1";
const sorts: CatalogSort[] = ["recommended", "price_asc", "price_desc", "rating", "name"];

class CatalogQuery {
  @IsOptional() @Transform(csv) @IsString({ each: true }) category: string[] = [];
  @IsOptional() @Transform(csv) @IsString({ each: true }) brand: string[] = [];
  @IsOptional() @Transform(csv) @IsString({ each: true }) size: string[] = [];
  @IsOptional() @Transform(csv) @IsEnum(Season, { each: true }) season: Season[] = [];
  @IsOptional() @Transform(csv) @IsString({ each: true }) features: string[] = [];
  @IsOptional() @Transform(flag) @IsBoolean() inStock = false;
  @IsOptional() @Transform(flag) @IsBoolean() featured = false;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxPrice?: number;
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(sorts) sort: CatalogSort = "recommended";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) pageSize = 9;
}

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  categories() {
    return this.catalog.categories();
  }

  @Get("products")
  products(@Query() query: ProductQuery) {
    return this.catalog.products(query);
  }

  @Get("catalog")
  catalogPage(@Query() query: CatalogQuery) {
    return this.catalog.catalog(
      {
        categories: query.category,
        brands: query.brand,
        sizes: query.size,
        seasons: query.season,
        features: query.features,
        inStock: query.inStock,
        featured: query.featured,
        minPrice: query.minPrice,
        maxPrice: query.maxPrice,
        q: query.q,
      },
      { sort: query.sort, page: query.page, pageSize: query.pageSize },
    );
  }

  @Get("products/:slug")
  async product(@Param("slug") slug: string) {
    const product = await this.catalog.productBySlug(slug);
    if (!product) throw new NotFoundException();
    return product;
  }
}
