import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ConfigService } from '@nestjs/config';
import * as moment from 'moment';
import { UntisService } from 'src/untis/untis.service';
import { NtfyService } from './ntfy.service';

interface LessonSnapshot {
  code?: string;
  rooms: string;
  title: string;
}

@Injectable()
export class NotificationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NotificationsService.name);

  private previousState = new Map<number, Map<number, LessonSnapshot>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly untisService: UntisService,
    private readonly ntfyService: NtfyService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  async onApplicationBootstrap() {
    this.registerCronJob();

    const classIds = this.getConfiguredClassIds();
    await this.ntfyService.send(
      '✅ untis-ics-sync gestartet',
      classIds.length > 0
        ? `Service läuft, Absagen-/Änderungs-Check aktiv für Klasse(n): ${classIds.join(', ')}.`
        : `Service läuft, aber NOTIFY_CLASS_IDS ist nicht gesetzt – kein Check aktiv.`,
    );
  }

  private registerCronJob() {
    const cronExpression = this.configService.get<string>(
      'NOTIFY_CRON_EXPRESSION',
      '*/5 6-22 * * *',
    );

    this.logger.log(
      `Registriere Check mit Cron-Expression: "${cronExpression}"`,
    );

    const job = new CronJob(cronExpression, () => this.checkForCancellations());
    this.schedulerRegistry.addCronJob('cancellation-check', job);
    job.start();
  }

  async checkForCancellations() {
    const classIds = this.getConfiguredClassIds();

    if (classIds.length === 0) {
      this.logger.debug(
        'NOTIFY_CLASS_IDS ist nicht gesetzt, überspringe Check.',
      );
      return;
    }

    for (const classId of classIds) {
      try {
        await this.checkClass(classId);
      } catch (e) {
        this.logger.error(`Check für Klasse ${classId} fehlgeschlagen: ${e}`);
        await this.ntfyService.send(
          '⚠️ untis-ics-sync: Check fehlgeschlagen',
          `Klasse ${classId}: ${e instanceof Error ? e.message : e}`,
        );
      }
    }
  }

  private getConfiguredClassIds(): number[] {
    return this.configService
      .get<string>('NOTIFY_CLASS_IDS', '')
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id));
  }

  private isEnabled(key: string, defaultValue = true): boolean {
    const value = this.configService.get<string>(key);
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  private buildTitle(lesson: any): string {
    return lesson.lstext
      ? `${lesson.su?.map((s) => s.longname).join(', ')} (${lesson.lstext})`
      : (lesson.su?.map((s) => s.longname).join(', ') ?? 'Unbenannte Stunde');
  }

  private buildRooms(lesson: any): string {
    return lesson.ro?.map((r) => r.longname).join(', ') ?? '';
  }

  private async checkClass(classId: number) {
    const before = this.configService.get<number>(
      'LESSONS_TIMETABLE_BEFORE',
      7,
    );
    const after = this.configService.get<number>('LESSONS_TIMETABLE_AFTER', 14);

    const notifyOnCancel = this.isEnabled('NOTIFY_ON_CANCEL');
    const notifyOnRoomChange = this.isEnabled('NOTIFY_ON_ROOM_CHANGE');
    const notifyOnTitleChange = this.isEnabled('NOTIFY_ON_TITLE_CHANGE');

    const lessons = await this.untisService.fetchTimetable(
      before,
      after,
      classId,
    );

    const previous = this.previousState.get(classId) ?? new Map();
    const current = new Map<number, LessonSnapshot>();

    for (const lesson of lessons) {
      const snapshot: LessonSnapshot = {
        code: lesson.code,
        rooms: this.buildRooms(lesson),
        title: this.buildTitle(lesson),
      };
      current.set(lesson.id, snapshot);

      const prev = previous.get(lesson.id);
      if (!prev) {
        // Erster bekannter Zustand für diese Lesson -> keine Vergleichsbasis, nichts melden
        continue;
      }

      const date = moment(lesson.date.toString(), 'YYYYMMDD').format(
        'DD.MM.YYYY',
      );
      const t = String(lesson.startTime).padStart(4, '0');
      const time = `${t.slice(0, -2)}:${t.slice(-2)}`;

      const wasCancelled = prev.code === 'cancelled';
      const isCancelled = snapshot.code === 'cancelled';

      if (isCancelled && !wasCancelled) {
        if (notifyOnCancel) {
          await this.ntfyService.send(
            `❌ ${snapshot.title} entfällt`,
            `${snapshot.title} am ${date} um ${time} Uhr wurde abgesagt.`,
          );
        }
        continue; // Bei Absage andere Änderungen nicht zusätzlich melden
      }

      if (!isCancelled) {
        if (notifyOnRoomChange && prev.rooms !== snapshot.rooms) {
          await this.ntfyService.send(
            `🚪 Raumänderung: ${snapshot.title}`,
            `${snapshot.title} am ${date} um ${time} Uhr: ${prev.rooms || 'kein Raum'} → ${snapshot.rooms || 'kein Raum'}`,
          );
        }

        if (notifyOnTitleChange && prev.title !== snapshot.title) {
          await this.ntfyService.send(
            `✏️ Änderung: ${prev.title}`,
            `„${prev.title}" am ${date} um ${time} Uhr wurde zu „${snapshot.title}" geändert.`,
          );
        }
      }
    }

    this.previousState.set(classId, current);
  }
}
