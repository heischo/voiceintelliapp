#!/usr/bin/env node

/**
 * Setup Utilities for VoiceIntelli Setup Installer
 *
 * Provides utility functions for:
 * - Colored logging output
 * - Command execution with error handling
 * - File downloads using PowerShell
 * - Windows registry checks
 *
 * @module setup-utils
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

// Constants
const SCRIPT_DIR = __dirname;
const PROJECT_ROOT = path.join(SCRIPT_DIR, '..');
const TEMP_DIR = path.join(os.tmpdir(), 'voiceintelli-setup');

// ANSI color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Log a message with colored prefix based on type
 * @param {string} message - The message to log
 * @param {'info' | 'success' | 'error' | 'warn' | 'step'} type - Log type for coloring
 */
function log(message, type = 'info') {
  const colorMap = {
    info: COLORS.blue,
    success: COLORS.green,
    error: COLORS.red,
    warn: COLORS.yellow,
    step: COLORS.gray,
  };

  const prefixMap = {
    info: 'INFO',
    success: 'SUCCESS',
    error: 'ERROR',
    warn: 'WARN',
    step: 'STEP',
  };

  const color = colorMap[type] || COLORS.blue;
  const prefix = prefixMap[type] || 'INFO';

  console.log(`${color}[${prefix}]${COLORS.reset} ${message}`);
}

/**
 * Log a section header for better visual organization
 * @param {string} title - Section title to display
 */
function logSection(title) {
  console.log('');
  console.log(`${COLORS.blue}${'='.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.blue}  ${title}${COLORS.reset}`);
  console.log(`${COLORS.blue}${'='.repeat(60)}${COLORS.reset}`);
  console.log('');
}

/**
 * Run a command synchronously with error handling
 * @param {string} command - Command to execute
 * @param {Object} options - Execution options
 * @param {boolean} options.silent - Suppress output logging
 * @param {boolean} options.ignoreError - Don't throw on non-zero exit
 * @param {string} options.cwd - Working directory for command
 * @returns {{ success: boolean, output: string, exitCode: number }}
 */
function runCommand(command, options = {}) {
  const { silent = false, ignoreError = false, cwd = process.cwd() } = options;

  if (!silent) {
    log(`Running: ${command}`, 'step');
  }

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      cwd,
      stdio: silent ? 'pipe' : 'inherit',
      windowsHide: true,
    });

    return {
      success: true,
      output: output || '',
      exitCode: 0,
    };
  } catch (error) {
    const exitCode = error.status || 1;
    const output = error.stdout ? error.stdout.toString() : '';
    const errorOutput = error.stderr ? error.stderr.toString() : error.message;

    if (!ignoreError) {
      log(`Command failed with exit code ${exitCode}: ${errorOutput}`, 'error');
    }

    return {
      success: false,
      output: output + errorOutput,
      exitCode,
    };
  }
}

/**
 * Run a command asynchronously with real-time output
 * @param {string} command - Command to execute
 * @param {string[]} args - Command arguments
 * @param {Object} options - Execution options
 * @param {boolean} options.silent - Suppress output logging
 * @param {string} options.cwd - Working directory for command
 * @returns {Promise<{ success: boolean, output: string, exitCode: number }>}
 */
function runCommandAsync(command, args = [], options = {}) {
  const { silent = false, cwd = process.cwd() } = options;

  return new Promise((resolve) => {
    if (!silent) {
      log(`Running: ${command} ${args.join(' ')}`, 'step');
    }

    const child = spawn(command, args, {
      cwd,
      shell: true,
      windowsHide: true,
      stdio: silent ? 'pipe' : 'inherit',
    });

    let output = '';

    if (silent) {
      child.stdout?.on('data', (data) => {
        output += data.toString();
      });
      child.stderr?.on('data', (data) => {
        output += data.toString();
      });
    }

    child.on('close', (exitCode) => {
      resolve({
        success: exitCode === 0,
        output,
        exitCode: exitCode || 0,
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        output: error.message,
        exitCode: 1,
      });
    });
  });
}

/**
 * Download a file using PowerShell Invoke-WebRequest
 * @param {string} url - URL to download from
 * @param {string} destPath - Destination file path
 * @param {Object} options - Download options
 * @param {boolean} options.silent - Suppress progress output
 * @returns {Promise<{ success: boolean, path: string, error?: string }>}
 */
async function downloadFile(url, destPath, options = {}) {
  const { silent = false } = options;

  // Ensure destination directory exists
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (!silent) {
    log(`Downloading: ${url}`, 'info');
    log(`Destination: ${destPath}`, 'step');
  }

  // Use PowerShell for reliable Windows downloads with progress
  const psCommand = `
    $ProgressPreference = 'SilentlyContinue'
    try {
      Invoke-WebRequest -Uri '${url}' -OutFile '${destPath.replace(/\\/g, '\\\\')}' -UseBasicParsing
      Write-Output 'DOWNLOAD_SUCCESS'
    } catch {
      Write-Error $_.Exception.Message
      exit 1
    }
  `.trim();

  const result = await runCommandAsync('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    psCommand,
  ], { silent: true });

  if (result.success && fs.existsSync(destPath)) {
    if (!silent) {
      log(`Download complete: ${destPath}`, 'success');
    }
    return {
      success: true,
      path: destPath,
    };
  } else {
    const errorMsg = result.output || 'Unknown download error';
    if (!silent) {
      log(`Download failed: ${errorMsg}`, 'error');
    }
    return {
      success: false,
      path: destPath,
      error: errorMsg,
    };
  }
}

/**
 * Check Windows registry for a key/value
 * @param {string} keyPath - Registry key path (e.g., 'HKLM\\SOFTWARE\\Microsoft\\...')
 * @param {string} valueName - Value name to read (optional, reads default if empty)
 * @returns {Promise<{ exists: boolean, value?: string, error?: string }>}
 */
async function checkRegistry(keyPath, valueName = '') {
  // Use PowerShell to query registry
  const valueArg = valueName ? `-Name '${valueName}'` : '';
  const psCommand = `
    try {
      $value = Get-ItemProperty -Path 'Registry::${keyPath}' ${valueArg} -ErrorAction Stop
      if ('${valueName}') {
        Write-Output $value.'${valueName}'
      } else {
        Write-Output $value.'(Default)'
      }
    } catch {
      exit 1
    }
  `.trim();

  const result = await runCommandAsync('powershell', [
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    psCommand,
  ], { silent: true });

  if (result.success) {
    return {
      exists: true,
      value: result.output.trim(),
    };
  } else {
    return {
      exists: false,
      error: result.output || 'Registry key not found',
    };
  }
}

/**
 * Check if a command exists in PATH
 * @param {string} command - Command name to check
 * @returns {Promise<{ exists: boolean, path?: string }>}
 */
async function commandExists(command) {
  const result = await runCommandAsync('where', [command], { silent: true });

  if (result.success && result.output.trim()) {
    return {
      exists: true,
      path: result.output.trim().split('\n')[0],
    };
  }

  return { exists: false };
}

/**
 * Ensure temp directory exists and return path
 * @returns {string} Path to temp directory
 */
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  return TEMP_DIR;
}

/**
 * Clean up temp directory
 */
function cleanupTempDir() {
  if (fs.existsSync(TEMP_DIR)) {
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      log('Cleaned up temporary files', 'step');
    } catch (error) {
      log(`Warning: Could not clean temp directory: ${error.message}`, 'warn');
    }
  }
}

/**
 * Parse a semantic version string
 * @param {string} version - Version string (e.g., "1.77.2")
 * @returns {{ major: number, minor: number, patch: number } | null}
 */
function parseVersion(version) {
  const match = version.match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two version strings
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const p1 = parseVersion(v1);
  const p2 = parseVersion(v2);

  if (!p1 || !p2) return 0;

  if (p1.major !== p2.major) return p1.major > p2.major ? 1 : -1;
  if (p1.minor !== p2.minor) return p1.minor > p2.minor ? 1 : -1;
  if (p1.patch !== p2.patch) return p1.patch > p2.patch ? 1 : -1;

  return 0;
}

/**
 * Format bytes to human readable size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Check available disk space on the specified drive or system drive
 * Uses PowerShell Get-PSDrive on Windows to query disk space
 *
 * @param {string} [driveLetter] - Drive letter to check (e.g., 'C'). Defaults to system drive.
 * @returns {Promise<{ success: boolean, freeBytes: number, totalBytes: number, freeFormatted: string, error?: string }>}
 */
async function checkDiskSpace(driveLetter) {
  // Default to system drive (usually C:)
  const drive = driveLetter || process.env.SystemDrive?.charAt(0) || 'C';

  // Use PowerShell Get-PSDrive which is available on all modern Windows
  // Output format: Free|Used (bytes)
  const psCommand = `$d=Get-PSDrive ${drive} -ErrorAction SilentlyContinue;if($d){$d.Free.ToString()+'|'+($d.Used+$d.Free).ToString()}else{exit 1}`;

  const result = runCommand(
    `powershell -NoProfile -NonInteractive -Command "${psCommand}"`,
    { silent: true, ignoreError: true }
  );

  if (!result.success || !result.output.trim()) {
    return {
      success: false,
      freeBytes: 0,
      totalBytes: 0,
      freeFormatted: '0 B',
      error: result.output || `Failed to query disk space for drive ${drive}:`,
    };
  }

  const output = result.output.trim();
  const parts = output.split('|');

  if (parts.length !== 2) {
    return {
      success: false,
      freeBytes: 0,
      totalBytes: 0,
      freeFormatted: '0 B',
      error: `Unexpected disk space output format: ${output}`,
    };
  }

  const freeBytes = parseInt(parts[0], 10);
  const totalBytes = parseInt(parts[1], 10);

  if (isNaN(freeBytes) || isNaN(totalBytes)) {
    return {
      success: false,
      freeBytes: 0,
      totalBytes: 0,
      freeFormatted: '0 B',
      error: `Failed to parse disk space values from: ${output}`,
    };
  }

  return {
    success: true,
    freeBytes,
    totalBytes,
    freeFormatted: formatBytes(freeBytes),
  };
}

/**
 * Check if the current process is running with administrator privileges
 * Uses 'net session' command which requires admin rights
 *
 * @returns {Promise<{ isAdmin: boolean, error?: string }>}
 */
async function isAdmin() {
  // Method 1: Try 'net session' which requires admin privileges
  // This is a reliable way to check for admin rights on Windows
  // 'net session' will fail with access denied if not running as admin
  const result = runCommand('net session', { silent: true, ignoreError: true });

  // If 'net session' succeeds (exit code 0), we have admin rights
  // If it fails with access denied, we don't have admin rights
  if (result.success) {
    return { isAdmin: true };
  }

  // The 'net session' command failed, which typically means no admin rights
  // This is the expected behavior for non-admin users
  return { isAdmin: false };
}

/**
 * Check if there is sufficient disk space for an operation
 * Convenience function that checks against a minimum requirement
 *
 * @param {number} requiredBytes - Minimum required bytes
 * @param {string} [driveLetter] - Drive letter to check (defaults to system drive)
 * @returns {Promise<{ sufficient: boolean, freeBytes: number, requiredBytes: number, freeFormatted: string, requiredFormatted: string, error?: string }>}
 */
async function hasSufficientDiskSpace(requiredBytes, driveLetter) {
  const diskInfo = await checkDiskSpace(driveLetter);

  if (!diskInfo.success) {
    return {
      sufficient: false,
      freeBytes: 0,
      requiredBytes,
      freeFormatted: '0 B',
      requiredFormatted: formatBytes(requiredBytes),
      error: diskInfo.error,
    };
  }

  return {
    sufficient: diskInfo.freeBytes >= requiredBytes,
    freeBytes: diskInfo.freeBytes,
    requiredBytes,
    freeFormatted: diskInfo.freeFormatted,
    requiredFormatted: formatBytes(requiredBytes),
  };
}

/**
 * Pause execution for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the path to vswhere.exe
 * @returns {string | null} Path to vswhere.exe or null if not found
 */
function getVsWherePath() {
  // Standard location for vswhere.exe
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const vsWherePath = path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');

  if (fs.existsSync(vsWherePath)) {
    return vsWherePath;
  }

  return null;
}

/**
 * Check if Rust is installed using rustc --version
 * @returns {Promise<{ installed: boolean, version?: string, path?: string, error?: string }>}
 */
async function checkRust() {
  // First check if rustc exists in PATH
  const rustcExists = await commandExists('rustc');

  if (!rustcExists.exists) {
    return {
      installed: false,
      error: 'Rust compiler (rustc) not found in PATH',
    };
  }

  // Run rustc --version to get version info
  // Output format: "rustc 1.77.2 (25ef9e3d8 2024-04-09)"
  const result = await runCommandAsync('rustc', ['--version'], { silent: true });

  if (!result.success) {
    return {
      installed: false,
      error: `Failed to get Rust version: ${result.output}`,
    };
  }

  const output = result.output.trim();

  // Parse version from output: "rustc X.Y.Z (commit date)"
  const versionMatch = output.match(/^rustc\s+(\d+\.\d+\.\d+)/);

  if (!versionMatch) {
    return {
      installed: true,
      version: 'Unknown',
      path: rustcExists.path,
      error: `Could not parse version from: ${output}`,
    };
  }

  return {
    installed: true,
    version: versionMatch[1],
    path: rustcExists.path,
  };
}

/**
 * Check if WebView2 Runtime is installed using Windows registry
 * @returns {Promise<{ installed: boolean, version?: string, error?: string }>}
 */
async function checkWebView2() {
  // WebView2 registry location for Edge WebView2 Runtime
  // Client GUID: {F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}
  const registryPaths = [
    // 64-bit Windows, 32-bit Edge registry view
    'HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    // 64-bit Windows, 64-bit Edge registry view
    'HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
    // User-level installation
    'HKCU\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
  ];

  // Try each registry path
  for (const registryPath of registryPaths) {
    const result = await checkRegistry(registryPath, 'pv');

    if (result.exists && result.value) {
      return {
        installed: true,
        version: result.value,
      };
    }
  }

  // If no version found in standard locations, check if WebView2 is
  // installed as part of Windows 11 or newer Windows 10
  const systemWebView2 = await checkRegistry(
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\msedgewebview2.exe',
    ''
  );

  if (systemWebView2.exists) {
    return {
      installed: true,
      version: 'System installed (version unknown)',
    };
  }

  return {
    installed: false,
    error: 'WebView2 Runtime not found in registry',
  };
}

/**
 * Check if Visual Studio Build Tools with VC.Tools.x86.x64 is installed
 * Uses vswhere.exe for reliable detection
 * @returns {Promise<{ installed: boolean, version?: string, path?: string, error?: string }>}
 */
async function checkVSBuildTools() {
  const vsWherePath = getVsWherePath();

  // If vswhere.exe doesn't exist, VS Installer is not present
  if (!vsWherePath) {
    return {
      installed: false,
      error: 'Visual Studio Installer not found (vswhere.exe not present)',
    };
  }

  // Query for installations with VC.Tools.x86.x64 component
  // -products * includes Build Tools editions
  // -requires specifies the component we need
  // -format json for easy parsing
  // -latest to get the newest installation
  // Build command string directly to avoid shell arg escaping issues
  const vsWhereCommand = `"${vsWherePath}" -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json -latest`;

  return new Promise((resolve) => {
    const child = spawn(vsWhereCommand, [], {
      shell: true,
      windowsHide: true,
      stdio: 'pipe',
    });

    let output = '';
    let errorOutput = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (exitCode) => {
      if (exitCode !== 0 && exitCode !== null) {
        resolve({
          installed: false,
          error: `vswhere query failed: ${errorOutput || output}`,
        });
        return;
      }

      // Parse JSON output
      const trimmedOutput = output.trim();
      if (!trimmedOutput || trimmedOutput === '[]') {
        resolve({
          installed: false,
          error: 'No Visual Studio installation with VC.Tools.x86.x64 found',
        });
        return;
      }

      try {
        const installations = JSON.parse(trimmedOutput);

        if (!Array.isArray(installations) || installations.length === 0) {
          resolve({
            installed: false,
            error: 'No Visual Studio installation with VC.Tools.x86.x64 found',
          });
          return;
        }

        // Get the first (latest) installation
        const installation = installations[0];

        resolve({
          installed: true,
          version: installation.installationVersion || installation.catalog?.productDisplayVersion || 'Unknown',
          path: installation.installationPath,
          productName: installation.displayName || installation.productId,
        });
      } catch (parseError) {
        resolve({
          installed: false,
          error: `Failed to parse vswhere output: ${parseError.message}`,
        });
      }
    });

    child.on('error', (error) => {
      resolve({
        installed: false,
        error: `Failed to run vswhere: ${error.message}`,
      });
    });
  });
}

// VS Build Tools installation URLs and configuration
const VS_BUILD_TOOLS_URL = 'https://aka.ms/vs/17/release/vs_buildtools.exe';
const VS_BUILD_TOOLS_FILENAME = 'vs_buildtools.exe';

// Rust/rustup installation URLs and configuration
const RUSTUP_URL = 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe';
const RUSTUP_FILENAME = 'rustup-init.exe';

// WebView2 installation URLs and configuration
const WEBVIEW2_URL = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703';
const WEBVIEW2_FILENAME = 'MicrosoftEdgeWebView2RuntimeInstallerX64.exe';

/**
 * Install Visual Studio Build Tools with C++ workload
 *
 * Performs silent installation of VS Build Tools with the VCTools workload.
 * Handles exit code 3010 (reboot required) as success.
 *
 * @param {Object} options - Installation options
 * @param {boolean} options.silent - Suppress progress output
 * @param {Function} options.onProgress - Progress callback (stage, message)
 * @returns {Promise<{ success: boolean, rebootRequired: boolean, message: string, error?: string }>}
 */
async function installVSBuildTools(options = {}) {
  const { silent = false, onProgress } = options;

  const progress = (stage, message) => {
    if (!silent) {
      log(message, stage === 'error' ? 'error' : 'info');
    }
    if (onProgress) {
      onProgress(stage, message);
    }
  };

  progress('start', 'Starting Visual Studio Build Tools installation...');

  // Ensure temp directory exists
  const tempDir = ensureTempDir();
  const installerPath = path.join(tempDir, VS_BUILD_TOOLS_FILENAME);

  try {
    // Step 1: Download the installer
    progress('download', 'Downloading VS Build Tools installer...');

    const downloadResult = await downloadFile(VS_BUILD_TOOLS_URL, installerPath, { silent });

    if (!downloadResult.success) {
      return {
        success: false,
        rebootRequired: false,
        message: 'Failed to download VS Build Tools installer',
        error: downloadResult.error || 'Download failed',
      };
    }

    // Step 2: Run the installer with silent flags
    progress('install', 'Installing VS Build Tools (this may take 10-30 minutes)...');

    // Build the installation command
    // --quiet: Silent mode
    // --wait: Wait for installation to complete
    // --norestart: Don't automatically restart
    // --add: Add the VCTools workload with recommended components
    const installArgs = [
      '--quiet',
      '--wait',
      '--norestart',
      '--add', 'Microsoft.VisualStudio.Workload.VCTools',
      '--includeRecommended',
    ];

    const installResult = await runVSBuildToolsInstaller(installerPath, installArgs);

    // Step 3: Handle exit codes
    // Exit code 0: Success
    // Exit code 3010: Success but reboot required
    // Other codes: Failure
    if (installResult.exitCode === 0) {
      progress('success', 'VS Build Tools installed successfully!');
      return {
        success: true,
        rebootRequired: false,
        message: 'VS Build Tools installed successfully',
      };
    } else if (installResult.exitCode === 3010) {
      progress('success', 'VS Build Tools installed successfully (reboot required)');
      return {
        success: true,
        rebootRequired: true,
        message: 'VS Build Tools installed successfully. A system restart is required to complete the installation.',
      };
    } else {
      const errorMessage = `Installation failed with exit code ${installResult.exitCode}`;
      progress('error', errorMessage);
      return {
        success: false,
        rebootRequired: false,
        message: errorMessage,
        error: installResult.output || errorMessage,
      };
    }
  } catch (error) {
    const errorMessage = `VS Build Tools installation failed: ${error.message}`;
    progress('error', errorMessage);
    return {
      success: false,
      rebootRequired: false,
      message: 'Installation failed due to an unexpected error',
      error: errorMessage,
    };
  } finally {
    // Clean up the installer file (but keep temp dir for other installers)
    try {
      if (fs.existsSync(installerPath)) {
        fs.unlinkSync(installerPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run the VS Build Tools installer with given arguments
 * Uses spawn for long-running process with proper exit code handling
 *
 * @param {string} installerPath - Path to vs_buildtools.exe
 * @param {string[]} args - Installation arguments
 * @returns {Promise<{ success: boolean, exitCode: number, output: string }>}
 */
function runVSBuildToolsInstaller(installerPath, args) {
  return new Promise((resolve) => {
    const child = spawn(installerPath, args, {
      shell: false,
      windowsHide: true,
      stdio: 'pipe',
    });

    let output = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (exitCode) => {
      // Handle exit codes:
      // 0 = Success
      // 3010 = Success, but reboot required
      // Other = Failure
      const isSuccess = exitCode === 0 || exitCode === 3010;

      resolve({
        success: isSuccess,
        exitCode: exitCode || 0,
        output,
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        exitCode: 1,
        output: error.message,
      });
    });
  });
}

/**
 * Get the default Cargo bin path for the current user
 * @returns {string} Path to the Cargo bin directory
 */
function getCargoPath() {
  const userProfile = process.env.USERPROFILE || process.env.HOME || '';
  return path.join(userProfile, '.cargo', 'bin');
}

/**
 * Refresh PATH for the current process to include Cargo bin
 * This is necessary because rustup modifies the system PATH, but the
 * current process won't see that change without a restart.
 *
 * @returns {boolean} True if PATH was modified, false if already present
 */
function refreshPathForRust() {
  const cargoPath = getCargoPath();

  // Check if already in PATH
  const currentPath = process.env.PATH || '';
  const pathSeparator = ';';
  const pathParts = currentPath.split(pathSeparator);

  // Normalize paths for comparison (lowercase on Windows)
  const normalizedCargoPath = cargoPath.toLowerCase();
  const alreadyInPath = pathParts.some(
    (p) => p.toLowerCase() === normalizedCargoPath
  );

  if (alreadyInPath) {
    return false;
  }

  // Add Cargo bin to PATH for this process
  process.env.PATH = `${cargoPath}${pathSeparator}${currentPath}`;
  return true;
}

/**
 * Verify Rust installation by checking if rustc is accessible
 * @returns {Promise<{ success: boolean, version?: string, error?: string }>}
 */
async function verifyRustInstallation() {
  // First, refresh PATH to include Cargo bin
  refreshPathForRust();

  // Try to run rustc --version
  const result = await runCommandAsync('rustc', ['--version'], { silent: true });

  if (result.success) {
    const versionMatch = result.output.match(/^rustc\s+(\d+\.\d+\.\d+)/);
    if (versionMatch) {
      return {
        success: true,
        version: versionMatch[1],
      };
    }
    return {
      success: true,
      version: 'unknown',
    };
  }

  // If rustc not found, check if it exists in the Cargo bin directory
  const cargoPath = getCargoPath();
  const rustcPath = path.join(cargoPath, 'rustc.exe');

  if (fs.existsSync(rustcPath)) {
    // Try running from full path
    const directResult = await runCommandAsync(`"${rustcPath}"`, ['--version'], { silent: true });
    if (directResult.success) {
      const versionMatch = directResult.output.match(/^rustc\s+(\d+\.\d+\.\d+)/);
      return {
        success: true,
        version: versionMatch ? versionMatch[1] : 'unknown',
      };
    }
  }

  return {
    success: false,
    error: 'rustc not found after installation',
  };
}

/**
 * Install Rust toolchain via rustup-init.exe
 *
 * Performs silent installation of Rust using rustup with the stable toolchain
 * and MSVC target. Handles PATH updates for the current process.
 *
 * @param {Object} options - Installation options
 * @param {boolean} options.silent - Suppress progress output
 * @param {Function} options.onProgress - Progress callback (stage, message)
 * @returns {Promise<{ success: boolean, newTerminalRequired: boolean, message: string, version?: string, error?: string }>}
 */
async function installRust(options = {}) {
  const { silent = false, onProgress } = options;

  const progress = (stage, message) => {
    if (!silent) {
      log(message, stage === 'error' ? 'error' : 'info');
    }
    if (onProgress) {
      onProgress(stage, message);
    }
  };

  progress('start', 'Starting Rust installation...');

  // Ensure temp directory exists
  const tempDir = ensureTempDir();
  const installerPath = path.join(tempDir, RUSTUP_FILENAME);

  try {
    // Step 1: Download rustup-init.exe
    progress('download', 'Downloading rustup installer...');

    const downloadResult = await downloadFile(RUSTUP_URL, installerPath, { silent });

    if (!downloadResult.success) {
      return {
        success: false,
        newTerminalRequired: false,
        message: 'Failed to download rustup installer',
        error: downloadResult.error || 'Download failed',
      };
    }

    // Step 2: Run rustup-init.exe with silent flags
    progress('install', 'Installing Rust toolchain (this may take 5-10 minutes)...');

    // Build the installation command
    // -y: Accept all defaults, don't prompt
    // --default-toolchain stable: Install stable toolchain
    // --default-host x86_64-pc-windows-msvc: Use MSVC target (requires VS Build Tools)
    // --profile default: Standard installation (includes cargo, rustfmt, clippy)
    const installArgs = [
      '-y',
      '--default-toolchain', 'stable',
      '--default-host', 'x86_64-pc-windows-msvc',
      '--profile', 'default',
    ];

    const installResult = await runRustupInstaller(installerPath, installArgs);

    // Step 3: Handle installation result
    if (!installResult.success) {
      const errorMessage = `Rust installation failed with exit code ${installResult.exitCode}`;
      progress('error', errorMessage);
      return {
        success: false,
        newTerminalRequired: false,
        message: errorMessage,
        error: installResult.output || errorMessage,
      };
    }

    // Step 4: Refresh PATH and verify installation
    progress('verify', 'Verifying Rust installation...');

    const pathModified = refreshPathForRust();
    const verification = await verifyRustInstallation();

    if (verification.success) {
      const versionMsg = verification.version ? ` (v${verification.version})` : '';
      progress('success', `Rust installed successfully${versionMsg}!`);

      return {
        success: true,
        newTerminalRequired: pathModified,
        message: pathModified
          ? `Rust installed successfully${versionMsg}. NOTE: You may need to open a new terminal for PATH changes to take effect.`
          : `Rust installed successfully${versionMsg}.`,
        version: verification.version,
      };
    } else {
      // Installation reported success but we can't verify
      progress('warn', 'Rust installation completed but verification failed');
      return {
        success: true,
        newTerminalRequired: true,
        message: 'Rust installation completed. Please open a new terminal and run "rustc --version" to verify.',
        error: verification.error,
      };
    }
  } catch (error) {
    const errorMessage = `Rust installation failed: ${error.message}`;
    progress('error', errorMessage);
    return {
      success: false,
      newTerminalRequired: false,
      message: 'Installation failed due to an unexpected error',
      error: errorMessage,
    };
  } finally {
    // Clean up the installer file (but keep temp dir for other installers)
    try {
      if (fs.existsSync(installerPath)) {
        fs.unlinkSync(installerPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run the rustup-init.exe installer with given arguments
 * Uses spawn for the installation process with proper exit code handling
 *
 * @param {string} installerPath - Path to rustup-init.exe
 * @param {string[]} args - Installation arguments
 * @returns {Promise<{ success: boolean, exitCode: number, output: string }>}
 */
function runRustupInstaller(installerPath, args) {
  return new Promise((resolve) => {
    const child = spawn(installerPath, args, {
      shell: false,
      windowsHide: true,
      stdio: 'pipe',
      // Set environment variables for non-interactive installation
      env: {
        ...process.env,
        // Prevent rustup from prompting
        RUSTUP_INIT_SKIP_PATH_CHECK: 'yes',
      },
    });

    let output = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (exitCode) => {
      // Exit code 0 = Success
      const isSuccess = exitCode === 0;

      resolve({
        success: isSuccess,
        exitCode: exitCode || 0,
        output,
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        exitCode: 1,
        output: error.message,
      });
    });
  });
}

/**
 * Install WebView2 Runtime via the Evergreen Bootstrapper
 *
 * Performs silent installation of WebView2 Runtime. This component is
 * required for Tauri webview functionality on Windows.
 *
 * Note: WebView2 is often pre-installed on Windows 10 (1803+) and Windows 11.
 * This installation is only needed if detection reports it as missing.
 *
 * @param {Object} options - Installation options
 * @param {boolean} options.silent - Suppress progress output
 * @param {Function} options.onProgress - Progress callback (stage, message)
 * @returns {Promise<{ success: boolean, message: string, error?: string }>}
 */
async function installWebView2(options = {}) {
  const { silent = false, onProgress } = options;

  const progress = (stage, message) => {
    if (!silent) {
      log(message, stage === 'error' ? 'error' : 'info');
    }
    if (onProgress) {
      onProgress(stage, message);
    }
  };

  progress('start', 'Starting WebView2 Runtime installation...');

  // Ensure temp directory exists
  const tempDir = ensureTempDir();
  const installerPath = path.join(tempDir, WEBVIEW2_FILENAME);

  try {
    // Step 1: Download the installer
    progress('download', 'Downloading WebView2 Runtime installer...');

    const downloadResult = await downloadFile(WEBVIEW2_URL, installerPath, { silent });

    if (!downloadResult.success) {
      return {
        success: false,
        message: 'Failed to download WebView2 Runtime installer',
        error: downloadResult.error || 'Download failed',
      };
    }

    // Step 2: Run the installer with silent flags
    progress('install', 'Installing WebView2 Runtime...');

    // The WebView2 Evergreen Bootstrapper supports these flags:
    // /silent: Silent install (no UI)
    // /install: Perform installation
    const installResult = await runWebView2Installer(installerPath);

    // Step 3: Handle installation result
    if (installResult.success) {
      progress('verify', 'Verifying WebView2 installation...');

      // Verify installation by checking registry
      const verification = await checkWebView2();

      if (verification.installed) {
        const versionMsg = verification.version ? ` (v${verification.version})` : '';
        progress('success', `WebView2 Runtime installed successfully${versionMsg}!`);
        return {
          success: true,
          message: `WebView2 Runtime installed successfully${versionMsg}.`,
        };
      } else {
        // Installation reported success but verification failed
        // This can happen if a reboot is required
        progress('warn', 'WebView2 installation completed but verification pending');
        return {
          success: true,
          message: 'WebView2 Runtime installation completed. A system restart may be required for detection.',
        };
      }
    } else {
      const errorMessage = `WebView2 installation failed with exit code ${installResult.exitCode}`;
      progress('error', errorMessage);
      return {
        success: false,
        message: errorMessage,
        error: installResult.output || errorMessage,
      };
    }
  } catch (error) {
    const errorMessage = `WebView2 Runtime installation failed: ${error.message}`;
    progress('error', errorMessage);
    return {
      success: false,
      message: 'Installation failed due to an unexpected error',
      error: errorMessage,
    };
  } finally {
    // Clean up the installer file (but keep temp dir for other installers)
    try {
      if (fs.existsSync(installerPath)) {
        fs.unlinkSync(installerPath);
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Run the WebView2 installer with silent flags
 * Uses spawn for the installation process with proper exit code handling
 *
 * @param {string} installerPath - Path to MicrosoftEdgeWebView2RuntimeInstallerX64.exe
 * @returns {Promise<{ success: boolean, exitCode: number, output: string }>}
 */
function runWebView2Installer(installerPath) {
  return new Promise((resolve) => {
    // WebView2 Evergreen Bootstrapper silent installation flags:
    // /silent - No UI shown during installation
    // /install - Perform the installation
    const args = ['/silent', '/install'];

    const child = spawn(installerPath, args, {
      shell: false,
      windowsHide: true,
      stdio: 'pipe',
    });

    let output = '';

    child.stdout?.on('data', (data) => {
      output += data.toString();
    });

    child.stderr?.on('data', (data) => {
      output += data.toString();
    });

    child.on('close', (exitCode) => {
      // Exit code 0 = Success
      // Other codes indicate failure
      const isSuccess = exitCode === 0;

      resolve({
        success: isSuccess,
        exitCode: exitCode || 0,
        output,
      });
    });

    child.on('error', (error) => {
      resolve({
        success: false,
        exitCode: 1,
        output: error.message,
      });
    });
  });
}

// Export all utilities
module.exports = {
  // Logging
  log,
  logSection,

  // Command execution
  runCommand,
  runCommandAsync,

  // Downloads
  downloadFile,

  // Registry
  checkRegistry,

  // Dependency detection
  checkRust,
  checkVSBuildTools,
  checkWebView2,
  getVsWherePath,

  // Dependency installation
  installVSBuildTools,
  installRust,
  installWebView2,

  // Path utilities
  commandExists,
  ensureTempDir,
  cleanupTempDir,
  getCargoPath,
  refreshPathForRust,

  // Version utilities
  parseVersion,
  compareVersions,

  // System checks
  checkDiskSpace,
  isAdmin,
  hasSufficientDiskSpace,

  // Misc utilities
  formatBytes,
  sleep,
  verifyRustInstallation,

  // Constants
  SCRIPT_DIR,
  PROJECT_ROOT,
  TEMP_DIR,
  COLORS,
  VS_BUILD_TOOLS_URL,
  RUSTUP_URL,
  WEBVIEW2_URL,
};
