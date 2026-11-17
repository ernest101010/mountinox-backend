import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { SellingMode } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { CatalogService } from "./catalog.service";

class TranslationDto {
  @IsString() hy!: string;
  @IsString() ru!: string;
  @IsString() en!: string;
}

class CategoryDto {
  @IsString() @MinLength(1) slug!: string;
  @IsObject() name!: TranslationDto;
  @Type(() => Number) @IsInt() sort!: number;
  @IsOptional() @IsString() parentId?: string;
}

class ProductDto {
  @IsString() categoryId!: string;
  @IsString() slug!: string;
  @IsObject() name!: TranslationDto;
  @IsObject() description!: TranslationDto;
  @IsBoolean() published!: boolean;
  @IsOptional() @IsString() brandId?: string;
}

class VariantDto {
  @IsString() productId!: string;
  @IsString() sku!: string;
  @Type(() => Number) @IsInt() @Min(0) priceAmd!: number;
  @Type(() => Number) @IsInt() @Min(0) stockQty!: number;
  @IsEnum(SellingMode) sellingMode!: SellingMode;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) preorderLimit?: number;
  @IsOptional() @IsString() barcode?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) costAmd?: number;
  @IsObject() label!: TranslationDto;
}

class ImageDto {
  @IsString() productId!: string;
  @IsOptional() @IsString() variantId?: string;
  @IsString() url!: string;
  @Type(() => Number) @IsInt() sort!: number;
}

@Controller("admin")
@UseGuards(JwtGuard)
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  categories() {
    return this.catalog.categories();
  }

  @Post("categories")
  createCategory(@Body() dto: CategoryDto) {
    return this.catalog.createCategory(dto);
  }

  @Patch("categories/:id")
  updateCategory(@Param("id") id: string, @Body() dto: Partial<CategoryDto>) {
    return this.catalog.updateCategory(id, dto);
  }

  @Delete("categories/:id")
  deleteCategory(@Param("id") id: string) {
    return this.catalog.deleteCategory(id);
  }

  @Get("products")
  products() {
    return this.catalog.adminProducts();
  }

  @Post("products")
  createProduct(@Body() dto: ProductDto) {
    return this.catalog.createProduct(dto);
  }

  @Patch("products/:id")
  updateProduct(@Param("id") id: string, @Body() dto: Partial<ProductDto>) {
    return this.catalog.updateProduct(id, dto);
  }

  @Delete("products/:id")
  deleteProduct(@Param("id") id: string) {
    return this.catalog.deleteProduct(id);
  }

  @Post("variants")
  createVariant(@Body() dto: VariantDto) {
    return this.catalog.createVariant(dto);
  }

  @Patch("variants/:id")
  updateVariant(@Param("id") id: string, @Body() dto: Partial<VariantDto>) {
    return this.catalog.updateVariant(id, dto);
  }

  @Delete("variants/:id")
  deleteVariant(@Param("id") id: string) {
    return this.catalog.deleteVariant(id);
  }

  @Post("images")
  createImage(@Body() dto: ImageDto) {
    return this.catalog.createImage(dto);
  }

  @Delete("images/:id")
  deleteImage(@Param("id") id: string) {
    return this.catalog.deleteImage(id);
  }
}
