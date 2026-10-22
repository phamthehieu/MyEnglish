# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
# The page calls these by name (window.AndroidTTS): shrinking or renaming them would silence the speech
-keepclassmembers class com.myenglish.app.TtsBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Vosk (speech recognition) and JNA load native code and call back by name
-keep class org.vosk.** { *; }
-keep class com.sun.jna.** { *; }
-keepclassmembers class * extends com.sun.jna.* { public *; }
-keepclassmembers class com.myenglish.app.AsrBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# JNA mentions desktop AWT classes it never uses on Android
-dontwarn java.awt.**
-dontwarn javax.swing.**

# JNA maps this interface by method name
-keep interface com.myenglish.app.VoskDictionary { *; }

# The page sets the study reminders through these (window.AndroidReminders)
-keepclassmembers class com.myenglish.app.RemindersBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# WorkManager builds the worker by class name
-keep class com.myenglish.app.ReminderCatchUpWorker { *; }

# WorkManager keeps its jobs in a Room database that Room instantiates by reflection: R8 must not drop the constructors
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { *; }
-keep class androidx.work.impl.**_Impl { *; }
-keep class androidx.work.impl.WorkDatabase { *; }
-keepclassmembers class * extends androidx.work.ListenableWorker {
    public <init>(android.content.Context, androidx.work.WorkerParameters);
}
