import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { SellingMode } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { CatalogService } from "./catalog.service";

class ProductQuery {
  @IsOptional()
  @IsEnum(SellingMode)
  mode?: SellingMode;

  @IsOptional()
  @IsString()
  q?: string;
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

  @Get("products/:slug")
  async product(@Param("slug") slug: string) {
    const product = await this.catalog.productBySlug(slug);
    if (!product) throw new NotFoundException();
    return product;
  }
}
