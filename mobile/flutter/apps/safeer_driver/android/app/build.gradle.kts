import java.util.Properties

// D74: release builds keep the existing application ID and the private Safeer upload key, so a
// later release can replace the WebView app as an update. Debug builds get a .dev suffix and
// install beside the current apps. The key stays outside Git.
val uploadFile = file((project.findProperty("safeerUploadProperties") as String?) ?: "${System.getProperty("user.home")}/.android/safeer-upload.properties")
val upload = Properties().apply { if (uploadFile.exists()) uploadFile.inputStream().use { load(it) } }

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "sd.safeer.driver"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "sd.safeer.driver"
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (upload.getProperty("storeFile") != null) {
            create("upload") {
                storeFile = file(upload.getProperty("storeFile"))
                storePassword = upload.getProperty("storePassword")
                keyAlias = upload.getProperty("keyAlias")
                keyPassword = upload.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
        }
        release {
            signingConfig = signingConfigs.findByName("upload")
        }
    }
}

// Profile builds (optimized, for trying on a phone) are debug-signed: keep them on the .dev IDs
// so they can never collide with the published apps, whichever order Flutter creates them in.
android.buildTypes.matching { it.name == "profile" }.configureEach {
    applicationIdSuffix = ".dev"
    versionNameSuffix = "-dev"
}

gradle.taskGraph.whenReady {
    if (upload.getProperty("storeFile") == null && allTasks.any { it.path.startsWith(":app:") && it.name.contains("Release") }) {
        throw GradleException("Release builds need the Safeer upload key: %USERPROFILE%/.android/safeer-upload.properties (see mobile/PLAY_STORE.md).")
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
