import { Body, Controller, Get, NotFoundException, Post, Query } from "@nestjs/common";
import { IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { OrdersService } from "./orders.service";

class CheckoutDto {
  @IsString() cartId!: string;
  @IsString() @MinLength(2) customerName!: string;
  @Matches(/^\+374\d{8}$/) phone!: string;
  @IsOptional() @IsString() email?: string;
  @IsIn(["yerevan", "marz"]) addressKind!: "yerevan" | "marz";
  @IsString() district!: string;
  @IsString() addressLine!: string;
  @IsIn(["cod", "bank_transfer"]) paymentMethod!: "cod" | "bank_transfer";
  @IsString() deliveryZoneId!: string;
  @IsOptional() @IsString() clubCode?: string;
}

@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post("checkout")
  checkout(@Body() dto: CheckoutDto) {
    return this.orders.checkout(dto);
  }

  @Get("orders/track")
  async track(@Query("number") number: string, @Query("phone") phone: string) {
    const order = await this.orders.track(number, phone);
    if (!order) throw new NotFoundException();
    return order;
  }
}
