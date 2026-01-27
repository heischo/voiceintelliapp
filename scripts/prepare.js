#!/usr/bin/env node

/**
 * VoiceIntelli Setup Installer
 *
 * Standalone setup script that detects and installs system-level dependencies
 * required to run the VoiceIntelli application on Windows.
 *
 * Dependencies managed:
 * - Visual Studio C++ Build Tools (required for Rust compilation)
 * - Rust (required for Tauri backend)
 * - WebView2 Runtime (required for Tauri webview)
 *
 * Usage:
 *   node scripts/setup.js [command]
 *
 * Commands:
 *   (none)     Run full setup with installation prompts
 *   --check    Check dependency status without installing
 *   --help     Show this help message
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
 * Check if VS Build Tools with VC tools are installed using vswhere.exe
 * @returns {Promise<{ installed: boolean, version?: string, path?: string }>}
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
 * Check if Rust is installed and meets version requirements
 * @returns {Promise<{ installed: boolean, version?: string, meetsMinimum: boolean }>}
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
 * Check if WebView2 Runtime is installed via registry
 * @returns {Promise<{ installed: boolean, version?: string }>}
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
 * Display dependency status table
 * @param {Object} status - Status object with dependency check results
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
 * Check all dependencies and return status
 * @returns {Promise<Object>} Status of all dependencies
 */
async function checkAllDependencies() {
  log('Checking installed dependencies...', 'info');

  const [vsBuildTools, rust, webview2] = await Promise.all([
    checkVSBuildTools(),
    checkRust(),
    checkWebView2(),
  ]);

  return { vsBuildTools, rust, webview2 };
}

/**
 * Calculate overall readiness
 * @param {Object} status - Dependency status object
 * @returns {{ ready: boolean, missing: string[] }}
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
 * Command: --check
 * Check dependency status and exit
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
    log('Run "node scripts/setup.js" to install missing dependencies.', 'info');
    process.exit(1);
  }
}

/**
 * Command: (default)
 * Run full setup with installation prompts
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
 * Print usage information
 */
function printHelp() {
  console.log(`
${COLORS.blue}VoiceIntelli Setup Installer${COLORS.reset}

Usage: node scripts/setup.js [command]

Commands:
  (none)     Run full setup with installation prompts
  --check    Check dependency status without installing
  --help     Show this help message

Dependencies Managed:
  - Visual Studio C++ Build Tools (MSVC compiler)
  - Rust toolchain (stable, x86_64-pc-windows-msvc)
  - WebView2 Runtime

Examples:
  node scripts/setup.js           # Run full setup
  node scripts/setup.js --check   # Check status only
  node scripts/setup.js --help    # Show help

For more information, see the VoiceIntelli documentation.
`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

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
