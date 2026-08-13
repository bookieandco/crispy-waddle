package com.jhadina.calendar

import kotlinx.datetime.LocalDate

/**
 * Bridge state for the concrete Kizitonwose pager. The actual library state
 * stays in this Android presentation layer; Planning Core only sees dates.
 */
data class CalendarPagingState(
    val firstVisibleDate: LocalDate,
    val selectedDate: LocalDate,
    val mode: CalendarViewMode,
)

class KizitonwosePagingBridge(
    private val navigation: PlanningCalendarNavigation,
) {
    fun state(): CalendarPagingState {
        val state = navigation.state()
        return CalendarPagingState(
            firstVisibleDate = state.anchorDate,
            selectedDate = state.selectedDate,
            mode = state.mode,
        )
    }

    fun onDateClicked(date: LocalDate): CalendarPagingState {
        navigation.select(date)
        return state()
    }

    fun onTodayClicked(): CalendarPagingState {
        navigation.today()
        return state()
    }

    fun onPageForward(): CalendarPagingState {
        navigation.next()
        return state()
    }

    fun onPageBackward(): CalendarPagingState {
        navigation.previous()
        return state()
    }
}
