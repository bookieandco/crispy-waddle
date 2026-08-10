package com.jhadina.calendar

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/**
 * Native calendar entry point. The concrete Kizitonwose dependency is supplied
 * by the Android module build once its Compose/Kotlin versions are established.
 * This boundary keeps the Planning adapter independent of that library.
 */
@Composable
fun KizitonwoseCalendarView(
    adapter: PlanningCalendarAdapter,
    navigation: PlanningCalendarNavigation,
    modifier: Modifier = Modifier,
) {
    // The dependency-specific HorizontalCalendar/HorizontalWeekCalendar call
    // belongs here. Until the module declares the compatible Kizitonwose
    // artifact, the adapter remains the source of truth for the native screen.
    KizitonwosePlanningCalendarAndroid(adapter = adapter, modifier = modifier)
}
