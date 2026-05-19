const axios = require('axios');

// Convert location name to coordinates using Nominatim
async function geocodeLocation(locationName) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: locationName + ', Tamil Nadu, India',
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

// Find nearby places using Overpass API
async function findNearbyPlaces(lat, lng, placeType) {
  try {
    // Map our place types to OSM amenity tags
    const amenityMap = {
      'restaurant': 'restaurant',
      'tea stall': 'cafe',
      'hotel': 'hotel',
      'fuel': 'fuel',
      'cafe': 'cafe',
      'dhaba': 'restaurant',
      'viewpoint': 'viewpoint',
      'default': 'restaurant'
    };

    const amenity = amenityMap[placeType] || amenityMap['default'];
    const radius = 2000; // 2km radius

    const query = `
      [out:json][timeout:25];
      node["amenity"="${amenity}"](around:${radius},${lat},${lng});
      out body 5;
    `;

    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      query,
      { headers: { 'Content-Type': 'text/plain' } }
    );

    const places = response.data.elements.map(place => ({
      name: place.tags.name || 'Unknown',
      lat: place.lat,
      lng: place.lon,
      amenity: place.tags.amenity,
      cuisine: place.tags.cuisine || null,
      opening_hours: place.tags.opening_hours || null,
      google_place_id: null,
      our_score: calculateScore(place.tags),
      price_category: guessPriceCategory(place.tags, placeType)
    }));

    return places.filter(p => p.name !== 'Unknown');

  } catch (err) {
    console.error('Overpass error:', err.message);
    return [];
  }
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

module.exports = { geocodeLocation, findNearbyPlaces };