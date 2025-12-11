#  Translation System Documentation

  

##  Overview

  

This project uses Google Cloud Translation API to automatically translate application strings into 100+ languages. The translation system is powered by the official `@google-cloud/translate` package and uses the **Cloud Translation - Basic (v2)** API.

  

---

  

##  Quick Start

  

###  Running Translations

  

To translate all strings from the source `en.json` file into all supported languages:

  

```bash

npm run  translate

```

  

This command executes `node translation/translate.js`

  

---

  

##  Translation Workflows

  

###  🚀 Initial Translation (First Time Setup)

  

When setting up translations for the first time or adding a new language, the system will translate ALL keys in your `en.json` file.

  

**Steps:**

  

1.  **Ensure your source file is complete**

```bash

# Edit your source translations

translation/en.json

```

  

2.  **Set up Google Cloud API Key**
```bash

# Add to .env file

GOOGLE_TRANSLATE_API_KEY=your_api_key_here

```

  

3.  **Run the translation script**

```bash

npm run translate

```

  

4.  **What happens during initial translation:**

- Script reads all keys from `translation/en.json`

- For each language in `translation/languages.js`:

- Checks if `translation/output/{lang}.json` exists

- If **NOT exists**: Creates new file and translates ALL keys from scratch

- If **exists**: Only translates missing keys (see Append-Only Updates below)

- Processes languages in batches of 5 (configurable)

- Waits 5 seconds between batches to respect rate limits

- Displays real-time progress with dots for each key translated

  

**Example Output:**

```

╔════════════════════════════════════════════════════════════╗

║ Google Cloud Translation API - Official Client ║

╚════════════════════════════════════════════════════════════╝

  

📖 Loading source file: /path/to/translation/en.json

✓ Loaded 745 key(s) from source file

  

🌍 Processing 103 language(s)...

⏱ Using Google Cloud Translation API...

  

📦 Batch 1/21 (af, am, ar, az, be)

  

→ af - Creating translation (745 keys) ................... ✓

→ am - Creating translation (745 keys) ................... ✓

→ ar - Creating translation (745 keys) ................... ✓

→ az - Creating translation (745 keys) ................... ✓

→ be - Creating translation (745 keys) ................... ✓

  

⏸ Waiting 5s before next batch...

  

📦 Batch 2/21 (bg, bn, bs, ca, ceb)

...

```

  

**Cost Estimate for Initial Translation:**

- 745 keys × ~70 characters per key = ~52,150 characters per language

- 52,150 chars × 103 languages = ~5,371,450 total characters

- Minus free tier: 5,371,450 - 500,000 = 4,871,450 billable characters

- Cost: **~$97.43** (first month only, subsequent months are free unless you add new keys)

  

---

  

###  🔄 Append-Only Updates (Adding New Keys)

  

After initial setup, when you add new translation keys, the system intelligently detects and translates **only the missing keys**. This is the most common operation.

  

**How Append-Only Works:**

  

1.  **Deep comparison**: Script compares `en.json` structure with each existing `output/{lang}.json` file

2.  **Missing key detection**: Uses recursive algorithm to find keys that exist in source but not in target

3.  **Selective translation**: Only translates the missing keys (not the entire file)

4.  **Smart merging**: Merges new translations into existing files, preserving all existing content

5.  **Bottom append**: New keys are added at the bottom of the JSON structure in the same nested location

  

**Steps for Adding New Keys:**

  

1.  **Edit `translation/en.json`** and add your new keys:

```json

{

"existing_key":  "Existing value",

"profile":  "Profile",

  

// Add new keys anywhere in the structure

"new_feature_title":  "New Feature Title",

"new_feature_description":  "This is a brand new feature",

  

"settings":  {

"existing_setting":  "Old Setting",

// Add nested keys

"new_privacy":  "Privacy Settings",

"new_notifications":  "Notification Preferences"

}

}

```

  

2.  **Run translation script:**

```bash

npm run translate

```

  

3.  **Script behavior:**

- Scans and detects exactly which keys are missing in each language

- Only translates the new keys (massive cost savings!)

- Shows how many keys need translation for each language

- Much faster completion time

  

**Example Output:**

```

📖 Loading source file: /path/to/translation/en.json

✓ Loaded 749 key(s) from source file (4 new keys detected)

  

🌍 Processing 103 language(s)...

  

📦 Batch 1/21 (af, am, ar, az, be)

  

⟳ af - Translating 4 new key(s) .... ✓

⟳ am - Translating 4 new key(s) .... ✓

⟳ ar - Translating 4 new key(s) .... ✓

✓ az - No updates needed (already has all keys)

⟳ be - Translating 4 new key(s) .... ✓

```

  

**Cost Estimate for Append-Only Update:**

- 4 new keys × ~70 characters per key = ~280 characters per language

- 280 chars × 103 languages = ~28,840 characters

- Cost: **$0 (FREE!)** - Well within the 500K monthly free tier

- You can add up to **~114 new keys per month for FREE**

  

**Benefits:**

- ✅ **Highly cost-effective**: Only pay for new translations

- ✅ **Fast execution**: Skips languages already up to date

- ✅ **Safe**: Never overwrites or re-translates existing content

- ✅ **Automatic**: Smart detection requires no configuration

- ✅ **Maintains structure**: New keys appear in correct nested location

  

**Important Notes:**

- The script never deletes or modifies existing translations

- If you rename a key, it will be treated as a new key (old key remains)

- To remove old keys, manually edit the output files or recreate from scratch

  

---

  

###  🌍 Adding New Languages

  

You can add support for additional languages at any time without affecting existing translations.

  

**Steps:**

  

1.  **Edit `translation/languages.js`** and add new language codes:

```javascript

const  languages  =  [

"af",  "am",  "ar",  "az",  "be",  "bg",  "bn",  "bs",  "ca",  "ceb",

// ... existing 103 languages ...

"zu",

  

// Add your new languages here (use ISO 639-1 codes)

"tl",  // Filipino/Tagalog

"haw",  // Hawaiian

"sm",  // Samoan

"ku",  // Kurdish

];

  

module.exports  = languages;

```

  

2.  **Run translation script:**

```bash

npm run translate

```

  

3.  **What happens:**

- Script processes ALL languages in the updated list

- For existing languages: Only translates missing keys (append-only mode)

- For NEW languages: Creates complete translation file from scratch

- Each new language file will have all 745+ keys translated

  

**Example Output:**

```

🌍 Processing 107 language(s)... (4 new languages added)

  

📦 Batch 1/22 (af, am, ar, az, be)

  

✓ af - No updates needed

✓ am - No updates needed

✓ ar - No updates needed

...

  

📦 Batch 22/22 (tl, haw, sm, ku)

  

→ tl - Creating translation (745 keys) ................... ✓ [NEW]

→ haw - Creating translation (745 keys) ................... ✓ [NEW]

→ sm - Creating translation (745 keys) ................... ✓ [NEW]

→ ku - Creating translation (745 keys) ................... ✓ [NEW]

```

  

**Supported Language Codes:**

  

See [Google Cloud Translation Language Support](https://cloud.google.com/translate/docs/languages) for the complete list of 100+ available language codes.

  
**Cost for Adding Languages:**

-  **1 new language**: 745 keys × ~70 chars = ~52,150 characters = **$0 (FREE!)** within monthly tier

-  **5 new languages**: 52,150 × 5 = ~260,750 characters = **$0 (FREE!)** within monthly tier

-  **9 new languages**: 52,150 × 9 = ~469,350 characters = **$0 (FREE!)** at monthly tier limit

-  **10 new languages**: 52,150 × 10 = ~521,500 characters = **~$0.43** (only 21,500 chars billed)

-  **20 new languages**: 52,150 × 20 = ~1,043,000 characters = **~$10.86** (543K chars billed)

  

**Tip**: You can add up to **9 new languages per month for FREE** within the 500K monthly tier!

  

---

  

##  Google Cloud Translation API Billing

  

###  Understanding the Pricing Model

  

This project uses **Cloud Translation - Basic (v2)** which offers character-based pricing:

  

**Pricing:**

-  **First 500,000 characters/month**: **FREE** ($10 credit applied automatically)

-  **500K - 1 billion characters/month**: **$20 per million characters**

-  **Over 1 billion characters/month**: Contact Google Cloud sales for volume discounts

  

**What counts as a "character":**

- Every letter, number, space, and punctuation mark

- Emojis count as 1-4 characters depending on encoding

- HTML tags and special characters are included

- Empty strings and whitespace still count

  

**Free Tier Details:**

- Available to all Google Cloud accounts

- Resets monthly (not annual)

- Applied automatically - no special configuration needed

- Covers approximately **10 new translation keys across 103 languages** per month

  

###  Cost Calculation Formula

  

```

Billable Characters = Total Characters - 500,000 (free tier)

Total Cost = (Billable Characters / 1,000,000) × $20

```

  

**Example Calculations:**

  

1.  **Initial Full Translation (745 keys → 103 languages)**

```

Keys: 745

Avg characters per key: ~70

Characters per language: 745 × 70 = 52,150

Total characters: 52,150 × 103 = 5,371,450

  

Minus free tier: 5,371,450 - 500,000 = 4,871,450

Cost: 4,871,450 / 1,000,000 × $20 = $97.43

  

First month cost: $97.43

Subsequent months: $0 (no changes)

```

  

2.  **Adding 10 New Keys (→ 103 languages)**

```

New keys: 10

Avg characters per key: ~70

Characters per language: 10 × 70 = 700

Total characters: 700 × 103 = 72,100

  

Within free tier: 72,100 < 500,000

Cost: $0 (FREE!)

  

You can add ~114 keys/month for free (114 × 70 × 103 ≈ 490K chars)

```

  

3.  **Adding 50 New Keys in One Month (→ 103 languages)**

```

New keys: 50

Avg characters per key: ~70

Total characters: 50 × 70 × 103 = 360,500

  

Within free tier: 360,500 < 500,000

Cost: $0 (FREE!)

```

  

4.  **Adding 1 New Language (745 keys)**

```

Keys to translate: 745

Avg characters per key: ~70

Total characters: 745 × 70 = 52,150

  

Within free tier: 52,150 < 500,000

Cost: $0 (FREE!)

  

You can add ~9 new languages per month within free tier

```

  

5.  **Large Update: 200 New Keys (→ 103 languages)**

```

New keys: 200

Avg characters per key: ~70

Total characters: 200 × 70 × 103 = 1,442,000

  

Minus free tier: 1,442,000 - 500,000 = 942,000

Cost: 942,000 / 1,000,000 × $20 = $18.84

```

  

###  Monitoring Your Usage

  

**View usage in Google Cloud Console:**

  

1. Go to [Google Cloud Console](https://console.cloud.google.com/)

2. Select your project

3. Navigate to **APIs & Services → Dashboard**

4. Click on **Cloud Translation API**

5. View **Metrics** tab for character count and costs

  

**Check the script output:**

  

After each translation run, the script displays:

```

📊 Statistics:

• Total characters translated: 1,245,678

```

  

Use this to estimate: `1,245,678 / 1,000,000 × $20 = $24.91`


  

###  Setting Up Billing Alerts

  

1. Go to [Google Cloud Console → Billing](https://console.cloud.google.com/billing)

2. Select your billing account

3. Click **Budgets & alerts**

4. Create budget with threshold alerts (e.g., at 50%, 90%, 100%)

5. Add email notifications



  

##  How It Works

  

###  Translation Process

  

1.  **Source File**: All English translations are stored in `translation/en.json`

2.  **Script Execution**: The `translate.js` script reads the source file

3.  **Smart Detection**: For each language, it detects which keys are missing

4.  **API Translation**: Missing keys are translated using Google Cloud Translation API

5.  **Output**: Translated files are saved in `translation/output/` directory

  

###  Key Features

  

-  **Incremental Updates**: Only translates new or missing keys

-  **Batch Processing**: Processes languages in batches of 5 to avoid rate limits

-  **Automatic Retries**: Retries failed translations up to 3 times with exponential backoff

-  **Progress Tracking**: Real-time progress indicators and detailed statistics

-  **Error Handling**: Gracefully handles errors and reports them in the summary

  

---

  

##  Directory Structure

  

```

translation/

├── en.json # Source translation file (English)

├── languages.js # List of all supported language codes

├── translate.js # Translation script

└── output/ # Generated translation files

├── en.json

├── es.json

├── fr.json

├── de.json

└── ... (103+ languages)

```

  

---

  

##  Adding New Translations

  

###  Step 1: Edit `translation/en.json`

  

Add your new translation keys to the source file. The file supports nested objects:

  

```json

{

"welcome_back":  "Welcome Back!",

"profile":  "Profile",

"_new_feature_section":  "New Feature Section",

"new_feature_title":  "Amazing New Feature",

"new_feature_description":  "This is a new feature we just added",

"nested_example":  {

"level_1":  "First Level",

"level_2":  {

"deep_key":  "Deeply nested translation"

}

}

}

```

  

**Best Practices:**

- Use descriptive keys in `snake_case`

- Group related translations together

- Use section comments (keys starting with `_`) to organize translations

- Keep values clear and concise

- Support placeholders like `{0}`, `{1}` for dynamic values

  

###  Step 2: Run the Translation Script

  

```bash

npm run  translate

```

  

The script will:

1. Detect the new keys you added

2. Translate them into all 103+ supported languages

3. Merge them into existing language files

4. Display progress and statistics

  

###  Step 3: Verify Output

  

Check the `translation/output/` directory to verify your translations were generated correctly.


---

  

##  API Usage

  

###  Fetching Translations

  

The translations are served via a REST API endpoint:

  

**Endpoint**: `GET /api/v1/app-settings/locales/:lang`

  

**Examples:**

  

```bash

# Get English translations

GET /api/v1/app-settings/locales/en.json

  

# Get Spanish translations

GET /api/v1/app-settings/locales/es.json

  

# Get French translations

GET /api/v1/app-settings/locales/fr.json

  

# Get Japanese translations

GET /api/v1/app-settings/locales/ja.json

```

  

##  Environment Configuration

  

###  Required Environment Variable

  

The translation script requires a Google Cloud Translation API key:

  

```bash

GOOGLE_TRANSLATE_API_KEY=your_api_key_here

```

  

Add this to your `.env` file in the project root.

  

###  Getting an API Key

  

1. Go to [Google Cloud Console](https://console.cloud.google.com/)

2. Create a new project or select an existing one

3. Enable the "Cloud Translation API"

4. Create credentials (API Key)

5. Copy the API key to your `.env` file

  

---


##  Additional Resources

-  [Google Cloud Translation API Documentation](https://cloud.google.com/translate/docs)

-  [Supported Languages](https://cloud.google.com/translate/docs/languages)

-  [API Pricing](https://cloud.google.com/translate/pricing)
---

