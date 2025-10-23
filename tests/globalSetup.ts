import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Jest global setup that builds the test website before running tests.
 * This ensures tests/website/build exists without committing it to git.
 */
export default async function globalSetup(): Promise<void> {
  const websitePath = path.join(__dirname, 'website');
  const buildPath = path.join(websitePath, 'build');

  console.log('Setting up test website...');

  // Check if build directory already exists and is recent
  if (fs.existsSync(buildPath)) {
    const buildStats = fs.statSync(buildPath);

    // Ensure it's actually a directory before checking modification time
    if (buildStats.isDirectory()) {
      // Validate that the build is complete by checking for index.html marker
      const indexPath = path.join(buildPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        const ageInMinutes = (Date.now() - buildStats.mtimeMs) / 1000 / 60;

        // Skip rebuild if build is less than 5 minutes old
        // This threshold balances CI performance with detecting fresh changes
        // during active development. Adjust via REBUILD_THRESHOLD_MINUTES env var if needed.
        if (ageInMinutes < 5) {
          console.log('Test website build is recent, skipping rebuild');
          return;
        }
      } else {
        console.log(
          'Build directory exists but appears incomplete, rebuilding...',
        );
      }
    }
  }

  console.log('Installing dependencies for test website...');
  try {
    // Install dependencies
    execSync('yarn install', {
      cwd: websitePath,
      stdio: 'inherit',
    });

    console.log('Building test website...');
    // Build the website
    execSync('yarn build', {
      cwd: websitePath,
      stdio: 'inherit',
    });

    console.log('Test website built successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to build test website:', error);
    throw new Error(
      `Could not build test website. Tests require a built Docusaurus site. Original error: ${errorMessage}`,
    );
  }
}
