#!/usr/bin/env node

import { access, copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const appId = 'com.actionanand.spendzo.app';
const resources = resolve('android/app/src/main/res');
const manifestPath = resolve('android/app/src/main/AndroidManifest.xml');
const gradlePath = resolve('android/app/build.gradle');
const javaPath = resolve('android/app/src/main/java', ...appId.split('.'), 'MainActivity.java');
const exportJavaPath = resolve(
  'android/app/src/main/java',
  ...appId.split('.'),
  'SpendzoExport.java',
);
const version = JSON.parse(await readFile(resolve('android-version.json'), 'utf8'));

async function write(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

let manifest = await readFile(manifestPath, 'utf8');
if (!manifest.includes('android.permission.USE_BIOMETRIC')) {
  manifest = manifest.replace(
    '<application',
    '    <uses-permission android:name="android.permission.USE_BIOMETRIC" />\n\n    <application',
  );
}
manifest = manifest
  .replace(/android:icon="[^"]+"/, 'android:icon="@drawable/spendzo_app_icon"')
  .replace(/android:roundIcon="[^"]+"/, 'android:roundIcon="@drawable/spendzo_app_icon"')
  .replace(
    /(<activity\b(?=[^>]*android:name="\.MainActivity")[^>]*android:theme=")[^"]*(")/,
    '$1@style/AppTheme.NoActionBarLaunch$2',
  );
manifest = manifest.replace(
  /\s*<provider\s+android:name="androidx\.core\.content\.FileProvider"\s+android:authorities="\$\{applicationId\}\.exports"[\s\S]*?<\/provider>/g,
  '',
);
await writeFile(manifestPath, manifest);

let gradle = await readFile(gradlePath, 'utf8');
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${version.versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${version.versionName}"`);
if (!gradle.includes('androidx.biometric:biometric')) {
  gradle = gradle.replace(
    /dependencies\s*\{/,
    "dependencies {\n    implementation 'androidx.biometric:biometric:1.1.0'",
  );
}
await writeFile(gradlePath, gradle);

const lightStyles = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">#087F5B</item>
        <item name="colorPrimaryDark">#07150F</item>
        <item name="colorAccent">#43D394</item>
        <item name="android:fontFamily">sans</item>
        <item name="android:windowActionModeOverlay">true</item>
        <item name="android:windowNoTitle">true</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:windowBackground">#F3F8F5</item>
        <item name="android:statusBarColor">#F3F8F5</item>
        <item name="android:navigationBarColor">#F3F8F5</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
        <item name="android:windowActionModeOverlay">true</item>
        <item name="android:windowNoTitle">true</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="AppTheme.NoActionBar">
        <item name="android:windowBackground">@drawable/spendzo_splash_screen</item>
        <item name="android:statusBarColor">#07150F</item>
        <item name="android:navigationBarColor">#07150F</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
</resources>`;

const darkStyles = lightStyles
  .replaceAll('#F3F8F5', '#07150F')
  .replace(
    '<item name="android:windowLightStatusBar">true</item>',
    '<item name="android:windowLightStatusBar">false</item>',
  )
  .replace(
    '<item name="android:windowLightNavigationBar">true</item>',
    '<item name="android:windowLightNavigationBar">false</item>',
  );

const lightAndroid12Styles = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">#087F5B</item>
        <item name="colorPrimaryDark">#07150F</item>
        <item name="colorAccent">#43D394</item>
        <item name="android:windowNoTitle">true</item>
    </style>
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="android:windowBackground">#F3F8F5</item>
        <item name="android:statusBarColor">#F3F8F5</item>
        <item name="android:navigationBarColor">#F3F8F5</item>
        <item name="android:windowLightStatusBar">true</item>
        <item name="android:windowLightNavigationBar">true</item>
        <item name="android:windowNoTitle">true</item>
    </style>
    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">#07150F</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/spendzo_splash_icon</item>
        <item name="windowSplashScreenIconBackgroundColor">@android:color/transparent</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
        <item name="android:statusBarColor">#07150F</item>
        <item name="android:navigationBarColor">#07150F</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
</resources>`;

const darkAndroid12Styles = lightAndroid12Styles
  .replaceAll('#F3F8F5', '#07150F')
  .replace(
    '<item name="android:windowLightStatusBar">true</item>',
    '<item name="android:windowLightStatusBar">false</item>',
  )
  .replace(
    '<item name="android:windowLightNavigationBar">true</item>',
    '<item name="android:windowLightNavigationBar">false</item>',
  );

await write(resolve(resources, 'values/styles.xml'), lightStyles);
await write(resolve(resources, 'values-night/styles.xml'), darkStyles);
await write(resolve(resources, 'values-v31/styles.xml'), lightAndroid12Styles);
await write(resolve(resources, 'values-night-v31/styles.xml'), darkAndroid12Styles);
await write(
  resolve(resources, 'values/spendzo_colours.xml'),
  `<?xml version="1.0" encoding="utf-8"?><resources><color name="spendzo_splash_background">#07150F</color></resources>`,
);
try {
  for (const directory of await readdir(resources)) {
    if (!directory.startsWith('drawable')) continue;
    const generatedSplashPng = resolve(resources, directory, 'splash.png');
    if (await fileExists(generatedSplashPng)) await rm(generatedSplashPng);
  }
} catch {
  // Capacitor creates these folders during sync; missing generated resources are harmless.
}
await write(
  resolve(resources, 'drawable/spendzo_splash_icon.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:drawable="@drawable/spendzo_splash_logo"
    android:inset="28%" />`,
);
await write(
  resolve(resources, 'drawable/spendzo_splash_screen.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/spendzo_splash_background" />
    <item android:gravity="center">
        <inset android:drawable="@drawable/spendzo_splash_icon" android:inset="34%" />
    </item>
</layer-list>`,
);
await mkdir(resolve(resources, 'drawable-nodpi'), { recursive: true });
await copyFile(
  resolve('public/spendzo.png'),
  resolve(resources, 'drawable-nodpi/spendzo_app_icon.png'),
);
await copyFile(
  resolve('public/spendzo.png'),
  resolve(resources, 'drawable-nodpi/spendzo_splash_logo.png'),
);
const legacyExportPaths = resolve(resources, 'xml/spendzo_file_paths.xml');
if (await fileExists(legacyExportPaths)) await rm(legacyExportPaths);

const mainActivity = `package ${appId};

import android.content.ContentValues;
import android.content.Intent;
import android.content.res.Configuration;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import androidx.activity.OnBackPressedCallback;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.concurrent.Executor;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public class MainActivity extends BridgeActivity {
  private static final String KEY_ALIAS = "spendzo_biometric_key";
  private SpendzoDatabase database;
  private SpendzoExport exportBridge;
  private boolean darkMode;

  @Override
  public void onCreate(Bundle savedInstanceState) {
    setTheme(R.style.AppTheme_NoActionBar);
    super.onCreate(savedInstanceState);
    darkMode = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
      == Configuration.UI_MODE_NIGHT_YES;
    database = new SpendzoDatabase();
    exportBridge = new SpendzoExport(MainActivity.this);
    getBridge().getWebView().setBackgroundColor(
      Color.parseColor(darkMode ? "#07150F" : "#F3F8F5")
    );
    getBridge().getWebView().addJavascriptInterface(database, "SpendzoDatabase");
    getBridge().getWebView().addJavascriptInterface(new SystemBarsBridge(), "SpendzoSystemBars");
    getBridge().getWebView().addJavascriptInterface(new NativeBridge(), "SpendzoNative");
    getBridge().getWebView().addJavascriptInterface(
      exportBridge,
      "SpendzoExport"
    );
    getOnBackPressedDispatcher().addCallback(
      this,
      new OnBackPressedCallback(true) {
        @Override
        public void handleOnBackPressed() {
          dispatchEvent("spendzo-back");
        }
      }
    );
    applySystemBars(darkMode);
  }

  @Override
  protected void onActivityResult(int requestCode, int resultCode, Intent data) {
    if (exportBridge != null && exportBridge.handleActivityResult(requestCode, resultCode, data)) {
      return;
    }
    super.onActivityResult(requestCode, resultCode, data);
  }

  @Override
  public void onResume() {
    super.onResume();
    applySystemBars(darkMode);
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) applySystemBars(darkMode);
  }

  public class SystemBarsBridge {
    @JavascriptInterface
    public void setDarkMode(boolean enabled) {
      runOnUiThread(() -> applySystemBars(enabled));
    }
  }

  public class NativeBridge {
    @JavascriptInterface
    public void hideSplash() {
      runOnUiThread(() -> applySystemBars(darkMode));
    }

    @JavascriptInterface
    public void exitApp() {
      runOnUiThread(() -> finish());
    }

    @JavascriptInterface
    public boolean isBiometricAvailable() {
      return BiometricManager.from(MainActivity.this).canAuthenticate(
        BiometricManager.Authenticators.BIOMETRIC_STRONG
      ) == BiometricManager.BIOMETRIC_SUCCESS;
    }

    @JavascriptInterface
    public void enableBiometric(String secret) {
      runOnUiThread(() -> {
        try {
          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(Cipher.ENCRYPT_MODE, createBiometricKey());
          showPrompt("Enable fingerprint login", "Confirm your fingerprint for Spendzo", cipher, () -> {
            try {
              byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
              getPreferences(MODE_PRIVATE).edit()
                .putString("biometric_ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP))
                .putString("biometric_iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .apply();
              dispatchEvent("biometric-enabled");
            } catch (Exception ignored) {}
          });
        } catch (Exception ignored) {}
      });
    }

    @JavascriptInterface
    public void authenticateBiometric() {
      runOnUiThread(() -> {
        try {
          String encryptedValue = getPreferences(MODE_PRIVATE).getString("biometric_ciphertext", "");
          String ivValue = getPreferences(MODE_PRIVATE).getString("biometric_iv", "");
          if (encryptedValue.isEmpty() || ivValue.isEmpty()) return;
          Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
          cipher.init(
            Cipher.DECRYPT_MODE,
            loadBiometricKey(),
            new GCMParameterSpec(128, Base64.decode(ivValue, Base64.NO_WRAP))
          );
          showPrompt("Unlock Spendzo", "Use your fingerprint or enter your PIN", cipher, () -> {
            try {
              byte[] result = cipher.doFinal(Base64.decode(encryptedValue, Base64.NO_WRAP));
              if (result.length > 0) dispatchEvent("biometric-success");
            } catch (Exception ignored) {}
          });
        } catch (Exception ignored) {}
      });
    }

    @JavascriptInterface
    public void disableBiometric() {
      getPreferences(MODE_PRIVATE).edit()
        .remove("biometric_ciphertext")
        .remove("biometric_iv")
        .apply();
      try {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);
        keyStore.deleteEntry(KEY_ALIAS);
      } catch (Exception ignored) {}
    }
  }

  private void showPrompt(String title, String subtitle, Cipher cipher, Runnable success) {
    Executor executor = ContextCompat.getMainExecutor(this);
    BiometricPrompt prompt = new BiometricPrompt(
      this,
      executor,
      new BiometricPrompt.AuthenticationCallback() {
        @Override
        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
          super.onAuthenticationSucceeded(result);
          success.run();
        }
      }
    );
    BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
      .setTitle(title)
      .setSubtitle(subtitle)
      .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
      .setNegativeButtonText("Use PIN")
      .build();
    prompt.authenticate(info, new BiometricPrompt.CryptoObject(cipher));
  }

  private SecretKey createBiometricKey() throws Exception {
    KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
    KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
    )
      .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
      .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
      .setUserAuthenticationRequired(true)
      .setInvalidatedByBiometricEnrollment(true);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
    }
    generator.init(builder.build());
    return generator.generateKey();
  }

  private SecretKey loadBiometricKey() throws Exception {
    KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
    keyStore.load(null);
    return (SecretKey) keyStore.getKey(KEY_ALIAS, null);
  }

  private void dispatchEvent(String eventName) {
    getBridge().getWebView().post(() ->
      getBridge().getWebView().evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('" + eventName + "'))",
        null
      )
    );
  }

  private void applySystemBars(boolean dark) {
    darkMode = dark;
    Window window = getWindow();
    int background = Color.parseColor(dark ? "#07150F" : "#F3F8F5");
    window.setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(background));
    window.getDecorView().setBackgroundColor(background);
    getBridge().getWebView().setBackgroundColor(background);
    window.setStatusBarColor(background);
    window.setNavigationBarColor(background);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.setStatusBarContrastEnforced(false);
      window.setNavigationBarContrastEnforced(false);
    }
    View decor = window.getDecorView();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      WindowInsetsController controller = decor.getWindowInsetsController();
      if (controller != null) {
        int lightFlags = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS |
          WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
        controller.setSystemBarsAppearance(dark ? 0 : lightFlags, lightFlags);
      }
      return;
    }
    int flags = decor.getSystemUiVisibility();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      flags = dark
        ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        : flags | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      flags = dark
        ? flags & ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        : flags | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
    }
    decor.setSystemUiVisibility(flags);
  }

  private class SpendzoDatabase extends SQLiteOpenHelper {
    SpendzoDatabase() {
      super(MainActivity.this, "spendzo.db", null, 1);
    }

    @Override
    public void onCreate(SQLiteDatabase database) {
      database.execSQL(
        "CREATE TABLE app_state (state_key TEXT PRIMARY KEY NOT NULL, state_value TEXT NOT NULL, updated_at INTEGER NOT NULL)"
      );
      database.execSQL("CREATE INDEX idx_app_state_updated_at ON app_state(updated_at)");
      database.execSQL("PRAGMA user_version = 1");
    }

    @Override
    public void onUpgrade(SQLiteDatabase database, int oldVersion, int newVersion) {}

    @JavascriptInterface
    public String loadState() {
      try (
        Cursor cursor = getReadableDatabase().query(
          "app_state",
          new String[] { "state_value" },
          "state_key = ?",
          new String[] { "snapshot" },
          null,
          null,
          null
        )
      ) {
        return cursor.moveToFirst() ? cursor.getString(0) : "";
      }
    }

    @JavascriptInterface
    public void saveState(String value) {
      ContentValues record = new ContentValues();
      record.put("state_key", "snapshot");
      record.put("state_value", value);
      record.put("updated_at", System.currentTimeMillis());
      getWritableDatabase().insertWithOnConflict(
        "app_state",
        null,
        record,
        SQLiteDatabase.CONFLICT_REPLACE
      );
    }
  }
}
`;

const exportBridge = `package ${appId};

import android.app.Activity;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

final class SpendzoExport {
  private static final int CREATE_DOCUMENT_REQUEST = 7319;
  private final MainActivity activity;
  private byte[] pendingContents;

  SpendzoExport(MainActivity activity) {
    this.activity = activity;
  }

  @JavascriptInterface
  public void exportBackup(String content, String filename, String title) {
    requestSave(
      content.getBytes(StandardCharsets.UTF_8),
      filename,
      "application/octet-stream"
    );
  }

  @JavascriptInterface
  public void exportCsv(String content, String filename, String title) {
    requestSave(content.getBytes(StandardCharsets.UTF_8), filename, "text/csv");
  }

  @JavascriptInterface
  public void exportPdf(String content, String filename, String title) {
    new Thread(() -> {
      PdfDocument document = new PdfDocument();
      try {
        JSONObject report = new JSONObject(content);
        new PdfReportRenderer(document).render(report);
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        document.writeTo(output);
        requestSave(output.toByteArray(), filename, "application/pdf");
      } catch (Exception ignored) {
        dispatch("native-export-error");
      } finally {
        document.close();
      }
    }).start();
  }

  private void requestSave(byte[] contents, String requestedName, String mimeType) {
    activity.runOnUiThread(() -> {
      if (pendingContents != null) {
        dispatch("native-export-error");
        return;
      }
      try {
        pendingContents = contents;
        String filename = requestedName == null
          ? "spendzo-export"
          : requestedName.replaceAll("[^A-Za-z0-9._-]", "-");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mimeType);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        activity.startActivityForResult(intent, CREATE_DOCUMENT_REQUEST);
      } catch (Exception ignored) {
        pendingContents = null;
        dispatch("native-export-error");
      }
    });
  }

  boolean handleActivityResult(int requestCode, int resultCode, Intent data) {
    if (requestCode != CREATE_DOCUMENT_REQUEST) return false;
    byte[] contents = pendingContents;
    pendingContents = null;
    Uri destination = data == null ? null : data.getData();
    if (resultCode != Activity.RESULT_OK || destination == null || contents == null) {
      dispatch("native-export-cancelled");
      return true;
    }
    new Thread(() -> {
      try (OutputStream output = activity.getContentResolver().openOutputStream(destination, "w")) {
        if (output == null) throw new IllegalStateException("Unable to open selected file");
        output.write(contents);
        output.flush();
        dispatch("native-export-ready");
      } catch (Exception ignored) {
        dispatch("native-export-error");
      }
    }).start();
    return true;
  }

  private void dispatch(String eventName) {
    activity.getBridge().getWebView().post(() ->
      activity.getBridge().getWebView().evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('" + eventName + "'))",
        null
      )
    );
  }

  private static final class PdfReportRenderer {
    private static final int PAGE_WIDTH = 595;
    private static final int PAGE_HEIGHT = 842;
    private static final float MARGIN = 32f;
    private static final float CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
    private final PdfDocument document;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private PdfDocument.Page page;
    private Canvas canvas;
    private int pageNumber = 0;
    private float y;

    PdfReportRenderer(PdfDocument document) {
      this.document = document;
    }

    void render(JSONObject report) throws Exception {
      newPage();
      text(report.optString("title", "Spendzo expense statement"), MARGIN, y, 20f, true, Color.rgb(16, 37, 28));
      y += 25f;
      text(
        report.optString("subtitle", "") + " · Generated " + report.optString("generatedOn", ""),
        MARGIN,
        y,
        8f,
        false,
        Color.rgb(96, 115, 106)
      );
      y += 18f;
      paint.setColor(Color.rgb(8, 127, 91));
      canvas.drawRect(MARGIN, y, PAGE_WIDTH - MARGIN, y + 3f, paint);
      y += 15f;
      drawSummary(report.optJSONArray("summary"));
      JSONArray sections = report.optJSONArray("sections");
      if (sections != null) {
        for (int index = 0; index < sections.length(); index++) {
          drawSection(sections.getJSONObject(index));
        }
      }
      finishPage();
    }

    private void drawSummary(JSONArray summary) throws Exception {
      if (summary == null) return;
      float cardWidth = (CONTENT_WIDTH - 8f) / 2f;
      for (int index = 0; index < summary.length(); index++) {
        if (index % 2 == 0) ensure(48f);
        float x = MARGIN + ((index % 2) * (cardWidth + 8f));
        float top = y;
        paint.setColor(Color.rgb(243, 248, 245));
        canvas.drawRoundRect(x, top, x + cardWidth, top + 40f, 7f, 7f, paint);
        JSONObject item = summary.getJSONObject(index);
        text(ellipsis(item.optString("value"), 32), x + 8f, top + 16f, 11f, true, Color.rgb(8, 127, 91));
        text(ellipsis(item.optString("label"), 38), x + 8f, top + 30f, 7f, false, Color.rgb(96, 115, 106));
        if (index % 2 == 1 || index == summary.length() - 1) y += 48f;
      }
    }

    private void drawSection(JSONObject section) throws Exception {
      ensure(52f);
      y += 5f;
      text(section.optString("title", "Details"), MARGIN, y, 13f, true, Color.rgb(16, 37, 28));
      y += 10f;
      JSONArray headers = section.optJSONArray("headers");
      JSONArray rows = section.optJSONArray("rows");
      drawHeader(headers);
      if (rows == null || rows.length() == 0) {
        ensure(24f);
        text("No expenses in this period.", MARGIN + 6f, y + 15f, 8f, false, Color.rgb(96, 115, 106));
        y += 24f;
        return;
      }
      for (int rowIndex = 0; rowIndex < rows.length(); rowIndex++) {
        if (y + 22f > PAGE_HEIGHT - 38f) {
          newPage();
          text(section.optString("title", "Details") + " (continued)", MARGIN, y, 11f, true, Color.rgb(16, 37, 28));
          y += 10f;
          drawHeader(headers);
        }
        JSONObject row = rows.getJSONObject(rowIndex);
        drawRow(row.optJSONArray("cells"), headers == null ? 1 : headers.length(), rowIndex);
      }
      y += 8f;
    }

    private void drawHeader(JSONArray headers) throws Exception {
      int columns = headers == null ? 1 : Math.max(1, headers.length());
      float width = CONTENT_WIDTH / columns;
      ensure(22f);
      paint.setColor(Color.rgb(8, 127, 91));
      canvas.drawRect(MARGIN, y, PAGE_WIDTH - MARGIN, y + 21f, paint);
      for (int index = 0; index < columns; index++) {
        String value = headers == null ? "" : headers.optString(index);
        text(ellipsis(value, charsFor(width)), MARGIN + (index * width) + 4f, y + 14f, 7f, true, Color.WHITE);
      }
      y += 21f;
    }

    private void drawRow(JSONArray cells, int columns, int rowIndex) {
      float width = CONTENT_WIDTH / Math.max(1, columns);
      if (rowIndex % 2 == 1) {
        paint.setColor(Color.rgb(243, 248, 245));
        canvas.drawRect(MARGIN, y, PAGE_WIDTH - MARGIN, y + 21f, paint);
      }
      paint.setColor(Color.rgb(220, 232, 225));
      canvas.drawRect(MARGIN, y + 20f, PAGE_WIDTH - MARGIN, y + 21f, paint);
      for (int index = 0; index < columns; index++) {
        String value = cells == null ? "" : cells.optString(index);
        text(ellipsis(value, charsFor(width)), MARGIN + (index * width) + 4f, y + 14f, 6.6f, false, Color.rgb(16, 37, 28));
      }
      y += 21f;
    }

    private int charsFor(float width) {
      return Math.max(5, (int) (width / 4.2f));
    }

    private String ellipsis(String value, int max) {
      if (value == null) return "";
      return value.length() <= max ? value : value.substring(0, Math.max(1, max - 1)) + "…";
    }

    private void ensure(float height) {
      if (y + height > PAGE_HEIGHT - 38f) newPage();
    }

    private void newPage() {
      finishPage();
      pageNumber += 1;
      PdfDocument.PageInfo info = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create();
      page = document.startPage(info);
      canvas = page.getCanvas();
      canvas.drawColor(Color.WHITE);
      y = MARGIN;
    }

    private void finishPage() {
      if (page == null) return;
      text("Spendzo · Page " + pageNumber, MARGIN, PAGE_HEIGHT - 18f, 7f, false, Color.rgb(96, 115, 106));
      document.finishPage(page);
      page = null;
      canvas = null;
    }

    private void text(String value, float x, float baseline, float size, boolean bold, int colour) {
      paint.setColor(colour);
      paint.setTextSize(size);
      paint.setTypeface(bold ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
      canvas.drawText(value == null ? "" : value, x, baseline, paint);
    }
  }
}
`;

await write(javaPath, mainActivity);
await write(exportJavaPath, exportBridge);
console.log(`Patched Android project for Spendzo ${version.versionName} (${version.versionCode}).`);
