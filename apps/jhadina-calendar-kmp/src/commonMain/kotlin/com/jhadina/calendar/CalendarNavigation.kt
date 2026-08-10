package com.jhadina.calendar

import kotlinx.datetime.LocalDate
import kotlinx.datetime.Clock
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

/** Platform-neutral navigation state for a Kizitonwose-backed calendar. */
data class CalendarNavigationState(
    val mode: CalendarViewMode,
    val anchorDate: LocalDate,
    val selectedDate: LocalDate,
)

class PlanningCalendarNavigation(
    private val adapter: PlanningCalendarAdapter,
    private val today: LocalDate = Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).date,
) {
    private var state = CalendarNavigationState(
        mode = CalendarViewMode.MONTH,
        anchorDate = today,
        selectedDate = today,
    )

    fun state(): CalendarNavigationState = state

    fun showMonth() {
        state = state.copy(mode = CalendarViewMode.MONTH)
    }

    fun showWeek() {
        state = state.copy(mode = CalendarViewMode.WEEK)
    }

    fun today(): CalendarNavigationState {
        val key = today.toString()
        adapter.selectDate(key)
        state = state.copy(anchorDate = today, selectedDate = today)
        return state
    }

    fun select(date: LocalDate): CalendarNavigationState {
        adapter.selectDate(date.toString())
        state = state.copy(anchorDate = date, selectedDate = date)
        return state
    }

    fun next(): CalendarNavigationState {
        val date = if (state.mode == CalendarViewMode.MONTH) {
            state.anchorDate.plus(DatePeriod(months = 1))
        } else {
            state.anchorDate.plus(DatePeriod(days = 7))
        }
        state = state.copy(anchorDate = date)
        return state
    }

    fun previous(): CalendarNavigationState {
        val date = if (state.mode == CalendarViewMode.MONTH) {
            state.anchorDate.minus(DatePeriod(months = 1))
        } else {
            state.anchorDate.minus(DatePeriod(days = 7))
        }
        state = state.copy(anchorDate = date)
        return state
    }
}
