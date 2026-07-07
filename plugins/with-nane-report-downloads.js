const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  createRunOncePlugin,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require('expo/config-plugins');

const PLUGIN_NAME = 'with-nane-report-downloads';
const REPORT_PACKAGE_CLASS = 'NaneReportDownloadsPackage';

function withNaneReportDownloads(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const permissions = manifest.manifest['uses-permission'] || [];
    if (!AndroidConfig.Permissions.isPermissionAlreadyRequested('android.permission.POST_NOTIFICATIONS', permissions)) {
      AndroidConfig.Permissions.addPermissionToManifest('android.permission.POST_NOTIFICATIONS', permissions);
    }
    manifest.manifest['uses-permission'] = permissions;

    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    application.provider = application.provider || [];
    const hasProvider = application.provider.some((provider) => provider?.$?.['android:authorities'] === '${applicationId}.fileprovider');
    if (!hasProvider) {
      application.provider.push({
        $: {
          'android:name': 'androidx.core.content.FileProvider',
          'android:authorities': '${applicationId}.fileprovider',
          'android:exported': 'false',
          'android:grantUriPermissions': 'true',
        },
        'meta-data': [
          {
            $: {
              'android:name': 'android.support.FILE_PROVIDER_PATHS',
              'android:resource': '@xml/nane_file_paths',
            },
          },
        ],
      });
    }

    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes('androidx.core:core-ktx')) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        'implementation("com.facebook.react:react-android")',
        'implementation("com.facebook.react:react-android")\n    implementation("androidx.core:core-ktx:1.18.0")',
      );
    }
    return modConfig;
  });

  config = withMainApplication(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes(`${REPORT_PACKAGE_CLASS}()`)) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        'PackageList(this).packages.apply {',
        `PackageList(this).packages.apply {\n          add(${REPORT_PACKAGE_CLASS}())`,
      );
    }
    return modConfig;
  });

  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const androidPackage = modConfig.android?.package || 'com.mdoetech.nanemobile';
      const androidRoot = path.join(modConfig.modRequest.projectRoot, 'android');
      const packageDir = path.join(androidRoot, 'app/src/main/java', ...androidPackage.split('.'));
      const drawableDir = path.join(androidRoot, 'app/src/main/res/drawable');
      const xmlDir = path.join(androidRoot, 'app/src/main/res/xml');

      await fs.promises.mkdir(packageDir, { recursive: true });
      await fs.promises.mkdir(drawableDir, { recursive: true });
      await fs.promises.mkdir(xmlDir, { recursive: true });

      await writeTemplate(packageDir, 'NaneReportDownloadsModule.kt', androidPackage);
      await writeTemplate(packageDir, 'NaneReportDownloadsPackage.kt', androidPackage);
      await copyResource(drawableDir, 'ic_stat_nane.xml');
      await copyResource(xmlDir, 'nane_file_paths.xml');

      return modConfig;
    },
  ]);

  return config;
}

async function writeTemplate(destinationDir, fileName, androidPackage) {
  const source = await fs.promises.readFile(path.join(__dirname, 'nane-report-downloads', fileName), 'utf8');
  const output = source.replaceAll('__NANE_ANDROID_PACKAGE__', androidPackage);
  await fs.promises.writeFile(path.join(destinationDir, fileName), output);
}

async function copyResource(destinationDir, fileName) {
  const sourcePath = path.join(__dirname, 'nane-report-downloads', fileName);
  const destinationPath = path.join(destinationDir, fileName);
  await fs.promises.copyFile(sourcePath, destinationPath);
}

module.exports = createRunOncePlugin(withNaneReportDownloads, PLUGIN_NAME, '1.0.0');
