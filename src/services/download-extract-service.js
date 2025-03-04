// src/services/download-extract-service.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { promisify } = require('util');
const stream = require('stream');
const logger = require('../utils/logging');

// Promisified versions of stream.pipeline and fs functions
const pipeline = promisify(stream.pipeline);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

class DownloadExtractService {
    constructor(config = {}) {
        this.config = {
            downloadDir: path.join(process.cwd(), 'downloads'),
            extractDir: path.join(process.cwd(), 'data'),
            retryAttempts: 3,
            retryDelay: 5000,
            ...config
        };
    }

    /**
     * Initialize service and create necessary directories
     */
    async initialize() {
        try {
            // Ensure download directory exists
            if (!fs.existsSync(this.config.downloadDir)) {
                await mkdir(this.config.downloadDir, { recursive: true });
                logger.processInfo(`Created download directory: ${this.config.downloadDir}`);
            }

            // Ensure extract directory exists
            if (!fs.existsSync(this.config.extractDir)) {
                await mkdir(this.config.extractDir, { recursive: true });
                logger.processInfo(`Created extract directory: ${this.config.extractDir}`);
            }

            return true;
        } catch (error) {
            logger.processingError('Failed to initialize download and extract service', error);
            throw error;
        }
    }

    /**
     * Download file from URL
     * @param {string} url - URL to download from
     * @param {string} outputPath - Path to save the file
     * @returns {Promise<string>} Path to downloaded file
     */
    async downloadFile(url, outputPath = null) {
        await this.initialize();

        // Generate output path if not provided
        if (!outputPath) {
            const filename = path.basename(url);
            outputPath = path.join(this.config.downloadDir, filename);
        }

        try {
            logger.processInfo(`Starting download from ${url}`);
            
            let attempts = 0;
            let success = false;
            let error;

            // Retry logic
            while (attempts < this.config.retryAttempts && !success) {
                attempts++;
                
                try {
                    await this._downloadWithProgress(url, outputPath);
                    success = true;
                } catch (err) {
                    error = err;
                    logger.processInfo(`Download attempt ${attempts} failed, retrying in ${this.config.retryDelay / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
                }
            }

            if (!success) {
                throw error || new Error(`Failed to download after ${this.config.retryAttempts} attempts`);
            }

            logger.processInfo(`Successfully downloaded file to ${outputPath}`);
            return outputPath;
        } catch (error) {
            logger.processingError(`Failed to download file from ${url}`, error);
            throw error;
        }
    }

    /**
     * Private method to download with progress tracking
     * @param {string} url - URL to download from
     * @param {string} outputPath - Path to save the file
     * @returns {Promise<void>}
     */
    async _downloadWithProgress(url, outputPath) {
        return new Promise((resolve, reject) => {
            // Choose protocol based on URL
            const protocolModule = url.startsWith('https') ? https : http;
            
            protocolModule.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    this._downloadWithProgress(response.headers.location, outputPath)
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                // Check for successful response
                if (response.statusCode !== 200) {
                    reject(new Error(`Server responded with status code: ${response.statusCode}`));
                    return;
                }

                const fileSize = parseInt(response.headers['content-length'] || 0, 10);
                let downloadedBytes = 0;
                let lastLoggedPercent = 0;

                // Set up progress tracking
                response.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    
                    // Log progress at 10% intervals
                    if (fileSize > 0) {
                        const percent = Math.floor((downloadedBytes / fileSize) * 100);
                        if (percent >= lastLoggedPercent + 10) {
                            lastLoggedPercent = percent;
                            logger.processInfo(`Download progress: ${percent}% (${(downloadedBytes / (1024 * 1024)).toFixed(2)} MB)`);
                        }
                    }
                });

                // Create write stream and pipe response to it
                const fileStream = fs.createWriteStream(outputPath);
                
                pipeline(response, fileStream)
                    .then(() => {
                        logger.processInfo(`Download completed: ${outputPath}`);
                        resolve(outputPath);
                    })
                    .catch((error) => {
                        // Clean up partial file on error
                        if (fs.existsSync(outputPath)) {
                            fs.unlinkSync(outputPath);
                        }
                        reject(error);
                    });
            }).on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Extract gz file
     * @param {string} filePath - Path to gz file
     * @param {string} outputPath - Path to extract to (optional)
     * @returns {Promise<string>} Path to extracted file
     */
    async extractGzFile(filePath, outputPath = null) {
        try {
            // Generate output path if not provided
            if (!outputPath) {
                const filename = path.basename(filePath, '.gz');
                outputPath = path.join(this.config.extractDir, filename);
            }

            logger.processInfo(`Extracting ${filePath} to ${outputPath}`);

            const gunzip = zlib.createGunzip();
            const source = fs.createReadStream(filePath);
            const destination = fs.createWriteStream(outputPath);

            await pipeline(source, gunzip, destination);

            logger.processInfo(`Successfully extracted file to ${outputPath}`);
            return outputPath;
        } catch (error) {
            logger.processingError(`Failed to extract file: ${filePath}`, error);
            throw error;
        }
    }

    /**
     * Find the latest XML file based on type
     * @param {string} type - File type ('full', 'delta', 'incremental')
     * @param {string} directory - Directory to search in
     * @returns {Promise<string|null>} Path to latest file or null if not found
     */
    async findLatestFile(type, directory = null) {
        try {
            const searchDir = directory || this.config.extractDir;
            
            // Ensure directory exists
            if (!fs.existsSync(searchDir)) {
                logger.processInfo(`Directory does not exist: ${searchDir}`);
                return null;
            }

            // Read directory contents
            const files = await readdir(searchDir);
            
            // Filter files by type
            const pattern = new RegExp(`${type}.*\\.xml$`, 'i');
            const matchingFiles = files.filter(file => pattern.test(file));
            
            if (matchingFiles.length === 0) {
                logger.processInfo(`No ${type} XML files found in ${searchDir}`);
                return null;
            }

            // Get file stats to find the most recent one
            const fileStats = await Promise.all(
                matchingFiles.map(async (file) => {
                    const filePath = path.join(searchDir, file);
                    const stats = await stat(filePath);
                    return { 
                        path: filePath, 
                        file, 
                        mtime: stats.mtime,
                        size: stats.size
                    };
                })
            );

            // Sort by modification time (newest first)
            fileStats.sort((a, b) => b.mtime - a.mtime);
            
            const latestFile = fileStats[0];
            logger.processInfo(`Found latest ${type} file: ${latestFile.file} (${(latestFile.size / (1024 * 1024)).toFixed(2)} MB)`);
            
            return latestFile.path;
        } catch (error) {
            logger.processingError(`Failed to find latest ${type} file`, error);
            throw error;
        }
    }

    /**
     * Download and extract file in one operation
     * @param {string} url - URL to download from
     * @param {boolean} isCompressed - Whether the file is gzipped
     * @returns {Promise<string>} Path to processed file
     */
    async downloadAndExtract(url, isCompressed = true) {
        try {
            // Download the file
            const downloadedPath = await this.downloadFile(url);
            
            // Extract if compressed
            if (isCompressed) {
                const extractedPath = await this.extractGzFile(downloadedPath);
                return extractedPath;
            }
            
            return downloadedPath;
        } catch (error) {
            logger.processingError(`Failed to download and extract file from ${url}`, error);
            throw error;
        }
    }

    /**
     * Process a file for PFA data based on specified type
     * @param {string} type - File type ('full', 'delta', 'incremental')
     * @param {Object} options - Processing options
     * @returns {Promise<string>} Path to file ready for processing
     */
    async getLatestFileForProcessing(type, options = {}) {
        const { 
            useLocal = true,
            downloadUrl = null,
            isCompressed = true,
            targetDirectory = null 
        } = options;
        
        try {
            // First try to find a local file if requested
            if (useLocal) {
                const localFile = await this.findLatestFile(type, targetDirectory);
                if (localFile) {
                    return localFile;
                }
            }
            
            // If no local file found and URL provided, download
            if (downloadUrl) {
                return this.downloadAndExtract(downloadUrl, isCompressed);
            }
            
            throw new Error(`No local ${type} file found and no download URL provided`);
        } catch (error) {
            logger.processingError(`Failed to get latest ${type} file for processing`, error);
            throw error;
        }
    }
}

module.exports = DownloadExtractService;