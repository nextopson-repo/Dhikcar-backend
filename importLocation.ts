import fs from 'fs';
import csv from 'csv-parser';
import { AppDataSource } from './src/server';
import { Location } from './src/api/entity/Location';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BATCH_SIZE = 100; // Process 100 locations at a time

async function importCSV() {
  console.log('🚀 Starting CSV import process...');
  
  try {
    // Initialize database connection
    console.log('📡 Connecting to database...');
    await AppDataSource.initialize();
    console.log('✅ Database connected successfully');

    const locations: Location[] = [];
    const csvFilePath = path.join(__dirname, 'locations.csv');

    // Check if CSV file exists
    if (!fs.existsSync(csvFilePath)) {
      console.error(`❌ CSV file not found at: ${csvFilePath}`);
      console.log('📁 Please ensure locations.csv is in the same directory as this script');
      return;
    }

    console.log(`📂 Reading CSV file: ${csvFilePath}`);

    return new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            const location = new Location();
            location.state = row.state || '';
            location.city = row.city || '';
            location.locality = row.locality || '';
            // Handle empty stateUrl - use a default image or empty string
            location.stateImageUrl = row.stateUrl && row.stateUrl.trim() !== '' 
              ? row.stateUrl 
              : 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&h=600&fit=crop';
            location.cityImageUrl = row.cityUrl || '';
            location.isActive = row.city === 'Indore' || row.city === "Lucknow" 
            location.createdBy = 'system';
            location.updatedBy = 'system';

            locations.push(location);
            console.log(`📝 Processed: ${location.state} - ${location.city} - ${location.locality}`);
          } catch (error) {
            console.error('❌ Error processing row:', row, error);
          }
        })
        .on('end', async () => {
          try {
            console.log(`\n💾 Saving ${locations.length} locations to database in batches of ${BATCH_SIZE}...`);
            
            if (locations.length === 0) {
              console.log('⚠️  No locations to save. Please check your CSV file.');
              await AppDataSource.destroy();
              resolve();
              return;
            }

            // Use the repository to save in batches
            const locationRepository = AppDataSource.getRepository(Location);
            
            // Process in batches
            let savedCount = 0;
            for (let i = 0; i < locations.length; i += BATCH_SIZE) {
              const batch = locations.slice(i, i + BATCH_SIZE);
              console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(locations.length / BATCH_SIZE)} (${batch.length} locations)...`);
              
              try {
                await locationRepository.save(batch);
                savedCount += batch.length;
                console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} saved successfully (${savedCount}/${locations.length} total)`);
              } catch (error) {
                console.error(`❌ Error saving batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
                // Continue with next batch instead of failing completely
              }
            }
            
            console.log(`✅ Successfully imported ${savedCount} locations!`);
            
            // Show summary
            const stateCount = new Map();
            locations.forEach(loc => {
              stateCount.set(loc.state, (stateCount.get(loc.state) || 0) + 1);
            });
            
            console.log('\n📊 Import Summary:');
            stateCount.forEach((count, state) => {
              console.log(`   ${state}: ${count} locations`);
            });
            
          } catch (error) {
            console.error('❌ Error saving to database:', error);
            reject(error);
          } finally {
            try {
              await AppDataSource.destroy();
              console.log('🔌 Database connection closed');
            } catch (error) {
              console.error('❌ Error closing database connection:', error);
            }
            resolve();
          }
        })
        .on('error', (error) => {
          console.error('❌ Error reading CSV file:', error);
          reject(error);
        });
    });

  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    try {
      await AppDataSource.destroy();
    } catch (closeError) {
      console.error('❌ Error closing database connection:', closeError);
    }
  }
}

// Run the import
console.log('🎯 Location CSV Import Tool');
console.log('============================\n');

importCSV()
  .then(() => {
    console.log('\n🎉 Import process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Import process failed:', error);
    process.exit(1);
  });
