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
      processing: args.batch_size ? { batchSize: args.batch_size } : undefined,
      xml: args.max_file_size ? { maxFileSizeGB: args.max_file_size } : undefined
    });
    
    const config = configManager.load();
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
      maxFileSizeGB: config.xml.maxFileSizeGB
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