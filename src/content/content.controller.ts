import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsObject, IsString, Min } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { PrismaService } from "../prisma.service";

class TranslationDto {
  @IsString() hy!: string;
  @IsString() ru!: string;
  @IsString() en!: string;
}

class ZoneDto {
  @IsObject() name!: TranslationDto;
  @Type(() => Number) @IsInt() @Min(0) feeAmd!: number;
  @Type(() => Number) @IsInt() @Min(0) etaDays!: number;
}

class PageDto {
  @IsString() slug!: string;
  @IsObject() title!: TranslationDto;
  @IsObject() body!: TranslationDto;
}

class SettingDto {
  @IsString() key!: string;
  @IsString() value!: string;
}

@Controller()
export class ContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("pages/:slug")
  async page(@Param("slug") slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException();
    return page;
  }

  @Get("delivery-zones")
  zones() {
    return this.prisma.deliveryZone.findMany({ orderBy: { feeAmd: "asc" } });
  }

  @Get("settings/public")
  async settings() {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }
}

@Controller("admin")
@UseGuards(JwtGuard)
export class AdminContentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("zones")
  zones() {
    return this.prisma.deliveryZone.findMany();
  }

  @Post("zones")
  createZone(@Body() dto: ZoneDto) {
    return this.prisma.deliveryZone.create({ data: { ...dto, name: { ...dto.name } } });
  }

  @Patch("zones/:id")
  updateZone(@Param("id") id: string, @Body() dto: ZoneDto) {
    return this.prisma.deliveryZone.update({ where: { id }, data: { ...dto, name: { ...dto.name } } });
  }

  @Delete("zones/:id")
  deleteZone(@Param("id") id: string) {
    return this.prisma.deliveryZone.delete({ where: { id } });
  }

  @Get("pages")
  pages() {
    return this.prisma.page.findMany();
  }

  @Post("pages")
  createPage(@Body() dto: PageDto) {
    return this.prisma.page.create({ data: { slug: dto.slug, title: { ...dto.title }, body: { ...dto.body } } });
  }

  @Patch("pages/:id")
  updatePage(@Param("id") id: string, @Body() dto: PageDto) {
    return this.prisma.page.update({
      where: { id },
      data: { slug: dto.slug, title: { ...dto.title }, body: { ...dto.body } },
    });
  }

  @Get("settings")
  settings() {
    return this.prisma.setting.findMany();
  }

  @Post("settings")
  upsertSetting(@Body() dto: SettingDto) {
    return this.prisma.setting.upsert({ where: { key: dto.key }, create: dto, update: { value: dto.value } });
  }
}
