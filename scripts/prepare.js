#!/usr/bin/env node

/**
 * VoiceIntelli Prepare Script
 *
 * Standalone setup script that detects and installs system-level dependencies
 * required to run the VoiceIntelli application on Windows. This script can be
 * run as an npm lifecycle hook (prepare) or directly from the command line.
 *
 * Dependencies managed:
 * - Visual Studio C++ Build Tools (required for Rust compilation)
 * - Rust toolchain (required for Tauri backend)
 * - WebView2 Runtime (required for Tauri webview)
 *
 * Usage:
 *   node scripts/prepare.js [command]
 *
 * Commands:
 *   (none)     Run full setup with installation prompts
 *   --check    Check dependency status without installing
 *   --ci       CI mode: silent check, exits 0 (ready) or 1 (missing deps)
 *   --help     Show this help message
 *
 * Exit Codes:
 *   0 - All dependencies installed (ready to build)
 *   1 - Missing dependencies or error occurred
 *
 * @module prepare
 * @see setup-utils.js for utility functions used by this script
 */

const path = require('path');
const {
  log,
  logSection,
  runCommand,
  runCommandAsync,
  commandExists,
  checkRegistry,
  compareVersions,
  installVSBuildTools,
  installRust,
  installWebView2,
  checkDiskSpace,
  isAdmin,
  hasSufficientDiskSpace,
  formatBytes,
  COLORS,
  PROJECT_ROOT,
} = require('./setup-utils');

// Minimum required versions
const REQUIRED_VERSIONS = {
  rust: '1.77.2',
};

// WebView2 registry key for detection
const WEBVIEW2_REGISTRY_KEY = 'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

// Dependency URLs
const DEPENDENCY_URLS = {
  vsBuildTools: 'https://aka.ms/vs/17/release/vs_buildtools.exe',
  rustup: 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe',
  webview2: 'https://go.microsoft.com/fwlink/p/?LinkId=2124703',
};

/**
 * Check if Visual Studio Build Tools with VC tools are installed.
 *
 * Uses vswhere.exe to detect VS Build Tools installations that include
 * the Microsoft.VisualStudio.Component.VC.Tools.x86.x64 component,
 * which is required for compiling Rust code targeting Windows MSVC.
 *
 * @returns {Promise<{installed: boolean, version?: string, path?: string}>}
 *   - installed: true if VS Build Tools with VC tools is found
 *   - version: installation version (if available)
 *   - path: installation path (if available)
 */
async function checkVSBuildTools() {
  // First check if vswhere exists (comes with VS installer)
  const vswhereLocations = [
    'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\Installer\\vswhere.exe',
  ];

  let vswherePath = null;
  for (const loc of vswhereLocations) {
    try {
      const result = runCommand(`if exist "${loc}" echo found`, { silent: true, ignoreError: true });
      if (result.output.includes('found')) {
        vswherePath = loc;
        break;
      }
    } catch {
      // Continue checking
    }
  }

  if (!vswherePath) {
    return { installed: false };
  }

  // Query for VC Tools component
  const result = runCommand(
    `"${vswherePath}" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`,
    { silent: true, ignoreError: true }
  );

  if (result.success && result.output.trim()) {
    return {
      installed: true,
      path: result.output.trim().split('\n')[0],
    };
  }

  return { installed: false };
}

/**
 * Check if Rust is installed and meets version requirements.
 *
 * Verifies that rustc is available in PATH and that its version
 * meets the minimum requirement defined in REQUIRED_VERSIONS.rust.
 *
 * @returns {Promise<{installed: boolean, version?: string, meetsMinimum: boolean}>}
 *   - installed: true if rustc command is found in PATH
 *   - version: rustc version string (e.g., "1.77.2")
 *   - meetsMinimum: true if version >= REQUIRED_VERSIONS.rust
 */
async function checkRust() {
  const exists = await commandExists('rustc');

  if (!exists.exists) {
    return { installed: false, meetsMinimum: false };
  }

  // Get version
  const result = runCommand('rustc --version', { silent: true, ignoreError: true });

  if (result.success) {
    const versionMatch = result.output.match(/rustc (\d+\.\d+\.\d+)/);
    if (versionMatch) {
      const version = versionMatch[1];
      const meetsMinimum = compareVersions(version, REQUIRED_VERSIONS.rust) >= 0;
      return {
        installed: true,
        version,
        meetsMinimum,
      };
    }
  }

  return { installed: true, meetsMinimum: false };
}

/**
 * Check if WebView2 Runtime is installed via Windows registry.
 *
 * Queries the EdgeUpdate registry key to detect WebView2 Runtime
 * installation. WebView2 is required for Tauri's webview functionality
 * on Windows.
 *
 * @returns {Promise<{installed: boolean, version?: string}>}
 *   - installed: true if WebView2 Runtime is detected
 *   - version: WebView2 version string (if available)
 */
async function checkWebView2() {
  const result = await checkRegistry(WEBVIEW2_REGISTRY_KEY, 'pv');

  if (result.exists && result.value) {
    return {
      installed: true,
      version: result.value,
    };
  }

  return { installed: false };
}

/**
 * Display a formatted table showing the status of all dependencies.
 *
 * Renders a visual table with colored status indicators for each
 * dependency (VS Build Tools, Rust, WebView2). Uses ANSI colors
 * to indicate installed (green), missing (red), or needs update (yellow).
 *
 * @param {Object} status - Status object containing dependency check results
 * @param {Object} status.vsBuildTools - VS Build Tools check result
 * @param {boolean} status.vsBuildTools.installed - Whether VS Build Tools is installed
 * @param {string} [status.vsBuildTools.path] - Installation path if available
 * @param {Object} status.rust - Rust check result
 * @param {boolean} status.rust.installed - Whether Rust is installed
 * @param {string} [status.rust.version] - Rust version if installed
 * @param {boolean} status.rust.meetsMinimum - Whether version meets requirements
 * @param {Object} status.webview2 - WebView2 check result
 * @param {boolean} status.webview2.installed - Whether WebView2 is installed
 * @param {string} [status.webview2.version] - WebView2 version if installed
 * @returns {void}
 */
function displayStatus(status) {
  const { vsBuildTools, rust, webview2 } = status;

  console.log('');
  console.log('  Dependency Status:');
  console.log('  ' + '-'.repeat(56));

  // VS Build Tools
  const vsStatus = vsBuildTools.installed
    ? `${COLORS.green}Installed${COLORS.reset}`
    : `${COLORS.red}Not Found${COLORS.reset}`;
  console.log(`  VS Build Tools (MSVC):   ${vsStatus}`);
  if (vsBuildTools.path) {
    console.log(`                           ${COLORS.gray}${vsBuildTools.path}${COLORS.reset}`);
  }

  // Rust
  let rustStatus;
  if (rust.installed && rust.meetsMinimum) {
    rustStatus = `${COLORS.green}Installed${COLORS.reset} (v${rust.version})`;
  } else if (rust.installed) {
    rustStatus = `${COLORS.yellow}Update Required${COLORS.reset} (v${rust.version} < ${REQUIRED_VERSIONS.rust})`;
  } else {
    rustStatus = `${COLORS.red}Not Found${COLORS.reset}`;
  }
  console.log(`  Rust:                    ${rustStatus}`);

  // WebView2
  const wv2Status = webview2.installed
    ? `${COLORS.green}Installed${COLORS.reset}${webview2.version ? ` (v${webview2.version})` : ''}`
    : `${COLORS.red}Not Found${COLORS.reset}`;
  console.log(`  WebView2 Runtime:        ${wv2Status}`);

  console.log('  ' + '-'.repeat(56));
  console.log('');
}

/**
 * Check all required dependencies in parallel.
 *
 * Runs dependency checks for VS Build Tools, Rust, and WebView2
 * concurrently for faster execution. Used by all command modes
 * to determine the current installation status.
 *
 * @param {Object} [options={}] - Options for the check
 * @param {boolean} [options.silent=false] - Suppress log output (for CI mode)
 * @returns {Promise<{vsBuildTools: Object, rust: Object, webview2: Object}>}
 *   Object containing status results for each dependency
 */
async function checkAllDependencies(options = {}) {
  const { silent = false } = options;

  if (!silent) {
    log('Checking installed dependencies...', 'info');
  }

  const [vsBuildTools, rust, webview2] = await Promise.all([
    checkVSBuildTools(),
    checkRust(),
    checkWebView2(),
  ]);

  return { vsBuildTools, rust, webview2 };
}

/**
 * Calculate overall system readiness based on dependency status.
 *
 * Analyzes the dependency status object to determine if all required
 * dependencies are installed and meet version requirements.
 *
 * @param {Object} status - Dependency status object from checkAllDependencies()
 * @param {Object} status.vsBuildTools - VS Build Tools check result
 * @param {Object} status.rust - Rust check result
 * @param {Object} status.webview2 - WebView2 check result
 * @returns {{ready: boolean, missing: string[]}}
 *   - ready: true if all dependencies are installed and meet requirements
 *   - missing: array of human-readable names of missing dependencies
 */
function calculateReadiness(status) {
  const missing = [];

  if (!status.vsBuildTools.installed) {
    missing.push('VS Build Tools');
  }
  if (!status.rust.installed || !status.rust.meetsMinimum) {
    missing.push('Rust');
  }
  if (!status.webview2.installed) {
    missing.push('WebView2 Runtime');
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Command handler for --check mode.
 *
 * Checks all dependency statuses and displays the results in a
 * formatted table. Provides guidance on next steps based on the
 * current status. Does not perform any installations.
 *
 * Exit codes:
 *   0 - All dependencies installed
 *   1 - One or more dependencies missing
 *
 * @returns {Promise<void>} Resolves after displaying status and exiting
 */
async function cmdCheck() {
  logSection('VoiceIntelli Setup - Dependency Status');

  const status = await checkAllDependencies();
  displayStatus(status);

  const readiness = calculateReadiness(status);

  if (readiness.ready) {
    log('All dependencies are installed! VoiceIntelli is ready to build.', 'success');
    console.log('');
    log('Run "npm run tauri:dev" to start development.', 'info');
    process.exit(0);
  } else {
    log(`Missing dependencies: ${readiness.missing.join(', ')}`, 'warn');
    console.log('');
    log('Run "node scripts/prepare.js" to install missing dependencies.', 'info');
    process.exit(1);
  }
}

/**
 * Command handler for default (no arguments) mode.
 *
 * Runs the full setup workflow: checks dependencies, displays status,
 * and provides installation instructions for any missing dependencies.
 * This is the primary user-facing mode for first-time setup.
 *
 * Exit codes:
 *   0 - All dependencies installed (setup complete)
 *   1 - Missing dependencies (instructions provided)
 *
 * @returns {Promise<void>} Resolves after completing setup workflow
 */
async function cmdSetup() {
  logSection('VoiceIntelli Setup Installer');

  log('Welcome to VoiceIntelli Setup!', 'info');
  console.log('');
  console.log('  This installer will check and install the following dependencies:');
  console.log('  - Visual Studio C++ Build Tools (required for Rust compilation)');
  console.log('  - Rust toolchain (required for Tauri backend)');
  console.log('  - WebView2 Runtime (required for Tauri webview)');
  console.log('');

  // Check current status
  const status = await checkAllDependencies();
  displayStatus(status);

  const readiness = calculateReadiness(status);

  if (readiness.ready) {
    logSection('Setup Complete');
    log('All dependencies are already installed!', 'success');
    console.log('');
    console.log('  Next steps:');
    console.log('  1. Open the VoiceIntelli app');
    console.log('  2. Go to Settings to configure API keys and offline components');
    console.log('  3. Download whisper models for offline transcription');
    console.log('');
    log('For development: npm run tauri:dev', 'info');
    process.exit(0);
  }

  // Show what needs to be installed
  log(`The following dependencies need to be installed: ${readiness.missing.join(', ')}`, 'warn');
  console.log('');
  log('Installation will begin in the next phase.', 'info');
  log('Note: Some installations may require administrator privileges.', 'info');
  console.log('');

  // Installation logic will be implemented in subtask-3-*
  // For now, provide instructions
  logSection('Manual Installation Instructions');

  if (!status.vsBuildTools.installed) {
    console.log('  VS Build Tools:');
    console.log(`    Download: ${DEPENDENCY_URLS.vsBuildTools}`);
    console.log('    Run the installer and select "Desktop development with C++"');
    console.log('');
  }

  if (!status.rust.installed || !status.rust.meetsMinimum) {
    console.log('  Rust:');
    console.log(`    Download: ${DEPENDENCY_URLS.rustup}`);
    console.log('    Run rustup-init.exe and follow the prompts');
    console.log('    Note: VS Build Tools must be installed first');
    console.log('');
  }

  if (!status.webview2.installed) {
    console.log('  WebView2 Runtime:');
    console.log(`    Download: ${DEPENDENCY_URLS.webview2}`);
    console.log('    Run the installer (usually pre-installed on Windows 10/11)');
    console.log('');
  }

  log('After installing, run this setup again to verify.', 'info');
  process.exit(1);
}

/**
 * Command handler for --ci mode (CI/automated environments).
 *
 * Performs a silent dependency check without any interactive prompts
 * or verbose output. Designed for use in CI pipelines, npm lifecycle
 * hooks, and automated scripts where minimal output is preferred.
 *
 * Output:
 *   - On success: No output (silent)
 *   - On failure: Single line listing missing dependencies
 *
 * Exit codes:
 *   0 - All dependencies installed (ready to build)
 *   1 - One or more dependencies missing
 *
 * @returns {Promise<void>} Resolves after check completes and process exits
 */
async function cmdCi() {
  const status = await checkAllDependencies({ silent: true });
  const readiness = calculateReadiness(status);

  if (readiness.ready) {
    process.exit(0);
  } else {
    // Only output missing dependencies for CI logs
    console.log(`Missing: ${readiness.missing.join(', ')}`);
    process.exit(1);
  }
}

/**
 * Print usage information and command help to stdout.
 *
 * Displays a formatted help message showing available commands,
 * their descriptions, managed dependencies, and usage examples.
 *
 * @returns {void}
 */
function printHelp() {
  console.log(`
${COLORS.blue}VoiceIntelli Setup Installer${COLORS.reset}

Usage: node scripts/prepare.js [command]

Commands:
  (none)     Run full setup with installation prompts
  --check    Check dependency status without installing
  --ci       CI mode: silent check, exits 0 (ready) or 1 (missing deps)
  --help     Show this help message

Dependencies Managed:
  - Visual Studio C++ Build Tools (MSVC compiler)
  - Rust toolchain (stable, x86_64-pc-windows-msvc)
  - WebView2 Runtime

Examples:
  node scripts/prepare.js           # Run full setup
  node scripts/prepare.js --check   # Check status only
  node scripts/prepare.js --ci      # CI mode (silent check)
  node scripts/prepare.js --help    # Show help

For more information, see the VoiceIntelli documentation.
`);
}

/**
 * Check if the script is running as part of an npm lifecycle event.
 *
 * When npm runs lifecycle scripts (like 'prepare' during npm install),
 * it sets the npm_lifecycle_event environment variable. We use this to
 * detect automated contexts where interactive prompts should be avoided.
 *
 * @returns {boolean} True if running as npm lifecycle script
 */
function isNpmLifecycleContext() {
  return !!process.env.npm_lifecycle_event;
}

/**
 * Main entry point for the prepare script.
 *
 * Parses command-line arguments and dispatches to the appropriate
 * command handler. Handles errors gracefully with informative messages.
 *
 * When running as an npm lifecycle hook (e.g., during 'npm install'),
 * the script automatically runs in check-only mode to avoid interactive
 * prompts that could block automated installations.
 *
 * Supported commands:
 *   --help, -h : Show help message
 *   --check, -c: Check dependency status
 *   --ci       : CI mode (silent check)
 *   (none)     : Full setup mode (or check-only if in npm lifecycle context)
 *
 * @returns {Promise<void>} Resolves when command completes
 */
async function main() {
  const args = process.argv.slice(2);
  let command = args[0];

  // If running as npm lifecycle hook (e.g., 'npm install' triggering 'prepare'),
  // automatically switch to check-only mode to avoid blocking prompts
  if (!command && isNpmLifecycleContext()) {
    const lifecycleEvent = process.env.npm_lifecycle_event;
    log(`Running as npm lifecycle hook (${lifecycleEvent}), using check-only mode`, 'info');
    command = '--check';
  }

  try {
    switch (command) {
      case '--help':
      case '-h':
        printHelp();
        break;
      case '--check':
      case '-c':
        await cmdCheck();
        break;
      case '--ci':
        await cmdCi();
        break;
      case undefined:
        await cmdSetup();
        break;
      default:
        log(`Unknown command: ${command}`, 'error');
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    log(`Setup failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
