import { TimelineCalendarAdapter } from "@jhadina/planning-core";

export default function CalendarPage() {
  // The production composition root will hydrate this from Planning Core.
  // Keep the screen deterministic until that wiring is supplied.
  const calendar = new TimelineCalendarAdapter([]);
  const today = calendar.today();

  return (
    <main aria-label="Jhadina Calendar">
      <header>
        <h1>Calendar</h1>
        <p>{today.date}</p>
      </header>
      <section aria-label="Today">
        <h2>Today</h2>
        {today.events.length === 0 ? (
          <p>No planning events scheduled for today.</p>
        ) : (
          <ul>
            {today.events.map((event) => (
              <li key={event.id}>{event.title}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
