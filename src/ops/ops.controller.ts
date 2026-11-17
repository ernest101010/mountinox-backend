import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { CouponKind, ReturnStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Response } from "express";
import { JwtGuard } from "../auth/jwt.guard";
import { Roles, RolesGuard } from "../auth/roles.guard";
import { OpsService } from "./ops.service";

class NameDto {
  @IsString() @MinLength(1) name!: string;
}

class BulkPriceDto {
  @IsArray() @ArrayMinSize(1) @IsString({ each: true }) variantIds!: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) priceAmd?: number;
  @IsOptional() @Type(() => Number) @IsInt() percent?: number;
}

class PurchaseLineDto {
  @IsString() variantId!: string;
  @Type(() => Number) @IsInt() @Min(1) qty!: number;
  @Type(() => Number) @IsInt() @Min(0) costAmd!: number;
}

class PurchaseDto {
  @IsString() supplierId!: string;
  @IsString() warehouseId!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseLineDto) lines!: PurchaseLineDto[];
}

class SupplierDto {
  @IsString() name!: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() notes?: string;
}

class ReturnLineDto {
  @IsString() orderLineId!: string;
  @Type(() => Number) @IsInt() @Min(1) qty!: number;
}

class ReturnDto {
  @IsString() orderId!: string;
  @IsBoolean() restock!: boolean;
  @IsOptional() @IsString() note?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => ReturnLineDto) lines!: ReturnLineDto[];
}

class ReturnStatusDto {
  @IsEnum(ReturnStatus) status!: ReturnStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) refundAmd?: number;
}

class CouponDto {
  @IsString() code!: string;
  @IsEnum(CouponKind) kind!: CouponKind;
  @Type(() => Number) @IsInt() @Min(1) value!: number;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}

class CouponPatchDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) value?: number;
}

class ExpenseDto {
  @IsString() title!: string;
  @Type(() => Number) @IsInt() @Min(0) amountAmd!: number;
  @IsOptional() @IsDateString() spentOn?: string;
  @IsOptional() @IsString() note?: string;
}

class UserDto {
  @IsEmail() email!: string;
  @IsString() name!: string;
  @IsString() @MinLength(8) password!: string;
  @IsEnum(["owner", "manager", "staff"]) role!: "owner" | "manager" | "staff";
}

class UserPatchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(["owner", "manager", "staff"]) role?: "owner" | "manager" | "staff";
}

@Controller("admin")
@UseGuards(JwtGuard, RolesGuard)
export class OpsController {
  constructor(private readonly ops: OpsService) {}

  @Get("dashboard/summary")
  summary() {
    return this.ops.summary();
  }

  @Get("brands")
  brands() {
    return this.ops.brands();
  }

  @Post("brands")
  createBrand(@Body() dto: NameDto) {
    return this.ops.createBrand(dto.name);
  }

  @Patch("brands/:id")
  updateBrand(@Param("id") id: string, @Body() dto: NameDto) {
    return this.ops.updateBrand(id, dto.name);
  }

  @Delete("brands/:id")
  deleteBrand(@Param("id") id: string) {
    return this.ops.deleteBrand(id);
  }

  @Post("pricing/bulk")
  bulk(@Body() dto: BulkPriceDto) {
    return this.ops.bulkPrice(dto);
  }

  @Get("warehouses")
  warehouses() {
    return this.ops.warehouses();
  }

  @Post("warehouses")
  createWarehouse(@Body() dto: NameDto) {
    return this.ops.createWarehouse(dto.name);
  }

  @Get("movements")
  movements() {
    return this.ops.movements();
  }

  @Get("inventory/low-stock")
  lowStock(@Query("threshold") threshold?: string) {
    return this.ops.lowStock(threshold ? Number(threshold) : 5);
  }

  @Get("customers")
  customers(@Query("minOrders") minOrders?: string, @Query("minSpend") minSpend?: string) {
    return this.ops.customers({
      minOrders: minOrders ? Number(minOrders) : undefined,
      minSpend: minSpend ? Number(minSpend) : undefined,
    });
  }

  @Get("customers/:id")
  customer(@Param("id") id: string) {
    return this.ops.customer(id);
  }

  @Get("suppliers")
  suppliers() {
    return this.ops.suppliers();
  }

  @Post("suppliers")
  createSupplier(@Body() dto: SupplierDto) {
    return this.ops.createSupplier(dto);
  }

  @Patch("suppliers/:id")
  updateSupplier(@Param("id") id: string, @Body() dto: SupplierDto) {
    return this.ops.updateSupplier(id, dto);
  }

  @Get("purchases")
  purchases() {
    return this.ops.purchases();
  }

  @Post("purchases")
  createPurchase(@Body() dto: PurchaseDto) {
    return this.ops.createPurchase(dto);
  }

  @Post("purchases/:id/receive")
  receive(@Param("id") id: string) {
    return this.ops.receivePurchase(id);
  }

  @Get("returns")
  returns() {
    return this.ops.returns();
  }

  @Post("returns")
  createReturn(@Body() dto: ReturnDto) {
    return this.ops.createReturn(dto);
  }

  @Patch("returns/:id")
  patchReturn(@Param("id") id: string, @Body() dto: ReturnStatusDto) {
    return this.ops.updateReturn(id, dto.status, dto.refundAmd);
  }

  @Get("coupons")
  coupons() {
    return this.ops.coupons();
  }

  @Post("coupons")
  createCoupon(@Body() dto: CouponDto) {
    return this.ops.createCoupon(dto);
  }

  @Patch("coupons/:id")
  patchCoupon(@Param("id") id: string, @Body() dto: CouponPatchDto) {
    return this.ops.updateCoupon(id, dto);
  }

  @Get("expenses")
  expenses() {
    return this.ops.expenses();
  }

  @Post("expenses")
  createExpense(@Body() dto: ExpenseDto) {
    return this.ops.createExpense(dto);
  }

  @Delete("expenses/:id")
  @Roles("owner", "manager")
  deleteExpense(@Param("id") id: string) {
    return this.ops.deleteExpense(id);
  }

  @Get("finance/report")
  report(@Query("from") from?: string, @Query("to") to?: string) {
    return this.ops.finance(from, to);
  }

  @Get("finance/export")
  async export(@Query("from") from: string | undefined, @Query("to") to: string | undefined, @Res() res: Response) {
    const report = await this.ops.finance(from, to);
    const csv = ["metric,amountAmd", `revenue,${report.revenueAmd}`, `cogs,${report.cogsAmd}`, `expenses,${report.expensesAmd}`, `refunds,${report.refundsAmd}`, `profit,${report.profitAmd}`].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=finance.csv");
    res.send(csv);
  }

  @Get("users")
  @Roles("owner")
  users() {
    return this.ops.users();
  }

  @Post("users")
  @Roles("owner")
  createUser(@Body() dto: UserDto) {
    return this.ops.createUser(dto);
  }

  @Patch("users/:id")
  @Roles("owner")
  updateUser(@Param("id") id: string, @Body() dto: UserPatchDto) {
    return this.ops.updateUser(id, dto);
  }

  @Delete("users/:id")
  @Roles("owner")
  deleteUser(@Param("id") id: string, @Req() req: { admin: { sub: string } }) {
    return this.ops.deleteUser(id, req.admin.sub);
  }
}
