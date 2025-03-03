// src/utils/date-formatter.js
/**
 * Utility functions for date handling throughout the application
 */

// Month name to number mapping
const MONTH_MAP = {
  'JAN': 1, 'JANUARY': 1,
  'FEB': 2, 'FEBRUARY': 2,
  'MAR': 3, 'MARCH': 3,
  'APR': 4, 'APRIL': 4,
  'MAY': 5,
  'JUN': 6, 'JUNE': 6,
  'JUL': 7, 'JULY': 7,
  'AUG': 8, 'AUGUST': 8,
  'SEP': 9, 'SEPTEMBER': 9,
  'OCT': 10, 'OCTOBER': 10,
  'NOV': 11, 'NOVEMBER': 11,
  'DEC': 12, 'DECEMBER': 12
};

/**
 * Convert month name to number
 * @param {string} monthName - Month name (e.g., 'JAN', 'January')
 * @returns {number} Month number (1-12) or null if invalid
 */
function convertMonthNameToNumber(monthName) {
  if (!monthName) return null;
  
  // If already a number, return it
  if (!isNaN(monthName)) {
    const num = parseInt(monthName, 10);
    return (num >= 1 && num <= 12) ? num : null;
  }
  
  // Try to convert from name
  const upperMonth = monthName.toUpperCase();
  return MONTH_MAP[upperMonth] || null;
}

/**
 * Parse date components into a JavaScript Date object
 * @param {number|string} year - Year
 * @param {number|string} month - Month (number 1-12 or name)
 * @param {number|string} day - Day
 * @returns {Date|null} Date object or null if invalid
 */
function parseDate(year, month, day = 1) {
  try {
    if (!year || !month) return null;
    
    // Convert year to number
    const numYear = parseInt(year, 10);
    if (isNaN(numYear)) return null;
    
    // Convert month to number (1-12)
    const numMonth = convertMonthNameToNumber(month);
    if (!numMonth) return null;
    
    // Convert day to number
    const numDay = parseInt(day, 10) || 1;
    
    // Create Date (month is 0-based in JavaScript)
    return new Date(numYear, numMonth - 1, numDay);
  } catch (error) {
    return null;
  }
}

/**
 * Format a Date object or date components to ISO string (YYYY-MM-DD)
 * @param {Date|number|string} date - Date object, or year if separate components
 * @param {number|string} [month] - Month if using separate components
 * @param {number|string} [day] - Day if using separate components
 * @returns {string|null} Formatted date string or null if invalid
 */
function formatDate(date, month, day) {
  try {
    let dateObj;
    
    if (date instanceof Date) {
      dateObj = date;
    } else if (arguments.length >= 2) {
      // Using separate components
      dateObj = parseDate(date, month, day);
    } else {
      // Try parsing from string
      dateObj = new Date(date);
    }
    
    if (!dateObj || isNaN(dateObj.getTime())) return null;
    
    // Format as ISO date (YYYY-MM-DD)
    return dateObj.toISOString().split('T')[0];
  } catch (error) {
    return null;
  }
}

/**
 * Extract date components from a date string or object
 * @param {Date|string} date - Date to extract from
 * @returns {Object|null} Object with year, month, day properties or null if invalid
 */
function extractDateComponents(date) {
  try {
    if (!date) return null;
    
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) return null;
    
    return {
      year: dateObj.getFullYear(),
      month: dateObj.getMonth() + 1, // Convert from 0-based to 1-based
      day: dateObj.getDate()
    };
  } catch (error) {
    return null;
  }
}

/**
 * Get formatted month name for a given month number
 * @param {number} monthNum - Month number (1-12)
 * @param {boolean} [short=false] - Whether to return short (3-letter) month name
 * @returns {string|null} Month name or null if invalid
 */
function getMonthName(monthNum, short = false) {
  if (monthNum < 1 || monthNum > 12 || isNaN(monthNum)) return null;
  
  const date = new Date(2000, monthNum - 1, 1);
  return date.toLocaleString('en-US', { 
    month: short ? 'short' : 'long' 
  });
}

module.exports = {
  convertMonthNameToNumber,
  parseDate,
  formatDate,
  extractDateComponents,
  getMonthName
};