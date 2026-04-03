const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const repoRoot = process.cwd();

const riskyTrackedFileMatchers = [
  /^\.env$/i,
  /^\.env\..+/i,
  /^google-services\.json$/i,
  /^googleservice-info\.plist$/i,
  /^service-account.*\.json$/i,
  /\.keystore$/i,
  /\.jks$/i,
  /\.p8$/i,
  /\.p12$/i,
  /\.mobileprovision$/i,
];

const excludedDirs = new Set([
  '.git',
  'node_modules',
  '.expo',
  '.expo-router-check',
  '.eas-inspect-android',
  'dist',
  'android',
  'apk',
]);

const binaryExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.pdf',
  '.zip',
  '.gz',
  '.tgz',
  '.jar',
  '.keystore',
  '.jks',
  '.p8',
  '.p12',
  '.mobileprovision',
  '.hbc',
  '.mp4',
  '.mov',
  '.avi',
  '.aab',
  '.apk',
]);

const secretPatterns = [
  { name: 'Google API key', regex: /\bAIza[0-9A-Za-z\-_]{35}\b/g },
  { name: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'GitHub token', regex: /\bghp_[A-Za-z0-9]{20,}\b/g },
  { name: 'GitHub fine-grained token', regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: 'OpenAI-style secret key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
  { name: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'Private key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g },
];

function run(command) {
  return cp.execSync(command, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function getTrackedFiles() {
  const output = run('git ls-files -z');
  return output.split('\0').filter(Boolean);
}

function isRiskyTrackedFile(file) {
  if (file === '.env.example') return false;
  return riskyTrackedFileMatchers.some(regex => regex.test(file.replace(/\\/g, '/')));
}

function shouldSkipFile(file) {
  const normalized = file.replace(/\\/g, '/');
  const parts = normalized.split('/');
  if (parts.some(part => excludedDirs.has(part))) return true;
  return binaryExtensions.has(path.extname(normalized).toLowerCase());
}

function isProbablyText(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8000));
  for (const byte of sample) {
    if (byte === 0) return false;
  }
  return true;
}

function scanTrackedFiles(files) {
  const findings = [];

  for (const file of files) {
    if (shouldSkipFile(file)) continue;

    const absPath = path.join(repoRoot, file);
    if (!fs.existsSync(absPath) || !fs.statSync(absPath).isFile()) continue;

    const buffer = fs.readFileSync(absPath);
    if (!isProbablyText(buffer)) continue;

    const text = buffer.toString('utf8');
    const lines = text.split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];

      for (const pattern of secretPatterns) {
        if (pattern.regex.test(line)) {
          findings.push({
            file,
            line: index + 1,
            type: pattern.name,
          });
        }
        pattern.regex.lastIndex = 0;
      }
    }
  }

  return findings;
}

function main() {
  const trackedFiles = getTrackedFiles();
  const riskyTrackedFiles = trackedFiles.filter(isRiskyTrackedFile);
  const secretFindings = scanTrackedFiles(trackedFiles);

  if (riskyTrackedFiles.length === 0 && secretFindings.length === 0) {
    console.log('check:secrets passed');
    process.exit(0);
  }

  console.error('check:secrets failed');

  if (riskyTrackedFiles.length > 0) {
    console.error('\nTracked sensitive-looking files:');
    for (const file of riskyTrackedFiles) {
      console.error(`- ${file}`);
    }
  }

  if (secretFindings.length > 0) {
    console.error('\nHigh-confidence secret patterns found:');
    for (const finding of secretFindings) {
      console.error(`- ${finding.file}:${finding.line} (${finding.type})`);
    }
  }

  process.exit(1);
}

main();
