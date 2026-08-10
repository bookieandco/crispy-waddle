import type { ID, TimelineEvent } from "./index";

export interface CalendarDay {
  date: string;
  isToday: boolean;
  events: TimelineEvent[];
}

export interface PlanningCalendarAdapter {
  today(): CalendarDay;
  eventsForDate(date: string): TimelineEvent[];
  selectDate(date: string): CalendarDay;
}

export class TimelineCalendarAdapter implements PlanningCalendarAdapter {
  private selectedDate: string;

  constructor(private readonly timeline: TimelineEvent[], today = new Date()) {
    this.selectedDate = toDateKey(today);
  }

  today(): CalendarDay {
    return this.day(toDateKey(new Date()));
  }

  eventsForDate(date: string): TimelineEvent[] {
    return this.timeline.filter((event) => event.timestamp.slice(0, 10) === date);
  }

  selectDate(date: string): CalendarDay {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error(`Invalid calendar date: ${date}`);
    }
    this.selectedDate = date;
    return this.day(date);
  }

  private day(date: string): CalendarDay {
    const today = toDateKey(new Date());
    return {
      date,
      isToday: date === today,
      events: this.eventsForDate(date),
    };
  }
}

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
