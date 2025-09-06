# Release Guide for GeoTIFF Downloader

This document outlines the automated release process for the GeoTIFF Downloader tool using GitHub Actions.

## Prerequisites

- GitHub account with repository access
- GitHub Personal Access Token with appropriate permissions (if needed)

## Automated CI/CD Process

This project uses GitHub Actions for Continuous Integration and Deployment. The workflow is defined in `.github/workflows/ci-cd.yml` and automatically handles the entire release process:

### Trigger Events

The CI/CD pipeline runs on:

- Pushes to main/master branch
- Pull requests to main/master branch
- Release creation
- Manual trigger via GitHub Actions interface

### Automated Steps

When triggered, the workflow automatically:

- Builds the project
- Runs tests (when configured)
- Creates executables for Windows, Linux and macOS (for tag releases)
- Creates GitHub releases (for tag releases)
- Publishes to npm (when enabled)

## Creating a New Release

To create a new release:

1. Update version and changelog:

   - Update the version in package.json
   - Update CHANGELOG.md with details of changes

2. Commit and push changes:

   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Release v[version]"
   git push origin main
   ```

3. Create and push a tag:

   ```bash
   git tag v[version]
   git push origin v[version]
   ```

4. The GitHub Actions workflow will automatically:
   - Build the project
   - Create platform-specific executables
   - Create a GitHub release with the executables attached
   - Publish to npm (if configured)

## Post-Release

1. Announce the release in relevant channels
2. Monitor for initial user feedback and issues
3. Update documentation if necessary

## Hotfix Process

For critical bugs discovered post-release:

1. Create a hotfix branch from the tag
2. Fix the issue
3. Follow the standard release process with a patch version increment

4. Go to GitHub repository > Releases > Create new release
   - Select the tag version
   - Add release notes from CHANGELOG.md
   - Attach the executable files from the executables directory

## Post-Release

1. Announce the release in relevant channels
2. Monitor for initial user feedback and issues
3. Update documentation if necessary

## Hotfix Process

For critical bugs discovered post-release:

1. Create a hotfix branch from the tag
2. Fix the issue
3. Follow the standard release process with a patch version increment
