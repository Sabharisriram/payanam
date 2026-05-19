// Score and rank places for a specific trip type
function rankPlacesForTripType(places, tripType, stopType) {
  return places.map(place => {
    let score = parseFloat(place.our_score) || 3.0;

    // Boost score based on trip type and stop type
    if (tripType === 'family') {
      if (place.price_category === 'average') score += 0.5;
      if (place.price_category === 'luxury') score += 0.3;
      if (stopType === 'breakfast' && place.amenity === 'restaurant') score += 0.4;
    }

    if (tripType === 'boys' || tripType === 'bachelor') {
      if (place.price_category === 'budget') score += 0.5;
      if (place.cuisine === 'indian') score += 0.3;
      if (stopType === 'tea' && place.amenity === 'cafe') score += 0.4;
    }

    if (tripType === 'solo') {
      if (place.price_category === 'budget') score += 0.4;
      if (place.price_category === 'average') score += 0.3;
    }

    if (tripType === 'friends') {
      if (place.price_category === 'average') score += 0.4;
      if (place.cuisine) score += 0.2;
    }

    return { ...place, final_score: Math.min(score, 5.0).toFixed(1) };
  }).sort((a, b) => b.final_score - a.final_score);
}

module.exports = { rankPlacesForTripType };