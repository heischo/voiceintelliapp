#!/usr/bin/env node

/**
 * Version Bump Utility for Voice Intelligence
 *
 * Manages version synchronization across:
 * - package.json
 * - src-tauri/Cargo.toml
 * - src-tauri/tauri.conf.json
 *
 * Usage:
 *   node scripts/bump-version.js [command]
 *
 * Commands:
 *   check - Verify all versions are synchronized
 *   patch - Increment patch version (0.1.0 -> 0.1.1)
 *   minor - Increment minor version (0.1.0 -> 0.2.0)
 *   major - Increment major version (0.1.0 -> 1.0.0)
 */

const fs = require('fs');
const path = require('path');

// File paths relative to project root
const PROJECT_ROOT = path.join(__dirname, '..');
const FILES = {
  packageJson: path.join(PROJECT_ROOT, 'package.json'),
  cargoToml: path.join(PROJECT_ROOT, 'src-tauri', 'Cargo.toml'),
  tauriConf: path.join(PROJECT_ROOT, 'src-tauri', 'tauri.conf.json'),
};

// Semantic version regex
const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

/**
 * Parse semantic version string into components
 * @param {string} version - Version string (e.g., "0.1.0")
 * @returns {{ major: number, minor: number, patch: number } | null}
 */
function parseVersion(version) {
  const match = version.match(SEMVER_REGEX);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Format version components back to string
 * @param {{ major: number, minor: number, patch: number }} version
 * @returns {string}
 */
function formatVersion(version) {
  return `${version.major}.${version.minor}.${version.patch}`;
}

/**
 * Read version from package.json
 * @returns {string}
 */
function readPackageJsonVersion() {
  const content = JSON.parse(fs.readFileSync(FILES.packageJson, 'utf-8'));
  return content.version;
}

/**
 * Read version from Cargo.toml
 * @returns {string}
 */
function readCargoTomlVersion() {
  const content = fs.readFileSync(FILES.cargoToml, 'utf-8');
  // Match version in [package] section - the version line under [package]
  const match = content.match(/^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error('Could not find version in Cargo.toml');
  }
  return match[1];
}

/**
 * Read version from tauri.conf.json
 * @returns {string}
 */
function readTauriConfVersion() {
  const content = JSON.parse(fs.readFileSync(FILES.tauriConf, 'utf-8'));
  return content.version;
}

/**
 * Write version to package.json
 * @param {string} version
 */
function writePackageJsonVersion(version) {
  const content = JSON.parse(fs.readFileSync(FILES.packageJson, 'utf-8'));
  content.version = version;
  fs.writeFileSync(FILES.packageJson, JSON.stringify(content, null, 2) + '\n', 'utf-8');
}

/**
 * Write version to Cargo.toml
 * @param {string} version
 */
function writeCargoTomlVersion(version) {
  let content = fs.readFileSync(FILES.cargoToml, 'utf-8');
  // Replace version in [package] section
  content = content.replace(
    /(^\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m,
    `$1"${version}"`
  );
  fs.writeFileSync(FILES.cargoToml, content, 'utf-8');
}

/**
 * Write version to tauri.conf.json
 * @param {string} version
 */
function writeTauriConfVersion(version) {
  const content = JSON.parse(fs.readFileSync(FILES.tauriConf, 'utf-8'));
  content.version = version;
  fs.writeFileSync(FILES.tauriConf, JSON.stringify(content, null, 2) + '\n', 'utf-8');
}

/**
 * Read all versions and check for mismatches
 * @returns {{ packageJson: string, cargoToml: string, tauriConf: string, synced: boolean }}
 */
function checkVersions() {
  const versions = {
    packageJson: readPackageJsonVersion(),
    cargoToml: readCargoTomlVersion(),
    tauriConf: readTauriConfVersion(),
  };

  const synced = versions.packageJson === versions.cargoToml &&
                 versions.cargoToml === versions.tauriConf;

  return { ...versions, synced };
}

/**
 * Increment version based on bump type
 * @param {string} currentVersion
 * @param {'patch' | 'minor' | 'major'} bumpType
 * @returns {string}
 */
function incrementVersion(currentVersion, bumpType) {
  const parsed = parseVersion(currentVersion);
  if (!parsed) {
    throw new Error(`Invalid version format: ${currentVersion}`);
  }

  switch (bumpType) {
    case 'patch':
      parsed.patch += 1;
      break;
    case 'minor':
      parsed.minor += 1;
      parsed.patch = 0;
      break;
    case 'major':
      parsed.major += 1;
      parsed.minor = 0;
      parsed.patch = 0;
      break;
    default:
      throw new Error(`Unknown bump type: ${bumpType}`);
  }

  return formatVersion(parsed);
}

/**
 * Command: check
 * Verify all versions are synchronized
 */
function cmdCheck() {
  const result = checkVersions();

  console.log('Version Check:');
  console.log(`  package.json:     ${result.packageJson}`);
  console.log(`  Cargo.toml:       ${result.cargoToml}`);
  console.log(`  tauri.conf.json:  ${result.tauriConf}`);
  console.log('');

  if (result.synced) {
    console.log(`All versions synchronized at ${result.packageJson}`);
    process.exit(0);
  } else {
    console.error('ERROR: Version mismatch detected!');
    process.exit(1);
  }
}

/**
 * Command: bump (patch/minor/major)
 * Increment version in all files
 * @param {'patch' | 'minor' | 'major'} bumpType
 */
function cmdBump(bumpType) {
  // First check that versions are synced
  const result = checkVersions();

  if (!result.synced) {
    console.error('ERROR: Cannot bump version - versions are not synchronized');
    console.error(`  package.json:     ${result.packageJson}`);
    console.error(`  Cargo.toml:       ${result.cargoToml}`);
    console.error(`  tauri.conf.json:  ${result.tauriConf}`);
    console.error('');
    console.error('Please run "node scripts/bump-version.js check" and manually sync versions first.');
    process.exit(1);
  }

  const currentVersion = result.packageJson;
  const newVersion = incrementVersion(currentVersion, bumpType);

  // Validate the new version
  if (!parseVersion(newVersion)) {
    console.error(`ERROR: Generated invalid version: ${newVersion}`);
    process.exit(1);
  }

  // Write to all files
  writePackageJsonVersion(newVersion);
  writeCargoTomlVersion(newVersion);
  writeTauriConfVersion(newVersion);

  console.log(`Version bumped: ${currentVersion} -> ${newVersion}`);
  console.log('');
  console.log('Updated files:');
  console.log('  - package.json');
  console.log('  - src-tauri/Cargo.toml');
  console.log('  - src-tauri/tauri.conf.json');
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Usage: node scripts/bump-version.js [command]

Commands:
  check   Verify all versions are synchronized
  patch   Increment patch version (0.1.0 -> 0.1.1)
  minor   Increment minor version (0.1.0 -> 0.2.0)
  major   Increment major version (0.1.0 -> 1.0.0)

Examples:
  node scripts/bump-version.js check
  node scripts/bump-version.js patch
  npm run version:check
  npm run version:patch
`);
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  printUsage();
  process.exit(1);
}

switch (command) {
  case 'check':
    cmdCheck();
    break;
  case 'patch':
  case 'minor':
  case 'major':
    cmdBump(command);
    break;
  case '--help':
  case '-h':
    printUsage();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    printUsage();
    process.exit(1);
}
