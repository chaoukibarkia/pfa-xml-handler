// src/utils/file-validator.js
const fs = require('fs');
const path = require('path');
const logger = require('./logging');

class FileValidator {
    /**
     * Validate XML file
     * @param {string} filePath - Path to the XML file
     * @param {Object} config - Configuration object
     * @returns {string} Validated file path
     * @throws {Error} If file validation fails
     */
    static validate(filePath, config = {}) {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            const error = new Error(`File not found: ${filePath}`);
            logger.processingError('File not found', error);
            throw error;
        }

        // Get file stats
        const stats = fs.statSync(filePath);
        const fileSizeInGB = stats.size / (1024 * 1024 * 1024);

        // Validate file extension
        const ext = path.extname(filePath).toLowerCase();
        const validExtensions = config.xml?.validExtensions || ['.xml'];
        
        if (!validExtensions.includes(ext)) {
            const error = new Error(`Invalid file type. Expected ${validExtensions.join(', ')}, got ${ext}`);
            logger.processingError('Invalid file type', error);
            throw error;
        }

        // Validate file size if max size is configured
        const maxFileSizeGB = config.xml?.maxFileSizeGB || 10;
        if (fileSizeInGB > maxFileSizeGB) {
            const error = new Error(`File too large. Max size is ${maxFileSizeGB}GB, file is ${fileSizeInGB.toFixed(2)}GB`);
            logger.processingError('File size exceeded', error);
            throw error;
        }

        // Log file details
        logger.processInfo('File validated', {
            path: filePath,
            size: `${fileSizeInGB.toFixed(2)} GB`,
            extension: ext
        });

        return filePath;
    }
    
    /**
     * Validate output directory
     * @param {string} directoryPath - Path to the output directory
     * @param {boolean} [create=true] - Whether to create the directory if it doesn't exist
     * @returns {string} Validated directory path
     * @throws {Error} If directory validation fails
     */
    static validateDirectory(directoryPath, create = true) {
        // Create directory if it doesn't exist and create flag is true
        if (!fs.existsSync(directoryPath)) {
            if (create) {
                try {
                    fs.mkdirSync(directoryPath, { recursive: true });
                    logger.processInfo(`Created directory: ${directoryPath}`);
                } catch (error) {
                    logger.processingError(`Failed to create directory: ${directoryPath}`, error);
                    throw new Error(`Failed to create directory: ${directoryPath}`);
                }
            } else {
                const error = new Error(`Directory not found: ${directoryPath}`);
                logger.processingError('Directory not found', error);
                throw error;
            }
        }
        
        // Check if it's a directory
        if (!fs.statSync(directoryPath).isDirectory()) {
            const error = new Error(`Not a directory: ${directoryPath}`);
            logger.processingError('Not a directory', error);
            throw error;
        }
        
        // Check if it's writable
        try {
            const testFile = path.join(directoryPath, '.write-test');
            fs.writeFileSync(testFile, '');
            fs.unlinkSync(testFile);
        } catch (error) {
            logger.processingError(`Directory not writable: ${directoryPath}`, error);
            throw new Error(`Directory not writable: ${directoryPath}`);
        }
        
        logger.processInfo('Directory validated', { path: directoryPath });
        return directoryPath;
    }
}

module.exports = FileValidator;