plugins {
    kotlin("multiplatform")
    id("com.android.library")
    id("org.jetbrains.compose")
}

kotlin {
    androidTarget()

    sourceSets {
        commonMain.dependencies {
            // Version is intentionally managed by the repository's future
            // version catalog rather than duplicated in this module.
        }

        androidMain.dependencies {
            // Kizitonwose Calendar dependency belongs exclusively here.
            // Add it when the repository's Compose/Kotlin version catalog is
            // established so the artifact is version-compatible.
        }
    }
}

android {
    namespace = "com.jhadina.calendar"
}
