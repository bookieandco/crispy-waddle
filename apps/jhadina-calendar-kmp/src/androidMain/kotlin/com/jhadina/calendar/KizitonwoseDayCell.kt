package com.jhadina.calendar

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kotlinx.datetime.LocalDate

/** Pure presentation: renders a Planning day and its event marker count. */
@Composable
fun KizitonwoseDayCell(
    date: LocalDate,
    model: KizitonwoseDayModel,
    onDateSelected: (LocalDate) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = { onDateSelected(date) },
        modifier = modifier.size(44.dp),
        tonalElevation = if (model.selected) 2.dp else 0.dp,
    ) {
        Column {
            Text(
                text = date.dayOfMonth.toString(),
                style = MaterialTheme.typography.labelMedium,
            )
            if (model.eventCount > 0) {
                Text(
                    text = "• ${model.eventCount}",
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
    }
}
