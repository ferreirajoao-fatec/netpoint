import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const payload: AuthUser = { sub: user.id, name: user.name, email: user.email, role: user.role };
    return { accessToken: await this.jwt.signAsync(payload), user: publicUser(user) };
  }

  async me(userId: string) {
    return publicUser(await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }));
  }

  async changePassword(userId: string, current: string, next: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(current, user.passwordHash))) {
      throw new BadRequestException('Senha atual incorreta');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(next, 10) } });
    return { ok: true };
  }
}

export const publicUser = (u: { id: string; name: string; email: string; role: string; active?: boolean }) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active ?? true,
});
