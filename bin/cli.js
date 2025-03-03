#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ArgumentParser } = require('argparse');
const XMLParserService = require('../src/services/xml-parser-service');
const logger = require('../src/utils/logging');
const FileValidator = require('../src/utils/file-validator');

// Load configuration
let config;
try {
  const configPath = path.resolve(process.cwd(), 'config.json');
  if (fs.existsSync(configPath)) {
    config = require(configPath);
    logger.processInfo('Loaded configuration from config.json');
  } else {
    logger.processInfo('No config.json found, using default configuration');
    config = {
      database: {
        connectionString: "postgresql://postgres:postgres@localhost:5432/pfa_db",
        maxConnections: 10,
        idleTimeout: 30000,
        connectionTimeout: 2000
      },
      processing: {
        batchSize: 500,
        logLevel: "info",
        logDirectory: "./logs"
      },
      xml: {
        validExtensions: [".xml"],
        maxFileSizeGB: 10
      }
    };
  }
} catch (error) {
  logger.processingError('Failed to load configuration', error);
  process.exit(1);
}

// Setup argument parser
const parser = new ArgumentParser({
  description: 'PFA XML Handler - Process large XML files into PostgreSQL database'
});

parser.add_argument('-f', '--file', { 
  help: 'Path to input XML file', 
  required: true 
});

parser.add_argument('-c', '--connection', { 
  help: 'Database connection string', 
  default: config.database.connectionString 
});

parser.add_argument('-b', '--batch-size', { 
  help: 'Batch size for processing', 
  type: 'int', 
  default: config.processing.batchSize 
});

parser.add_argument('-m', '--max-file-size', { 
  help: 'Maximum file size in GB', 
  type: 'float', 
  default: config.xml.maxFileSizeGB 
});

parser.add_argument('--no-validate', { 
  help: 'Skip XML validation', 
  action: 'store_true' 
});

// Parse arguments
const args = parser.parse_args();

// Setup database config
const dbConfig = args.connection.startsWith('postgresql://') 
  ? { connectionString: args.connection } 
  : { 
      connectionString: args.connection,
      max: config.database.maxConnections,
      idleTimeoutMillis: config.database.idleTimeout,
      connectionTimeoutMillis: config.database.connectionTimeout
    };

// Parse XML file
async function processXmlFile() {
  try {
    // Validate the file
    logger.processInfo('Starting XML file validation');
    const validatedFilePath = FileValidator.validate(args.file, {
      xml: {
        validExtensions: config.xml.validExtensions,
        maxFileSizeGB: args.max_file_size
      }
    });
    
    // Create XML parser
    logger.processInfo('Creating XML parser service');
    const parserOptions = {
      batchSize: args.batch_size,
      validateXml: !args.no_validate,
      maxFileSizeGB: args.max_file_size
    };
    
    const xmlParser = new XMLParserService(dbConfig, parserOptions);
    
    // Start processing
    logger.processInfo('Beginning XML file processing', {
      filePath: validatedFilePath,
      batchSize: args.batch_size,
      validateXml: !args.no_validate
    });
    
    const startTime = new Date();
    const stats = await xmlParser.parseXMLFile(validatedFilePath);
    const endTime = new Date();
    
    // Calculate processing time
    const processingSeconds = (endTime - startTime) / 1000;
    const minutes = Math.floor(processingSeconds / 60);
    const seconds = Math.floor(processingSeconds % 60);
    
    // Log results
    logger.processInfo('XML processing completed successfully', {
      filePath: validatedFilePath,
      processingTime: `${minutes}m ${seconds}s`,
      totalRecords: stats.processedRecords,
      recordsPerSecond: (stats.processedRecords / processingSeconds).toFixed(2),
      counts: stats.counts
    });
    
    console.log('\n------------------------------------');
    console.log('XML PROCESSING COMPLETED SUCCESSFULLY');
    console.log('------------------------------------');
    console.log(`File: ${path.basename(validatedFilePath)}`);
    console.log(`Processing time: ${minutes}m ${seconds}s`);
    console.log(`Total records processed: ${stats.processedRecords}`);
    console.log(`Speed: ${(stats.processedRecords / processingSeconds).toFixed(2)} records/second`);
    console.log('------------------------------------');
    console.log('Record counts:');
    
    // Display counts in a readable format
    Object.entries(stats.counts).forEach(([key, value]) => {
      if (value > 0) {
        console.log(`  ${key}: ${value}`);
      }
    });
    
    console.log('------------------------------------');
    console.log('See logs for detailed information.');
    
  } catch (error) {
    logger.processingError('XML processing failed', error);
    console.error('\n-----------------------');
    console.error('XML PROCESSING FAILED');
    console.error('-----------------------');
    console.error(`Error: ${error.message}`);
    console.error('See logs for detailed information.');
    process.exit(1);
  }
}

// Run the processing
processXmlFile();