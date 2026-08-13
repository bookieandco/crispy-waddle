package com.jhadina.calendar

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import kotlinx.datetime.LocalDate

/**
 * Android presentation binding for the Kizitonwose calendar module.
 * PlanningCalendarAdapter remains the only source of timeline/selection state.
 * Calendar gestures only select dates; they never invoke execution.
 */
@Composable
fun KizitonwosePlanningCalendarAndroid(
    adapter: PlanningCalendarAdapter,
    modifier: Modifier = Modifier,
) {
    var selectedDate by remember { mutableStateOf(adapter.today().date) }
    var mode by remember { mutableStateOf(CalendarViewMode.MONTH) }

    Column(modifier = modifier) {
        Button(onClick = { selectedDate = adapter.today().date }) {
            Text("Today")
        }
        Button(onClick = { mode = CalendarViewMode.MONTH }) { Text("Month") }
        Button(onClick = { mode = CalendarViewMode.WEEK }) { Text("Week") }

        // Bind this state to Kizitonwose HorizontalCalendar/VerticalCalendar
        // in the Android UI module. Keeping the binding here prevents Android
        // calendar types from entering Planning Core or the KMP domain adapter.
        Text("$mode · $selectedDate")
        adapter.eventsForDate(selectedDate).forEach { event ->
            Text(event.title)
        }
    }
}
