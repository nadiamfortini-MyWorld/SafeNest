require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── SchoolDigger API (via RapidAPI) ──

app.get('/api/schools', async (req, res) => {
  const { city, state = 'WA', zip, perPage = 10 } = req.query;

  if (!city && !zip) {
    return res.status(400).json({ error: 'city or zip is required' });
  }

  try {
    const params = new URLSearchParams({
      st: state,
      perPage: perPage.toString(),
      sortBy: 'rank',
    });

    if (zip) params.append('zip', zip);
    else if (city) params.append('city', city);

    const url = `https://schooldigger-k-12-school-data-api.p.rapidapi.com/v2.0/schools?${params}`;

    const response = await fetch(url, {
      headers: {
        'x-rapidapi-key': process.env.RAPIDAPI_KEY,
        'x-rapidapi-host': 'schooldigger-k-12-school-data-api.p.rapidapi.com',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('SchoolDigger API error:', response.status, text);
      return res.status(response.status).json({ error: 'SchoolDigger API error', detail: text });
    }

    const data = await response.json();

    const schools = (data.schoolList || []).map(s => ({
      name: s.schoolName,
      rating: s.rankHistory?.[0]?.rankStars ?? null,
      rankPercentile: s.rankHistory?.[0]?.rankStatewidePercentage ?? null,
      type: s.schoolLevel || 'Unknown',
      grades: `${s.lowGrade || '?'}–${s.highGrade || '?'}`,
      address: `${s.address?.city || ''}, ${s.address?.state || ''}`,
      zip: s.address?.zip,
      enrollment: s.numberOfStudents,
      district: s.district?.districtName,
      phone: s.phone,
      url: s.url,
    }));

    res.json({ schools, total: data.numberOfSchools || schools.length });
  } catch (err) {
    console.error('Schools fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch school data' });
  }
});

// ── FBI Crime Data API (free, no key needed) ──

app.get('/api/crime/state/:stateAbbr', async (req, res) => {
  const { stateAbbr } = req.params;
  const { year = 2022 } = req.query; // Latest available year

  try {
    const url = `https://api.usa.gov/crime/fbi/sapi/api/estimates/states/${stateAbbr}/${year}/${year}?API_KEY=iiHnOKfno2Mgkt5AynpvPpUQTEyxE77jo1RU8PIv`;

    const response = await fetch(url);

    if (!response.ok) {
      // Fallback: try the summary endpoint
      const fallbackUrl = `https://api.usa.gov/crime/fbi/sapi/api/summarized/state/${stateAbbr}/${year}/${year}?API_KEY=iiHnOKfno2Mgkt5AynpvPpUQTEyxE77jo1RU8PIv`;
      const fallbackResp = await fetch(fallbackUrl);

      if (!fallbackResp.ok) {
        return res.status(fallbackResp.status).json({ error: 'FBI Crime API error' });
      }

      const data = await fallbackResp.json();
      return res.json(normalizeCrimeData(data));
    }

    const data = await response.json();
    res.json(normalizeCrimeData(data));
  } catch (err) {
    console.error('Crime data fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch crime data' });
  }
});

// Crime data for a specific agency/ORI code
app.get('/api/crime/agency/:ori', async (req, res) => {
  const { ori } = req.params;
  const { year = 2022 } = req.query;

  try {
    const url = `https://api.usa.gov/crime/fbi/sapi/api/summarized/agencies/${ori}/offenses/${year}/${year}?API_KEY=iiHnOKfno2Mgkt5AynpvPpUQTEyxE77jo1RU8PIv`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'FBI Crime API error' });
    }

    const data = await response.json();
    res.json(normalizeCrimeData(data));
  } catch (err) {
    console.error('Crime agency fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch crime data' });
  }
});

function normalizeCrimeData(raw) {
  if (!raw || (!raw.results && !raw.data)) return { crime: null };

  const records = raw.results || raw.data || [];
  if (!records.length) return { crime: null };

  const latest = records[records.length - 1];

  return {
    crime: {
      year: latest.year,
      population: latest.population,
      violent: {
        total: latest.violent_crime ?? latest.aggravated_assault + latest.robbery + (latest.rape_revised || latest.rape_legacy || 0) + (latest.homicide || 0),
        assault: latest.aggravated_assault,
        robbery: latest.robbery,
        murder: latest.homicide,
      },
      property: {
        total: latest.property_crime ?? (latest.burglary || 0) + (latest.larceny || 0) + (latest.motor_vehicle_theft || 0),
        burglary: latest.burglary,
        larceny: latest.larceny,
        motorVehicleTheft: latest.motor_vehicle_theft,
      },
      arson: latest.arson,
    },
    raw: latest,
  };
}

// ── Health Check ──

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apis: {
      schoolDigger: !!process.env.RAPIDAPI_KEY,
      fbiCrime: true,
    },
  });
});

// ── SPA Fallback ──

app.get('*', (req, res) => {
  res.sendFile('index.html', { root: 'public' });
});

app.listen(PORT, () => {
  console.log(`\n🏡 SafeNest server running at http://localhost:${PORT}\n`);
  console.log('APIs connected:');
  console.log(`  📚 SchoolDigger: ${process.env.RAPIDAPI_KEY ? '✅ Key configured' : '❌ Missing RAPIDAPI_KEY'}`);
  console.log('  🔒 FBI Crime Data: ✅ Free (no key needed)');
  console.log('  🏠 Rental Listings: 📋 Mock data (plug in API later)\n');
});
