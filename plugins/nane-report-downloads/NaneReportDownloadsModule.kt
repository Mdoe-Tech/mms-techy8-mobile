package __NANE_ANDROID_PACKAGE__

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.io.FileInputStream
import java.io.InputStream

class NaneReportDownloadsModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = NAME

  @ReactMethod
  fun saveReport(fileUri: String, desiredFileName: String, mimeType: String, title: String, promise: Promise) {
    try {
      val fileName = sanitizeFileName(desiredFileName)
      val saved = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        saveWithMediaStore(fileUri, fileName, mimeType)
      } else {
        saveLegacy(fileUri, fileName, mimeType)
      }
      val notificationShown = postReportSavedNotification(saved.uri, saved.fileName, mimeType, title)

      val map = Arguments.createMap().apply {
        putString("uri", saved.uri.toString())
        putString("fileName", saved.fileName)
        putString("displayPath", "Downloads/Nane Reports")
        putBoolean("notificationShown", notificationShown)
      }
      promise.resolve(map)
    } catch (error: Exception) {
      promise.reject("NANE_REPORT_SAVE_FAILED", "Nane could not save this report to Downloads.", error)
    }
  }

  private fun saveWithMediaStore(fileUri: String, fileName: String, mimeType: String): SavedReport {
    val resolver = reactContext.contentResolver
    val values = ContentValues().apply {
      put(MediaStore.Downloads.DISPLAY_NAME, fileName)
      put(MediaStore.Downloads.MIME_TYPE, mimeType)
      put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Nane Reports")
      put(MediaStore.Downloads.IS_PENDING, 1)
    }

    val destinationUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
      ?: throw IllegalStateException("Downloads folder is not available.")

    try {
      openSourceStream(fileUri).use { input ->
        resolver.openOutputStream(destinationUri)?.use { output ->
          input.copyTo(output)
        } ?: throw IllegalStateException("Could not write the report file.")
      }
      values.clear()
      values.put(MediaStore.Downloads.IS_PENDING, 0)
      resolver.update(destinationUri, values, null, null)
      return SavedReport(destinationUri, fileName)
    } catch (error: Exception) {
      resolver.delete(destinationUri, null, null)
      throw error
    }
  }

  private fun saveLegacy(fileUri: String, fileName: String, mimeType: String): SavedReport {
    val directory = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Nane Reports")
    if (!directory.exists() && !directory.mkdirs()) {
      throw IllegalStateException("Downloads folder is not available.")
    }

    val destination = uniqueFile(directory, fileName)
    openSourceStream(fileUri).use { input ->
      destination.outputStream().use { output -> input.copyTo(output) }
    }

    MediaScannerConnection.scanFile(
      reactContext,
      arrayOf(destination.absolutePath),
      arrayOf(mimeType),
      null,
    )

    val uri = FileProvider.getUriForFile(reactContext, "${reactContext.packageName}.fileprovider", destination)
    return SavedReport(uri, destination.name)
  }

  private fun openSourceStream(fileUri: String): InputStream {
    val uri = Uri.parse(fileUri)
    return when (uri.scheme) {
      "content" -> reactContext.contentResolver.openInputStream(uri)
        ?: throw IllegalStateException("Could not read the report file.")
      "file", null -> FileInputStream(File(uri.path ?: fileUri.removePrefix("file://")))
      else -> FileInputStream(File(fileUri))
    }
  }

  private fun postReportSavedNotification(uri: Uri, fileName: String, mimeType: String, title: String): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      val permission = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.POST_NOTIFICATIONS)
      if (permission != PackageManager.PERMISSION_GRANTED) return false
    }

    createNotificationChannel()
    val intent = Intent(Intent.ACTION_VIEW).apply {
      setDataAndType(uri, mimeType)
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    val pendingIntent = PendingIntent.getActivity(
      reactContext,
      fileName.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(reactContext, REPORT_CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_nane)
      .setColor(Color.rgb(37, 99, 235))
      .setContentTitle("Report saved")
      .setContentText("$fileName saved to Downloads/Nane Reports")
      .setStyle(NotificationCompat.BigTextStyle().bigText("${title.ifBlank { "Report" }} is ready in Downloads/Nane Reports."))
      .setContentIntent(pendingIntent)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()

    return try {
      NotificationManagerCompat.from(reactContext).notify(fileName.hashCode(), notification)
      true
    } catch (_: SecurityException) {
      false
    }
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val existing = manager.getNotificationChannel(REPORT_CHANNEL_ID)
    if (existing != null) return

    val channel = NotificationChannel(REPORT_CHANNEL_ID, "Report downloads", NotificationManager.IMPORTANCE_DEFAULT).apply {
      description = "Notifications shown after Nane saves reports to your device."
    }
    manager.createNotificationChannel(channel)
  }

  private fun sanitizeFileName(value: String): String {
    val cleaned = value
      .replace(Regex("[\\\\/:*?\"<>|]+"), "-")
      .replace(Regex("\\s+"), " ")
      .trim()
    return cleaned.ifBlank { "nane-report" }
  }

  private fun uniqueFile(directory: File, desiredFileName: String): File {
    val base = desiredFileName.substringBeforeLast('.', desiredFileName)
    val extension = desiredFileName.substringAfterLast('.', "")
    var candidate = File(directory, desiredFileName)
    var index = 1
    while (candidate.exists()) {
      val suffix = if (extension.isBlank()) " ($index)" else " ($index).$extension"
      candidate = File(directory, "$base$suffix")
      index += 1
    }
    return candidate
  }

  private data class SavedReport(val uri: Uri, val fileName: String)

  companion object {
    const val NAME = "NaneReportDownloads"
    private const val REPORT_CHANNEL_ID = "nane_report_downloads"
  }
}
