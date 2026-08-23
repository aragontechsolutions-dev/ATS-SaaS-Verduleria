import { IsObject } from 'class-validator';

/** El admin manda el config completo; el backend lo normaliza (whitelist). */
export class SaveLandingDto {
  @IsObject()
  config!: Record<string, unknown>;
}
