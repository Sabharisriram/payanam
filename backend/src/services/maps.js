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

// Find nearby places using Overpass API
async function findNearbyPlaces(lat, lng, placeType) {
  try {
    const amenityMap = {
      'restaurant': 'restaurant',
      'tea stall': 'cafe',
      'hotel': 'hotel',
      'fuel': 'fuel',
      'cafe': 'cafe',
      'dhaba': 'restaurant',
      'viewpoint': 'viewpoint',
      'meal': 'restaurant',
      'default': 'restaurant'
    };

    const amenity = amenityMap[placeType.toLowerCase()] || amenityMap['default'];

    // Create a bounding box ~3km around the point
    const delta = 0.03;
    const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;

    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: amenity,
        format: 'json',
        limit: 5,
        viewbox: viewbox,
        bounded: 1,
        addressdetails: 1
      },
      headers: {
        'User-Agent': 'Payanam/1.0 (travel planning app; contact@payanam.app)'
      }
    });

    const places = response.data.map(place => ({
      name: place.display_name.split(',')[0],
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      amenity: amenity,
      cuisine: null,
      opening_hours: null,
      our_score: calculateScore({}),
      price_category: guessPriceCategory({}, placeType)
    }));

    return places;

  } catch (err) {
    console.error('Places search error:', err.message);
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