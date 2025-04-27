const User = require('../model/user'); // Ensure this is the correct path to your User model
const Ambulance = require('../model/ambulance'); // Assuming you have an Ambulance model
const axios = require('axios'); // For making HTTP requests

// Function to get latitude and longitude from an address using Google Maps API
module.exports.getCoordinatesFromAddress = async (req, res) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).send('Address is required');
    }

    // Use Google Maps Geocoding API to get coordinates
    const apiKey = process.env.GOOGLE_MAPS_API_KEY; // Ensure your API key is stored in an environment variable
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const response = await axios.get(geocodeUrl);

    if (response.data.status !== 'OK') {
      console.error('Error from Google Maps API:', response.data);
      return res.status(400).send('Unable to fetch coordinates for the provided address');
    }

    const location = response.data.results[0].geometry.location;
    const coordinates = {
      latitude: location.lat,
      longitude: location.lng,
    };

    console.log('Coordinates from Google Maps API:', coordinates);

    // Save the coordinates to the user's location
    const userId = req.user._id; // Assuming the user is authenticated
    await User.findByIdAndUpdate(userId, {
      location: {
        type: 'Point',
        coordinates: [coordinates.longitude, coordinates.latitude], // GeoJSON format: [longitude, latitude]
      },
    });

    res.status(200).send({ message: 'Coordinates fetched successfully', coordinates });
  } catch (error) {
    console.error('Error fetching coordinates from Google Maps API:', error);
    res.status(500).send('Failed to fetch coordinates');
  }
};

// Function to fetch the nearest ambulance driver based on user location
// Function to find the nearest ambulance driver
exports.getNearestAmbulanceDriver = async (req, res) => {
  const { lat = 21.25, lng = 78.27 } = req.query; // Fallback to Amravati

  try {
    const ambulances = await Ambulance.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: 10000, // 10km radius
        },
      },
      isAvailable: true,
    });

    res.render('user/ambulance-list', { ambulances });
  } catch (err) {
    console.error('GeoQuery error:', err);
    res.status(500).send('Something went wrong.');
  }
};