package com.jhadina.calendar

enum class CalendarViewMode { MONTH, WEEK }

/** Calendar-facing state; no Android or Compose types leak into Planning Core. */
data class PlanningCalendarDay(
    val date: String,
    val isToday: Boolean,
    val events: List<PlanningCalendarEvent>,
)

interface PlanningCalendarAdapter {
    fun today(): PlanningCalendarDay
    fun eventsForDate(date: String): List<PlanningCalendarEvent>
    fun selectDate(date: String): PlanningCalendarDay
    fun setViewMode(mode: CalendarViewMode)
    fun viewMode(): CalendarViewMode
}

class DefaultPlanningCalendarAdapter(
    private val events: List<PlanningCalendarEvent>,
    private val todayDate: () -> String,
) : PlanningCalendarAdapter {
    private var selectedDate: String = todayDate()
    private var mode: CalendarViewMode = CalendarViewMode.MONTH

    override fun today(): PlanningCalendarDay = day(todayDate())

    override fun eventsForDate(date: String): List<PlanningCalendarEvent> =
        events.filter { it.date == date }

    override fun selectDate(date: String): PlanningCalendarDay {
        require(Regex("\\d{4}-\\d{2}-\\d{2}").matches(date)) {
            "Invalid calendar date: $date"
        }
        selectedDate = date
        return day(selectedDate)
    }

    override fun setViewMode(mode: CalendarViewMode) {
        this.mode = mode
    }

    override fun viewMode(): CalendarViewMode = mode

    private fun day(date: String): PlanningCalendarDay =
        PlanningCalendarDay(
            date = date,
            isToday = date == todayDate(),
            events = eventsForDate(date),
        )
}
