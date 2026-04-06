import { useState, useEffect, useRef, useCallback } from 'react';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
let loadPromise = null;

// Load the Google Maps script once
export function loadGoogleMaps() {
  if (loadPromise) return loadPromise;
  if (window.google?.maps) return Promise.resolve();

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,marker&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps script failed to load'));
    document.head.appendChild(script);
  });
  return loadPromise;
}

// Hook: returns isLoaded boolean
export function useGoogleMaps() {
  const [isLoaded, setIsLoaded] = useState(!!window.google?.maps);
  useEffect(() => {
    if (isLoaded) return;
    loadGoogleMaps().then(() => setIsLoaded(true)).catch(console.error);
  }, [isLoaded]);
  return isLoaded;
}

// Autocomplete using Geocoding API (server-side) as a universal fallback
// This avoids ALL legacy Places Autocomplete issues since it uses our own backend
export function PlaceAutocompleteInput({ value, onChange, placeholder, className, style }) {
  const containerRef = useRef(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputVal, setInputVal] = useState(value || '');
  const debounceRef = useRef(null);

  useEffect(() => { setInputVal(value || ''); }, [value]);

  const fetchSuggestions = useCallback(async (query) => {
    if (!query || query.length < 2) { setSuggestions([]); return; }
    try {
      // Use our server-side geocoding endpoint to get suggestions
      const resp = await fetch(`/api/spots/autocomplete?input=${encodeURIComponent(query)}`);
      if (resp.ok) {
        const data = await resp.json();
        setSuggestions(data.predictions || []);
        setShowDropdown(true);
      }
    } catch (err) {
      console.error('Autocomplete fetch error:', err);
      setSuggestions([]);
    }
  }, []);

  function handleInput(e) {
    const v = e.target.value;
    setInputVal(v);
    onChange(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 300);
  }

  function selectSuggestion(s) {
    setInputVal(s.description);
    onChange(s.description);
    setSuggestions([]);
    setShowDropdown(false);
  }

  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setShowDropdown(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <input
        className={className}
        style={style}
        value={inputVal}
        onChange={handleInput}
        onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {showDropdown && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map(s => (
            <div key={s.place_id} className="autocomplete-item" onClick={() => selectSuggestion(s)}>
              <div className="autocomplete-main">{s.main_text}</div>
              <div className="autocomplete-secondary">{s.secondary_text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
