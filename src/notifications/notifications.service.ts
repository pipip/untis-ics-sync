import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import { UntisService } from 'src/untis/untis.service';
import { NtfyService } from './ntfy.service';

@Injectable()
export class NotificationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsService.name);

  private previousState = new Map<number, Map<number, string | undefined>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly untisService: UntisService,
    private readonly ntfyService: NtfyService,
  ) {}

  async onApplicationBootstrap() {
    const classIds = this.getConfiguredClassIds();

    await this.ntfyService.send(
      '✅ untis-ics-sync gestartet',
      classIds.length > 0
        ? `Service läuft, Absagen-Check aktiv für Klasse(n): ${classIds.join(', ')}.`
        : `Service läuft, aber NOTIFY_CLASS_IDS ist nicht gesetzt – kein Absagen-Check aktiv.`,
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkForCancellations() {
    const classIds = this.getConfiguredClassIds();

    if (classIds.length === 0) {
      this.logger.debug(
        'NOTIFY_CLASS_IDS ist nicht gesetzt, überspringe Check.',
      );
      return;
    }

    for (const classId of classIds) {
      await this.checkClass(classId);
    }
  }

  private getConfiguredClassIds(): number[] {
    return this.configService
      .get<string>('NOTIFY_CLASS_IDS', '')
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
  }

  private async checkClass(classId: number) {
    const before = this.configService.get<number>(
      'LESSONS_TIMETABLE_BEFORE',
      7,
    );
    const after = this.configService.get<number>('LESSONS_TIMETABLE_AFTER', 14);

    const lessons = await this.untisService.fetchTimetable(
      before,
      after,
      classId,
    );

    const previous = this.previousState.get(classId) ?? new Map();
    const current = new Map<number, string | undefined>();

    for (const lesson of lessons) {
      current.set(lesson.id, lesson.code);

      const wasCancelled = previous.get(lesson.id) === 'cancelled';
      const isCancelled = lesson.code === 'cancelled';

      // Nur benachrichtigen, wenn wir den Termin vorher schon kannten (nicht beim ersten Lauf)
      // UND er neu von "nicht abgesagt" auf "abgesagt" gewechselt ist.
      if (isCancelled && !wasCancelled && previous.has(lesson.id)) {
        const subject =
          lesson.su?.map((s) => s.longname).join(', ') ?? 'Unterricht';
        const date = moment(lesson.date.toString(), 'YYYYMMDD').format(
          'DD.MM.YYYY',
        );
        const t = String(lesson.startTime).padStart(4, '0');
        const time = `${t.slice(0, -2)}:${t.slice(-2)}`;

        await this.ntfyService.send(
          `❌ ${subject} entfällt`,
          `${subject} am ${date} um ${time} Uhr wurde abgesagt.`,
        );
      }
    }

    this.previousState.set(classId, current);
  }
}
