import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthPayload } from "./jwt.guard";

export const ROLES_KEY = "roles";
export const Roles = (...roles: AuthPayload["role"][]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AuthPayload["role"][]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<{ admin?: AuthPayload }>();
    if (!request.admin || !roles.includes(request.admin.role)) {
      throw new ForbiddenException("Insufficient role");
    }
    return true;
  }
}
