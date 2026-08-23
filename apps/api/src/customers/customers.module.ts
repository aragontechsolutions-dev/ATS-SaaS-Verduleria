import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, RolesGuard],
})
export class CustomersModule {}
