import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs';
import os from 'os';
import https from 'https';

/**
 * Downloads yt-dlp binary from GitHub releases
 * Uses correct platform-specific URLs for standalone binaries
 */
async function downloadYtDlpBinary(url: string, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[ensureYtDlp] Downloading from: ${url}`);

    const handleDownload = (response: any) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      const file = fs.createWriteStream(targetPath);
      let downloadedBytes = 0;

      response.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          console.log(`[ensureYtDlp] Downloaded ${(downloadedBytes / 1024 / 1024).toFixed(2)}MB`);
          resolve();
        });
      });

      file.on('error', (err) => {
        file.close(() => {
          fs.unlink(targetPath, () => {});
          reject(err);
        });
      });

      response.on('error', (err: Error) => {
        file.close(() => {
          fs.unlink(targetPath, () => {});
          reject(err);
        });
      });
    };

    https.get(url, (response) => {
      // Follow redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect location not found'));
          return;
        }

        console.log(`[ensureYtDlp] Following redirect to: ${redirectUrl}`);
        https.get(redirectUrl, handleDownload).on('error', reject);
      } else {
        handleDownload(response);
      }
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Ensures yt-dlp binary is available and returns its path.
 * Downloads the binary automatically if it doesn't exist.
 *
 * @returns Promise<string> - Path to the yt-dlp binary
 * @throws Error if download fails or binary cannot be found
 */
export async function ensureYtDlpBinary(): Promise<string> {
  const isWindows = os.platform() === 'win32';
  const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';

  // Check if binary path is specified via environment variable
  const envBinaryPath = process.env.YTDLP_BINARY_PATH;
  if (envBinaryPath) {
    console.log('[ensureYtDlp] Using yt-dlp from environment variable:', envBinaryPath);
    if (fs.existsSync(envBinaryPath)) {
      return envBinaryPath;
    } else {
      console.warn('[ensureYtDlp] Binary specified in YTDLP_BINARY_PATH does not exist:', envBinaryPath);
    }
  }

  // Try to find yt-dlp in system PATH first
  try {
    const systemBinaryPath = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
    // Quick check if yt-dlp is available in PATH
    const { execSync } = require('child_process');
    try {
      execSync(isWindows ? 'where yt-dlp' : 'which yt-dlp', { stdio: 'pipe' });
      console.log('[ensureYtDlp] Using yt-dlp from system PATH');
      return systemBinaryPath;
    } catch {
      // Not in PATH, continue to download
    }
  } catch (error) {
    // execSync not available or failed, continue to download
  }

  // Define local binary path
  const binDir = path.join(process.cwd(), 'bin');
  const binaryPath = path.join(binDir, binaryName);

  // Clean up wrong-platform binaries (e.g., .exe on Linux, or vice versa)
  const wrongPlatformBinary = isWindows
    ? path.join(binDir, 'yt-dlp')      // On Windows, remove Linux binary
    : path.join(binDir, 'yt-dlp.exe'); // On Linux/WSL, remove Windows binary

  if (fs.existsSync(wrongPlatformBinary)) {
    console.warn(`[ensureYtDlp] Removing wrong-platform binary: ${wrongPlatformBinary}`);
    fs.unlinkSync(wrongPlatformBinary);
  }

  // Check if binary already exists locally and validate it
  if (fs.existsSync(binaryPath)) {
    const stats = fs.statSync(binaryPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    // Validate binary file size (should be > 10MB for yt-dlp)
    if (stats.size < 10 * 1024 * 1024) {
      console.warn(`[ensureYtDlp] Binary exists but is too small (${fileSizeMB}MB). Likely corrupt, re-downloading...`);
      fs.unlinkSync(binaryPath);
    } else {
      // Verify executable permissions on Unix systems
      if (!isWindows) {
        const isExecutable = !!(stats.mode & fs.constants.S_IXUSR);
        if (!isExecutable) {
          console.warn('[ensureYtDlp] Binary not executable, fixing permissions...');
          fs.chmodSync(binaryPath, 0o755);
        }
      }

      console.log(`[ensureYtDlp] Using existing yt-dlp binary at: ${binaryPath} (${fileSizeMB}MB)`);
      return binaryPath;
    }
  }

  // Binary doesn't exist or was invalid, download it
  console.log('[ensureYtDlp] yt-dlp binary not found. Downloading...');

  try {
    // Create bin directory if it doesn't exist
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // Download binary from GitHub using correct platform-specific URL
    // Note: We bypass YTDlpWrap because it downloads the Python script instead
    // of the standalone binary for Linux
    const platform = os.platform();
    let downloadUrl: string;

    if (platform === 'win32') {
      downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    } else if (platform === 'darwin') {
      downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
    } else {
      // Linux, WSL, etc.
      downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
    }

    console.log('[ensureYtDlp] Downloading yt-dlp binary to:', binaryPath);
    await downloadYtDlpBinary(downloadUrl, binaryPath);

    // Validate downloaded file
    if (!fs.existsSync(binaryPath)) {
      throw new Error('Download completed but binary file not found');
    }

    const stats = fs.statSync(binaryPath);
    const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);

    if (stats.size < 10 * 1024 * 1024) {
      throw new Error(`Downloaded binary is too small (${fileSizeMB}MB). Download may have failed.`);
    }

    // Make binary executable on Unix systems
    if (!isWindows) {
      fs.chmodSync(binaryPath, 0o755);
    }

    console.log(`[ensureYtDlp] yt-dlp binary downloaded successfully (${fileSizeMB}MB)`);
    return binaryPath;
  } catch (error: any) {
    console.error('[ensureYtDlp] Failed to download yt-dlp binary:', error);
    throw new Error(
      `Failed to download yt-dlp binary: ${error.message}. ` +
      `Please install yt-dlp manually: https://github.com/yt-dlp/yt-dlp#installation`
    );
  }
}

/**
 * Validates that the yt-dlp binary exists and is executable.
 *
 * @param binaryPath - Path to the yt-dlp binary
 * @returns boolean - True if binary is valid and executable
 */
export function validateYtDlpBinary(binaryPath: string): boolean {
  try {
    if (!fs.existsSync(binaryPath)) {
      return false;
    }

    // Check if file is executable (on Unix systems)
    if (os.platform() !== 'win32') {
      const stats = fs.statSync(binaryPath);
      const isExecutable = !!(stats.mode & fs.constants.S_IXUSR);
      if (!isExecutable) {
        console.warn('[ensureYtDlp] Binary exists but is not executable:', binaryPath);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[ensureYtDlp] Error validating binary:', error);
    return false;
  }
}
