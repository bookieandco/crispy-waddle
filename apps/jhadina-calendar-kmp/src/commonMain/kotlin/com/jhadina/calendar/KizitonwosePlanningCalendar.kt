package com.jhadina.calendar

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier

/**
 * Presentation contract for a Kizitonwose-backed calendar.
 *
 * The adapter owns selection/timeline state; this UI never executes a planning
 * proposal. Execution remains behind Jhadina Planning Core's policy boundary.
 */
@Composable
fun JhadinaPlanningCalendar(
    adapter: PlanningCalendarAdapter,
    modifier: Modifier = Modifier,
) {
    var mode by remember { mutableStateOf(CalendarViewMode.MONTH) }
    var selected by remember { mutableStateOf(adapter.today()) }

    Column(modifier = modifier) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Button(onClick = { mode = CalendarViewMode.MONTH }) { Text("Month") }
            Button(onClick = { mode = CalendarViewMode.WEEK }) { Text("Week") }
            Button(onClick = { selected = adapter.today() }) { Text("Today") }
        }

        // Kizitonwose Calendar can consume this state in the platform UI module.
        // Keeping the common layer on our adapter prevents calendar implementation
        // details from leaking into Planning Core.
        Text(text = selected.date)
        selected.events.forEach { event ->
            Text(text = event.title)
        }

        // Navigation/selection is intentionally delegated to the adapter.
        // The platform implementation binds month/week scroll state and day
        // clicks to adapter.selectDate(...).
        Text(text = mode.name)
    }
}
