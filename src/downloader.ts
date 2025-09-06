import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import cliProgress from 'cli-progress';
import logger from './logger';
import { LayerInfo } from './layer-finder';

export type DownloadFormat = 'geotiff' | 'jpeg';

export interface DownloadOptions {
  showProgress?: boolean;
  format?: DownloadFormat;
}

class Downloader {
  private baseUrl: string;
  private outputDir: string;

  constructor(geoserverUrl: string, outputDir: string = 'downloads') {
    this.baseUrl = geoserverUrl.split('?')[0];
    this.outputDir = outputDir;
    fs.ensureDirSync(this.outputDir);
    logger.info(`Output directory set to: ${path.resolve(this.outputDir)}`);
  }

  async downloadLayer(
    layer: LayerInfo,
    options: DownloadOptions = {}
  ): Promise<string> {
    const layerId = layer.id;
    const showProgress = options.showProgress ?? false;
    const downloadFormat = options.format ?? 'geotiff';

    // Determine file extension and content type based on the format
    const fileExtension = downloadFormat === 'geotiff' ? 'tiff' : 'jpg';
    const formatParam = downloadFormat === 'geotiff' ? 'geotiff' : 'jpeg';

    // Use title or name for the filename (falling back to name if title is undefined)
    const fileName =
      layer.title && layer.title.trim() !== '' ? layer.title : layer.name;
    // Sanitize filename by replacing invalid characters
    const safeFileName = fileName.replace(/[/\\?%*:|"<>]/g, '_');
    const outputPath = path.join(
      this.outputDir,
      `${safeFileName}.${fileExtension}`
    );

    logger.info(`Starting download for layer: ${layerId}`);
    logger.info(`Output file will be: ${outputPath}`);

    try {
      // Construct the WCS GetCoverage URL
      const downloadUrl = `${this.baseUrl}?service=WCS&version=2.0.1&request=getCoverage&coverageid=${layerId}&format=${formatParam}&compression=LZW&tileWidth=512&tileHeight=512`;

      logger.info(`Download URL: ${downloadUrl}`);

      // First make a HEAD request to get the content length if possible
      let totalLength = 0;
      try {
        const headResponse = await axios.head(downloadUrl);
        totalLength = parseInt(
          headResponse.headers['content-length'] || '0',
          10
        );
      } catch (error) {
        logger.warn('Could not determine file size before download');
      }

      // Download the file with a stream to handle large files
      const response = await axios({
        method: 'get',
        url: downloadUrl,
        responseType: 'stream',
      });

      // Create a write stream to save the file
      const writer = fs.createWriteStream(outputPath);

      // Create progress bar if requested
      let progressBar: cliProgress.SingleBar | undefined;
      if (showProgress && totalLength > 0) {
        progressBar = new cliProgress.SingleBar({
          format: `Downloading ${safeFileName} [{bar}] {percentage}% | ETA: {eta}s | {value}/{total} bytes`,
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true,
        });
        progressBar.start(totalLength, 0);
      }

      // Track downloaded bytes
      let downloadedBytes = 0;

      // Add progress tracking
      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        if (progressBar) {
          progressBar.update(downloadedBytes);
        }
      });

      response.data.pipe(writer);

      // Return a promise that resolves when the download is complete
      return new Promise<string>((resolve, reject) => {
        writer.on('finish', () => {
          if (progressBar) {
            progressBar.stop();
          }
          logger.info(
            `Successfully downloaded layer ${layerId} to ${outputPath}`
          );
          resolve(outputPath);
        });

        writer.on('error', (err) => {
          if (progressBar) {
            progressBar.stop();
          }
          logger.error(
            `Error writing file for layer ${layerId}: ${err.message}`
          );
          reject(err);
        });
      });
    } catch (error: any) {
      // Log and handle download errors
      const errorMessage = `Failed to download layer ${layerId}: ${error.message}`;
      logger.error(errorMessage);

      // If the file was partially created, clean it up
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
        logger.info(`Removed incomplete file: ${outputPath}`);
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * Validate a downloaded file based on its format
   */
  validateFile(filePath: string): boolean {
    try {
      // Basic validation - check file exists and has content
      if (!fs.existsSync(filePath)) {
        logger.error(`File does not exist: ${filePath}`);
        return false;
      }

      const stats = fs.statSync(filePath);
      if (stats.size === 0) {
        logger.error(`File is empty: ${filePath}`);
        return false;
      }

      // Read the first few bytes to determine file type
      const buffer = Buffer.alloc(8);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 8, 0);
      fs.closeSync(fd);

      // Check file format based on magic bytes
      const extension = path.extname(filePath).toLowerCase();

      if (extension === '.tiff' || extension === '.tif') {
        // TIFF files start with either 'II*\0' or 'MM\0*'
        const isIntelFormat =
          buffer[0] === 0x49 &&
          buffer[1] === 0x49 &&
          buffer[2] === 0x2a &&
          buffer[3] === 0x00;
        const isMotorFormat =
          buffer[0] === 0x4d &&
          buffer[1] === 0x4d &&
          buffer[2] === 0x00 &&
          buffer[3] === 0x2a;

        if (!(isIntelFormat || isMotorFormat)) {
          logger.error(`File is not a valid TIFF: ${filePath}`);
          return false;
        }
      } else if (extension === '.jpg' || extension === '.jpeg') {
        // JPEG files start with FF D8 FF
        const isJPEG =
          buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;

        if (!isJPEG) {
          logger.error(`File is not a valid JPEG: ${filePath}`);
          return false;
        }
      } else {
        logger.warn(
          `Unknown file extension: ${extension}, performing basic validation only`
        );
      }

      logger.info(`File validation passed: ${filePath}`);
      return true;
    } catch (error: any) {
      logger.error(`Error validating file ${filePath}: ${error.message}`);
      return false;
    }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use validateFile instead
   */
  validateGeoTIFF(filePath: string): boolean {
    return this.validateFile(filePath);
  }
}

export default Downloader;
