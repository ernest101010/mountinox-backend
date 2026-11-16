import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { OrderStatus } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { OrdersService } from "./orders.service";

class LineDto {
  @IsString() variantId!: string;
  @Type(() => Number) @IsInt() @Min(1) qty!: number;
}

class InstagramOrderDto {
  @IsString() customerName!: string;
  @IsString() phone!: string;
  @IsDateString() placedAt!: string;
  @IsEnum(OrderStatus) status!: OrderStatus;
  @IsString() district!: string;
  @IsString() addressLine!: string;
  @IsOptional() @IsString() clubCode?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => LineDto) lines!: LineDto[];
}

class StatusDto {
  @IsEnum(OrderStatus) status!: OrderStatus;
}

@Controller("admin")
@UseGuards(JwtGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get("orders")
  list(@Query("channel") channel?: string) {
    return this.orders.list().then((orders) =>
      channel === "site" || channel === "instagram" ? orders.filter((order) => order.channel === channel) : orders,
    );
  }

  @Post("orders")
  create(@Body() dto: InstagramOrderDto) {
    return this.orders.recordInstagram(dto);
  }

  @Patch("orders/:id")
  status(@Param("id") id: string, @Body() dto: StatusDto) {
    return this.orders.updateStatus(id, dto.status);
  }

  @Get("dashboard/products-sold")
  productsSold(@Query("month") month?: string) {
    const value = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
    return this.orders.productsSold(value);
  }
}
