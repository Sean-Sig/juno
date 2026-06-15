const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the monorepo root so Metro picks up packages/* changes
config.watchFolders = [monorepoRoot];

// Tell Metro exactly where to look for node_modules.
// disableHierarchicalLookup stops Metro from crawling parent directories
// and accidentally picking up expo/AppEntry from the monorepo root instead
// of expo-router/entry from the correct project.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
