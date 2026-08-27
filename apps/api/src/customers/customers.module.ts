import { Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { CustomersController } from './customers.controller';
import { PosCustomersController } from './pos-customers.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController, PosCustomersController],
  providers: [CustomersService, RolesGuard],
})
export class CustomersModule {}
