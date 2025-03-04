// src/utils/error-handler.js
const logger = require('./logging');

/**
 * Global error handler for centralized error management
 */
class ErrorHandler {
    /**
     * Constructor
     */
    constructor() {
        this.setupGlobalHandlers();
    }
    
    /**
     * Set up global error handlers
     */
    setupGlobalHandlers() {
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            this.handleFatalError('Uncaught Exception', error);
            
            // Allow logs to flush before exiting
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            this.handleFatalError('Unhandled Promise Rejection', reason);
            
            // Allow logs to flush before exiting
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });
        
        // Handle SIGTERM
        process.on('SIGTERM', () => {
            logger.info('Received SIGTERM signal');
            
            // Allow logs to flush before exiting
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        });
        
        // Handle SIGINT (Ctrl+C)
        process.on('SIGINT', () => {
            logger.info('Received SIGINT signal');
            
            // Allow logs to flush before exiting
            setTimeout(() => {
                process.exit(0);
            }, 1000);
        });
    }
    
    /**
     * Handle database error
     * @param {string} operation - Database operation
     * @param {Error} error - Error object
     * @param {Object} context - Additional context
     */
    handleDatabaseError(operation, error, context = {}) {
        logger.error(`Database error during ${operation}`, {
            ...context,
            error: error.message,
            code: error.code,
            stack: error.stack,
            context: 'database'
        });
        
        // Determine if this is a connection error
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            this.handleConnectionError(error, 'Database connection error');
        }
    }
    
    /**
     * Handle connection error
     * @param {Error} error - Error object
     * @param {string} message - Error message
     * @param {Object} context - Additional context
     */
    handleConnectionError(error, message = 'Connection error', context = {}) {
        logger.error(message, {
            ...context,
            error: error.message,
            code: error.code,
            stack: error.stack,
            context: 'connection'
        });
    }
    
    /**
     * Handle XML parsing error
     * @param {Error} error - Error object
     * @param {Object} context - Additional context
     */
    handleXmlError(error, context = {}) {
        logger.error('XML parsing error', {
            ...context,
            error: error.message,
            stack: error.stack,
            context: 'xml'
        });
    }
    
    /**
     * Handle fatal error
     * @param {string} type - Error type
     * @param {Error} error - Error object
     */
    handleFatalError(type, error) {
        logger.error(`Fatal error: ${type}`, {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : 'No stack trace available',
            context: 'fatal'
        });
        
        // Output to console as well for immediate visibility
        console.error(`\n\nFATAL ERROR: ${type}`);
        console.error(error);
    }
    
    /**
     * Handle validation error
     * @param {string} type - Validation type
     * @param {string} message - Error message
     * @param {Object} context - Additional context
     */
    handleValidationError(type, message, context = {}) {
        logger.error(`Validation error: ${type}`, {
            ...context,
            message,
            context: 'validation'
        });
    }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

module.exports = errorHandler;