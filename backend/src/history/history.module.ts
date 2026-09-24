import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('history')
class HistoryController {
  constructor(private readonly history: HistoryService) {}

  @Get()
  list(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.history.list({ entityType, entityId, take: take ? Number(take) : undefined, skip: skip ? Number(skip) : undefined });
  }
}

@Global()
@Module({ controllers: [HistoryController], providers: [HistoryService], exports: [HistoryService] })
export class HistoryModule {}
