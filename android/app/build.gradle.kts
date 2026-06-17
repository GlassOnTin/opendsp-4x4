plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "net.opendsp.x4x4"
    compileSdk = 35

    defaultConfig {
        applicationId = "net.opendsp.x4x4"
        minSdk = 24
        targetSdk = 35
        // CI overrides these from the release tag / run number (-PversionName/-PversionCode).
        versionCode = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("versionName") as String?) ?: "0.1.0"
    }

    signingConfigs {
        create("release") {
            System.getenv("KEYSTORE_PATH")?.let { ks ->
                storeFile = file(ks)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Sign with the release keystore when CI provides one (secrets), else fall
            // back to the debug key so the APK is still installable for sideloading.
            signingConfig = if (System.getenv("KEYSTORE_PATH") != null)
                signingConfigs.getByName("release")
            else
                signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1") // WindowInsetsCompat for edge-to-edge insets
    implementation("androidx.webkit:webkit:1.12.1")
}
