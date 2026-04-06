import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';

const mapStyle = { width: '100%', height: '100%', borderRadius: 16 };

const TRANSPORT = [
  { id: 'DRIVING', icon: '🚗', label: 'Drive' },
  { id: 'WALKING', icon: '🚶', label: 'Walk' },
  { id: 'TRANSIT', icon: '🚌', label: 'Transit' },
  { id: 'BICYCLING', icon: '🚲', label: 'Bike' },
];

const CATS = [
  { keyword: '', label: 'All', icon: '🌐' },
  { keyword: 'cafe', type: 'cafe', label: 'Coffee', icon: '☕' },
  { keyword: 'restaurant', type: 'restaurant', label: 'Food', icon: '🍽️' },
  { keyword: 'shopping', type: 'shopping_mall', label: 'Shopping', icon: '🛍️' },
  { keyword: 'entertainment', type: 'movie_theater', label: 'Fun', icon: '🎬' },
  { keyword: 'park', type: 'park', label: 'Parks', icon: '🌳' },
  { keyword: 'bar', type: 'bar', label: 'Bars', icon: '🍸' },
];

function emojiFor(types) {
  const t = (types || [])[0] || '';
  const m = { restaurant: '🍽️', cafe: '☕', bar: '🍸', store: '🛍️', shopping_mall: '🛍️', movie_theater: '🎬', park: '🌳', gym: '💪', bakery: '🥐', museum: '🏛️' };
  return m[t] || '📍';
}

export default function MapExplorer({
  isLoaded, coords, midpoint, peopleLabels, itinerary,
  onAddToItinerary, onRemoveFromItinerary,
}) {
  const [spots, setSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [activeCats, setActiveCats] = useState([]);
  const [topRated, setTopRated] = useState(false);
  const [customSearch, setCustomSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [spotDirs, setSpotDirs] = useState(null);
  const [transport, setTransport] = useState('DRIVING');
  const [exploreCenter, setExploreCenter] = useState(null);
  const [searchError, setSearchError] = useState('');
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const infoContentRef = useRef(null);

  const center = exploreCenter || midpoint;

  // Initialize map manually
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || !window.google || mapRef.current) return;
    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: midpoint || { lat: 37.5, lng: -122 },
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [{ featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] }],
    });
    mapRef.current = map;
    infoWindowRef.current = new window.google.maps.InfoWindow();
    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#D4622A', strokeOpacity: 0.8, strokeWeight: 5 }
    });
  }, [isLoaded, midpoint]);

  // Update people markers
  useEffect(() => {
    if (!mapRef.current || !isLoaded) return;
    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const pinColors = ['#D4622A', '#6B8F71', '#7B5EA7', '#3D8B4B', '#C0541F'];
    coords.forEach((c, i) => {
      const marker = new window.google.maps.Marker({
        position: c,
        map: mapRef.current,
        icon: { url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="14" fill="${pinColors[i % pinColors.length]}" stroke="white" stroke-width="3"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14" font-family="sans-serif">${(peopleLabels[i] || '?')[0]}</text></svg>`)}` },
        title: peopleLabels[i],
        zIndex: 100,
      });
      markersRef.current.push(marker);
    });

    if (midpoint && !exploreCenter) {
      const mp = new window.google.maps.Marker({
        position: midpoint,
        map: mapRef.current,
        label: { text: '🎯', fontSize: '24px' },
        title: 'Midpoint',
        zIndex: 99,
      });
      markersRef.current.push(mp);
    }
  }, [coords, midpoint, isLoaded, peopleLabels, exploreCenter]);

  // Search nearby (server-side proxy for New API)
  const searchNearby = useCallback(async () => {
    if (!center || !window.google) return;
    setLoading(true);
    setSearchError('');

    // Assemble keywords based on custom search and active categories
    let keywordsToSearch = [];
    if (appliedSearch.trim()) {
      keywordsToSearch.push(appliedSearch.trim());
    }

    if (activeCats.length > 0) {
      keywordsToSearch.push(...activeCats);
    } else if (!appliedSearch.trim()) {
      // Default to broad categories if nothing at all is selected
      keywordsToSearch = ['restaurant', 'cafe', 'bakery', 'bar', 'park', 'movie_theater'];
    }

    try {
      const promises = keywordsToSearch.map(kw => {
        const cat = CATS.find(c => c.keyword === kw) || { keyword: kw, type: kw };
        const params = { lat: center.lat, lng: center.lng, radius: 3000 };
        if (cat.type) params.type = cat.type;
        if (cat.keyword) params.keyword = cat.keyword;
        return api.nearbySpots(params).catch(() => ({ spots: [] }));
      });

      const results = await Promise.all(promises);
      let allSpots = [];
      const seen = new Set();

      results.forEach(res => {
        (res.spots || []).forEach(spot => {
          if (!seen.has(spot.google_place_id)) {
            seen.add(spot.google_place_id);
            allSpots.push(spot);
          }
        });
      });

      // Apply Over 4 Stars filter
      if (topRated) {
        allSpots = allSpots.filter(s => s.rating >= 4.0);
      }

      // Sort by distance (nearby first) for a better mix of results
      allSpots.sort((a, b) => {
        const d1 = Math.pow(a.lat - center.lat, 2) + Math.pow(a.lng - center.lng, 2);
        const d2 = Math.pow(b.lat - center.lat, 2) + Math.pow(b.lng - center.lng, 2);
        return d1 - d2;
      });

      if (allSpots.length > 0) {
        setSpots(allSpots);
      } else {
        setSpots([]);
        setSearchError('No spots found. Try adjusting your filters.');
      }
    } catch (err) {
      console.error('Places search status:', err);
      setSpots([]);
      setSearchError('Could not load places. Ensure "Places API (New)" is enabled in Google Cloud Console.');
    }
    setLoading(false);
  }, [center?.lat, center?.lng, activeCats, topRated, appliedSearch]);

  useEffect(() => { if (isLoaded && mapRef.current) searchNearby(); }, [searchNearby, isLoaded]);

  // Show spot markers
  useEffect(() => {
    // Remove previous spot markers (keep people markers at beginning)
    const peopleCount = coords.length + (midpoint && !exploreCenter ? 1 : 0);
    markersRef.current.slice(peopleCount).forEach(m => m.setMap(null));
    markersRef.current = markersRef.current.slice(0, peopleCount);

    if (!mapRef.current || !isLoaded) return;
    const inIt = (spot) => itinerary.some(s => s.google_place_id === spot.google_place_id);

    spots.forEach(s => {
      const marker = new window.google.maps.Marker({
        position: { lat: s.lat, lng: s.lng },
        map: mapRef.current,
        icon: { url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="${inIt(s) ? '#6B8F71' : '#2C2416'}" stroke="white" stroke-width="2"/><text x="14" y="19" text-anchor="middle" fill="white" font-size="12">${s.emoji}</text></svg>`)}` },
      });
      marker.addListener('click', () => {
        setSelectedSpot(s);
        mapRef.current.panTo({ lat: s.lat, lng: s.lng });
      });
      markersRef.current.push(marker);
    });
  }, [spots, isLoaded, itinerary, coords.length, midpoint, exploreCenter]);

  // Directions for selected spot
  const fetchDirs = useCallback(async (spot) => {
    if (!coords || coords.length === 0 || !spot) return;
    try {
      const directionsService = new window.google.maps.DirectionsService();
      
      // If we already have stops, everyone is traveling together from the LAST stop
      const isMultiStop = itinerary && itinerary.length > 0;
      const effectiveOrigins = isMultiStop 
        ? [{ lat: itinerary[itinerary.length - 1].lat, lng: itinerary[itinerary.length - 1].lng, label: "All Move Together" }]
        : coords.map((c, i) => ({ ...c, label: peopleLabels[i] }));

      const promises = effectiveOrigins.map(o =>
        api.getDirections({ origin: { lat: o.lat, lng: o.lng }, destination: { lat: spot.lat, lng: spot.lng }, mode: transport.toLowerCase() })
      );
      const results = await Promise.all(promises);
      setSpotDirs(results.map((r, i) => ({ label: effectiveOrigins[i].label, ...r })));

      // Render the route on map (from the first effective origin)
      if (results[0] && results[0].overview_polyline) {
        directionsService.route({
          origin: { lat: effectiveOrigins[0].lat, lng: effectiveOrigins[0].lng },
          destination: { lat: spot.lat, lng: spot.lng },
          travelMode: window.google.maps.TravelMode[transport]
        }, (result, status) => {
          if (status === 'OK') {
            directionsRendererRef.current.setDirections(result);
            const route = result.routes[0].legs[0];
            const midPoint = route.steps[Math.floor(route.steps.length / 2)].end_location;
            infoWindowRef.current.setContent(`<div style="padding: 4px 8px; font-family: 'DM Sans', sans-serif; font-weight: 600; color: #2C2416;">${route.duration.text}</div>`);
            infoWindowRef.current.setPosition(midPoint);
            infoWindowRef.current.open(mapRef.current);
          }
        });
      }
    } catch (err) { 
      console.error('Directions err:', err); 
      setSpotDirs(null);
      if (directionsRendererRef.current) directionsRendererRef.current.setDirections({routes: []});
      infoWindowRef.current.close();
    }
  }, [coords, transport, peopleLabels, itinerary]);

  useEffect(() => { if (selectedSpot) fetchDirs(selectedSpot); }, [selectedSpot, transport, fetchDirs]);

  // Render itinerary route overview
  useEffect(() => {
    if (!isLoaded || !mapRef.current || selectedSpot || itinerary.length === 0) {
      if (!selectedSpot && directionsRendererRef.current) {
        directionsRendererRef.current.setDirections({routes: []});
        infoWindowRef.current?.close();
      }
      return;
    }

    const directionsService = new window.google.maps.DirectionsService();
    const waypoints = itinerary.slice(0, -1).map(stop => ({
      location: { lat: stop.lat, lng: stop.lng },
      stopover: true
    }));
    
    directionsService.route({
      origin: coords[0],
      destination: { lat: itinerary[itinerary.length - 1].lat, lng: itinerary[itinerary.length - 1].lng },
      waypoints: waypoints,
      travelMode: window.google.maps.TravelMode[transport]
    }, (result, status) => {
      if (status === 'OK') {
        directionsRendererRef.current.setDirections(result);
      }
    });
  }, [itinerary, selectedSpot, coords, transport, isLoaded]);

  function handleAdd(spot) {
    const etaData = {
      transport_mode: transport,
      etas: spotDirs?.map(d => ({ label: d.label, text: d.duration?.text || '', seconds: d.duration?.value || 0 })) || [],
    };
    onAddToItinerary(spot, etaData);
    setSelectedSpot(null);
  }

  function handleExplore(spot) {
    setExploreCenter({ lat: spot.lat, lng: spot.lng });
    setSelectedSpot(null);
    mapRef.current?.panTo({ lat: spot.lat, lng: spot.lng });
    mapRef.current?.setZoom(15);
  }

  function handleBack() {
    setExploreCenter(null);
    if (midpoint) { mapRef.current?.panTo(midpoint); mapRef.current?.setZoom(13); }
  }

  if (!isLoaded) return <div className="map-loading">Loading map…</div>;

  const inIt = (spot) => itinerary.some(s => s.google_place_id === spot.google_place_id);
  const pinColors = ['#D4622A', '#6B8F71', '#7B5EA7', '#3D8B4B', '#C0541F'];

  return (
    <div className="map-explorer">
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input 
          type="text" 
          placeholder="Search boba, pizza, museum..." 
          className="loc-input" 
          style={{ background: 'white', borderRadius: 100, padding: '8px 14px', border: '1.5px solid #EDE5DA', flex: 1, fontSize: 13 }}
          value={customSearch}
          onChange={e => setCustomSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') setAppliedSearch(customSearch) }}
        />
        <button 
          className="map-cat-btn" 
          style={{ background: '#2C2416', color: 'white', borderColor: '#2C2416', margin: 0, padding: '8px 14px' }}
          onClick={() => setAppliedSearch(customSearch)}
        >
          🔍
        </button>
      </div>

      <div className="map-categories">
        {CATS.map(c => {
          const isActive = c.keyword === '' ? activeCats.length === 0 : activeCats.includes(c.keyword);
          return (
            <button key={c.keyword} className={`map-cat-btn ${isActive ? 'active' : ''}`}
              onClick={() => {
                if (c.keyword === '') setActiveCats([]);
                else setActiveCats(prev => prev.includes(c.keyword) ? prev.filter(k => k !== c.keyword) : [...prev, c.keyword]);
              }}>{c.icon} {c.label}</button>
          );
        })}
        <button className={`map-cat-btn ${topRated ? 'active' : ''}`}
          style={{ borderColor: topRated ? '#D4622A' : '#EDE5DA', color: topRated ? 'white' : '#6B5B4E', background: topRated ? '#D4622A' : 'white' }}
          onClick={() => setTopRated(!topRated)}>⭐ 4.0+</button>
      </div>

      {exploreCenter && <button className="explore-back-btn" onClick={handleBack}>← Back to Midpoint</button>}

      <div className="map-container">
        <div ref={mapContainerRef} style={mapStyle} />
      </div>

      <div className="map-spots-count">
        {loading ? 'Searching nearby places…' : searchError ? searchError : `${spots.length} spots found`}
      </div>

      {/* Selected spot detail */}
      {selectedSpot && (
        <div className="selected-spot-detail">
          <button className="detail-close" onClick={() => { 
            setSelectedSpot(null); 
            setSpotDirs(null); 
            if (directionsRendererRef.current) directionsRendererRef.current.setDirections({routes: []});
            infoWindowRef.current.close();
          }}>×</button>
          <div className="detail-header">
            <span className="detail-emoji">{selectedSpot.emoji}</span>
            <div>
              <div className="detail-name">{selectedSpot.name}</div>
              <div className="detail-meta">
                {selectedSpot.rating > 0 && <span>⭐ {selectedSpot.rating}</span>}
                {selectedSpot.price_level && <span>{selectedSpot.price_level}</span>}
                {selectedSpot.business_status && selectedSpot.business_status !== 'OPERATIONAL' ? (
                  <span style={{ color: '#C0392B', fontSize: 11, fontWeight: 700 }}>
                    🔴 {selectedSpot.business_status.replace('_', ' ')}
                  </span>
                ) : selectedSpot.open_now !== null && (
                  <span style={{ color: selectedSpot.open_now ? '#3D8B4B' : '#C0392B', fontSize: 11, fontWeight: 700 }}>
                    {selectedSpot.open_now ? '🟢 Open' : '🔴 Closed'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="detail-address">📍 {selectedSpot.address}</div>

          <div className="transport-picker" style={{ marginBottom: 8 }}>
            {TRANSPORT.map(m => (
              <button key={m.id} className={`transport-btn ${transport === m.id ? 'active' : ''}`}
                onClick={() => setTransport(m.id)}>{m.icon} {m.label}</button>
            ))}
          </div>

          {spotDirs && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {spotDirs.map((d, i) => (
                <div key={i} style={{ flex: 1, minWidth: 80, background: '#F8F3EE', borderRadius: 8, padding: '6px 10px' }}>
                  <div style={{ fontSize: 10, color: pinColors[i % pinColors.length], fontWeight: 600 }}>{d.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{d.duration?.text || '—'}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            {inIt(selectedSpot) ? (
              <button className="map-info-btn added" onClick={() => onRemoveFromItinerary(selectedSpot.google_place_id)}>× Remove from Plan</button>
            ) : (
              <button className="map-info-btn" onClick={() => handleAdd(selectedSpot)}>+ Add to Plan</button>
            )}
            <button className="map-info-btn explore" onClick={() => handleExplore(selectedSpot)}>🔍 Nearby</button>
          </div>
        </div>
      )}

      <div className="map-spots-list">
        {spots.map(spot => (
          <div key={spot.google_place_id}
            className={`spot-card ${inIt(spot) ? 'in-itinerary' : ''}`}
            onClick={() => { setSelectedSpot(spot); mapRef.current?.panTo({ lat: spot.lat, lng: spot.lng }); }}>
            <div className="spot-top">
              <div className="spot-emoji">{spot.emoji}</div>
              <div className="spot-info">
                <div className="spot-name">{spot.name}</div>
                <div className="spot-meta">
                  {spot.rating > 0 && <span className="spot-rating">⭐ {spot.rating}</span>}
                  {spot.price_level && <span className="spot-price">{spot.price_level}</span>}
                  {spot.business_status && spot.business_status !== 'OPERATIONAL' ? (
                    <span style={{ color: '#C0392B', fontSize: 11, fontWeight: 700 }}>
                      🔴 {spot.business_status.replace('_', ' ')}
                    </span>
                  ) : spot.open_now !== null && (
                    <span style={{ color: spot.open_now ? '#3D8B4B' : '#C0392B', fontSize: 11, fontWeight: 700 }}>
                      {spot.open_now ? '🟢 Open Now' : '🔴 Closed'}
                    </span>
                  )}
                </div>
                <div className="spot-address">📍 {spot.address}</div>
              </div>
            </div>
            {spot.photo_url && <div className="spot-photo"><img src={spot.photo_url} alt={spot.name} loading="lazy" /></div>}
            <button className={`add-btn ${inIt(spot) ? 'added' : ''}`}
              onClick={e => { 
                e.stopPropagation(); 
                if (inIt(spot)) { 
                  onRemoveFromItinerary(spot.google_place_id); 
                } else { 
                  setSelectedSpot(spot); 
                  handleAdd(spot); 
                } 
              }}>
              {inIt(spot) ? '× Remove from Plan' : '+ Add to Itinerary'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
