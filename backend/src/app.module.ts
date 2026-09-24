import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from './prisma/prisma.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { HistoryModule } from './history/history.module';
import { StructureModule } from './structure/structure.module';
import { ConnectionsModule } from './connections/connections.module';
import { DevicesModule } from './devices/devices.module';
import { PointsModule } from './points/points.module';
import { SwitchesModule } from './switches/switches.module';
import { RacksModule } from './racks/racks.module';
import { SearchModule } from './search/search.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ExcelModule } from './excel/excel.module';

@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'netpoint-dev-secret',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as any },
    }),
    PrismaModule,
    HistoryModule,
    AuthModule,
    UsersModule,
    StructureModule,
    ConnectionsModule,
    DevicesModule,
    PointsModule,
    SwitchesModule,
    RacksModule,
    SearchModule,
    DashboardModule,
    ExcelModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
