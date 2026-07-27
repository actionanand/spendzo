const fs = require('node:fs');
const path = require('node:path');

const file = path.join(process.cwd(), 'android-version.json');
const version = JSON.parse(fs.readFileSync(file, 'utf8'));
const bump = process.argv.find((argument) => ['--patch', '--minor', '--major'].includes(argument));
const parts = String(version.versionName)
  .split('.')
  .map((part) => Number.parseInt(part, 10));

if (
  !Number.isInteger(version.versionCode) ||
  version.versionCode < 1 ||
  parts.length !== 3 ||
  parts.some((part) => !Number.isInteger(part) || part < 0)
) {
  throw new Error(
    'android-version.json must contain a positive versionCode and x.y.z versionName.',
  );
}

version.versionCode += 1;
if (bump === '--major') version.versionName = `${parts[0] + 1}.0.0`;
if (bump === '--minor') version.versionName = `${parts[0]}.${parts[1] + 1}.0`;
if (bump === '--patch') version.versionName = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;

fs.writeFileSync(file, `${JSON.stringify(version, null, 2)}\n`);
console.log(`Android version: ${version.versionName} (${version.versionCode})`);
