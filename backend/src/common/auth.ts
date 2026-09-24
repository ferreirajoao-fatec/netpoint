import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export interface AuthUser {
  sub: string;
  name: string;
  email: string;
  role: Role;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Rota acessível sem token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restringe a rota aos perfis informados. Sem @Roles, qualquer usuário autenticado acessa. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

/** Perfis que podem cadastrar e alterar conexões. */
export const CanEdit = () => Roles(Role.ADMIN, Role.TECHNICIAN);
/** Somente administradores (excluir, importar, exportar, gerenciar usuários). */
export const AdminOnly = () => Roles(Role.ADMIN);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
