const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages (including Bun's .bun folder)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules/.bun/node_modules"),
];

// IMPORTANT: Allow hierarchical lookup for Bun compatibility
// Bun uses symlinks that require traversing up the tree
config.resolver.disableHierarchicalLookup = false;

// Add support for additional extensions
config.resolver.sourceExts = [...config.resolver.sourceExts, "mjs"];

// Enable symlink support for Bun's module structure
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
