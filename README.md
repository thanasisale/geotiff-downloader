# GeoTIFF Downloader

A command-line tool for downloading GeoTIFF layers from a GeoServer.

## Features

- List available GeoTIFF layers from a GeoServer
- Export layer list to CSV, JSON, or text files
- Download specific layers by ID
- Interactive layer selection
- Download all available layers
- Download in GeoTIFF or JPEG format
- Show progress bar during download
- Validate downloaded files
- Comprehensive logging to track operations and failures
- Environment variables support for default configuration

## Installation

### Prerequisites

- Node.js 14.x or higher

### Install from source

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

4. Install globally (optional):

```bash
npm install -g .
```

## Configuration

You can configure default settings using environment variables in a `.env` file:

```env
# GeoServer URL
GEOSERVER_URL=https://your-geoserver.com/geoserver/wcs

# Default output directory (default: ./downloads)
OUTPUT_DIR=./my-downloads
```

A template `.env.example` file is provided.

## Usage

### List Available Layers

```bash
# Using npm run
npm run dev -- list

# Or if installed globally
geotiff-downloader list

# Specify custom GeoServer URL
geotiff-downloader list --url "https://your-geoserver.com/wcs"

# Export layer list to a file
geotiff-downloader list --output "layers.csv"
geotiff-downloader list --output "layers.json"
geotiff-downloader list --output "layers.txt"
```

### Download Layers

```bash
# Download by ID
geotiff-downloader download --id "your_layer_id"

# Download all layers
geotiff-downloader download --all

# Interactive layer selection
geotiff-downloader download --interactive

# Specify custom output directory
geotiff-downloader download --id "your_layer_id" --output "./my-geotiffs"

# Specify custom GeoServer URL
geotiff-downloader download --id "your_layer_id" --url "https://your-geoserver.com/wcs"

# Download as JPEG instead of GeoTIFF
geotiff-downloader download --id "your_layer_id" --format jpeg

# Show download progress
geotiff-downloader download --id "your_layer_id" --progress

# Combine options
geotiff-downloader download --interactive --format jpeg --progress --output "./my-images"
```

## Logs

Logs are stored in the `logs` directory:

- `geotiff-downloader.log` - Contains all log messages
- `geotiff-downloader-error.log` - Contains only error messages

## Cross-Platform Support

This tool is compatible with:

- Windows
- Linux
- macOS

## License

ISC
