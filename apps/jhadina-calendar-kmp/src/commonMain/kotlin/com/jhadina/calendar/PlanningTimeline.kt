package com.jhadina.calendar

/** Platform-neutral representation consumed by the KMP calendar UI. */
data class PlanningCalendarEvent(
    val id: String,
    val date: String,
    val title: String,
    val description: String? = null,
    val spatialObjectIds: List<String> = emptyList(),
)

/** Adapter boundary between Jhadina Planning Core data and the calendar UI. */
interface PlanningTimelineMapper {
    fun map(events: List<PlanningTimelineSourceEvent>): List<PlanningCalendarEvent>
}

data class PlanningTimelineSourceEvent(
    val id: String,
    val timestamp: String,
    val title: String,
    val description: String? = null,
    val spatialObjectIds: List<String> = emptyList(),
)

class DefaultPlanningTimelineMapper : PlanningTimelineMapper {
    override fun map(events: List<PlanningTimelineSourceEvent>): List<PlanningCalendarEvent> =
        events
            .map {
                PlanningCalendarEvent(
                    id = it.id,
                    date = it.timestamp.substringBefore('T'),
                    title = it.title,
                    description = it.description,
                    spatialObjectIds = it.spatialObjectIds,
                )
            }
            .sortedWith(compareBy<PlanningCalendarEvent> { it.date }.thenBy { it.title })
}
