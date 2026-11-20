import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { IsEmail, IsIn } from "class-validator";
import { PrismaService } from "../prisma.service";

class SubscribeDto {
  @IsEmail() email!: string;
  @IsIn(["hy", "ru", "en"]) locale!: string;
}

@Controller("newsletter")
export class NewsletterController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(204)
  async subscribe(@Body() dto: SubscribeDto) {
    const email = dto.email.trim().toLowerCase();
    await this.prisma.subscriber.upsert({
      where: { email },
      create: { email, locale: dto.locale },
      update: { locale: dto.locale },
    });
  }
}
