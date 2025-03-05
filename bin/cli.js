#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ArgumentParser } = require('argparse');
const { Pool } = require('pg');
const XmlParserService = require('../src/services/xml-parser-service');
const logger = require('../src/utils/logging');
const FileValidator = require('../src/utils/file-validator');
const ConfigManager = require('../src/config/index');
const errorHandler = require('../src/utils/error-handler');
const DownloadExtractService = require('../src/services/download-extract-service');
const os = require('os');

// Default memory settings
const defaultMaxMemoryMB = parseInt(process.env.NODE_MAX_MEMORY_MB || '4096', 10);
const systemMemoryMB = Math.floor(os.totalmem() / (1024 * 1024));
const recommendedMemoryMB = Math.min(Math.floor(systemMemoryMB * 0.7), 8192);

// Enable garbage collection if possible
let gcEnabled = false;
try {
  if (global.gc) {
    gcEnabled = true;
    logger.processInfo('Manual garbage collection is enabled');
  }
} catch (e) {
  // gc not available
}

/**
 * Main CLI application for PFA XML Handler
 */
async function main() {
  // Setup argument parser
  const parser = new ArgumentParser({
    description: 'PFA XML Handler - Process large XML files into PostgreSQL database'
  });

  parser.add_argument('-f', '--file', { 
    help: 'Path to input XML file', 
    required: false 
  });

  parser.add_argument('-u', '--url', { 
    help: 'URL to download XML file from', 
    required: false 
  });

  parser.add_argument('-c', '--connection', { 
    help: 'Database connection string' 
  });

  parser.add_argument('-b', '--batch-size', { 
    help: 'Batch size for processing', 
    type: 'int',
    default: 100 // Reduced default for better memory management
  });

  parser.add_argument('-m', '--max-file-size', { 
    help: 'Maximum file size in GB', 
    type: 'float'
  });

  parser.add_argument('--config', { 
    help: 'Path to custom config file',
    default: path.resolve(process.cwd(), 'config.json')
  });

  parser.add_argument('--type', { 
    help: 'Type of file to process: full, delta, incremental',
    choices: ['full', 'delta', 'incremental'],
    default: 'full'
  });

  parser.add_argument('--no-validate', { 
    help: 'Skip XML validation', 
    action: 'store_true' 
  });

  parser.add_argument('--download-only', { 
    help: 'Only download the file, do not process', 
    action: 'store_true' 
  });
  
  parser.add_argument('--max-memory', { 
    help: `Maximum memory allocation in MB (default: ${defaultMaxMemoryMB}, recommended: ${recommendedMemoryMB})`,
    type: 'int',
    default: defaultMaxMemoryMB
  });
  
  parser.add_argument('--stream-mode', { 
    help: 'Processing mode: eager (all at once) or stream (smaller batches)',
    choices: ['eager', 'stream'],
    default: 'stream'
  });
  
  parser.add_argument('--gc-interval', { 
    help: 'Force garbage collection interval (in records)',
    type: 'int',
    default: 500 // More frequent GC
  });

  // New options for improved memory management
  parser.add_argument('--chunk-size', { 
    help: 'Size of file chunks in MB for large file processing',
    type: 'int',
    default: 50
  });
  
  parser.add_argument('--memory-check-interval', { 
    help: 'Interval for memory usage checks in milliseconds',
    type: 'int',
    default: 10000 // 10 seconds
  });
  
  parser.add_argument('--db-pool-size', { 
    help: 'Maximum database connection pool size',
    type: 'int',
    default: 5
  });
  
  parser.add_argument('--db-idle-timeout', { 
    help: 'Database connection idle timeout in milliseconds',
    type: 'int',
    default: 10000
  });
  
  parser.add_argument('--disable-file-chunking', {
    help: 'Disable file chunking for large files',
    action: 'store_true'
  });

  // Parse arguments
  const args = parser.parse_args();

  try {
    // Either a file path or a URL must be provided
    if (!args.file && !args.url) {
      throw new Error('Either a file path (-f, --file) or URL (-u, --url) must be provided');
    }

    // Check if we can use garbage collection
    if (!gcEnabled) {
      logger.processInfo('WARNING: Manual garbage collection is not enabled. For better memory management, run with --expose-gc flag');
      console.warn('\nWARNING: For better memory management with large files, run with node --expose-gc --max-old-space-size=XXXX');
    }
    
    // Memory recommendation
    if (args.max_memory < recommendedMemoryMB * 0.5 || args.max_memory > systemMemoryMB * 0.9) {
      logger.processInfo(`NOTICE: Your memory allocation (${args.max_memory}MB) is outside the recommended range. Suggested value: ${recommendedMemoryMB}MB`);
      console.warn(`\nNOTICE: Your memory allocation (${args.max_memory}MB) might not be optimal. Suggested value: ${recommendedMemoryMB}MB`);
    }

    // Load configuration with command line overrides
    const configManager = new ConfigManager({
      configPath: args.config,
      database: {
        connectionString: args.connection,
        maxConnections: args.db_pool_size,
        idleTimeout: args.db_idle_timeout
      },
      processing: {
        batchSize: args.batch_size,
        streamMode: args.stream_mode,
        gcInterval: args.gc_interval,
        maxMemoryMB: args.max_memory,
        logMemoryInterval: args.memory_check_interval
      },
      xml: {
        maxFileSizeGB: args.max_file_size,
        validateStructure: !args.no_validate
      },
      storage: {
        chunkSize: args.chunk_size * 1024 * 1024, // Convert MB to bytes
        disableChunking: args.disable_file_chunking
      }
    });
    
    const config = configManager.load();
    
    // Update memory settings if specified
    if (args.max_memory && args.max_memory !== defaultMaxMemoryMB) {
      logger.processInfo(`Setting maximum memory allocation to ${args.max_memory}MB`);
      // Note: For a running process, this won't actually change the limit
      // This is informational only - the --max-old-space-size flag must be set when starting Node
      logger.processInfo('Memory limit can only be set when starting the Node process with --max-old-space-size flag');
    }
    
    // Log key configuration settings
    logger.processInfo('Configuration loaded successfully', {
      batchSize: config.processing.batchSize,
      streamMode: config.processing.streamMode,
      gcInterval: config.processing.gcInterval,
      maxMemoryMB: config.processing.maxMemoryMB,
      chunkSize: `${config.storage.chunkSize / (1024 * 1024)}MB`,
      disableChunking: config.storage.disableChunking
    });

    // File path to process (may be downloaded)
    let filePath = args.file;

    // If URL is provided, download the file
    if (args.url) {
      logger.processInfo(`Downloading file from ${args.url}`);
      const downloadService = new DownloadExtractService({
        ...config.storage,
        retryAttempts: 5, // More resilient downloads
        retryDelay: 10000  // 10 seconds between retries
      });
      
      // Initialize download service
      await downloadService.initialize();
      
      // Download and possibly extract the file
      filePath = await downloadService.downloadAndExtract(args.url, true);
      
      logger.processInfo(`File downloaded successfully to ${filePath}`);
      
      // Exit if download-only flag is set
      if (args.download_only) {
        logger.processInfo('Download complete, exiting as --download-only was specified');
        return;
      }
    }

    // Validate the file
    logger.processInfo('Validating file');
    FileValidator.validate(filePath, config.xml);

    // Process the XML file
    logger.processInfo('Beginning XML file processing', {
      filePath,
      batchSize: config.processing.batchSize,
      validateXml: !args.no_validate,
      maxMemoryMB: config.processing.maxMemoryMB,
      gcInterval: config.processing.gcInterval
    });

    // Enhanced parser options
    const parserOptions = {
      batchSize: config.processing.batchSize,
      validateXml: !args.no_validate,
      maxFileSizeGB: config.xml.maxFileSizeGB,
      streamMode: config.processing.streamMode,
      gcInterval: config.processing.gcInterval,
      maxMemoryMB: config.processing.maxMemoryMB,
      tempDir: config.storage.tempDirectory,
      logMemoryInterval: config.processing.logMemoryInterval,
      chunkSize: config.storage.chunkSize,
      maxConnections: config.database.maxConnections,
      idleTimeout: config.database.idleTimeout,
      disableChunking: config.storage.disableChunking
    };

    // Create and run XML parser
    const xmlParser = new XmlParserService(config.database, parserOptions);
    
    // Set up memory warning handler
    xmlParser.on('memory-warning', (stats) => {
      console.warn(`\nWARNING: High memory usage detected: ${stats.heapUsedMB}MB of ${stats.maxAllowedMB}MB`);
    });
    
    // Set up abort handler
    xmlParser.on('abort', (abortInfo) => {
      console.error(`\nERROR: Processing aborted due to ${abortInfo.reason}. Memory usage: ${abortInfo.heapUsedMB}MB`);
    });
    
    const startTime = new Date();
    const stats = await xmlParser.parseXMLFile(filePath);
    const endTime = new Date();

    // Calculate processing time
    const processingSeconds = (endTime - startTime) / 1000;
    const hours = Math.floor(processingSeconds / 3600);
    const minutes = Math.floor((processingSeconds % 3600) / 60);
    const seconds = Math.floor(processingSeconds % 60);

    // Display results
    console.log('\n------------------------------------');
    console.log('XML PROCESSING COMPLETED SUCCESSFULLY');
    console.log('------------------------------------');
    console.log(`File: ${path.basename(filePath)}`);
    
    // Format time with hours if needed
    const timeDisplay = hours > 0 
      ? `${hours}h ${minutes}m ${seconds}s`
      : `${minutes}m ${seconds}s`;
    
    console.log(`Processing time: ${timeDisplay}`);
    console.log(`Total records processed: ${stats.processedRecords.toLocaleString()}`);
    console.log(`Speed: ${(stats.processedRecords / processingSeconds).toFixed(2)} records/second`);
    console.log('------------------------------------');
    console.log('Record counts:');

    // Display counts in a readable format
    Object.entries(stats.counts).forEach(([key, value]) => {
      if (value > 0) {
        console.log(`  ${key}: ${value.toLocaleString()}`);
      }
    });

    console.log('------------------------------------');
    console.log('Peak memory usage:');
    const memUsage = process.memoryUsage();
    console.log(`  Heap: ${Math.round(memUsage.heapUsed / (1024 * 1024))}MB / ${Math.round(memUsage.heapTotal / (1024 * 1024))}MB`);
    console.log(`  RSS: ${Math.round(memUsage.rss / (1024 * 1024))}MB`);
    console.log('------------------------------------');
    console.log('See logs for detailed information.');

    // Close database pool
    if (xmlParser.pool) {
      await xmlParser.pool.end();
    }
    
  } catch (error) {
    // Handle errors
    errorHandler.handleFatalError('CLI Error', error);
    
    console.error('\n-----------------------');
    console.error('XML PROCESSING FAILED');
    console.error('-----------------------');
    console.error(`Error: ${error.message}`);
    
    // Show stack trace for development
    if (process.env.NODE_ENV === 'development') {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    console.error('\nSee logs for detailed information.');
    
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  errorHandler.handleFatalError('Unhandled Promise Rejection', error);
  process.exit(1);
});