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

// Configure max memory for Node.js process
// This prevents the 'JavaScript heap out of memory' error
// Note: This should be adjusted according to system capabilities
const maxMemoryMB = parseInt(process.env.NODE_MAX_MEMORY_MB || '4096', 10);
// Set Node.js max old space size to the configured value
if (maxMemoryMB) {
  // For the running instance - though this should be set via command line option when starting
  process.env.NODE_OPTIONS = `--max-old-space-size=${maxMemoryMB}`;
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
    type: 'int'
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
    help: 'Maximum memory allocation in MB (also set by NODE_MAX_MEMORY_MB env var)',
    type: 'int',
    default: maxMemoryMB
  });
  
  parser.add_argument('--stream-mode', { 
    help: 'Processing mode: eager (all at once) or stream (smaller batches)',
    choices: ['eager', 'stream'],
    default: 'stream'
  });
  
  parser.add_argument('--gc-interval', { 
    help: 'Force garbage collection interval (in records)',
    type: 'int',
    default: 1000
  });

  // Parse arguments
  const args = parser.parse_args();

  try {
    // Either a file path or a URL must be provided
    if (!args.file && !args.url) {
      throw new Error('Either a file path (-f, --file) or URL (-u, --url) must be provided');
    }

    // Load configuration with command line overrides
    const configManager = new ConfigManager({
      configPath: args.config,
      database: args.connection ? { connectionString: args.connection } : undefined,
      processing: {
        batchSize: args.batch_size || undefined,
        streamMode: args.stream_mode,
        gcInterval: args.gc_interval,
        maxMemoryMB: args.max_memory
      },
      xml: args.max_file_size ? { maxFileSizeGB: args.max_file_size } : undefined
    });
    
    const config = configManager.load();
    
    // Update memory settings if specified
    if (args.max_memory && args.max_memory !== maxMemoryMB) {
      logger.processInfo(`Setting maximum memory allocation to ${args.max_memory}MB`);
      process.env.NODE_OPTIONS = `--max-old-space-size=${args.max_memory}`;
    }
    logger.processInfo('Configuration loaded successfully');

    // File path to process (may be downloaded)
    let filePath = args.file;

    // If URL is provided, download the file
    if (args.url) {
      logger.processInfo(`Downloading file from ${args.url}`);
      const downloadService = new DownloadExtractService(config.storage);
      
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

    // Create database connection pool
    const dbConfig = configManager.getDatabaseConfig();
    const pool = new Pool(dbConfig);

    // Process the XML file
    logger.processInfo('Beginning XML file processing', {
      filePath,
      batchSize: config.processing.batchSize,
      validateXml: !args.no_validate
    });

    const parserOptions = {
      batchSize: config.processing.batchSize,
      validateXml: !args.no_validate,
      maxFileSizeGB: config.xml.maxFileSizeGB,
      streamMode: config.processing.streamMode,
      gcInterval: config.processing.gcInterval,
      maxMemoryMB: config.processing.maxMemoryMB
    };

    const xmlParser = new XmlParserService(dbConfig, parserOptions);
    const startTime = new Date();
    const stats = await xmlParser.parseXMLFile(filePath);
    const endTime = new Date();

    // Calculate processing time
    const processingSeconds = (endTime - startTime) / 1000;
    const minutes = Math.floor(processingSeconds / 60);
    const seconds = Math.floor(processingSeconds % 60);

    // Display results
    console.log('\n------------------------------------');
    console.log('XML PROCESSING COMPLETED SUCCESSFULLY');
    console.log('------------------------------------');
    console.log(`File: ${path.basename(filePath)}`);
    console.log(`Processing time: ${minutes}m ${seconds}s`);
    console.log(`Total records processed: ${stats.processedRecords}`);
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
    console.log('See logs for detailed information.');

    // Close the pool
    await pool.end();
    
  } catch (error) {
    // Handle errors
    errorHandler.handleFatalError('CLI Error', error);
    
    console.error('\n-----------------------');
    console.error('XML PROCESSING FAILED');
    console.error('-----------------------');
    console.error(`Error: ${error.message}`);
    console.error('See logs for detailed information.');
    
    process.exit(1);
  }
}

// Run the application
main().catch(error => {
  errorHandler.handleFatalError('Unhandled Promise Rejection', error);
  process.exit(1);
});