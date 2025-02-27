# PFA XML Handler

## Overview
A robust, scalable solution for processing large XML files containing Public Figure Association data, designed to efficiently import data into a PostgreSQL database.

## Features
- Streaming XML parsing for large files
- Comprehensive data processing
- Configurable batch processing
- Command-line interface
- Detailed logging

## Prerequisites
- Node.js (v14+)
- PostgreSQL
- Large XML file to process

## Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/pfa-xml-handler.git
cd pfa-xml-handler

# Install dependencies
npm install

# Optional: Install globally
npm install -g
```

## Database Setup
1. Create a PostgreSQL database
2. Run the schema script:
```bash
psql -U your_username -d your_database -a -f database/schema.sql
```

## Usage
### CLI Options
```bash
# Basic usage
node bin/cli.js -f /path/to/input.xml

# With custom connection string
node bin/cli.js -f /path/to/input.xml -c "postgresql://username:password@localhost:5432/yourdb"

# Custom batch size
node bin/cli.js -f /path/to/input.xml -b 200
```

## Configuration
Copy `examples/sample-config.json` to `config.json` and modify as needed:
```json
{
  "database": {
    "connectionString": "postgresql://username:password@localhost:5432/yourdb",
    "maxConnections": 10,
    "idleTimeout": 30000
  },
  "processing": {
    "batchSize": 500,
    "logLevel": "info"
  }
}
```

## Troubleshooting
- Ensure XML file path is correct
- Verify database connection details
- Check available system resources

## Performance Tips
- Use on a machine with ample RAM
- Adjust batch size based on system capabilities
- Monitor system resources during processing

## Contributing
1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License
[Your License Here]
```