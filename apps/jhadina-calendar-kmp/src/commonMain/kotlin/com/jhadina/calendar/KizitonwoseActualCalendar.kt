package com.jhadina.calendar

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.kizitonwose.calendar.compose.HorizontalCalendar
import com.kizitonwose.calendar.compose.rememberCalendarState
import com.kizitonwose.calendar.compose.weekcalendar.HorizontalWeekCalendar
import com.kizitonwose.calendar.compose.weekcalendar.rememberWeekCalendarState
import com.kizitonwose.calendar.core.daysOfWeek
import kotlinx.coroutines.launch
import kotlinx.datetime.DatePeriod
import kotlinx.datetime.LocalDate
import kotlinx.datetime.TimeZone
import kotlinx.datetime.YearMonth
import kotlinx.datetime.plus
import kotlinx.datetime.toLocalDateTime
import kotlin.time.Clock

/**
 * Real Kizitonwose Compose Multiplatform calendar surface.
 *
 * PlanningCalendarAdapter remains the only timeline source. Calendar gestures
 * update selection/navigation only; they cannot invoke proposals or execution.
 */
@Composable
fun JhadinaKizitonwoseCalendar(
    adapter: PlanningCalendarAdapter,
    navigation: PlanningCalendarNavigation,
    modifier: Modifier = Modifier,
) {
    val today = remember {
        Clock.System.now().toLocalDateTime(TimeZone.currentSystemDefault()).date
    }
    val currentMonth = remember(today) { YearMonth(today.year, today.month) }
    val startMonth = remember(currentMonth) { currentMonth.plus(DatePeriod(months = -24)) }
    val endMonth = remember(currentMonth) { currentMonth.plus(DatePeriod(months = 24)) }
    val firstDayOfWeek = remember { daysOfWeek().first() }
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf(navigation.state().mode) }

    val monthState = rememberCalendarState(
        startMonth = startMonth,
        endMonth = endMonth,
        firstVisibleMonth = currentMonth,
        firstDayOfWeek = firstDayOfWeek,
    )
    val weekState = rememberWeekCalendarState(
        startDate = startMonth.firstDay,
        endDate = endMonth.lastDay,
        firstDayOfWeek = firstDayOfWeek,
    )

    fun select(date: LocalDate) {
        navigation.select(date)
    }

    Column(modifier = modifier) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Button(onClick = {
                scope.launch {
                    if (mode == CalendarViewMode.MONTH) {
                        monthState.animateScrollToMonth(
                            monthState.firstVisibleMonth.yearMonth.plus(DatePeriod(months = -1)),
                        )
                    } else {
                        weekState.animateScrollToWeek(
                            weekState.firstVisibleWeek.days.first().date.plus(DatePeriod(days = -7)),
                        )
                    }
                    navigation.previous()
                }
            }) { Text("Previous") }

            Button(onClick = {
                scope.launch {
                    monthState.animateScrollToDate(today)
                    weekState.animateScrollToDate(today)
                    navigation.today()
                }
            }) { Text("Today") }

            Button(onClick = {
                scope.launch {
                    if (mode == CalendarViewMode.MONTH) {
                        monthState.animateScrollToMonth(
                            monthState.firstVisibleMonth.yearMonth.plus(DatePeriod(months = 1)),
                        )
                    } else {
                        weekState.animateScrollToWeek(
                            weekState.firstVisibleWeek.days.first().date.plus(DatePeriod(days = 7)),
                        )
                    }
                    navigation.next()
                }
            }) { Text("Next") }
        }

        Row(modifier = Modifier.fillMaxWidth()) {
            Button(onClick = {
                mode = CalendarViewMode.MONTH
                navigation.showMonth()
            }) { Text("Month") }
            Button(onClick = {
                mode = CalendarViewMode.WEEK
                navigation.showWeek()
            }) { Text("Week") }
        }

        if (mode == CalendarViewMode.MONTH) {
            HorizontalCalendar(
                state = monthState,
                calendarScrollPaged = true,
                dayContent = { day ->
                    KizitonwoseActualDayCell(
                        date = day.date,
                        model = adapter.dayModel(day.date, navigation.state().selectedDate),
                        onDateSelected = ::select,
                    )
                },
            )
        } else {
            HorizontalWeekCalendar(
                state = weekState,
                calendarScrollPaged = true,
                dayContent = { day ->
                    KizitonwoseActualDayCell(
                        date = day.date,
                        model = adapter.dayModel(day.date, navigation.state().selectedDate),
                        onDateSelected = ::select,
                    )
                },
            )
        }
    }
}

@Composable
private fun KizitonwoseActualDayCell(
    date: LocalDate,
    model: KizitonwoseDayModel,
    onDateSelected: (LocalDate) -> Unit,
) {
    Surface(
        onClick = { onDateSelected(date) },
        tonalElevation = if (model.selected) 2.dp else 0.dp,
    ) {
        Column {
            Text(date.dayOfMonth.toString(), style = MaterialTheme.typography.labelMedium)
            if (model.eventCount > 0) {
                Text("• ${model.eventCount}", style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}
