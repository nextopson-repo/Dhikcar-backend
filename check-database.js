import { AppDataSource } from './src/server.js';
import { Property } from './src/api/entity/Property.js';
import { Address } from './src/api/entity/Address.js';

async function checkDatabase() {
  try {
    console.log('🔍 Checking database...');
    
    // Initialize database connection
    await AppDataSource.initialize();
    
    const propertyRepo = AppDataSource.getRepository(Property);
    const addressRepo = AppDataSource.getRepository(Address);

    // Check total properties
    const totalProperties = await propertyRepo.count();
    console.log('📊 Total properties in database:', totalProperties);

    // Check active properties
    const activeProperties = await propertyRepo.count({ where: { isActive: true } });
    console.log('📊 Active properties:', activeProperties);

    // Check sold properties
    const soldProperties = await propertyRepo.count({ where: { isSold: true } });
    console.log('📊 Sold properties:', soldProperties);

    // Check rent properties
    const rentProperties = await propertyRepo.count({ where: { isSale: 'Rent' } });
    console.log('📊 Rent properties:', rentProperties);

    // Check sell properties
    const sellProperties = await propertyRepo.count({ where: { isSale: 'Sell' } });
    console.log('📊 Sell properties:', sellProperties);

    // Get sample properties with addresses
    const sampleProperties = await propertyRepo.find({
      relations: ['address'],
      take: 10
    });

    console.log('\n📋 Sample properties:');
    sampleProperties.forEach((property, index) => {
      console.log(`${index + 1}. Property ID: ${property.id}`);
      console.log(`   - Active: ${property.isActive}`);
      console.log(`   - Sold: ${property.isSold}`);
      console.log(`   - Sale Type: ${property.isSale}`);
      console.log(`   - Address: ${property.address ? JSON.stringify({
        city: property.address.city,
        state: property.address.state,
        locality: property.address.locality
      }) : 'No address'}`);
      console.log('');
    });

    // Check addresses specifically
    const totalAddresses = await addressRepo.count();
    console.log('📊 Total addresses in database:', totalAddresses);

    const sampleAddresses = await addressRepo.find({ take: 5 });
    console.log('\n📋 Sample addresses:');
    sampleAddresses.forEach((address, index) => {
      console.log(`${index + 1}. Address ID: ${address.id}`);
      console.log(`   - City: ${address.city}`);
      console.log(`   - State: ${address.state}`);
      console.log(`   - Locality: ${address.locality}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

checkDatabase();
