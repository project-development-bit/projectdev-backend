const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Translate } = require('@google-cloud/translate').v2;
const fs = require('fs').promises;

const languages = require('./languages');

// Configuration
const SOURCE_FILE = path.join(__dirname, 'en.json');
const OUTPUT_DIR = path.join(__dirname, 'output');
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds between retries
const DELAY_BETWEEN_REQUESTS = 100; // 100ms between each translation 
const BATCH_SIZE = 5; // Process 5 languages at a time
const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds between batches

// Initialize Google Cloud Translate client
const translate = new Translate({
  key: process.env.GOOGLE_TRANSLATE_API_KEY
});

// Statistics for logging
const stats = {
  totalLanguages: 0,
  languagesUpdated: 0,
  newKeysFound: 0,
  totalKeysTranslated: 0,
  totalCharactersTranslated: 0,
  errors: []
};

//Sleep utility for delays
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//Translate text using Google Cloud Translation API
async function translateText(text, targetLang, retries = MAX_RETRIES) {
  try {
    await sleep(DELAY_BETWEEN_REQUESTS);

    const [translation] = await translate.translate(text, targetLang);

    // Track character count
    stats.totalCharactersTranslated += text.length;

    return translation;
  } catch (error) {
    if (retries > 0) {
      const backoffDelay = RETRY_DELAY * (MAX_RETRIES - retries + 1);
      console.log(`  ⚠ Translation failed, waiting ${backoffDelay/1000}s before retry... (${MAX_RETRIES - retries + 1}/${MAX_RETRIES})`);
      await sleep(backoffDelay);
      return translateText(text, targetLang, retries - 1);
    }
    throw error;
  }
}

//Load JSON file safely
async function loadJSON(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null; // File doesn't exist
    }
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}

//Save JSON file with proper formatting
async function saveJSON(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

//Ensure output directory exists
async function ensureOutputDir() {
  try {
    await fs.access(OUTPUT_DIR);
  } catch {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
  }
}

//Translate an object
async function translateObject(obj, targetLang, parentKey = '') {
  const translated = {};

  for (const [key, value] of Object.entries(obj)) {
    const currentKey = parentKey ? `${parentKey}.${key}` : key;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively translate nested objects
      translated[key] = await translateObject(value, targetLang, currentKey);
    } else if (typeof value === 'string') {
      try {
        translated[key] = await translateText(value, targetLang);
        stats.totalKeysTranslated++;
        // Show progress for each key
        process.stdout.write('.');
      } catch (error) {
        console.error(`\n  ✖ Failed to translate key "${currentKey}": ${error.message}`);
        translated[key] = value; // Keep original on error
        stats.errors.push({
          language: targetLang,
          key: currentKey,
          error: error.message
        });
      }
    } else {
      translated[key] = value;
    }
  }

  return translated;
}

//Find missing keys by comparing source and target objects
function findMissingKeys(sourceObj, targetObj, parentKey = '') {
  const missing = {};

  for (const [key, value] of Object.entries(sourceObj)) {
    const currentKey = parentKey ? `${parentKey}.${key}` : key;

    if (!(key in targetObj)) {
      // Key is completely missing
      missing[key] = value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively check nested objects
      const nestedMissing = findMissingKeys(value, targetObj[key] || {}, currentKey);
      if (Object.keys(nestedMissing).length > 0) {
        missing[key] = nestedMissing;
      }
    }
  }

  return missing;
}

//Count total keys in an object (including nested)
function countKeys(obj) {
  let count = 0;
  for (const value of Object.values(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      count += countKeys(value);
    } else if (typeof value === 'string') {
      count++;
    }
  }
  return count;
}

//Merge missing translations into existing object
function mergeTranslations(existing, newTranslations) {
  const merged = { ...existing };

  for (const [key, value] of Object.entries(newTranslations)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      merged[key] = mergeTranslations(merged[key] || {}, value);
    } else {
      merged[key] = value;
    }
  }

  return merged;
}

//Translate a single language
async function translateLanguage(langCode, sourceData) {
  const outputFile = path.join(OUTPUT_DIR, `${langCode}.json`);

  try {
    // Load existing translation if it exists
    const existingData = await loadJSON(outputFile);

    if (existingData) {
      // UPDATE MODE: Find and translate only missing keys
      const missingKeys = findMissingKeys(sourceData, existingData);
      const missingCount = countKeys(missingKeys);

      if (missingCount === 0) {
        console.log(`✓ ${langCode.padEnd(8)} - No updates needed`);
        return { updated: false, keysAdded: 0 };
      }

      process.stdout.write(`⟳ ${langCode.padEnd(8)} - Translating ${missingCount} new key(s) `);

      // Translate only missing keys
      const newTranslations = await translateObject(missingKeys, langCode);

      // Merge with existing data (appends to bottom)
      const updatedData = mergeTranslations(existingData, newTranslations);

      // Save updated file
      await saveJSON(outputFile, updatedData);

      stats.languagesUpdated++;
      stats.newKeysFound += missingCount;

      console.log(` ✓`);

      return { updated: true, keysAdded: missingCount };
    } else {
      // INITIAL MODE: Translate entire file
      const totalKeys = countKeys(sourceData);
      process.stdout.write(`→ ${langCode.padEnd(8)} - Creating translation (${totalKeys} keys) `);

      const translatedData = await translateObject(sourceData, langCode);
      await saveJSON(outputFile, translatedData);

      stats.languagesUpdated++;

      console.log(` ✓`);

      return { updated: true, keysAdded: totalKeys };
    }
  } catch (error) {
    console.error(`\n✖ ${langCode.padEnd(8)} - Error: ${error.message}`);
    stats.errors.push({
      language: langCode,
      error: error.message
    });
    return { updated: false, keysAdded: 0, error: error.message };
  }
}

//Process languages in batches
async function processBatch(langCodes, sourceData) {
  const results = [];

  // Process sequentially within batch
  for (const lang of langCodes) {
    const result = await translateLanguage(lang, sourceData);
    results.push(result);
  }

  return results;
}

//Main translation function
async function translateAll() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      Google Cloud Translation API - Official Client       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Verify API key is set
    if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
      throw new Error('GOOGLE_TRANSLATE_API_KEY environment variable is not set');
    }

    // Load source file
    console.log(`📖 Loading source file: ${SOURCE_FILE}`);
    const sourceData = await loadJSON(SOURCE_FILE);

    if (!sourceData) {
      throw new Error('Source file not found or empty');
    }

    const sourceKeys = countKeys(sourceData);
    console.log(`✓ Loaded ${sourceKeys} key(s) from source file\n`);

    // Ensure output directory exists
    await ensureOutputDir();

    // Initialize stats
    stats.totalLanguages = languages.length;

    console.log(`🌍 Processing ${languages.length} language(s)...`);
    console.log(`⏱  Using Google Cloud Translation API...\n`);

    // Process languages in batches
    for (let i = 0; i < languages.length; i += BATCH_SIZE) {
      const batch = languages.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(languages.length / BATCH_SIZE);

      console.log(`\n📦 Batch ${batchNum}/${totalBatches} (${batch.join(', ')})\n`);

      await processBatch(batch, sourceData);

      // Delay between batches
      if (i + BATCH_SIZE < languages.length) {
        console.log(`\n⏸  Waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
        await sleep(DELAY_BETWEEN_BATCHES);
      }
    }

    // Print summary
    printSummary();

  } catch (error) {
    console.error(`\n❌ Fatal error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Print summary statistics
 */
function printSummary() {
  console.log('\n\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                     Summary Report                         ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`📊 Statistics:`);
  console.log(`   • Total languages processed:   ${stats.totalLanguages}`);
  console.log(`   • Languages updated:           ${stats.languagesUpdated}`);
  console.log(`   • Total keys translated:       ${stats.totalKeysTranslated}`);
  console.log(`   • Total characters translated: ${stats.totalCharactersTranslated.toLocaleString()}`);

  if (stats.newKeysFound > 0) {
    console.log(`   • New keys found and added:    ${stats.newKeysFound}`);
  }

  if (stats.errors.length > 0) {
    console.log(`\n⚠ Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`   • [${err.language}] ${err.key || 'General'}: ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more errors`);
    }
  } else {
    console.log(`\n✓ All translations completed successfully!`);
  }

}

// Run if executed directly
if (require.main === module) {
  translateAll().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { translateAll, translateLanguage };
