import { Module } from '@nestjs/common';
import { PublicStoreController } from './store.controller';
import { StoreService } from './store.service';

@Module({
  controllers: [PublicStoreController],
  providers: [StoreService],
})
export class StoreModule {}
