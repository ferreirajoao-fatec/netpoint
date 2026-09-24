import { Global, Module } from '@nestjs/common';
import { DepartmentsController, LocationsController, RoomsController } from './structure.controller';
import { StructureService } from './structure.service';

@Global()
@Module({
  controllers: [LocationsController, RoomsController, DepartmentsController],
  providers: [StructureService],
  exports: [StructureService],
})
export class StructureModule {}
