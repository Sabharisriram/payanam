-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  preferred_trip_type TEXT DEFAULT 'solo',
  created_at TIMESTAMP DEFAULT NOW()
);

-- TRIPS
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  trip_name TEXT NOT NULL,
  start_location TEXT NOT NULL,
  start_lat FLOAT,
  start_lng FLOAT,
  end_location TEXT NOT NULL,
  end_lat FLOAT,
  end_lng FLOAT,
  start_date DATE NOT NULL,
  start_time TIME NOT NULL,
  trip_type TEXT NOT NULL,
  vehicle_type TEXT NOT NULL,
  member_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT NOW()
);

-- PLACES
CREATE TABLE places (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  google_place_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  lat FLOAT,
  lng FLOAT,
  place_type TEXT,
  our_score FLOAT DEFAULT 0,
  price_category TEXT DEFAULT 'average',
  total_reviews INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- TRIP STOPS
CREATE TABLE trip_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  place_id UUID REFERENCES places(id),
  stop_type TEXT NOT NULL,
  suggested_time TIME,
  actual_arrival_time TIME,
  sequence_order INTEGER,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- REVIEWS
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  place_id UUID REFERENCES places(id),
  trip_id UUID REFERENCES trips(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  cleanliness_rating INTEGER CHECK (cleanliness_rating BETWEEN 1 AND 5),
  food_quality INTEGER CHECK (food_quality BETWEEN 1 AND 5),
  comment TEXT,
  trip_type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- TRIP LOCATIONS
CREATE TABLE trip_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  recorded_at TIMESTAMP DEFAULT NOW()
);