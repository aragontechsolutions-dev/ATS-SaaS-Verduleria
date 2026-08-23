import { SetMetadata } from '@nestjs/common';
import type { Role } from '@ats/database';

export const ROLES_KEY = 'roles';

/** Restringe un handler/controlador a ciertos roles del tenant. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
