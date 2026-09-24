import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { ConnectionsService } from './connections.service';

@Controller('trace')
class TraceController {
  constructor(private readonly connections: ConnectionsService) {}

  /** GET /trace?deviceId=… | pointId=… | switchPortId=… | patchPanelPortId=… | connectionId=… */
  @Get()
  trace(
    @Query('deviceId') deviceId?: string,
    @Query('pointId') pointId?: string,
    @Query('switchPortId') switchPortId?: string,
    @Query('patchPanelPortId') patchPanelPortId?: string,
    @Query('connectionId') connectionId?: string,
  ) {
    return this.connections.trace({ deviceId, pointId, switchPortId, patchPanelPortId, connectionId });
  }
}

@Global()
@Module({ controllers: [TraceController], providers: [ConnectionsService], exports: [ConnectionsService] })
export class ConnectionsModule {}
