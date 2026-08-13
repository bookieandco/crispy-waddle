package com.jhadina.calendar

import kotlinx.datetime.LocalDate

/**
 * Dependency-isolated binding surface for the Kizitonwose calendar composables.
 *
 * This keeps library-specific pager state out of Planning Core while providing
 * the exact callbacks the concrete Compose implementation must bind:
 * selection, today, forward/backward paging, and day-cell event models.
 */
data class KizitonwoseCalendarBinding(
    val state: CalendarPagingState,
    val days: List<KizitonwoseDayModel>,
    val onDateSelected: (LocalDate) -> CalendarPagingState,
    val onToday: () -> CalendarPagingState,
    val onNext: () -> CalendarPagingState,
    val onPrevious: () -> CalendarPagingState,
)

fun KizitonwosePagingBridge.binding(
    adapter: PlanningCalendarAdapter,
    visibleDates: List<LocalDate>,
): KizitonwoseCalendarBinding {
    val current = state()
    return KizitonwoseCalendarBinding(
        state = current,
        days = visibleDates.map { adapter.dayModel(it, current.selectedDate) },
        onDateSelected = ::onDateClicked,
        onToday = ::onTodayClicked,
        onNext = ::onPageForward,
        onPrevious = ::onPageBackward,
    )
}
