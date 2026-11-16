import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Controller("club-codes")
export class ClubCodesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(":code")
  async check(@Param("code") code: string) {
    const clubCode = await this.prisma.clubCode.findFirst({
      where: { code, active: true },
      include: { partner: true },
    });
    if (!clubCode || clubCode.partner.validUntil < new Date()) {
      throw new NotFoundException("Invalid club code");
    }
    return { code: clubCode.code, partner: clubCode.partner.name, validUntil: clubCode.partner.validUntil };
  }
}
