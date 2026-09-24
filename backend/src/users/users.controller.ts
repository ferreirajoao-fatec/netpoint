import { Body, Controller, Delete, Get, Param, Patch, Post, BadRequestException, ConflictException } from '@nestjs/common';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly, AuthUser, CurrentUser } from '../common/auth';
import { publicUser } from '../auth/auth.service';
import { HistoryService } from '../history/history.service';

class CreateUserDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail({}, { message: 'Informe um e-mail válido' }) email: string;
  @IsString() @MinLength(6, { message: 'A senha deve ter ao menos 6 caracteres' }) password: string;
  @IsEnum(Role) role: Role;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MinLength(6, { message: 'A senha deve ter ao menos 6 caracteres' }) password?: string;
}

@AdminOnly()
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService, private readonly history: HistoryService) {}

  @Get()
  async list() {
    const users = await this.prisma.user.findMany({ orderBy: { name: 'asc' } });
    return users.map(publicUser);
  }

  @Post()
  async create(@Body() dto: CreateUserDto, @CurrentUser() me: AuthUser) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Já existe um usuário com este e-mail');
    }
    const user = await this.prisma.user.create({
      data: { name: dto.name.trim(), email, role: dto.role, passwordHash: await bcrypt.hash(dto.password, 10) },
    });
    await this.history.log(me, { entityType: 'User', entityId: user.id, entityLabel: user.name, action: 'CREATE', newValue: user.role });
    return publicUser(user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() me: AuthUser) {
    if (id === me.sub && (dto.active === false || (dto.role && dto.role !== Role.ADMIN))) {
      throw new BadRequestException('Você não pode remover o próprio acesso de administrador');
    }
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        role: dto.role,
        active: dto.active,
        passwordHash: dto.password ? await bcrypt.hash(dto.password, 10) : undefined,
      },
    });
    await this.history.logDiff(me, 'User', id, user.name, before, user, { name: 'Nome', role: 'Perfil', active: 'Ativo' });
    return publicUser(user);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    if (id === me.sub) throw new BadRequestException('Você não pode excluir o próprio usuário');
    const user = await this.prisma.user.delete({ where: { id } });
    await this.history.log(me, { entityType: 'User', entityId: id, entityLabel: user.name, action: 'DELETE' });
    return { ok: true };
  }
}
