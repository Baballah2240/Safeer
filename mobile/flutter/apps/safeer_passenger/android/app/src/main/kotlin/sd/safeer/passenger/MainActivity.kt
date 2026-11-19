package sd.safeer.passenger

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File

// FlutterFragmentActivity: the fingerprint and face prompt (local_auth) needs a FragmentActivity (D113).
// D126: "safeer/update" gives the in-app updater a private download folder and opens Android's
// installer for a downloaded, checksum-verified APK (installed over this app, same signing key).
class MainActivity : FlutterFragmentActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "safeer/update").setMethodCallHandler { call, result ->
            val folder = File(cacheDir, "updates")
            when (call.method) {
                "folder" -> result.success(folder.absolutePath)
                "install" -> {
                    val file = File(call.argument<String>("path") ?: "")
                    if (!file.exists() || file.parentFile?.canonicalPath != folder.canonicalPath) {
                        result.success("failed")
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !packageManager.canRequestPackageInstalls()) {
                        startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
                        result.success("permission")
                    } else {
                        val uri = FileProvider.getUriForFile(this, "$packageName.updates", file)
                        startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
                        result.success("started")
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
