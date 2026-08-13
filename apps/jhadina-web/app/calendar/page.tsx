"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { TimelineEvent } from "@jhadina/planning-core";

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageContent />
    </Suspense>
  );
}

function CalendarPageContent() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("planId");
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [view, setView] = useState<"month" | "week">("month");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    const controller = new AbortController();

    fetch(`/api/planning/timeline?planId=${encodeURIComponent(planId)}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json()).error ?? "Unable to load timeline");
        return response.json() as Promise<{ events: TimelineEvent[] }>;
      })
      .then((data) => setEvents(data.events))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Unable to load timeline");
      });

    return () => controller.abort();
  }, [planId]);

  const selectedEvents = useMemo(
    () => events.filter((event) => event.timestamp.slice(0, 10) === selectedDate),
    [events, selectedDate],
  );

  const today = dateKey(new Date());

  return (
    <main aria-label="Jhadina Calendar">
      <header>
        <h1>Calendar</h1>
        <p>{selectedDate}</p>
        <button type="button" onClick={() => setSelectedDate(today)}>Today</button>
        <button type="button" aria-pressed={view === "month"} onClick={() => setView("month")}>Month</button>
        <button type="button" aria-pressed={view === "week"} onClick={() => setView("week")}>Week</button>
      </header>

      {!planId && <p>Choose a planning plan to load its timeline.</p>}
      {error && <p role="alert">{error}</p>}
      {planId && !error && <p>{view === "month" ? "Month view" : "Week view"} · Planning timeline</p>}

      <section aria-label="Selected day">
        <h2>{selectedDate === today ? "Today" : selectedDate}</h2>
        {selectedEvents.length === 0 ? (
          <p>No planning events scheduled for this date.</p>
        ) : (
          <ul>
            {selectedEvents.map((event) => (
              <li key={event.id}>
                <strong>{event.title}</strong>
                {event.description ? <span> — {event.description}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
