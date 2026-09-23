import { Module } from '@nestjs/common';
import { UntisModule } from 'src/untis/untis.module';
import { NotificationsService } from './notifications.service';
import { NtfyService } from './ntfy.service';

@Module({
  imports: [UntisModule],
  providers: [NotificationsService, NtfyService],
})
export class NotificationsModule {}
