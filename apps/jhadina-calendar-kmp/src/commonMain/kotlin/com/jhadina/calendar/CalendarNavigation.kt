package com.jhadina.calendar

import java.time.LocalDate

/** Platform-neutral navigation state for a Kizitonwose-backed calendar. */
data class CalendarNavigationState(
    val mode: CalendarViewMode,
    val anchorDate: LocalDate,
    val selectedDate: LocalDate,
)

class PlanningCalendarNavigation(
    private val adapter: PlanningCalendarAdapter,
    private val today: LocalDate = LocalDate.now(),
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
            state.anchorDate.plusMonths(1)
        } else {
            state.anchorDate.plusWeeks(1)
        }
        return state.copy(anchorDate = date)
            .also { state = it }
    }

    fun previous(): CalendarNavigationState {
        val date = if (state.mode == CalendarViewMode.MONTH) {
            state.anchorDate.minusMonths(1)
        } else {
            state.anchorDate.minusWeeks(1)
        }
        return state.copy(anchorDate = date)
            .also { state = it }
    }
}
