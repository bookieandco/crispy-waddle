package com.jhadina.calendar

import kotlinx.datetime.LocalDate

/** Presentation model consumed by the concrete Kizitonwose day cell. */
data class KizitonwoseDayModel(
    val date: LocalDate,
    val selected: Boolean,
    val today: Boolean,
    val eventCount: Int,
    val events: List<PlanningCalendarEvent>,
)

fun PlanningCalendarAdapter.dayModel(
    date: LocalDate,
    selectedDate: LocalDate,
): KizitonwoseDayModel {
    val events = eventsForDate(date.toString())
    return KizitonwoseDayModel(
        date = date,
        selected = date == selectedDate,
        today = date == today().date,
        eventCount = events.size,
        events = events,
    )
}
