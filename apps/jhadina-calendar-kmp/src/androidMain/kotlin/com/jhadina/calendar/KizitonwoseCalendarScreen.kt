package com.jhadina.calendar

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import kotlinx.datetime.LocalDate

/**
 * Concrete presentation screen. Kizitonwose-specific paging remains isolated
 * to this Android source set; the Planning adapter remains the domain boundary.
 */
@Composable
fun JhadinaKizitonwoseCalendarScreen(
    adapter: PlanningCalendarAdapter,
    navigation: PlanningCalendarNavigation,
    visibleDates: List<LocalDate>,
    modifier: Modifier = Modifier,
) {
    val bridge = remember(navigation) { KizitonwosePagingBridge(navigation) }
    val binding = bridge.binding(adapter, visibleDates)

    Column(modifier = modifier) {
        Row(modifier = Modifier.fillMaxWidth()) {
            Button(onClick = { binding.onPrevious() }) { Text("Previous") }
            Button(onClick = { binding.onToday() }) { Text("Today") }
            Button(onClick = { binding.onNext() }) { Text("Next") }
        }

        Text("${binding.state.mode} · ${binding.state.firstVisibleDate}")

        binding.days.forEach { model ->
            KizitonwoseDayCell(
                date = model.date,
                model = model,
                onDateSelected = { binding.onDateSelected(it) },
            )
        }
    }
}
