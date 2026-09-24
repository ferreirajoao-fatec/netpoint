import { Module } from '@nestjs/common';
import { SwitchesController } from './switches.controller';

@Module({ controllers: [SwitchesController] })
export class SwitchesModule {}
