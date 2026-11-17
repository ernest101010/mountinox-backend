import { BadRequestException, Injectable } from "@nestjs/common";
import { CouponKind, Prisma, ReturnStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Translation } from "../shared";
import { PrismaService } from "../prisma.service";

const orderMoney = {
  lines: true,
  returns: true,
} satisfies Prisma.OrderInclude;

@Injectable()
export class OpsService {
  constructor(private readonly prisma: PrismaService) {}

  brands() {
    return this.prisma.brand.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  }

  createBrand(name: string) {
    return this.prisma.brand.create({ data: { name } });
  }

  updateBrand(id: string, name: string) {
    return this.prisma.brand.update({ where: { id }, data: { name } });
  }

  deleteBrand(id: string) {
    return this.prisma.brand.delete({ where: { id } });
  }

  async bulkPrice(input: { variantIds: string[]; priceAmd?: number; percent?: number }) {
    const variants = await this.prisma.variant.findMany({ where: { id: { in: input.variantIds } } });
    if (variants.length === 0) throw new BadRequestException("No variants");
    await this.prisma.$transaction(
      variants.map((variant) => {
        const priceAmd =
          input.priceAmd != null
            ? input.priceAmd
            : Math.max(0, Math.round(variant.priceAmd * (1 + (input.percent ?? 0) / 100)));
        return this.prisma.variant.update({ where: { id: variant.id }, data: { priceAmd } });
      }),
    );
    return { updated: variants.length };
  }

  async summary() {
    const [orders, variants, expenses, returns] = await Promise.all([
      this.prisma.order.findMany({ include: { lines: true }, orderBy: { placedAt: "desc" } }),
      this.prisma.variant.findMany({ include: { product: true }, orderBy: { stockQty: "asc" } }),
      this.prisma.expense.findMany(),
      this.prisma.returnOrder.findMany({ where: { status: { in: ["received", "refunded"] } } }),
    ]);
    const active = orders.filter((order) => order.status !== "cancelled");
    const revenue = active.reduce((sum, order) => sum + this.orderNet(order), 0);
    const cost = active.reduce((sum, order) => sum + this.orderCost(order, variants), 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amountAmd, 0);
    const refunds = returns.reduce((sum, item) => sum + item.refundAmd, 0);
    const lowStock = variants
      .filter((variant) => variant.sellingMode === "in_stock" && variant.stockQty <= 5)
      .slice(0, 8)
      .map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        stockQty: variant.stockQty,
        name: (variant.product.name as Translation).en,
      }));
    const months = this.monthly(active);
    return {
      revenueAmd: revenue,
      profitAmd: revenue - cost - expenseTotal - refunds,
      orders: active.length,
      customers: new Set(active.map((order) => order.phone)).size,
      expensesAmd: expenseTotal,
      refundsAmd: refunds,
      lowStock,
      months,
      recent: orders.slice(0, 8).map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        customerName: order.customerName,
        totalAmd: this.orderNet(order),
        placedAt: order.placedAt,
      })),
    };
  }

  warehouses() {
    return this.prisma.warehouse.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { movements: true } } } });
  }

  createWarehouse(name: string) {
    return this.prisma.warehouse.create({ data: { name } });
  }

  movements() {
    return this.prisma.stockMovement.findMany({
      include: { warehouse: true, variant: { include: { product: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  lowStock(threshold = 5) {
    return this.prisma.variant.findMany({
      where: { sellingMode: "in_stock", stockQty: { lte: threshold } },
      include: { product: true },
      orderBy: { stockQty: "asc" },
    });
  }

  async customers(query: { minOrders?: number; minSpend?: number }) {
    const rows = await this.prisma.customer.findMany({
      include: { orders: { include: { lines: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows
      .map((customer) => this.customerView(customer))
      .filter((customer) => customer.orders >= (query.minOrders ?? 0) && customer.lifetimeAmd >= (query.minSpend ?? 0));
  }

  async customer(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { orders: { include: { lines: true, returns: true }, orderBy: { placedAt: "desc" } } },
    });
    if (!customer) throw new BadRequestException("Unknown customer");
    return {
      ...this.customerView(customer),
      email: customer.email,
      ordersList: customer.orders.map((order) => ({
        id: order.id,
        number: order.number,
        status: order.status,
        placedAt: order.placedAt,
        totalAmd: this.orderNet(order),
      })),
    };
  }

  suppliers() {
    return this.prisma.supplier.findMany({ orderBy: { name: "asc" } });
  }

  createSupplier(data: { name: string; email?: string; phone?: string; notes?: string }) {
    return this.prisma.supplier.create({ data: { ...data, notes: data.notes ?? "" } });
  }

  updateSupplier(id: string, data: { name?: string; email?: string; phone?: string; notes?: string }) {
    return this.prisma.supplier.update({ where: { id }, data });
  }

  purchases() {
    return this.prisma.purchaseOrder.findMany({
      include: { supplier: true, warehouse: true, lines: { include: { variant: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createPurchase(input: {
    supplierId: string;
    warehouseId: string;
    lines: { variantId: string; qty: number; costAmd: number }[];
  }) {
    const count = await this.prisma.purchaseOrder.count();
    return this.prisma.purchaseOrder.create({
      data: {
        number: `PO-${1001 + count}`,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        status: "ordered",
        lines: { create: input.lines },
      },
      include: { lines: true },
    });
  }

  async receivePurchase(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.findUnique({ where: { id }, include: { lines: true } });
      if (!order) throw new BadRequestException("Unknown purchase");
      if (order.status === "received") throw new BadRequestException("Already received");
      if (order.status === "cancelled") throw new BadRequestException("Cancelled purchase");
      for (const line of order.lines) {
        await tx.variant.update({
          where: { id: line.variantId },
          data: { stockQty: { increment: line.qty }, costAmd: line.costAmd },
        });
        await tx.stockMovement.create({
          data: {
            warehouseId: order.warehouseId,
            variantId: line.variantId,
            qty: line.qty,
            reason: "purchase",
            ref: order.number,
          },
        });
      }
      return tx.purchaseOrder.update({ where: { id }, data: { status: "received" }, include: { lines: true } });
    });
  }

  returns() {
    return this.prisma.returnOrder.findMany({
      include: { order: true, lines: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async createReturn(input: {
    orderId: string;
    restock: boolean;
    note?: string;
    lines: { orderLineId: string; qty: number }[];
  }) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: input.orderId }, include: { lines: true } });
      if (!order) throw new BadRequestException("Unknown order");
      let refundAmd = 0;
      for (const line of input.lines) {
        const source = order.lines.find((item) => item.id === line.orderLineId);
        if (!source || line.qty < 1 || line.qty > source.qty) throw new BadRequestException("Invalid return line");
        refundAmd += source.priceAmd * line.qty;
      }
      const created = await tx.returnOrder.create({
        data: {
          orderId: order.id,
          restock: input.restock,
          note: input.note ?? "",
          refundAmd,
          status: input.restock ? "received" : "requested",
          lines: { create: input.lines },
        },
        include: { lines: true },
      });
      if (input.restock) {
        const warehouse = await this.mainWarehouse(tx);
        for (const line of input.lines) {
          const source = order.lines.find((item) => item.id === line.orderLineId);
          if (!source || source.sellingMode !== "in_stock") continue;
          await tx.variant.update({ where: { id: source.variantId }, data: { stockQty: { increment: line.qty } } });
          await tx.stockMovement.create({
            data: {
              warehouseId: warehouse.id,
              variantId: source.variantId,
              qty: line.qty,
              reason: "return",
              ref: order.number,
            },
          });
        }
      }
      return created;
    });
  }

  updateReturn(id: string, status: ReturnStatus, refundAmd?: number) {
    return this.prisma.returnOrder.update({
      where: { id },
      data: { status, ...(refundAmd != null ? { refundAmd } : {}) },
    });
  }

  coupons() {
    return this.prisma.coupon.findMany({ orderBy: { code: "asc" } });
  }

  createCoupon(data: { code: string; kind: CouponKind; value: number; startsAt?: string; endsAt?: string }) {
    return this.prisma.coupon.create({
      data: {
        code: data.code,
        kind: data.kind,
        value: data.value,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
      },
    });
  }

  updateCoupon(id: string, data: { active?: boolean; value?: number }) {
    return this.prisma.coupon.update({ where: { id }, data });
  }

  expenses() {
    return this.prisma.expense.findMany({ orderBy: { spentOn: "desc" } });
  }

  createExpense(data: { title: string; amountAmd: number; spentOn?: string; note?: string }) {
    return this.prisma.expense.create({
      data: {
        title: data.title,
        amountAmd: data.amountAmd,
        spentOn: data.spentOn ? new Date(data.spentOn) : new Date(),
        note: data.note ?? "",
      },
    });
  }

  deleteExpense(id: string) {
    return this.prisma.expense.delete({ where: { id } });
  }

  async finance(from?: string, to?: string) {
    const range = this.range(from, to);
    const [orders, expenses, returns] = await Promise.all([
      this.prisma.order.findMany({ where: { placedAt: range, status: { not: "cancelled" } }, include: { lines: true } }),
      this.prisma.expense.findMany({ where: { spentOn: range } }),
      this.prisma.returnOrder.findMany({ where: { createdAt: range, status: { in: ["received", "refunded"] } } }),
    ]);
    const variants = await this.prisma.variant.findMany();
    const revenue = orders.reduce((sum, order) => sum + this.orderNet(order), 0);
    const cogs = orders.reduce((sum, order) => sum + this.orderCost(order, variants), 0);
    const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amountAmd, 0);
    const refunds = returns.reduce((sum, item) => sum + item.refundAmd, 0);
    return {
      from: range.gte,
      to: range.lt,
      orders: orders.length,
      revenueAmd: revenue,
      cogsAmd: cogs,
      expensesAmd: expenseTotal,
      refundsAmd: refunds,
      profitAmd: revenue - cogs - expenseTotal - refunds,
    };
  }

  users() {
    return this.prisma.adminUser.findMany({
      select: { id: true, email: true, name: true, role: true },
      orderBy: { email: "asc" },
    });
  }

  async createUser(data: { email: string; name: string; password: string; role: "owner" | "manager" | "staff" }) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.adminUser.create({
      data: { email: data.email, name: data.name, role: data.role, passwordHash },
      select: { id: true, email: true, name: true, role: true },
    });
  }

  updateUser(id: string, data: { name?: string; role?: "owner" | "manager" | "staff" }) {
    return this.prisma.adminUser.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
  }

  deleteUser(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException("You cannot remove yourself");
    return this.prisma.adminUser.delete({ where: { id } });
  }

  private customerView(customer: {
    id: string;
    name: string;
    phone: string;
    orders: { status: string; lines: { priceAmd: number; qty: number; variantId: string }[]; discountAmd: number; deliveryFeeAmd: number }[];
  }) {
    const open = customer.orders.filter((order) => order.status !== "cancelled");
    const lifetimeAmd = open.reduce((sum, order) => sum + this.orderNet(order), 0);
    return { id: customer.id, name: customer.name, phone: customer.phone, orders: open.length, lifetimeAmd };
  }

  private orderNet(order: { lines: { priceAmd: number; qty: number }[]; discountAmd: number; deliveryFeeAmd: number }) {
    const subtotal = order.lines.reduce((sum, line) => sum + line.priceAmd * line.qty, 0);
    return subtotal - order.discountAmd + order.deliveryFeeAmd;
  }

  private orderCost(
    order: { lines: { qty: number; variantId: string }[] },
    variants: { id: string; costAmd: number }[],
  ) {
    return order.lines.reduce((sum, line) => {
      const variant = variants.find((item) => item.id === line.variantId);
      return sum + (variant?.costAmd ?? 0) * line.qty;
    }, 0);
  }

  private monthly(orders: { placedAt: Date; lines: { priceAmd: number; qty: number }[]; discountAmd: number; deliveryFeeAmd: number; status: string }[]) {
    const buckets = new Map<string, number>();
    for (const order of orders) {
      const key = order.placedAt.toISOString().slice(0, 7);
      buckets.set(key, (buckets.get(key) ?? 0) + this.orderNet(order));
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, revenueAmd]) => ({ month, revenueAmd }));
  }

  private range(from?: string, to?: string): Prisma.DateTimeFilter {
    const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
    const end = to ? new Date(to) : new Date();
    end.setDate(end.getDate() + 1);
    return { gte: start, lt: end };
  }

  private async mainWarehouse(tx: Prisma.TransactionClient) {
    const existing = await tx.warehouse.findFirst({ orderBy: { name: "asc" } });
    if (existing) return existing;
    return tx.warehouse.create({ data: { name: "Main" } });
  }
}
