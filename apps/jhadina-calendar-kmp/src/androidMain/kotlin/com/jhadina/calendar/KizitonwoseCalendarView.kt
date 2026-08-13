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
import kotlinx.datetime.LocalDate

/**
 * Android presentation boundary for Kizitonwose.
 *
 * All calendar gestures remain selection/navigation operations. No planning
 * proposal is executed from this UI; execution remains behind Planning Core's
 * policy gateway and guarded executor.
 */
@Composable
fun KizitonwoseCalendarView(
    adapter: PlanningCalendarAdapter,
    navigation: PlanningCalendarNavigation,
    modifier: Modifier = Modifier,
) {
    var state by remember { mutableStateOf(navigation.state()) }

    Column(modifier = modifier) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Button(onClick = { navigation.previous(); state = navigation.state() }) { Text("Previous") }
            Button(onClick = { state = navigation.today() }) { Text("Today") }
            Button(onClick = { navigation.next(); state = navigation.state() }) { Text("Next") }
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            Button(onClick = { navigation.showMonth(); state = navigation.state() }) { Text("Month") }
            Button(onClick = { navigation.showWeek(); state = navigation.state() }) { Text("Week") }
        }

        Text("${state.mode} · ${state.anchorDate}")
        adapter.eventsForDate(state.selectedDate.toString()).forEach { event ->
            Text(event.title)
        }
    }
}
