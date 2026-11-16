import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from "class-validator";
import { Response } from "express";
import { JwtGuard } from "../auth/jwt.guard";
import { PrismaService } from "../prisma.service";

class PartnerDto {
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsIn(["blue", "gold"]) accent!: "blue" | "gold";
  @Type(() => Number) @IsInt() @Min(0) cashbackBps!: number;
  @IsDateString() validUntil!: string;
  @IsString() message!: string;
}

@Controller("admin/clubs")
@UseGuards(JwtGuard)
export class AdminClubsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query("month") month?: string) {
    const value = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
    const [year, monthIndex] = value.split("-").map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 1));
    const partners = await this.prisma.clubPartner.findMany({
      include: { codes: { orderBy: { createdAt: "desc" } } },
      orderBy: { name: "asc" },
    });
    const orders = await this.prisma.order.findMany({
      where: { clubCodeId: { not: null }, status: { not: "cancelled" } },
      include: { lines: true, clubCode: true },
    });
    const cards = partners.map((partner) => {
      const codeIds = new Set(partner.codes.map((code) => code.id));
      const partnerOrders = orders.filter((order) => order.clubCodeId && codeIds.has(order.clubCodeId));
      const monthOrders = partnerOrders.filter((order) => order.placedAt >= start && order.placedAt < end);
      const sum = (rows: typeof partnerOrders) => rows.reduce((total, order) => total + order.cashbackAmd, 0);
      return {
        ...partner,
        activeCode: partner.codes.find((code) => code.active) ?? null,
        ordersThisMonth: monthOrders.length,
        totalOrders: partnerOrders.length,
        cashbackThisMonth: sum(monthOrders),
        cashbackAllTime: sum(partnerOrders),
        monthOrders,
      };
    });
    return {
      month: value,
      clubOrdersThisMonth: cards.reduce((total, card) => total + card.ordersThisMonth, 0),
      cashbackOwed: cards.reduce((total, card) => total + card.cashbackThisMonth, 0),
      totalClubOrders: cards.reduce((total, card) => total + card.totalOrders, 0),
      partners: cards,
    };
  }

  @Post()
  async create(@Body() dto: PartnerDto) {
    return this.prisma.clubPartner.create({
      data: { ...dto, validUntil: new Date(dto.validUntil) },
    });
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: Partial<PartnerDto>) {
    return this.prisma.clubPartner.update({
      where: { id },
      data: { ...dto, validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined },
    });
  }

  @Post(":id/codes")
  async rotate(@Param("id") id: string, @Body() body: { code: string }) {
    if (!body.code) throw new BadRequestException("Code is required");
    return this.prisma.$transaction(async (tx) => {
      await tx.clubCode.updateMany({ where: { partnerId: id, active: true }, data: { active: false } });
      return tx.clubCode.create({ data: { partnerId: id, code: body.code, active: true } });
    });
  }

  @Get(":id/export")
  async export(@Param("id") id: string, @Query("month") month: string, @Res() res: Response) {
    const value = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
    const [year, monthIndex] = value.split("-").map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 1));
    const partner = await this.prisma.clubPartner.findUnique({ where: { id }, include: { codes: true } });
    if (!partner) throw new BadRequestException("Unknown partner");
    const orders = await this.prisma.order.findMany({
      where: {
        clubCodeId: { in: partner.codes.map((code) => code.id) },
        placedAt: { gte: start, lt: end },
        status: { not: "cancelled" },
      },
      include: { lines: true },
    });
    const header = "number,placedAt,customer,phone,status,cashbackAmd,totalAmd";
    const rows = orders.map((order) => {
      const total = order.lines.reduce((sum, line) => sum + line.priceAmd * line.qty, 0);
      return [order.number, order.placedAt.toISOString(), order.customerName, order.phone, order.status, order.cashbackAmd, total].join(",");
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${partner.slug}-${value}.csv"`);
    res.send([header, ...rows].join("\n"));
  }
}
