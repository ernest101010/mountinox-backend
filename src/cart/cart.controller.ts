import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";
import { PrismaService } from "../prisma.service";

class ItemDto {
  @IsInt()
  @Min(1)
  @Type(() => Number)
  qty!: number;
}

@Controller("cart")
export class CartController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  create() {
    return this.prisma.cart.create({ data: {}, include: { items: true } });
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.cart(id);
  }

  @Post(":id/items/:variantId")
  async add(@Param("id") id: string, @Param("variantId") variantId: string, @Body() dto: ItemDto) {
    await this.assertSellable(variantId, dto.qty);
    await this.prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId: id, variantId } },
      create: { cartId: id, variantId, qty: dto.qty },
      update: { qty: dto.qty },
    });
    return this.cart(id);
  }

  @Patch(":id/items/:variantId")
  async update(@Param("id") id: string, @Param("variantId") variantId: string, @Body() dto: ItemDto) {
    await this.assertSellable(variantId, dto.qty);
    await this.prisma.cartItem.update({
      where: { cartId_variantId: { cartId: id, variantId } },
      data: { qty: dto.qty },
    });
    return this.cart(id);
  }

  @Delete(":id/items/:variantId")
  async remove(@Param("id") id: string, @Param("variantId") variantId: string) {
    await this.prisma.cartItem.delete({ where: { cartId_variantId: { cartId: id, variantId } } });
    return this.cart(id);
  }

  private cart(id: string) {
    return this.prisma.cart.findUnique({
      where: { id },
      include: { items: { include: { variant: { include: { product: true } } } } },
    });
  }

  private async assertSellable(variantId: string, qty: number) {
    const variant = await this.prisma.variant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant || !variant.product.published || variant.sellingMode === "out_of_stock") {
      throw new BadRequestException("Variant is not for sale");
    }
    if (variant.sellingMode === "in_stock" && variant.stockQty < qty) {
      throw new BadRequestException("Insufficient stock");
    }
  }
}
