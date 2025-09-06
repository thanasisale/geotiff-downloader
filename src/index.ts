#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import dotenv from 'dotenv';
import { LayerFinder, LayerInfo } from './layer-finder';
import Downloader, { DownloadFormat } from './downloader';
import logger from './logger';

dotenv.config();
const packageJson = require('../package.json');
const program = new Command();

program
  .name('geotiff-downloader')
  .description('CLI tool to download GeoTIFF layers from a GeoServer')
  .version(packageJson.version);

const DEFAULT_GEOSERVER_URL = process.env.GEOSERVER_URL || '';
const DEFAULT_OUTPUT_DIR = process.env.OUTPUT_DIR || 'downloads';
async function getGeoServerUrl(providedUrl?: string): Promise<string> {
  if (providedUrl) {
    return providedUrl;
  }

  if (process.env.GEOSERVER_URL) {
    return process.env.GEOSERVER_URL;
  }
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'url',
      message: 'Enter the GeoServer URL:',
      validate: (input) => {
        if (!input.trim()) {
          return 'GeoServer URL is required';
        }
        return true;
      },
    },
  ]);

  return answers.url;
}

program
  .command('list')
  .description('List all available GeoTIFF layers from the GeoServer')
  .option('-u, --url <url>', 'GeoServer URL')
  .option(
    '-o, --output <file>',
    'Save layer list to file (supports .csv, .json, .txt)'
  )
  .action(async (options) => {
    try {
      const url = await getGeoServerUrl(options.url);
      const layerFinder = new LayerFinder(url);
      const layers = await layerFinder.getAvailableLayers();
      layerFinder.displayLayers(layers);
      if (options.output) {
        layerFinder.exportLayersToFile(layers, options.output);
        logger.info(`Layer list exported to ${options.output}`);
      }
    } catch (error: any) {
      logger.error(`Failed to list layers: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('download')
  .description('Download a GeoTIFF layer from the GeoServer')
  .option('-u, --url <url>', 'GeoServer URL')
  .option('-o, --output <dir>', 'Output directory', DEFAULT_OUTPUT_DIR)
  .option('-i, --id <id>', 'Coverage ID of the layer to download')
  .option('-a, --all', 'Download all available layers')
  .option('-I, --interactive', 'Interactive selection of layers to download')
  .option(
    '-f, --format <format>',
    'Format to download (geotiff or jpeg)',
    'geotiff'
  )
  .option('-p, --progress', 'Show download progress')
  .action(async (options) => {
    try {
      // Get GeoServer URL (from options, env, or prompt)
      const url = await getGeoServerUrl(options.url);

      // Validate the format option
      const format = options.format.toLowerCase();
      if (format !== 'geotiff' && format !== 'jpeg') {
        logger.error('Invalid format. Use "geotiff" or "jpeg".');
        process.exit(1);
      }

      // Ensure output directory exists
      const outputDir = path.resolve(options.output);
      fs.ensureDirSync(outputDir);

      const layerFinder = new LayerFinder(url);
      const downloader = new Downloader(url, outputDir);

      // Get all available layers
      const layers = await layerFinder.getAvailableLayers();

      if (layers.length === 0) {
        logger.error('No layers found to download');
        process.exit(1);
      }

      let layersToDownload: LayerInfo[] = [];

      // Interactive layer selection
      if (options.interactive) {
        layerFinder.displayLayers(layers);

        // Create a list of choices for the interactive prompt
        const choices = layers.map((layer, index) => ({
          name: `${index + 1}. ${layer.title || layer.name} (ID: ${layer.id})`,
          value: layer,
        }));

        // Ask user to select layers
        const answers = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedLayers',
            message:
              'Select layers to download (use space to select, enter to confirm)',
            choices,
            pageSize: 20,
            loop: false,
          },
        ]);

        layersToDownload = answers.selectedLayers;

        if (layersToDownload.length === 0) {
          logger.info('No layers selected for download');
          process.exit(0);
        } else {
          logger.info(
            `Selected ${layersToDownload.length} layer(s) for download`
          );
        }
      }

      // Check different options for layer selection
      if (layersToDownload.length === 0) {
        if (options.all) {
          // Download all layers
          layersToDownload = layers;
          logger.info(
            `Preparing to download all ${layers.length} available layers`
          );
        } else if (options.id) {
          // Download a specific layer by ID
          const layer = layers.find((l) => l.id === options.id);
          if (!layer) {
            logger.error(`Layer with ID '${options.id}' not found`);
            process.exit(1);
          }
          layersToDownload = [layer];
        } else {
          // If no selection method is provided, show the list and explain options
          layerFinder.displayLayers(layers);
          logger.error(
            'Please specify layers to download: use --id <id>, --all for all layers, or --interactive for selection menu'
          );
          process.exit(1);
        }
      }

      // Download each layer
      const results = {
        successful: 0,
        failed: 0,
        failedLayers: [] as { name: string; reason: string }[],
      };

      for (const layer of layersToDownload) {
        try {
          logger.info(`Processing layer: ${layer.name} (${layer.id})`);

          // Set up download options
          const downloadOptions = {
            showProgress: options.progress || false,
            format: options.format.toLowerCase() as DownloadFormat,
          };

          const filePath = await downloader.downloadLayer(
            layer,
            downloadOptions
          );

          // Validate the downloaded file
          const isValid = downloader.validateFile(filePath);

          if (isValid) {
            logger.info(`Successfully downloaded and validated: ${layer.name}`);
            results.successful++;
          } else {
            logger.error(`Downloaded file for ${layer.name} is not valid`);
            results.failed++;
            results.failedLayers.push({
              name: layer.name,
              reason: 'File validation failed',
            });

            // Remove invalid file
            fs.unlinkSync(filePath);
            logger.info(`Removed invalid file: ${filePath}`);
          }
        } catch (error: any) {
          logger.error(
            `Failed to download layer ${layer.name}: ${error.message}`
          );
          results.failed++;
          results.failedLayers.push({
            name: layer.name,
            reason: error.message,
          });
        }
      }

      // Output summary
      logger.info(`\nDownload Summary:`);
      logger.info(`- Successfully downloaded: ${results.successful}`);
      logger.info(`- Failed downloads: ${results.failed}`);

      if (results.failedLayers.length > 0) {
        logger.info(`\nFailed Layers:`);
        results.failedLayers.forEach((failure) => {
          logger.info(`- ${failure.name}: ${failure.reason}`);
        });
      }
    } catch (error: any) {
      logger.error(`Download operation failed: ${error.message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
