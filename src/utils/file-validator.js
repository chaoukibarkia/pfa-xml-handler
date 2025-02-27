const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logging');

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
            const error = new Error(`XML file not found: ${filePath}`);
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
}

module.exports = FileValidator;