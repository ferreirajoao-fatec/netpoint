import { Module } from '@nestjs/common';
import { PatchPanelsController, RacksController } from './racks.controller';

@Module({ controllers: [RacksController, PatchPanelsController] })
export class RacksModule {}
