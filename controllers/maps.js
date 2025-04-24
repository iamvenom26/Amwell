const Ambulance = require('../model/ambulance');
const mapService = require('../service/maps');

module.exports.showNearbyAmbulances = async (req, res) => {
  try {
    const userLocation = req.user.location; // Assuming user location is stored in the user object

    if (!userLocation) {
      return res.status(400).send('User location not found');
    }

    // Find ambulances within a 10km radius
    const nearbyAmbulances = await Ambulance.find({
      location: {
        $geoWithin: {
          $centerSphere: [[userLocation.coordinates[0], userLocation.coordinates[1]], 10 / 6371], // 10km radius
        },
      },
      isAvailable: true,
    }).lean();

    res.render('maps/nearbyAmbulances', { ambulances: nearbyAmbulances, userLocation });
  } catch (err) {
    console.error('Error fetching nearby ambulances:', err);
    res.status(500).send('Server error');
  }
};