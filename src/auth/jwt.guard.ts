import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import jwt from "jsonwebtoken";

export type AuthPayload = { sub: string; email: string; role: "owner" | "manager" | "staff" };

@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { admin?: AuthPayload }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException();
    }
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET ?? "dev-only-change-me");
      if (typeof payload === "string" || !payload.sub || !payload.email) {
        throw new UnauthorizedException();
      }
      const role = payload.role === "manager" || payload.role === "staff" ? payload.role : "owner";
      request.admin = { sub: String(payload.sub), email: String(payload.email), role };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
