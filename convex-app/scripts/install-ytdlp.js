/**
 * Script to install yt-dlp binary for Vercel deployment
 * Runs during the build process to ensure yt-dlp is available in production
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const YTDLP_VERSION = 'latest'; // Can be pinned to specific version if needed

// Determine platform-specific binary name and download URL
const isWindows = process.platform === 'win32';
const isMacOS = process.platform === 'darwin';
const BIN_DIR = path.join(__dirname, '..', 'bin');

let BINARY_NAME;
let YTDLP_URL;

if (isWindows) {
  BINARY_NAME = 'yt-dlp.exe';
  YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
} else if (isMacOS) {
  BINARY_NAME = 'yt-dlp';
  YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
} else {
  // Linux, WSL, Vercel, etc.
  BINARY_NAME = 'yt-dlp';
  YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
}

const BIN_PATH = path.join(BIN_DIR, BINARY_NAME);

console.log('[install-ytdlp] Starting yt-dlp installation...');
console.log('[install-ytdlp] Platform:', process.platform);
console.log('[install-ytdlp] Architecture:', process.arch);

// Create bin directory if it doesn't exist
if (!fs.existsSync(BIN_DIR)) {
  fs.mkdirSync(BIN_DIR, { recursive: true });
  console.log('[install-ytdlp] Created bin directory:', BIN_DIR);
}

// Check if yt-dlp already exists
if (fs.existsSync(BIN_PATH)) {
  console.log('[install-ytdlp] yt-dlp binary already exists at:', BIN_PATH);

  // Make it executable (Unix/Linux only)
  if (!isWindows) {
    try {
      fs.chmodSync(BIN_PATH, 0o755);
      console.log('[install-ytdlp] Binary is executable');
    } catch (error) {
      console.error('[install-ytdlp] Failed to make binary executable:', error.message);
    }
  }

  process.exit(0);
}

// Download yt-dlp binary
console.log('[install-ytdlp] Downloading yt-dlp from:', YTDLP_URL);

const file = fs.createWriteStream(BIN_PATH);

https.get(YTDLP_URL, (response) => {
  if (response.statusCode === 302 || response.statusCode === 301) {
    // Follow redirect
    const redirectUrl = response.headers.location;
    console.log('[install-ytdlp] Following redirect to:', redirectUrl);

    https.get(redirectUrl, (redirectResponse) => {
      redirectResponse.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          console.log('[install-ytdlp] Download complete');

          // Make binary executable (Unix/Linux only)
          if (!isWindows) {
            fs.chmodSync(BIN_PATH, 0o755);
            console.log('[install-ytdlp] Binary is now executable');
          }

          // Verify installation
          try {
            const version = execSync(`${BIN_PATH} --version`, { encoding: 'utf-8' });
            console.log('[install-ytdlp] Installation verified. Version:', version.trim());
          } catch (error) {
            console.error('[install-ytdlp] Warning: Could not verify installation:', error.message);
          }

          console.log('[install-ytdlp] Installation complete!');
        });
      });
    }).on('error', (err) => {
      fs.unlink(BIN_PATH, () => {});
      console.error('[install-ytdlp] Download error:', err.message);
      process.exit(1);
    });
  } else {
    response.pipe(file);

    file.on('finish', () => {
      file.close(() => {
        console.log('[install-ytdlp] Download complete');

        // Make binary executable (Unix/Linux only)
        if (!isWindows) {
          fs.chmodSync(BIN_PATH, 0o755);
          console.log('[install-ytdlp] Binary is now executable');
        }

        // Verify installation
        try {
          const version = execSync(`${BIN_PATH} --version`, { encoding: 'utf-8' });
          console.log('[install-ytdlp] Installation verified. Version:', version.trim());
        } catch (error) {
          console.error('[install-ytdlp] Warning: Could not verify installation:', error.message);
        }

        console.log('[install-ytdlp] Installation complete!');
      });
    });
  }
}).on('error', (err) => {
  fs.unlink(BIN_PATH, () => {});
  console.error('[install-ytdlp] Download error:', err.message);
  console.error('[install-ytdlp] You may need to install yt-dlp manually.');
  process.exit(1);
});

file.on('error', (err) => {
  fs.unlink(BIN_PATH, () => {});
  console.error('[install-ytdlp] File write error:', err.message);
  process.exit(1);
});
