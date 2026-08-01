# Android R8 and deobfuscation files

## What the Play Console warning means

Google Play may show this warning after an Android App Bundle is uploaded:

> There is no deobfuscation file associated with this App Bundle.

This is a warning, not an upload or release failure. It means that Play did not find an R8 or
ProGuard mapping file for that version of the application.

Android crashes and Application Not Responding (ANR) reports contain Java or Kotlin stack traces.
When R8 renames classes and methods, a production stack trace can contain shortened names such as
`a.b.c()` instead of the original source names. The mapping file records how the shortened names
correspond to the source code. Google Play uses it to reconstruct readable stack traces.

Without the correct mapping file:

- the application still installs and runs;
- the release can still be submitted for review;
- crash and ANR reports may be difficult to understand; and
- Play cannot reliably group and diagnose obfuscated failures.

## What R8 does

R8 is Android's release optimizer. In a release build it can:

- remove unreachable Java and Kotlin code;
- optimize bytecode;
- shorten or obfuscate class, field, and method names; and
- work with Android resource shrinking to remove unused resources.

These operations can reduce APK and App Bundle size. Obfuscation is not encryption and must not be
treated as a security boundary.

## How Spendzo enables it

Spendzo generates its `android/` project during CI, so release optimization is configured by
`scripts/patch-android.mjs` after Capacitor synchronization. The patch changes the generated
release configuration to the equivalent of:

```groovy
release {
    minifyEnabled true
    shrinkResources true
    proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
}
```

`minifyEnabled true` runs R8. `shrinkResources true` removes resources that are no longer reachable
after code shrinking.

Spendzo exposes several native Android methods to Angular through `WebView` JavaScript interfaces.
Those methods are called by name at runtime, so the native patch adds this keep rule:

```proguard
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
```

This prevents R8 from renaming or removing methods annotated with `@JavascriptInterface`, while
allowing the rest of the application to be optimized.

## Mapping file generation

Every optimized release build generates:

```text
android/app/build/outputs/mapping/release/mapping.txt
```

The file is unique to the exact build. A mapping file from another `versionCode`, even when the
source looks similar, must not be used to decode a different release.

The standard Android Gradle App Bundle task places the mapping data inside the AAB. With a current
Android Gradle Plugin, Google Play normally extracts and associates it automatically when the AAB
is uploaded.

Spendzo's GitHub Actions workflow also verifies that `mapping.txt` exists and copies it to:

```text
releases/<release-file-name>-mapping.txt
```

The copied file is committed with release artifacts on `main-android`, uploaded as a GitHub Actions
artifact, and attached to tagged GitHub Releases. This preserves the exact mapping even though
Gradle overwrites its build-output copy during later builds.

## CI build sequence

The relevant release sequence in `.github/workflows/android-build.yml` is:

1. Build the Angular application.
2. Generate and synchronize the Capacitor Android project.
3. Run `scripts/patch-android.mjs` to enable R8, resource shrinking, and WebView keep rules.
4. Run both `assembleRelease` and `bundleRelease`.
5. Require the release APK, AAB, and `mapping.txt` to exist.
6. Copy all three artifacts into `releases/`.

The workflow fails at the artifact-copy step if R8 does not produce a non-empty mapping file. This
prevents publishing an optimized release without preserving its deobfuscation data.

## What to do in Play Console

For a newly generated AAB, upload the AAB normally. Google Play should read the mapping from the
bundle without a separate upload.

To verify or manually attach the preserved mapping:

1. Open **Play Console** and select Spendzo.
2. Open **Test and release > App bundle explorer**.
3. Select the exact application version and `versionCode`.
4. Open **Downloads** and find the assets section.
5. If no ReTrace mapping is associated, upload the matching
   `releases/<release-file-name>-mapping.txt` file.

Never upload a mapping file generated for another version. Play's warning on an older App Bundle
will not be repaired by uploading a newly generated AAB; attach the mapping produced by that older
build if it is still available.

## Verifying a release locally

After generating and patching the Android project, run the release bundle task:

```bash
cd android
./gradlew bundleRelease
test -s app/build/outputs/mapping/release/mapping.txt
```

To confirm that an AAB contains the mapping metadata, inspect it as a ZIP archive and look under
`BUNDLE-METADATA` for the R8/ProGuard mapping entry.

## Mapping-file handling

- Keep the mapping for every published `versionCode` for as long as that version is supported.
- Do not edit, merge, or regenerate a mapping file after publishing the corresponding binary.
- The file does not contain the signing key, passwords, or user financial data.
- It does reveal original Java/Kotlin symbol names. If the repository or GitHub Release is public,
  consider storing the standalone copy in a private CI artifact instead. The AAB can still provide
  the mapping directly to Google Play.

## Official references

- [Android: troubleshoot app optimization and use ReTrace](https://developer.android.com/topic/performance/app-optimization/troubleshoot-the-optimization)
- [Google Play: deobfuscate or symbolicate crash stack traces](https://support.google.com/googleplay/android-developer/answer/9848633?hl=en)
- [Google Play: prepare and roll out a release](https://support.google.com/googleplay/android-developer/answer/9859348?hl=en)
