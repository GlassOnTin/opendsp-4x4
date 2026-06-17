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
        // Version lives in source so any build (CI, F-Droid, local) is deterministic
        // and reproducible — bump these per release, in the same commit you tag.
        versionCode = 5
        versionName = "0.2.1"
    }

    signingConfigs {
        // Same convention as iSpindlePlotter/Haven: CI decodes the keystore from a repo
        // secret and passes its path + passwords as env vars.
        val keystorePath = System.getenv("KEYSTORE_PATH")
        if (!keystorePath.isNullOrBlank()) {
            create("release") {
                storeFile = file(keystorePath)
                storePassword = System.getenv("KEYSTORE_PASSWORD")
                keyAlias = System.getenv("KEY_ALIAS")
                keyPassword = System.getenv("KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // release key when CI provides a keystore, else the debug key so the APK
            // still installs for sideloading.
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
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
