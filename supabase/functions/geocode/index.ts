import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { query, lat, lon } = body

    let nominatimUrl: URL;

    if (lat !== undefined && lon !== undefined) {
      // Reverse Geocoding
      nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse')
      nominatimUrl.searchParams.set('lat', lat.toString())
      nominatimUrl.searchParams.set('lon', lon.toString())
      nominatimUrl.searchParams.set('format', 'json')
      nominatimUrl.searchParams.set('addressdetails', '1')
    } else if (query && typeof query === 'string') {
      // Forward Geocoding
      nominatimUrl = new URL('https://nominatim.openstreetmap.org/search')
      nominatimUrl.searchParams.set('q', query.trim())
      nominatimUrl.searchParams.set('format', 'json')
      nominatimUrl.searchParams.set('addressdetails', '1')
      nominatimUrl.searchParams.set('limit', '5')
    } else {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid parameters (need query or lat/lon)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Call Nominatim API
    // Ensure we send a proper User-Agent as per Nominatim usage policy
    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'PoolNear/1.0 (contact@poolnear.app)',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    })

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    let results = []
    
    function formatLocation(item: any) {
      // Make it readable: 
      // Main text: name, amenity, building, or road
      // Sub text: suburb, city, state
      const addr = item.address || {};
      const main = addr.amenity || addr.building || addr.shop || addr.office || addr.leisure || addr.tourism || addr.historic || addr.aeroway || item.name || addr.road || addr.suburb || addr.village || addr.city;
      
      const parts = [
        addr.road,
        addr.neighbourhood,
        addr.suburb,
        addr.city || addr.town || addr.village,
        addr.state
      ].filter(p => p && p !== main);

      // Deduplicate parts
      const uniqueParts = [...new Set(parts)];
      const sub = uniqueParts.join(', ');

      return {
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
        display_name: main ? (sub ? `${main}\n${sub}` : main) : item.display_name,
        raw_name: item.display_name
      };
    }

    if (lat !== undefined && lon !== undefined) {
      // Reverse geocoding returns a single object or error if not found
      if (data && !data.error && data.display_name) {
        results = [formatLocation(data)];
      }
    } else {
      // Forward geocoding returns an array
      if (Array.isArray(data)) {
        results = data.map(formatLocation);
        
        // Deduplicate exact same display names
        const seen = new Set();
        results = results.filter(r => {
          if (seen.has(r.display_name)) return false;
          seen.add(r.display_name);
          return true;
        });
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
