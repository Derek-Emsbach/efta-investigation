import 'dotenv/config';
import { getSupabase } from '../src/supabase.js';

const locations = [
  { name: '9 E. 71st St Townhouse', location_type: 'epstein_property', address: '9 East 71st Street', city: 'New York', state: 'NY', country: 'US', latitude: 40.7711, longitude: -73.9644, description: 'Manhattan townhouse. Primary NYC residence. Gifted by Wexner.' },
  { name: '358 El Brillo Way', location_type: 'epstein_property', address: '358 El Brillo Way', city: 'Palm Beach', state: 'FL', country: 'US', latitude: 26.7066, longitude: -80.0356, description: 'Palm Beach mansion. Primary abuse location per FBI investigation.' },
  { name: 'Little St. James Island', location_type: 'epstein_property', city: 'St. Thomas', country: 'USVI', latitude: 18.3000, longitude: -64.8253, description: 'Private island. Known as "Pedophile Island." Extensive compound.' },
  { name: 'Great St. James Island', location_type: 'epstein_property', city: 'St. Thomas', country: 'USVI', latitude: 18.3117, longitude: -64.8350, description: 'Second private island. Purchased 2016. Construction without permits.' },
  { name: 'Zorro Ranch', location_type: 'epstein_property', address: 'Stanley', city: 'Stanley', state: 'NM', country: 'US', latitude: 35.1500, longitude: -105.9500, description: '8,000-acre NM ranch. Multiple victims reported abuse here.' },
  { name: '301 E. 66th St Apartments', location_type: 'epstein_property', address: '301 East 66th Street', city: 'New York', state: 'NY', country: 'US', latitude: 40.7646, longitude: -73.9589, description: 'Mark Epstein\'s building. Used to house young women.' },
  { name: 'Avenue Foch Apartment', location_type: 'epstein_property', city: 'Paris', country: 'France', latitude: 48.8716, longitude: 2.2833, description: 'Paris apartment. Caroline Lang / Prytanee LLC connection.' },
  { name: 'London Residence', location_type: 'epstein_property', city: 'London', country: 'UK', description: 'UK property. Location details vary across sources.' },
  { name: 'Teterboro Airport', location_type: 'airport', city: 'Teterboro', state: 'NJ', country: 'US', latitude: 40.8501, longitude: -74.0608, description: 'Primary private aviation hub for NY departures.' },
  { name: 'Palm Beach International Airport', location_type: 'airport', city: 'West Palm Beach', state: 'FL', country: 'US', latitude: 26.6832, longitude: -80.0956, description: 'Florida aviation hub.' },
  { name: 'Cyril E. King Airport (STT)', location_type: 'airport', city: 'St. Thomas', country: 'USVI', latitude: 18.3373, longitude: -64.9734, description: 'USVI airport. Transfer point to Little St. James by helicopter/boat.' },
  { name: 'Les Wexner Estate', location_type: 'associated_property', city: 'New Albany', state: 'OH', country: 'US', latitude: 40.0812, longitude: -82.7990, description: 'Wexner property. Maria Farmer alleges 1996 assault here.' },
  { name: 'Mar-a-Lago', location_type: 'associated_property', address: '1100 S Ocean Blvd', city: 'Palm Beach', state: 'FL', country: 'US', latitude: 26.6773, longitude: -80.0369, description: 'Trump property. Documented recruitment site per victim testimony.' },
  { name: 'Interlochen Center for the Arts', location_type: 'recruitment_site', city: 'Interlochen', state: 'MI', country: 'US', latitude: 44.6339, longitude: -85.7631, description: 'Performing arts camp. Multiple victims recruited from here.' },
  { name: 'Metropolitan Correctional Center', location_type: 'government_facility', address: '150 Park Row', city: 'New York', state: 'NY', country: 'US', latitude: 40.7127, longitude: -74.0010, description: 'Federal jail where Epstein died August 10, 2019.' },
];

async function main() {
  const sb = getSupabase();

  // Use upsert on name to allow re-running safely
  const { data, error } = await sb.from('locations')
    .upsert(locations, { onConflict: 'name', ignoreDuplicates: true })
    .select('id, name, location_type');

  if (error) {
    // If upsert fails (no unique constraint on name), fall back to insert
    console.warn('Upsert failed, trying insert:', error.message);
    const { data: insertData, error: insertError } = await sb.from('locations')
      .insert(locations)
      .select('id, name, location_type');
    if (insertError) {
      console.error('Error seeding locations:', insertError.message);
      process.exit(1);
    }
    console.log(`Seeded ${insertData?.length ?? 0} locations`);
    return;
  }

  console.log(`Seeded ${data?.length ?? 0} locations`);
  for (const l of (data ?? [])) {
    console.log(`  - ${l.name} (${l.location_type})`);
  }
}

main();
