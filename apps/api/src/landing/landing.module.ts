import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { LandingController, PublicLandingController } from './landing.controller';
import { LandingService } from './landing.service';

@Module({
  controllers: [LandingController, PublicLandingController],
  providers: [LandingService, RolesGuard],
})
export class LandingModule {}
