import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lugar, LugarSchema } from './lugar.schema';
import { LugarReview, LugarReviewSchema } from './lugar-review.schema';
import { LugaresService } from './lugares.service';
import { LugaresController } from './lugares.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lugar.name, schema: LugarSchema },
      { name: LugarReview.name, schema: LugarReviewSchema },
    ]),
  ],
  controllers: [LugaresController],
  providers: [LugaresService],
  exports: [LugaresService],
})
export class LugaresModule {}
