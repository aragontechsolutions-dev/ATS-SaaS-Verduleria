import { Global, Module } from '@nestjs/common';
import { RolesGuard } from '../tenant/roles.guard';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/** Global para que cualquier servicio pueda inyectar AuditService y loguear. */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, RolesGuard],
  exports: [AuditService],
})
export class AuditModule {}
