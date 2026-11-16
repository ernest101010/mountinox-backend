import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { AuthController } from "./auth/auth.controller";
import { CatalogService } from "./catalog/catalog.service";
import { CatalogController } from "./catalog/catalog.controller";
import { AdminCatalogController } from "./catalog/admin-catalog.controller";
import { CartController } from "./cart/cart.controller";
import { OrdersService } from "./orders/orders.service";
import { OrdersController } from "./orders/orders.controller";
import { AdminOrdersController } from "./orders/admin-orders.controller";
import { ClubCodesController } from "./clubs/club-codes.controller";
import { AdminClubsController } from "./clubs/admin-clubs.controller";
import { AdminContentController, ContentController } from "./content/content.controller";

@Module({
  controllers: [
    AuthController,
    CatalogController,
    AdminCatalogController,
    CartController,
    OrdersController,
    AdminOrdersController,
    ClubCodesController,
    AdminClubsController,
    ContentController,
    AdminContentController,
  ],
  providers: [PrismaService, CatalogService, OrdersService],
})
export class AppModule {}
