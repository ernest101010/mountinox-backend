import { BadRequestException, Injectable } from "@nestjs/common";
import { OrderStatus, PaymentMethod, Prisma, SellingMode } from "@prisma/client";
import { addDays, cashbackFromSubtotal, Translation } from "../shared";
import { PrismaService } from "../prisma.service";

const orderInclude = {
  lines: true,
  deliveryZone: true,
  clubCode: { include: { partner: true } },
} satisfies Prisma.OrderInclude;

export type CheckoutInput = {
  cartId: string;
  customerName: string;
  phone: string;
  email?: string;
  addressKind: "yerevan" | "marz";
  district: string;
  addressLine: string;
  paymentMethod: "cod" | "bank_transfer";
  deliveryZoneId: string;
  clubCode?: string;
  couponCode?: string;
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  track(number: string, phone: string) {
    return this.prisma.order.findFirst({ where: { number, phone }, include: orderInclude });
  }

  list() {
    return this.prisma.order.findMany({ include: orderInclude, orderBy: { placedAt: "desc" } });
  }

  async checkout(input: CheckoutInput) {
    return this.prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { id: input.cartId },
        include: { items: { include: { variant: { include: { product: true } } } } },
      });
      if (!cart || cart.items.length === 0) throw new BadRequestException("Cart is empty");
      const zone = await tx.deliveryZone.findUnique({ where: { id: input.deliveryZoneId } });
      if (!zone) throw new BadRequestException("Unknown delivery zone");
      const lead = await this.leadDays(tx);
      const club = await this.resolveClub(tx, input.clubCode);
      const placedAt = new Date();
      const lines = [];
      let subtotal = 0;
      for (const item of cart.items) {
        const variant = item.variant;
        if (!variant.product.published || variant.sellingMode === "out_of_stock") {
          throw new BadRequestException(`${variant.sku} is not for sale`);
        }
        if (variant.sellingMode === "in_stock") {
          const updated = await tx.variant.updateMany({
            where: { id: variant.id, sellingMode: "in_stock", stockQty: { gte: item.qty } },
            data: { stockQty: { decrement: item.qty } },
          });
          if (updated.count !== 1) throw new BadRequestException(`Insufficient stock for ${variant.sku}`);
        }
        if (variant.sellingMode === "preorder" && variant.preorderLimit != null) {
          const open = await tx.orderLine.aggregate({
            where: { variantId: variant.id, sellingMode: "preorder", order: { status: { not: "cancelled" } } },
            _sum: { qty: true },
          });
          if ((open._sum.qty ?? 0) + item.qty > variant.preorderLimit) {
            throw new BadRequestException(`Pre-order limit reached for ${variant.sku}`);
          }
        }
        subtotal += variant.priceAmd * item.qty;
        const name = variant.product.name as Translation;
        const label = variant.label as Translation;
        lines.push({
          variantId: variant.id,
          productName: name.en,
          variantLabel: label.en,
          qty: item.qty,
          priceAmd: variant.priceAmd,
          sellingMode: variant.sellingMode,
          promisedShipOn: variant.sellingMode === "preorder" ? addDays(placedAt, lead) : null,
        });
      }
      const number = await this.nextNumber(tx);
      const coupon = await this.resolveCoupon(tx, input.couponCode, subtotal);
      const customer = await this.upsertCustomer(tx, input.customerName, input.phone, input.email);
      const order = await tx.order.create({
        data: {
          number,
          customerName: input.customerName,
          phone: input.phone,
          email: input.email,
          addressKind: input.addressKind,
          district: input.district,
          addressLine: input.addressLine,
          paymentMethod: input.paymentMethod,
          channel: "site",
          status: "new",
          clubCodeId: club?.id,
          cashbackAmd: club ? cashbackFromSubtotal(subtotal, club.partner.cashbackBps) : 0,
          deliveryFeeAmd: zone.feeAmd,
          deliveryZoneId: zone.id,
          customerId: customer.id,
          couponId: coupon?.id,
          discountAmd: coupon?.discountAmd ?? 0,
          placedAt,
          lines: { create: lines },
        },
        include: orderInclude,
      });
      const warehouse = await this.mainWarehouse(tx);
      for (const item of cart.items) {
        if (item.variant.sellingMode === "in_stock") {
          await tx.stockMovement.create({
            data: {
              warehouseId: warehouse.id,
              variantId: item.variant.id,
              qty: -item.qty,
              reason: "order",
              ref: order.number,
            },
          });
        }
      }
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    });
  }

  async recordInstagram(input: {
    customerName: string;
    phone: string;
    placedAt: string;
    status: OrderStatus;
    lines: { variantId: string; qty: number }[];
    clubCode?: string;
    district: string;
    addressLine: string;
    couponCode?: string;
    email?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const club = await this.resolveClub(tx, input.clubCode);
      const placedAt = new Date(input.placedAt);
      const lead = await this.leadDays(tx);
      const lines = [];
      let subtotal = 0;
      for (const line of input.lines) {
        const variant = await tx.variant.findUnique({ where: { id: line.variantId }, include: { product: true } });
        if (!variant) throw new BadRequestException("Unknown variant");
        subtotal += variant.priceAmd * line.qty;
        const name = variant.product.name as Translation;
        const label = variant.label as Translation;
        lines.push({
          variantId: variant.id,
          productName: name.en,
          variantLabel: label.en,
          qty: line.qty,
          priceAmd: variant.priceAmd,
          sellingMode: variant.sellingMode === "out_of_stock" ? SellingMode.in_stock : variant.sellingMode,
          promisedShipOn: variant.sellingMode === "preorder" ? addDays(placedAt, lead) : null,
        });
      }
      const coupon = await this.resolveCoupon(tx, input.couponCode, subtotal);
      const customer = await this.upsertCustomer(tx, input.customerName, input.phone, input.email);
      return tx.order.create({
        data: {
          number: await this.nextNumber(tx),
          customerName: input.customerName,
          phone: input.phone,
          email: input.email,
          addressKind: "yerevan",
          district: input.district,
          addressLine: input.addressLine,
          paymentMethod: PaymentMethod.instagram,
          channel: "instagram",
          status: input.status,
          clubCodeId: club?.id,
          cashbackAmd: club ? cashbackFromSubtotal(subtotal, club.partner.cashbackBps) : 0,
          customerId: customer.id,
          couponId: coupon?.id,
          discountAmd: coupon?.discountAmd ?? 0,
          placedAt,
          lines: { create: lines },
        },
        include: orderInclude,
      });
    });
  }

  async updateStatus(id: string, status: OrderStatus) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id }, include: { lines: true } });
      if (!order) throw new BadRequestException("Unknown order");
      if (status === "cancelled" && order.status !== "cancelled" && order.channel === "site") {
        for (const line of order.lines) {
          if (line.sellingMode === "in_stock") {
            await tx.variant.update({ where: { id: line.variantId }, data: { stockQty: { increment: line.qty } } });
            const warehouse = await this.mainWarehouse(tx);
            await tx.stockMovement.create({
              data: {
                warehouseId: warehouse.id,
                variantId: line.variantId,
                qty: line.qty,
                reason: "cancel",
                ref: order.number,
              },
            });
          }
        }
      }
      return tx.order.update({ where: { id }, data: { status }, include: orderInclude });
    });
  }

  async productsSold(month: string) {
    const [year, monthIndex] = month.split("-").map(Number);
    const start = new Date(Date.UTC(year, monthIndex - 1, 1));
    const end = new Date(Date.UTC(year, monthIndex, 1));
    const lines = await this.prisma.orderLine.findMany({
      where: { order: { placedAt: { gte: start, lt: end }, status: { not: "cancelled" } } },
      include: { variant: { include: { product: true } } },
    });
    const totals = new Map<string, { productId: string; name: string; qty: number }>();
    for (const line of lines) {
      const name = (line.variant.product.name as Translation).en;
      const current = totals.get(line.variant.productId) ?? { productId: line.variant.productId, name, qty: 0 };
      current.qty += line.qty;
      totals.set(line.variant.productId, current);
    }
    return [...totals.values()].sort((a, b) => b.qty - a.qty);
  }

  private async leadDays(tx: Prisma.TransactionClient) {
    const setting = await tx.setting.findUnique({ where: { key: "preorderLeadDays" } });
    return Number(setting?.value ?? 7);
  }

  private async resolveClub(tx: Prisma.TransactionClient, code?: string) {
    if (!code) return null;
    const clubCode = await tx.clubCode.findFirst({
      where: { code, active: true },
      include: { partner: true },
    });
    if (!clubCode || clubCode.partner.validUntil < new Date()) {
      throw new BadRequestException("Invalid club code");
    }
    return clubCode;
  }

  private async upsertCustomer(tx: Prisma.TransactionClient, name: string, phone: string, email?: string) {
    return tx.customer.upsert({
      where: { phone },
      create: { name, phone, email },
      update: { name, ...(email ? { email } : {}) },
    });
  }

  private async resolveCoupon(tx: Prisma.TransactionClient, code: string | undefined, subtotal: number) {
    if (!code) return null;
    const coupon = await tx.coupon.findFirst({ where: { code, active: true } });
    if (!coupon) throw new BadRequestException("Invalid coupon");
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now) throw new BadRequestException("Coupon is not active yet");
    if (coupon.endsAt && coupon.endsAt < now) throw new BadRequestException("Coupon has expired");
    const discountAmd =
      coupon.kind === "percent" ? Math.round((subtotal * coupon.value) / 100) : Math.min(coupon.value, subtotal);
    return { id: coupon.id, discountAmd };
  }

  private async mainWarehouse(tx: Prisma.TransactionClient) {
    const existing = await tx.warehouse.findFirst({ orderBy: { name: "asc" } });
    if (existing) return existing;
    return tx.warehouse.create({ data: { name: "Main" } });
  }

  private async nextNumber(tx: Prisma.TransactionClient) {
    const count = await tx.order.count();
    return `MNX-${1001 + count}`;
  }
}
