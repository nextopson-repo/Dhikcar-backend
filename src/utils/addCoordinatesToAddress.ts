import axios from 'axios';

import { Address } from '@/api/entity/Address';
import { Property } from '@/api/entity/Car';
import { AppDataSource } from '@/server';

// Simple in-memory cache for geocoding results
const geocodingCache = new Map<string, { lat: number; lng: number; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Interface for geocoding response
interface GeocodingResponse {
  results: Array<{
    geometry: {
      location: {
        lat: number;
        lng: number;
      };
    };
    formatted_address: string;
  }>;
  status: string;
}

/**
 * Geocode locality name to get coordinates using Google Maps API with caching
 */
async function geocodeLocality(
  localityName: string,
  city?: string,
  state?: string
): Promise<{ lat: number; lng: number }> {
  try {
    // Build cache key
    const cacheKey = `${localityName.toLowerCase()}_${city?.toLowerCase() || ''}_${state?.toLowerCase() || ''}`;

    // Check cache first
    const cached = geocodingCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log('Using cached geocoding result for:', cacheKey);
      return { lat: cached.lat, lng: cached.lng };
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key not found in environment variables');
    }

    // Build the address string with context
    let addressString = localityName;
    if (city && city.trim()) {
      addressString += `, ${city.trim()}`;
    }
    if (state && state.trim()) {
      addressString += `, ${state.trim()}`;
    }

    console.log('Geocoding address:', addressString);

    const response = await axios.get<GeocodingResponse>(`https://maps.googleapis.com/maps/api/geocode/json`, {
      params: {
        address: addressString,
        key: apiKey,
      },
    });

    if (response.data.status !== 'OK') {
      throw new Error(`Geocoding failed: ${response.data.status}`);
    }

    if (response.data.results.length === 0) {
      throw new Error('No results found for the given locality');
    }

    const location = response.data.results[0].geometry.location;
    const result = {
      lat: location.lat,
      lng: location.lng,
    };

    // Cache the result
    geocodingCache.set(cacheKey, {
      ...result,
      timestamp: Date.now(),
    });

    console.log('Geocoding successful for:', addressString, result);
    return result;
  } catch (error) {
    console.error('Error in geocodeLocality:', error);
    throw error;
  }
}

/**
 * Add coordinate columns to Address table and update existing addresses
 */
export async function addCoordinatesToAddress() {
  try {
    console.log('Starting coordinate update process...');

    // Initialize database connection
    await AppDataSource.initialize();

    const addressRepo = AppDataSource.getRepository(Address);
    const propertyRepo = AppDataSource.getRepository(Property);

    // Get all addresses that don't have coordinates
    const addressesWithoutCoordinates = await addressRepo.find({
      where: [{ latitude: null }, { longitude: null }],
      relations: ['addressFor'],
    });

    console.log(`Found ${addressesWithoutCoordinates.length} addresses without coordinates`);

    let successCount = 0;
    let errorCount = 0;

    // Process addresses in batches to avoid overwhelming the API
    const batchSize = 10;
    for (let i = 0; i < addressesWithoutCoordinates.length; i += batchSize) {
      const batch = addressesWithoutCoordinates.slice(i, i + batchSize);

      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addressesWithoutCoordinates.length / batchSize)}`
      );

      await Promise.all(
        batch.map(async (address) => {
          try {
            if (!address.locality || !address.city || !address.state) {
              console.log(`Skipping address ${address.id} - missing required fields`);
              return;
            }

            const coordinates = await geocodeLocality(address.locality, address.city, address.state);

            await addressRepo.update(address.id, {
              latitude: coordinates.lat,
              longitude: coordinates.lng,
            });

            successCount++;
            console.log(`Updated coordinates for address ${address.id}:`, coordinates);

            // Add a small delay to avoid hitting API rate limits
            await new Promise((resolve) => setTimeout(resolve, 200));
          } catch (error) {
            errorCount++;
            console.error(`Failed to update coordinates for address ${address.id}:`, error);
          }
        })
      );

      // Add delay between batches
      if (i + batchSize < addressesWithoutCoordinates.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(`\nCoordinate update completed!`);
    console.log(`Successfully updated: ${successCount} addresses`);
    console.log(`Failed to update: ${errorCount} addresses`);
    console.log(`Total processed: ${addressesWithoutCoordinates.length} addresses`);
  } catch (error) {
    console.error('Error in addCoordinatesToAddress:', error);
  } finally {
    // Close database connection
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  addCoordinatesToAddress()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}
