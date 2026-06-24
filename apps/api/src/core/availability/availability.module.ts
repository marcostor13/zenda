import { Module } from '@nestjs/common';
import { AvailabilityRegistry } from './availability.registry';

@Module({
  providers: [AvailabilityRegistry],
  exports: [AvailabilityRegistry],
})
export class AvailabilityModule {}
