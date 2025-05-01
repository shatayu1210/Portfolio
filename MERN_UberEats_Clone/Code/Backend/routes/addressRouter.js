const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/countries', async (req, res) => {
  try {
    const response = await axios.get('https://countriesnow.space/api/v0.1/countries/positions');
    res.json(response.data.data.map(c => c.name));
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({ message: 'Failed to fetch countries', error: error.message });
  }
});

router.post('/states', async (req, res) => {
  try {
    const { country } = req.body;
    const response = await axios.post('https://countriesnow.space/api/v0.1/countries/states', { country });
    res.json(response.data.data.states.map(s => s.name));
  } catch (error) {
    console.error('Error fetching states:', error);
    res.status(500).json({ message: 'Failed to fetch states', error: error.message });
  }
});

router.post('/cities', async (req, res) => {
  try {
    const { country, state } = req.body;
    const response = await axios.post('https://countriesnow.space/api/v0.1/countries/state/cities', { country, state });
    res.json(response.data.data);
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ message: 'Failed to fetch cities', error: error.message });
  }
});

module.exports = router; 