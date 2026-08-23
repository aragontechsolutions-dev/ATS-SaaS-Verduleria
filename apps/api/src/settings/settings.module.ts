import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, RolesGuard],
})
export class SettingsModule {}
