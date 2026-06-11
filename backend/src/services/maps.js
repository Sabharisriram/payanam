const axios = require('axios');

// Convert location name to coordinates using Nominatim
async function geocodeLocation(locationName) {
  try {
    // Extract just the key place name (last meaningful part)
    const cleaned = locationName
      .replace(/roadside stall|near|just after|on the way to|viewpoint on|local cafe or tea shop near/gi, '')
      .split(',')[0]
      .trim();

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: cleaned + ', Tamil Nadu, India',
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'Payanam Travel App (payanam@gmail.com)'
      }
    });

    if (response.data.length === 0) return null;

    return {
      lat: parseFloat(response.data[0].lat),
      lng: parseFloat(response.data[0].lon),
      display_name: response.data[0].display_name
    };
  } catch (err) {
    console.error('Geocode error:', err.message);
    return null;
  }
}

// Reverse-geocode lat/lng to a city/town name
async function reverseGeocodeCity(lat, lng) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { lat, lon: lng, format: 'json', zoom: 10 },
      headers: { 'User-Agent': 'Payanam/1.0 (travel planning; contact@payanam.app)' },
      timeout: 8000,
    });
    const addr = response.data?.address;
    return addr?.city || addr?.town || addr?.village || addr?.county || null;
  } catch (err) {
    console.error('[maps] reverseGeocodeCity error:', err.message);
    return null;
  }
}

// Find nearby places using Nominatim structured amenity search + fallback chain
async function findNearbyPlaces(lat, lng, placeType) {
  const amenityMap = {
    'restaurant': 'restaurant',
    'tea stall': 'cafe',
    'hotel': 'hotel',
    'fuel': 'fuel',
    'cafe': 'cafe',
    'dhaba': 'restaurant',
    'viewpoint': 'viewpoint',
    'meal': 'restaurant',
    'default': 'restaurant',
  };

  const primaryAmenity = amenityMap[placeType?.toLowerCase()] || 'restaurant';

  // 5km bounding box: 0.045° ≈ 5km at the equator
  const delta = 0.045;
  const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;

  console.log(`[maps] findNearbyPlaces lat=${lat.toFixed(4)} lng=${lng.toFixed(4)} placeType="${placeType}" → amenity="${primaryAmenity}" radius~5km viewbox=${viewbox}`);

  // Use Nominatim structured amenity= parameter (NOT q=) so it matches OSM amenity tags
  const searchByAmenity = async (amenity) => {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { amenity, format: 'json', limit: 5, viewbox, bounded: 1 },
        headers: { 'User-Agent': 'Payanam/1.0 (travel planning; contact@payanam.app)' },
        timeout: 8000,
      });
      return response.data.map(place => ({
        name: place.display_name.split(',')[0],
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        amenity,
        cuisine: null,
        opening_hours: null,
        our_score: calculateScore({}),
        price_category: guessPriceCategory({}, placeType),
      }));
    } catch (err) {
      console.error(`[maps] searchByAmenity(${amenity}) error:`, err.message);
      return [];
    }
  };

  // Attempt 1: primary amenity tag within 5km box
  let places = await searchByAmenity(primaryAmenity);
  console.log(`[maps] attempt 1 amenity="${primaryAmenity}": ${places.length} results`);

  // Attempt 2: food-stop fallbacks (cafe → fast_food → restaurant)
  if (places.length === 0 && ['restaurant', 'cafe'].includes(primaryAmenity)) {
    for (const fallback of ['cafe', 'fast_food', 'restaurant']) {
      if (fallback === primaryAmenity) continue;
      places = await searchByAmenity(fallback);
      console.log(`[maps] attempt 2 fallback amenity="${fallback}": ${places.length} results`);
      if (places.length > 0) break;
    }
  }

  // Attempt 3: reverse-geocode to city name, then text search "amenity cityName"
  if (places.length === 0) {
    const city = await reverseGeocodeCity(lat, lng);
    console.log(`[maps] attempt 3 reverse-geocode → city="${city}"`);
    if (city) {
      try {
        const response = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: `${primaryAmenity} ${city}`,
            format: 'json',
            limit: 5,
            countrycodes: 'in',
          },
          headers: { 'User-Agent': 'Payanam/1.0 (travel planning; contact@payanam.app)' },
          timeout: 8000,
        });
        places = response.data.map(place => ({
          name: place.display_name.split(',')[0],
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lon),
          amenity: primaryAmenity,
          cuisine: null,
          opening_hours: null,
          our_score: calculateScore({}),
          price_category: guessPriceCategory({}, placeType),
        }));
        console.log(`[maps] attempt 3 text search "${primaryAmenity} ${city}": ${places.length} results`);
      } catch (err) {
        console.error('[maps] attempt 3 text search error:', err.message);
      }
    }
  }

  return places;
}

// Score a place based on available OSM tags
function calculateScore(tags) {
  let score = 3.0; // base score

  if (tags.name) score += 0.5;
  if (tags.cuisine) score += 0.3;
  if (tags.opening_hours) score += 0.2;
  if (tags.phone) score += 0.2;
  if (tags.website) score += 0.3;
  if (tags['addr:street']) score += 0.2;

  return Math.min(score, 5.0).toFixed(1);
}

// Guess price category from OSM tags and place type
function guessPriceCategory(tags, placeType) {
  if (['tea stall', 'dhaba'].includes(placeType)) return 'budget';
  if (placeType === 'hotel') return 'average';
  if (tags.stars >= 4) return 'luxury';
  if (tags.stars >= 2) return 'average';
  return 'budget';
}

module.exports = { geocodeLocation, findNearbyPlaces, reverseGeocodeCity };