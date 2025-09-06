import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import fs from 'fs-extra';
import path from 'path';
import logger from './logger';

interface LayerInfo {
  id: string;
  name: string;
  title?: string;
  abstract?: string;
}

class LayerFinder {
  private baseUrl: string;

  constructor(geoserverUrl: string) {
    this.baseUrl = geoserverUrl.split('?')[0];
  }
  async getAvailableLayers(): Promise<LayerInfo[]> {
    try {
      logger.info('Fetching available layers from GeoServer');

      const capabilitiesUrl = `${this.baseUrl}?service=WCS&version=2.0.1&request=GetCapabilities`;
      logger.info(`Requesting capabilities from: ${capabilitiesUrl}`);

      const response = await axios.get(capabilitiesUrl);

      if (response.status !== 200) {
        throw new Error(
          `Failed to fetch capabilities: HTTP ${response.status}`
        );
      }

      // Parse XML response
      const result = await parseStringPromise(response.data);

      // Extract coverage summaries from the WCS capabilities
      const coverages = this.extractCoverages(result);

      logger.info(`Found ${coverages.length} available layers`);
      return coverages;
    } catch (error: any) {
      logger.error(`Error fetching available layers: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract coverage information from the WCS GetCapabilities response
   */
  private extractCoverages(capabilitiesXml: any): LayerInfo[] {
    try {
      // The path to the coverages might differ based on the GeoServer version and configuration
      const contents =
        capabilitiesXml['wcs:Capabilities']?.['wcs:Contents']?.[0];

      if (!contents) {
        logger.error('Could not find content section in capabilities response');
        return [];
      }

      const coverageSummaries = contents['wcs:CoverageSummary'] || [];

      return coverageSummaries.map((summary: any) => {
        const id = summary['wcs:CoverageId']?.[0] || '';
        const title = summary['ows:Title']?.[0] || '';
        const abstract = summary['ows:Abstract']?.[0] || '';

        // Often the name is the last part of the coverage ID
        const name = id.split(':').pop() || id;

        return {
          id,
          name,
          title,
          abstract,
        };
      });
    } catch (error: any) {
      logger.error(`Error extracting coverage information: ${error.message}`);
      return [];
    }
  }

  /**
   * Display the list of available layers in a formatted way
   */
  displayLayers(layers: LayerInfo[]): void {
    if (layers.length === 0) {
      console.log('No layers found.');
      return;
    }

    console.log('\nAvailable Layers:');
    console.log('-----------------');

    layers.forEach((layer, index) => {
      console.log(`${index + 1}. ID: ${layer.id}`);
      console.log(`   Name: ${layer.name}`);
      if (layer.title) console.log(`   Title: ${layer.title}`);
      if (layer.abstract) console.log(`   Description: ${layer.abstract}`);
      console.log('');
    });
  }

  /**
   * Export the list of layers to a CSV file
   */
  exportLayersToFile(layers: LayerInfo[], outputPath: string): void {
    try {
      if (layers.length === 0) {
        logger.warn('No layers to export.');
        return;
      }

      // Determine file format based on extension
      const extension = path.extname(outputPath).toLowerCase();
      let content = '';

      if (extension === '.csv') {
        // Create CSV content
        content = 'Index,ID,Name,Title,Description\n';
        layers.forEach((layer, index) => {
          // Escape fields for CSV format
          const escapeCSV = (text?: string) =>
            text ? `"${text.replace(/"/g, '""')}"` : '';
          content += `${index + 1},${escapeCSV(layer.id)},${escapeCSV(
            layer.name
          )},${escapeCSV(layer.title)},${escapeCSV(layer.abstract)}\n`;
        });
      } else if (extension === '.json') {
        // Create JSON content
        content = JSON.stringify(layers, null, 2);
      } else if (extension === '.txt') {
        // Create text content
        content = 'Available Layers:\n-----------------\n\n';
        layers.forEach((layer, index) => {
          content += `${index + 1}. ID: ${layer.id}\n`;
          content += `   Name: ${layer.name}\n`;
          if (layer.title) content += `   Title: ${layer.title}\n`;
          if (layer.abstract) content += `   Description: ${layer.abstract}\n`;
          content += '\n';
        });
      } else {
        throw new Error(
          `Unsupported file format: ${extension}. Use .csv, .json, or .txt`
        );
      }

      // Ensure directory exists
      const dir = path.dirname(outputPath);
      fs.ensureDirSync(dir);

      // Write to file
      fs.writeFileSync(outputPath, content);

      logger.info(`Exported ${layers.length} layers to ${outputPath}`);
    } catch (error: any) {
      logger.error(`Error exporting layers to file: ${error.message}`);
      throw error;
    }
  }
}

export { LayerFinder, LayerInfo };
