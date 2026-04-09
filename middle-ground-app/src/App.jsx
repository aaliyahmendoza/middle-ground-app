import { useState, useEffect, useRef } from "react";
import { useGoogleMaps, PlaceAutocompleteInput } from "./hooks/useGoogleMaps";
import { useAuth } from "./context/AuthContext";
import { api } from "./api";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import VerifyPhonePage from "./pages/VerifyPhonePage";
import MapExplorer from "./components/MapExplorer";
import Cropper from "react-easy-crop";
import imageCompression from "browser-image-compression";

async function getCroppedImg(imageSrc, pixelCrop) {
  const image = new Image();
  image.src = imageSrc;
  await new Promise(r => image.onload = r);
  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return canvas.toDataURL('image/jpeg', 0.95);
}

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');`;

const TRANSPORT_MODES = [
  { id: "DRIVING", icon: "🚗", label: "Drive" },
  { id: "WALKING", icon: "🚶", label: "Walk" },
  { id: "TRANSIT", icon: "🚌", label: "Transit" },
  { id: "BICYCLING", icon: "🚲", label: "Bike" },
];

function MiniMap({ lat, lng, emoji, color = "#bb4b1e" }) {
  const mapRef = useRef(null);

  useEffect(() => {
    if (!window.google?.maps || !mapRef.current) return;
    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat, lng },
      zoom: 14,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      scaleControl: true,
    });

    new window.google.maps.Marker({
      position: { lat, lng },
      map: map,
      icon: { url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><circle cx="14" cy="14" r="12" fill="${color}" stroke="white" stroke-width="2"/><text x="14" y="19" text-anchor="middle" fill="white" font-size="12">${emoji}</text></svg>`)}` }
    });
  }, [lat, lng, emoji, color]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}

function DirectionsMap({ origin, destination, mode, onRoutesFound, selectedRouteIndex }) {
  const mapRef = useRef(null);
  const rendererRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const resultRef = useRef(null);

  const originKey = origin ? `${origin.lat},${origin.lng}` : '';
  const destKey = destination ? `${destination.lat},${destination.lng}` : '';

  // 1. Initial Map and Renderer Creation (Only once)
  useEffect(() => {
    if (!window.google?.maps || !mapRef.current || mapInstanceRef.current) return;
    
    const map = new window.google.maps.Map(mapRef.current, {
      center: origin || { lat: 37.5, lng: -122 },
      zoom: 12,
      disableDefaultUI: true,
      zoomControl: true,
    });
    mapInstanceRef.current = map;

    const renderer = new window.google.maps.DirectionsRenderer({
      map,
      hideRouteList: true,
      polylineOptions: { strokeColor: '#D4622A', strokeOpacity: 0.8, strokeWeight: 5 }
    });
    rendererRef.current = renderer;
  }, []);

  // 2. Route Calculation (Only when origin/dest/mode changes)
  useEffect(() => {
    if (!mapInstanceRef.current || !rendererRef.current || !origin || !destination) return;
    
    const panel = document.getElementById('directions-panel');
    if (panel) panel.innerHTML = '';
    
    const directionsService = new window.google.maps.DirectionsService();
    directionsService.route({
      origin,
      destination,
      provideRouteAlternatives: true,
      travelMode: window.google.maps.TravelMode[mode || 'DRIVING']
    }, (result, status) => {
      if (status === 'OK') {
        resultRef.current = result;
        rendererRef.current.setDirections(result);
        
        // Finalize state and panel
        setTimeout(() => {
          if (panel) rendererRef.current.setPanel(panel);
          rendererRef.current.setRouteIndex(selectedRouteIndex || 0);
        }, 50);

        if (onRoutesFound) {
          const routes = result.routes.map((r, i) => ({
            index: i,
            summary: r.summary,
            distance: r.legs[0].distance?.text,
            duration: r.legs[0].duration?.text,
          }));
          onRoutesFound(routes);
        }
      } else {
        if (panel) panel.innerHTML = `<div style="padding: 20px; text-align: center; color: #D4622A;">Could not find route: ${status}. Try "Open maps" button below!</div>`;
        if (onRoutesFound) onRoutesFound([]);
      }
    });
  }, [originKey, destKey, mode]);

  // 3. Route Selection (Instant update, no re-calc)
  useEffect(() => {
    if (rendererRef.current && resultRef.current) {
      rendererRef.current.setRouteIndex(selectedRouteIndex);
    }
  }, [selectedRouteIndex]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%', background: '#F8F3EE' }} />;
}

export default function App() {
  const { user, setUser, loading: authLoading, logout } = useAuth();
  const isLoaded = useGoogleMaps();
  const [authPage, setAuthPage] = useState("login");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [tab, setTab] = useState("plan");
  const [planMode, setPlanMode] = useState("middle_ground");
  const [yourLocation, setYourLocation] = useState("");
  const [cityLocation, setCityLocation] = useState("");
  const [friendLocations, setFriendLocations] = useState({});
  const [searched, setSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [allCoords, setAllCoords] = useState([]);
  const [midpoint, setMidpoint] = useState(null);
  const [peopleLabels, setPeopleLabels] = useState([]);
  const [itinerary, setItinerary] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [invites, setInvites] = useState({ received: [], sent: [] });

  const [draftOriginalItinerary, setDraftOriginalItinerary] = useState(null);
  const [suggestingInviteId, setSuggestingInviteId] = useState(null);
  const [suggestMessage, setSuggestMessage] = useState("");
  const [inviteSubTab, setInviteSubTab] = useState("received");
  const [eventDate, setEventDate] = useState("");
  const [stopSchedules, setStopSchedules] = useState({});
  const [is24h, setIs24h] = useState(false);
  const [timezone, setTimezone] = useState(new Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [friendSearch, setFriendSearch] = useState("");
  const [showGuestList, setShowGuestList] = useState(true);
  const [expandedGuestGroups, setExpandedGuestGroups] = useState({});

  const [toast, setToast] = useState("");
  const [addFriendEmail, setAddFriendEmail] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [sharePhone, setSharePhone] = useState("");
  const [showInviteLink, setShowInviteLink] = useState(false);
  const [showExploreModal, setShowExploreModal] = useState(null); // {lat, lng, name}
  const [directionRoutes, setDirectionRoutes] = useState([]);
  const [directionsLoaded, setDirectionsLoaded] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showRemoveFriendConfirm, setShowRemoveFriendConfirm] = useState(null);
  const [showDirectionsFor, setShowDirectionsFor] = useState(null);
  const [settingsData, setSettingsData] = useState({ name: "", email: "", location: "", profile_picture: "", username: "" });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Cropper State
  const [cropModalSrc, setCropModalSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  function openSettings() {
    setSettingsData({ name: user.name || "", email: user.email || "", location: user.location || "", profile_picture: user.profile_picture || "", username: user.username || "" });
    setShowSettings(true);
  }

  async function handleProfilePicUpload(e) {
    const file = e.target.files[0];
    e.target.value = ''; // Reset the input so the same file can be selected again
    if (file) {
      try {
        const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true, initialQuality: 0.9 };
        const compressedFile = await imageCompression(file, options);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setCropModalSrc(ev.target.result);
          setCrop({ x: 0, y: 0 });
          setZoom(1);
        };
        reader.readAsDataURL(compressedFile);
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function applyCrop() {
    try {
      if (!cropModalSrc || !croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(cropModalSrc, croppedAreaPixels);
      setSettingsData(p => ({ ...p, profile_picture: croppedImage }));
      setCropModalSrc(null);
    } catch (e) {
      console.error(e);
      showToast("Error cropping image");
    }
  }

  async function handleSaveSettings() {
    setSettingsLoading(true);
    try {
      const data = await api.updateUser(settingsData);
      setUser(data.user);
      if (settingsData.location) setYourLocation(settingsData.location);
      showToast("Saved!");
      setShowSettings(false);
    } catch (e) {
      showToast(e.message || "Error saving settings");
    } finally {
      setSettingsLoading(false);
    }
  }


  useEffect(() => {
    if (user) {
      if (user.location) setYourLocation(user.location);
      api.listFriends().then(d => setFriends(d.friends || [])).catch(() => {});
      api.listInvites().then(d => setInvites(d)).catch(() => {});
    }
  }, [user]);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(""), 3000); };
  // Ensure unique friends in acceptedFriends
  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeInvites = invites || { received: [], sent: [] };
  const acceptedFriends = safeFriends.filter((f, i, ar) => f && f.status === "accepted" && ar.findIndex(x => x.id === f.id) === i);
  const pendingReceived = safeFriends.filter(f => f && f.status === "pending" && f.requester_id !== user?.id);
  const pendingSent = safeFriends.filter(f => f && f.status === "pending" && f.requester_id === user?.id);
  const receivedList = Array.isArray(safeInvites.received) ? safeInvites.received : [];
  const sentList = Array.isArray(safeInvites.sent) ? safeInvites.sent : [];
  const registrationLink = `${window.location.origin}`;

  function toggleFriend(f) {
    setSelectedFriends(prev =>
      prev.find(s => s.id === f.id) ? prev.filter(s => s.id !== f.id) : [...prev, f]
    );
    // Bug #9: Always auto-fill friend's location from their profile
    // This pre-populates the location from their profile so you don't have to ask.
    // The user can override it for THIS plan only - it won't change the friend's profile.
    if (friendLocations[f.id] === undefined) setFriendLocations(p => ({ ...p, [f.id]: f.location || "" }));
  }

  async function handleSearch() {
    if (planMode === "middle_ground" && (!yourLocation || selectedFriends.length === 0)) return;
    if (planMode === "city" && (!cityLocation || selectedFriends.length === 0)) return;
    setSearchLoading(true); setSearched(false);
    try {
      // Bug #9: Do NOT auto-save location changes to profile during search.
      // Location changes here are ONE-TIME for this plan only.
      // The user's profile location should only change via Settings.
      
      const locs = [];
      if (planMode === "city") {
        locs.push({ label: "City", address: cityLocation });
      } else {
        locs.push({ label: "You", address: yourLocation });
        selectedFriends.forEach(f => {
          const addr = friendLocations[f.id] || f.location || "";
          if (addr) locs.push({ label: f.name, address: addr });
        });
      }
      
      if (locs.length === 0) throw new Error("No locations provided");

      const data = await api.searchMidpoint(locs);
      setAllCoords(data.coords.map(c => ({ lat: c.lat, lng: c.lng })));
      setPeopleLabels(data.coords.map(c => c.label));
      setMidpoint(data.midpoint);
      setSearched(true);
    } catch (err) { showToast("Could not find locations: " + err.message); }
    finally { setSearchLoading(false); }
  }

  async function addToItinerary(spot, etaData) {
    if (itinerary.find(s => s.google_place_id === spot.google_place_id)) return;
    try {
      const { spot_id } = await api.saveSpot(spot);
      setItinerary(prev => [...prev, { ...spot, db_id: spot_id, ...etaData, stop_order: prev.length }]);
      showToast(`✓ Added ${spot.name}`);
    } catch { showToast("Failed to add spot"); }
  }

  function removeFromItinerary(pid) { setItinerary(prev => prev.filter(s => s.google_place_id !== pid)); }

  async function updateStopTransport(idx, mode) {
    const stop = itinerary[idx];
    if (!stop) return;
    
    // Bug #6 & #7: Properly update transport mode AND recalculate ETA
    // For multi-stop: idx > 0 uses previous stop as origin, idx === 0 uses user's location
    let origin;
    if (idx === 0) {
      origin = allCoords[0] || yourLocation || user?.location || '';
    } else {
      origin = { lat: itinerary[idx - 1].lat, lng: itinerary[idx - 1].lng };
    }
    
    // Immediately update mode so UI reflects change
    setItinerary(prev => prev.map((s, i) => i === idx ? { ...s, transport_mode: mode } : s));
    
    try {
      const dir = await api.getDirections({ origin, destination: { lat: stop.lat, lng: stop.lng }, mode: mode.toLowerCase() });
      setItinerary(prev => prev.map((s, i) => i === idx ? {
        ...s, transport_mode: mode,
        etas: [
          { label: "You", text: dir.duration?.text || '', seconds: dir.duration?.value || 0 },
          ...(s.etas?.slice(1) || []),
        ],
      } : s));
    } catch (err) { 
      console.error("Transport update failed:", err);
      // Even if ETA fails, mode is already updated
    }
  }

  async function saveAndSendInvite() {
    if (selectedFriends.length === 0 || itinerary.length === 0) return;
    try {
      let finalMessage = "Check out this itinerary!";
      if (suggestingInviteId) {
        finalMessage = suggestMessage;
        if (!finalMessage.trim() && draftOriginalItinerary) {
           const oldSpots = draftOriginalItinerary.map(s => s.name);
           const newSpots = itinerary.map(s => s.name);
           const added = newSpots.filter(n => !oldSpots.includes(n));
           const removed = oldSpots.filter(o => !newSpots.includes(o));
           if (added.length > 0 && removed.length > 0) {
              finalMessage = `I made a suggestion: Instead of ${removed[0]}, how about ${added[0]}?`;
           } else if (added.length > 0) {
              finalMessage = `I made a suggestion: Let's also go to ${added[0]}!`;
           } else if (removed.length > 0) {
              finalMessage = `I made a suggestion: Let's skip ${removed[0]}.`;
           } else {
              finalMessage = `I adjusted our plan a bit!`;
           }
        }
      }

      const { id: itId } = await api.createItinerary({
        name: `Plan with ${selectedFriends.map(f => f.name).join(" & ")}`,
        friend_id: selectedFriends[0].id,
        user_location: yourLocation,
        friend_location: friendLocations[selectedFriends[0].id] || "",
        stops: itinerary.map((s, i) => ({ spot_id: s.db_id, stop_order: i, transport_mode: s.transport_mode || "DRIVING", eta_seconds_user: s.etas?.[0]?.seconds || 0, eta_seconds_friend: s.etas?.[1]?.seconds || 0, eta_text_user: s.etas?.[0]?.text || "", eta_text_friend: s.etas?.[1]?.text || "", start_time: stopSchedules[i]?.start || "", end_time: stopSchedules[i]?.end || "" })),
      });

      for (const f of selectedFriends) {
        await api.createInvite({ receiver_id: f.id, itinerary_id: itId, message: finalMessage, event_date: eventDate, show_guest_list: showGuestList });
      }

      if (suggestingInviteId) {
         await api.updateInvite(suggestingInviteId, { status: "counter" });
      }

      showToast(`📬 ${suggestingInviteId ? "Suggestion sent!" : "Invite sent!"}`);
      // Bug #5: Close BOTH the invite modal AND the explore panel
      setShowInviteModal(false);
      setShowExploreModal(null);
      setItinerary([]); setTab("invites");
      setSuggestingInviteId(null); setDraftOriginalItinerary(null); setSuggestMessage("");
      setEventDate(""); setStopSchedules({}); setShowGuestList(true);
      setSearched(false); setMidpoint(null); setAllCoords([]);
      api.listInvites().then(d => setInvites(d)).catch(() => {});
    } catch (err) { showToast("Failed: " + err.message); }
  }

  async function sendViaSMS() {
    if (!sharePhone || itinerary.length === 0) return;
    try {
      const { id: itId } = await api.createItinerary({
        name: "Plan shared via SMS", friend_id: selectedFriends[0]?.id, user_location: yourLocation,
        stops: itinerary.map((s, i) => ({ spot_id: s.db_id, stop_order: i, transport_mode: s.transport_mode || "DRIVING" })),
      });
      await api.sendItinerarySMS(sharePhone, itId);
      showToast("📱 Itinerary sent via text!"); setShowShareModal(false); setSharePhone("");
    } catch (err) { showToast("Failed: " + err.message); }
  }

  async function handleAddFriend() {
    if (!addFriendEmail) return;
    try {
      const { friend } = await api.addFriend({ email: addFriendEmail });
      setFriends(prev => [...prev, { ...friend, requester_id: user.id }]);
      setAddFriendEmail(""); setShowAddFriend(false);
      showToast(`Friend request sent to ${friend.name}!`);
    } catch (err) {
      if (err.message === "not_found") {
        setShowInviteLink(true);
        showToast("User not found — share the invite link!");
      } else showToast(err.message);
    }
  }

  async function handleFriendAction(fid, status) {
    try {
      await api.updateFriend(fid, { status });
      setFriends(prev => prev.map(f => f.friendship_id === fid ? { ...f, status } : f));
      showToast(status === "accepted" ? "Friend request accepted!" : "Request declined");
    } catch { showToast("Failed to update"); }
  }

  async function handleRemoveFriend(fid) {
    try {
      await api.removeFriend(fid);
      setFriends(prev => prev.filter(f => f.friendship_id !== fid));
      setSelectedFriends(prev => prev.filter(f => f.friendship_id !== fid));
      showToast("Friend removed");
    } catch { showToast("Failed to remove"); }
  }

  async function togglePin(f) {
    try {
      const newPinned = !f.is_pinned;
      await api.updateFriend(f.friendship_id, { is_pinned: newPinned });
      setFriends(prev => prev.map(p => p.id === f.id ? { ...p, is_pinned: newPinned } : p));
      showToast(newPinned ? "📌 Pinned!" : "Unpinned");
    } catch { showToast("Failed"); }
  }

  async function handleInviteAction(id, status) {
    try {
      await api.updateInvite(id, { status });
      setInvites(prev => ({
        received: (prev.received || []).map(inv => inv.id === id ? { ...inv, status } : inv),
        sent: (prev.sent || []).map(inv => inv.id === id ? { ...inv, status } : inv)
      }));
      showToast(status === "accepted" ? "🎉 Accepted!" : status === "completed" ? "✅ Completed!" : "Updated");
    } catch { showToast("Failed"); }
  }

  async function handleSuggestChanges(inv) {
    const isWeFriendInOriginal = inv.it_friend_id === user.id;
    
    // Bug #9: Use PROFILE location as default, not just the invite's stored location.
    // The user's profile location is the default. If the invite had a different location,
    // still fall back to profile. The user can override for THIS plan only.
    const myProfileLoc = user?.location || '';
    const myInviteLoc = isWeFriendInOriginal ? inv.friend_location : inv.user_location;
    // Use profile location as primary default, fall back to invite location
    setYourLocation(myProfileLoc || myInviteLoc || '');
    
    const otherPersonId = inv.sender_id === user.id ? inv.receiver_id : inv.sender_id;
    const otherPersonName = inv.sender_id === user.id ? inv.receiver_name : inv.sender_name;
    const otherPersonColor = inv.sender_id === user.id ? inv.receiver_color : inv.sender_color;
    const otherPersonAvatar = inv.sender_id === user.id ? inv.receiver_avatar : inv.sender_avatar;
    // Bug #9: Get friend's profile location from the friends list
    const otherPersonFromFriends = friends.find(f => f.id === otherPersonId);
    const otherProfileLoc = otherPersonFromFriends?.location || '';
    const otherInviteLoc = isWeFriendInOriginal ? inv.user_location : inv.friend_location;
    // Use the friend's profile location as default, fall back to invite data
    const otherPersonLoc = otherProfileLoc || otherInviteLoc || '';

    setFriendLocations(prev => ({ ...prev, [otherPersonId]: otherPersonLoc }));
    const friendObj = { id: otherPersonId, name: otherPersonName, color: otherPersonColor, avatar_letter: otherPersonAvatar, location: otherPersonLoc };
    setSelectedFriends([friendObj]);
    
    const restored = (inv.stops || []).map(s => {
      // Cleanup corrupted emojis if any
      let em = s.emoji || '📍';
      if (em.includes('') || em.length > 5) em = '📍'; 

      return {
        ...s,
        db_id: s.spot_id,
        google_place_id: s.google_place_id || ("fk_" + s.spot_id),
        name: s.spot_name,
        emoji: em,
        etas: [
          { label: "You", text: s.eta_text_user || '', seconds: s.eta_seconds_user || 0 },
          { label: otherPersonName || "Friend", text: s.eta_text_friend || '', seconds: s.eta_seconds_friend || 0 }
        ],
        transport_mode: s.transport_mode || 'DRIVING'
      };
    });
    
    setItinerary(restored);
    setDraftOriginalItinerary(restored);
    setSuggestingInviteId(inv.id);
    setSuggestMessage("");
    setEventDate(inv.event_date || '');
    const scheds = {};
    (inv.stops || []).forEach((s, idx) => {
      scheds[idx] = { start: s.start_time || '', end: s.end_time || '' };
    });
    setStopSchedules(scheds);
    setTab("plan");
    showToast("Loaded original plan for editing");
    
    // Bug #4 & #7: Automatically recalculate midpoint & directions
    try {
      const myLoc = myProfileLoc || myInviteLoc || '';
      const locs = [{ label: "You", address: myLoc }];
      locs.push({ label: otherPersonName, address: otherPersonLoc });
      const data = await api.searchMidpoint(locs);
      setAllCoords(data.coords.map(c => ({ lat: c.lat, lng: c.lng })));
      setPeopleLabels(data.coords.map(c => c.label));
      setMidpoint(data.midpoint);
      setSearched(true);
      
      // Bug #7: Recalculate ETAs for all restored stops with proper origins
      // For multi-stop: origin is previous stop (not user location) for idx > 0
      const userCoord = data.coords[0] ? { lat: data.coords[0].lat, lng: data.coords[0].lng } : null;
      const friendCoord = data.coords[1] ? { lat: data.coords[1].lat, lng: data.coords[1].lng } : null;
      if (userCoord && restored.length > 0) {
        const updatedStops = [...restored];
        for (let i = 0; i < updatedStops.length; i++) {
          const stop = updatedStops[i];
          // Bug #10: For idx > 0, use previous stop as origin
          const userOrigin = i === 0 ? userCoord : { lat: updatedStops[i-1].lat, lng: updatedStops[i-1].lng };
          const friendOrigin = i === 0 ? (friendCoord || userCoord) : { lat: updatedStops[i-1].lat, lng: updatedStops[i-1].lng };
          try {
            const [userDir, friendDir] = await Promise.all([
              api.getDirections({ origin: userOrigin, destination: { lat: stop.lat, lng: stop.lng }, mode: (stop.transport_mode || 'DRIVING').toLowerCase() }),
              friendCoord && i === 0 ? api.getDirections({ origin: friendOrigin, destination: { lat: stop.lat, lng: stop.lng }, mode: (stop.transport_mode || 'DRIVING').toLowerCase() }) : Promise.resolve(null),
            ]);
            updatedStops[i] = {
              ...stop,
              etas: [
                { label: "You", text: userDir.duration?.text || '', seconds: userDir.duration?.value || 0 },
                { label: otherPersonName || "Friend", text: (friendDir?.duration?.text || stop.etas?.[1]?.text || ''), seconds: (friendDir?.duration?.value || stop.etas?.[1]?.seconds || 0) },
              ]
            };
          } catch { /* keep original ETA data */ }
        }
        setItinerary(updatedStops);
      }
    } catch { 
      setSearched(true); // Don't hide the map even if geocode fails
    }
  }

  function getRouteNarrative() {
    // Bug #6: Use the correct emoji and transport word based on actual transport_mode
    const mw = { DRIVING: "drive", WALKING: "walk", TRANSIT: "ride", BICYCLING: "bike ride" };
    const me = { DRIVING: "🚗", WALKING: "🚶", TRANSIT: "🚌", BICYCLING: "🚲" };
    return itinerary.map((stop, i) => {
      const m = stop.transport_mode || "DRIVING";
      const label = i === 0 ? "First up" : i === itinerary.length - 1 ? "Last stop" : "Then";
      const userEta = stop.etas?.[0]?.text ? ` (about ${stop.etas[0].text})` : "";
      return `${me[m] || '🚗'} <strong>${label}</strong> — ${(mw[m] || 'drive').charAt(0).toUpperCase()}${(mw[m] || 'drive').slice(1)} to <strong>${stop.name}</strong>${userEta}`;
    });
  }

  function renderDetailedStops(inv, isReceived) {
    if (!inv.stops || inv.stops.length === 0) return null;
    // Bug #6: Use correct emoji for transport mode
    const transportEmoji = { DRIVING: '🚗', WALKING: '🚶', TRANSIT: '🚌', BICYCLING: '🚲' };
    const transportWord = { DRIVING: 'drive', WALKING: 'walk', TRANSIT: 'ride', BICYCLING: 'bike' };
    const cleanEmoji = (em) => {
        if (!em || em.includes('\uFFFD') || em.length > 5) return '📍';
        return em;
    };
    // Format time from 24hr "HH:MM" to 12hr "h:mm AM/PM"
    const formatTime = (t) => {
      if (!t) return '?';
      const [h, m] = t.split(':');
      const hr = parseInt(h);
      if (isNaN(hr)) return t;
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const displayHr = hr % 12 || 12;
      return `${displayHr}:${m} ${ampm}`;
    };

    return (
      <div className="invite-stops-detail" style={{ marginTop: 12, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 0 }}>
        {inv.stops.map((s, idx) => (
          <div key={idx}>
            {/* Travel tag between stops - Bug #6: show correct transport emoji and word */}
            {idx > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0' }}>
                <div style={{ flex: 1, height: 1, background: '#EDE5DA' }} />
                <div style={{ padding: '4px 12px', background: '#F8F3EE', borderRadius: 100, fontSize: 11, color: '#9A8A78', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {transportEmoji[s.transport_mode] || '🚗'} {s.eta_text_user || s.eta_text_friend || 'Travel'} {transportWord[s.transport_mode] || 'drive'}
                </div>
                <div style={{ flex: 1, height: 1, background: '#EDE5DA' }} />
              </div>
            )}
            <div style={{ border: '1.5px solid #EDE5DA', borderRadius: 12, overflow: 'hidden', background: '#FAFAFA' }}>
              {/* Bug #1: Always show MiniMap for all stops (sent and received plans) */}
              <div style={{ height: 120, background: '#E0D8CE', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(255,255,255,0.95)', color: '#2C2416', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>Stop {idx + 1}</div>
                {(s.start_time || s.end_time) && (
                  <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(212,98,42,0.9)', color: 'white', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                    🕐 {formatTime(s.start_time)} — {formatTime(s.end_time)}
                  </div>
                )}
                {s.lat && s.lng ? (
                  <MiniMap lat={s.lat} lng={s.lng} emoji={cleanEmoji(s.emoji)} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A8A78', fontSize: 13 }}>📍 Map unavailable</div>
                )}
              </div>
              <div style={{ padding: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{cleanEmoji(s.emoji)} {s.spot_name}</div>
                <div style={{ fontSize: 12, color: '#9A8A78', marginBottom: 12, lineHeight: 1.4 }}>📍 {s.address || 'Address unlisted'}</div>
                
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <button className="itin-opt-btn" style={{ flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 700, margin: 0, background: 'white', borderRadius: 8 }} onClick={() => { setDirectionRoutes([]); setDirectionsLoaded(false); setShowDirectionsFor({ inv, stopIdx: idx }); }}>🛣️ See Directions</button>
                  <button className="itin-opt-btn" style={{ flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 700, margin: 0, background: 'white', borderRadius: 8 }} onClick={() => {
                    // Bug #10: For idx > 0, use previous stop as origin, NOT user's home location
                    let myStart;
                    if (idx === 0) {
                      myStart = inv.it_friend_id === user.id ? inv.friend_location : inv.user_location;
                    } else {
                      const prev = inv.stops[idx - 1];
                      myStart = prev.address || `${prev.lat},${prev.lng}`;
                    }
                    const dest = s.address || `${s.lat},${s.lng}`;
                    window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(myStart)}&destination=${encodeURIComponent(dest)}&travelmode=${(s.transport_mode || 'DRIVING').toLowerCase()}`, '_blank');
                  }}>📱 Open maps</button>
                </div>
                
                {/* Bug #3: Bigger explore button */}
                <button className="itin-opt-btn" style={{ width: '100%', padding: '16px 0', fontSize: 14, fontWeight: 700, margin: '0 0 16px 0', background: 'linear-gradient(135deg, #F8F3EE, #FFF4EF)', color: '#D4622A', borderRadius: 12, border: '1.5px solid #FADED3', letterSpacing: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => {
                   setShowExploreModal({ lat: s.lat, lng: s.lng, name: s.spot_name });
                }}><span style={{ fontSize: 20 }}>🔍</span> Explore in area</button>
                
                <div style={{ display: 'flex', gap: 8 }}>
                  {idx === 0 ? (
                    <>
                      <div style={{ flex: 1, background: '#FFF4EF', padding: 8, borderRadius: 8 }}>
                        <span style={{ fontSize: 10, color: '#D4622A', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'block', marginBottom: 2 }}>{isReceived ? `${inv.sender_name}'s ETA` : 'Your ETA'}</span>
                        {/* Bug #2: Show '—' instead of 'Calculating…' for saved plans */}
                        <span style={{ fontSize: 13, color: '#2C2416', fontWeight: 600 }}>{s.eta_text_user || '—'}</span>
                      </div>
                      <div style={{ flex: 1, background: '#F6FBF7', padding: 8, borderRadius: 8 }}>
                        <span style={{ fontSize: 10, color: '#3D8B4B', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'block', marginBottom: 2 }}>{isReceived ? 'Your ETA' : `${inv.receiver_name}'s ETA`}</span>
                        <span style={{ fontSize: 13, color: '#2C2416', fontWeight: 600 }}>{s.eta_text_friend || '—'}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ flex: 1, background: '#F8F3EE', padding: 10, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px dashed #D4622A' }}>
                      <div>
                        <span style={{ fontSize: 9, color: '#6B5B4E', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'block' }}>Travel from {inv.stops[idx-1].spot_name}</span>
                        {/* Bug #6: Show correct transport emoji and word */}
                        <span style={{ fontSize: 14, color: '#2C2416', fontWeight: 700 }}>{transportEmoji[s.transport_mode] || '🚗'} {s.eta_text_user || '—'} {transportWord[s.transport_mode] || 'drive'} together</span>
                      </div>
                      <div style={{ fontSize: 20 }}>🏁</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // AUTH SCREENS
  if (authLoading) return (<><style>{styles}</style><div className="app"><div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}><div className="loading-bar" style={{ width: 200 }}><div className="loading-fill" /></div></div></div></>);
  if (!user) return (<><style>{styles}</style>{authPage === "login" ? <LoginPage onSwitch={() => setAuthPage("register")} /> : <RegisterPage onSwitch={() => setAuthPage("login")} onNeedVerify={() => setNeedsVerify(true)} />}</>);
  if (needsVerify && user.phone && !user.phone_verified) return (<><style>{styles}</style><VerifyPhonePage onSkip={() => setNeedsVerify(false)} /></>);

  const narrative = getRouteNarrative();
  const friendNames = selectedFriends.map(f => f.name).join(" & ") || "Friend";

  return (
    <><style>{styles}</style><div className="app">
      {toast && <div className="toast">{toast}</div>}

      <div className="narrow-container">
        <div className="header"><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div><div className="logo">the <span>middle</span> ground</div><div className="tagline">Meet halfway, no compromises</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div className="user-avatar" style={{ background: user.profile_picture ? 'transparent' : user.color, backgroundImage: user.profile_picture ? `url(${user.profile_picture})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', border: user.profile_picture ? '1.5px solid #EDE5DA' : 'none', cursor: 'pointer' }} onClick={openSettings} title="Settings">{!user.profile_picture && user.avatar_letter}</div>
            <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)} title="Logout">↗</button>
          </div>
        </div></div>

        <div className="nav">
          {[{ id: "plan", icon: "🗺️", label: "Plan" }, { id: "invites", icon: "💌", label: "Invites" }, { id: "friends", icon: "👥", label: "Friends" }].map(t => (
            <button key={t.id} className={`nav-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
              <span className="nav-icon">{t.icon}</span>{t.label}
              {t.id === "invites" && receivedList.filter(i => i.status === "pending").length > 0 && <span className="badge-dot">{receivedList.filter(i => i.status === "pending").length}</span>}
              {t.id === "friends" && pendingReceived.length > 0 && <span className="badge-dot">{pendingReceived.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="content" style={{ paddingBottom: itinerary.length > 0 ? 450 : 30 }}>

        {/* PLAN TAB */}
        {tab === "plan" && (<>
          <div className="narrow-container">
            {/* Toggles */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
               <button onClick={() => setPlanMode("middle_ground")} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid", borderColor: planMode === "middle_ground" ? "#D4622A" : "#EDE5DA", background: planMode === "middle_ground" ? "#FFF4EF" : "transparent", color: planMode === "middle_ground" ? "#D4622A" : "#9A8A78", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>🤝 Middle Ground</button>
               <button onClick={() => setPlanMode("city")} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid", borderColor: planMode === "city" ? "#D4622A" : "#EDE5DA", background: planMode === "city" ? "#FFF4EF" : "transparent", color: planMode === "city" ? "#D4622A" : "#9A8A78", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>🏙️ City Mode</button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="section-label" style={{ margin: 0 }}>Planning with</div>
                {acceptedFriends.length > 5 && (
                  <input 
                    type="text" 
                    placeholder="Search friends..." 
                    value={friendSearch}
                    onChange={e => setFriendSearch(e.target.value)}
                    style={{ fontSize: 11, padding: "4px 10px", border: "1.5px solid #EDE5DA", borderRadius: 100, width: 140, outline: 'none', background: '#FFF' }}
                  />
                )}
              </div>
              <div className="friend-selector">
                {acceptedFriends
                  .filter(f => !friendSearch || f.name.toLowerCase().includes(friendSearch.toLowerCase()))
                  .sort((a, b) => (b.is_pinned || 0) - (a.is_pinned || 0))
                  .slice(0, friendSearch ? 100 : 10)
                  .map(f => (
                    <button key={f.id} className={`friend-chip ${selectedFriends.find(s => s.id === f.id) ? "active" : ""}`} onClick={() => toggleFriend(f)}>
                      <div className="friend-avatar" style={{ background: f.color }}>{f.avatar_letter}</div>{f.name}
                      {f.is_pinned ? <span style={{ fontSize: 10, marginLeft: 2 }}>📌</span> : null}
                    </button>
                  ))}
                {acceptedFriends.length === 0 && <div className="muted-text">No friends yet — go to Friends tab to add some!</div>}
                {acceptedFriends.length > 10 && !friendSearch && <div style={{ fontSize: 10, color: '#9A8A78', width: '100%', marginTop: 6, textAlign: 'center' }}>Showing 10 friends. Use search for more.</div>}
              </div>
            </div>

            <div className="location-section">
              <div className="location-card">
                {planMode === "city" ? (
                  <div className="loc-row">
                    <div className="loc-dot you" style={{background: '#7B5EA7'}} /><span className="loc-label">Explore</span>
                    <PlaceAutocompleteInput className="loc-input" value={cityLocation} onChange={setCityLocation} placeholder="e.g. San Francisco, CA…" />
                  </div>
                ) : (
                  <>
                    <div className="loc-row">
                      <div className="loc-dot you" /><span className="loc-label">You</span>
                      <PlaceAutocompleteInput className="loc-input" value={yourLocation} onChange={setYourLocation} placeholder="Your location…" />
                    </div>
                    {selectedFriends.map(f => (
                      <div key={f.id} className="loc-row">
                        <div className="loc-dot friend" /><span className="loc-label">{f.name}</span>
                        <PlaceAutocompleteInput className="loc-input" value={friendLocations[f.id] ?? f.location ?? ""} onChange={v => setFriendLocations(prev => ({ ...prev, [f.id]: v }))} placeholder={`${f.name}'s location (optional)…`} />
                      </div>
                    ))}
                  </>
                )}
              </div>
              <button className="search-btn" onClick={handleSearch} disabled={searchLoading || selectedFriends.length === 0 || (planMode === 'middle_ground' ? !yourLocation : !cityLocation)}>
                {searchLoading ? "Finding spots…" : planMode === "city" ? "🏙️ Explore City" : "🎯 Find the Middle Ground"}
              </button>
              {searchLoading && <div className="loading-bar"><div className="loading-fill" /></div>}
            </div>
          </div>

          <div style={{ padding: '0 10px' }}>
            {searched && midpoint && <MapExplorer isLoaded={isLoaded} coords={allCoords} midpoint={midpoint} peopleLabels={peopleLabels} itinerary={itinerary} onAddToItinerary={addToItinerary} onRemoveFromItinerary={removeFromItinerary} />}
            {!searched && !searchLoading && <div className="narrow-container"><div className="empty"><div className="empty-emoji">🤝</div><div className="empty-title">Ready to plan?</div><div className="empty-sub">Select friends and a location to find spots with real Google Maps ETAs.</div></div></div>}
          </div>
        </>)}

        {/* INVITES TAB */}
        {tab === "invites" && (<div className="narrow-container">
          <div className="section-title">Your Invites</div>

          {/* RECEIVED / SENT TOGGLE */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: '#F0E8DD', borderRadius: 12, padding: 3 }}>
            <button onClick={() => setInviteSubTab("received")} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              background: inviteSubTab === 'received' ? 'white' : 'transparent',
              color: inviteSubTab === 'received' ? '#D4622A' : '#9A8A78',
              boxShadow: inviteSubTab === 'received' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            }}>
              💌 Received {receivedList.length > 0 && <span style={{ background: '#D4622A', color: 'white', borderRadius: 100, padding: '1px 7px', fontSize: 10, marginLeft: 4 }}>{receivedList.length}</span>}
            </button>
            <button onClick={() => setInviteSubTab("sent")} style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
              background: inviteSubTab === 'sent' ? 'white' : 'transparent',
              color: inviteSubTab === 'sent' ? '#D4622A' : '#9A8A78',
              boxShadow: inviteSubTab === 'sent' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            }}>
              📤 Sent {sentList.length > 0 && <span style={{ background: '#9A8A78', color: 'white', borderRadius: 100, padding: '1px 7px', fontSize: 10, marginLeft: 4 }}>{sentList.length}</span>}
            </button>
          </div>

          {/* RECEIVED INVITES */}
          {inviteSubTab === "received" && (<>
            {receivedList.length === 0 && <div className="empty"><div className="empty-emoji">💌</div><div className="empty-title">No invites received</div><div className="empty-sub">When friends send you a plan, it'll show up here!</div></div>}
            {receivedList.filter(i => i.status === "pending").length > 0 && <div className="section-sub" style={{marginBottom: 10}}>{receivedList.filter(i => i.status === "pending").length} pending</div>}
            {receivedList.map(inv => (
              <div key={inv.id} className={`invite-card ${inv.status === "accepted" ? "accepted" : inv.status === "completed" ? "completed" : ""}`}>
                <div className="invite-top">
                  <div className="invite-avatar" style={{ background: inv.sender_color }}>{inv.sender_avatar}</div>
                  <div className="invite-who">
                    <div className="invite-name">{inv.sender_name} invited you</div>
                    <div className="invite-date">🗓 {inv.event_date ? new Date(inv.event_date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : inv.date_label || "No date set"}</div>
                  </div>
                  <span className={`invite-status ${inv.status}`}>{inv.status === "pending" ? "Pending" : inv.status === "accepted" ? "Going ✓" : inv.status === "counter" ? "Countered" : inv.status === "completed" ? "Done ✓" : "Declined"}</span>
                </div>
                {inv.message && <div className="invite-message">"{inv.message}"</div>}
                {/* Show co-invitees if the sender enabled guest list visibility */}
                {inv.co_invitees && inv.co_invitees.length > 0 && (
                  <div style={{ marginBottom: 12, padding: '10px 12px', background: '#F8F3EE', borderRadius: 10, border: '1px solid #EDE5DA' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9A8A78', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Also invited</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {inv.co_invitees.map(ci => (
                        <div key={ci.receiver_id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', borderRadius: 100, padding: '3px 10px 3px 3px', border: '1px solid #EDE5DA', fontSize: 12, fontWeight: 500 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: ci.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white' }}>{ci.avatar_letter}</div>
                          {ci.name}
                          <span style={{ fontSize: 9, color: ci.status === 'accepted' ? '#3D8B4B' : ci.status === 'declined' ? '#C0392B' : '#E07C2A', fontWeight: 600, marginLeft: 2 }}>
                            {ci.status === 'accepted' ? '✓' : ci.status === 'declined' ? '✕' : '⏳'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {renderDetailedStops(inv, true)}
                <div className="invite-actions" style={{ flexDirection: 'column', gap: 8 }}>
                  {inv.status === "pending" ? (
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                      <button className="accept-btn" onClick={() => handleInviteAction(inv.id, "accepted")}>✓ Accept</button>
                      <button className="suggest-btn" style={{flex: 1, padding: "10px", borderRadius: 10, background: "#FFF4EF", color: "#D4622A", border: "1.5px solid #FADED3", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer"}} onClick={() => handleSuggestChanges(inv)}>✏️ Suggest Changes</button>
                      <button className="decline-btn" onClick={() => handleInviteAction(inv.id, "declined")}>✕</button>
                    </div>
                  ) : inv.status === "completed" ? (
                    <div className="status-msg" style={{ padding: 0, textAlign: 'center', color: '#6B8F71' }}>✅ Hangout completed!</div>
                  ) : (
                    <>
                      {inv.status === "accepted" && <div className="status-msg green" style={{ padding: 0, textAlign: 'left', marginBottom: 4 }}>🎉 You're going!</div>}
                      {inv.status === "declined" && <div className="status-msg" style={{ padding: 0, textAlign: 'left', marginBottom: 4, color: '#C0392B' }}>Declined</div>}
                      {inv.status === "counter" && <div className="status-msg" style={{ padding: 0, textAlign: 'left', marginBottom: 4, color: '#D4622A' }}>Counter proposed</div>}
                      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                        {inv.status !== "accepted" && <button className="accept-btn" style={{ flex: 1, padding: '8px', fontSize: 12 }} onClick={() => handleInviteAction(inv.id, "accepted")}>Accept</button>}
                        {inv.status !== "declined" && <button className="decline-btn" style={{ flex: 1, padding: '8px', fontSize: 12 }} onClick={() => handleInviteAction(inv.id, "declined")}>Decline</button>}
                        <button className="suggest-btn" style={{flex: 2, padding: "8px", borderRadius: 10, background: "#FFF4EF", color: "#D4622A", border: "1.5px solid #FADED3", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, cursor: "pointer"}} onClick={() => handleSuggestChanges(inv)}>✏️ Edit Itinerary</button>
                      </div>
                      {inv.status === "accepted" && (
                        <button onClick={() => handleInviteAction(inv.id, "completed")} style={{ width: '100%', marginTop: 4, padding: '8px', borderRadius: 10, background: '#E8F5E9', color: '#3D8B4B', border: '1.5px solid #C8E6C9', fontFamily: "'DM Sans'", fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✅ Mark as Completed</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </>)}

          {/* SENT INVITES - Grouped by itinerary_id */}
          {inviteSubTab === "sent" && (<>
            {sentList.length === 0 && <div className="empty"><div className="empty-emoji">📤</div><div className="empty-title">No invites sent</div><div className="empty-sub">Build an itinerary in Plan and send it to friends!</div></div>}
            {(() => {
              // Group sent invites by itinerary_id
              const grouped = [];
              const seenItineraries = new Set();
              sentList.forEach(inv => {
                if (!seenItineraries.has(inv.itinerary_id)) {
                  seenItineraries.add(inv.itinerary_id);
                  const group = sentList.filter(i => i.itinerary_id === inv.itinerary_id);
                  grouped.push(group);
                }
              });
              return grouped.map(group => {
                const primary = group[0]; // Use first invite for stops/date/message
                const receivers = group.map(inv => ({
                  id: inv.receiver_id,
                  name: inv.receiver_name,
                  avatar: inv.receiver_avatar,
                  color: inv.receiver_color,
                  status: inv.status,
                  inviteId: inv.id,
                }));
                const allCompleted = group.every(inv => inv.status === 'completed');
                const anyAccepted = group.some(inv => inv.status === 'accepted');
                const allNames = receivers.map(r => r.name);
                const displayNames = allNames.length <= 2 ? allNames.join(' & ') : `${allNames[0]} & ${allNames.length - 1} other${allNames.length - 1 > 1 ? 's' : ''}`;
                const isExpanded = expandedGuestGroups[primary.itinerary_id];
                const guestListHidden = !primary.show_guest_list;

                return (
                  <div key={primary.itinerary_id} className={`invite-card ${allCompleted ? "completed" : ""}`}>
                    <div className="invite-top">
                      {/* Stacked avatars for multiple receivers */}
                      <div style={{ display: 'flex', position: 'relative', width: Math.min(receivers.length, 3) * 16 + 24 }}>
                        {receivers.slice(0, 3).map((r, i) => (
                          <div key={r.id} className="invite-avatar" style={{
                            background: r.color,
                            position: i > 0 ? 'absolute' : 'relative',
                            left: i * 16,
                            zIndex: 3 - i,
                            border: '2px solid white',
                            width: 36, height: 36, fontSize: 14,
                          }}>{r.avatar}</div>
                        ))}
                        {receivers.length > 3 && (
                          <div style={{
                            position: 'absolute', left: 48, zIndex: 0,
                            width: 36, height: 36, borderRadius: '50%',
                            background: '#EDE5DA', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 10, fontWeight: 700,
                            color: '#6B5B4E', border: '2px solid white'
                          }}>+{receivers.length - 3}</div>
                        )}
                      </div>
                      <div className="invite-who">
                        <div className="invite-name">You → {displayNames}</div>
                        <div className="invite-date">🗓 {primary.event_date ? new Date(primary.event_date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : "No date set"}</div>
                      </div>
                      {/* Show combined status */}
                      <span className={`invite-status ${allCompleted ? 'completed' : anyAccepted ? 'accepted' : 'pending'}`}>
                        {allCompleted ? 'Done ✓' : anyAccepted ? 'Going' : 'pending'}
                      </span>
                    </div>

                    {/* Expandable guest list for 3+ people */}
                    {receivers.length >= 2 && (
                      <div style={{ marginBottom: 12 }}>
                        <button
                          onClick={() => setExpandedGuestGroups(prev => ({ ...prev, [primary.itinerary_id]: !prev[primary.itinerary_id] }))}
                          style={{
                            width: '100%', padding: '8px 12px', borderRadius: 10,
                            border: '1px solid #EDE5DA', background: '#F8F3EE',
                            fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', color: '#6B5B4E',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          }}
                        >
                          <span>👥 {receivers.length} people invited {guestListHidden && <span style={{ fontSize: 10, color: '#9A8A78', fontWeight: 400 }}>(hidden from guests)</span>}</span>
                          <span style={{ fontSize: 14, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                        </button>
                        {isExpanded && (
                          <div style={{ marginTop: 8, padding: '10px 12px', background: 'white', borderRadius: 10, border: '1px solid #EDE5DA' }}>
                            {receivers.map(r => (
                              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #F5F0EB' }}>
                                <div style={{ width: 28, height: 28, borderRadius: '50%', background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0 }}>{r.avatar}</div>
                                <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#2C2416' }}>{r.name}</div>
                                <span className={`invite-status ${r.status}`} style={{ fontSize: 10, padding: '2px 8px' }}>
                                  {r.status === 'accepted' ? 'Going ✓' : r.status === 'declined' ? 'Declined' : r.status === 'completed' ? 'Done ✓' : 'Pending'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {primary.message && (
                      <div style={{ margin: '0 0 12px 0', padding: '10px 12px', background: '#F8F3EE', borderRadius: 8, borderLeft: '3px solid #D4622A', fontSize: 13, color: '#2C2416', fontStyle: 'italic' }}>
                        "{primary.message}"
                      </div>
                    )}
                    {renderDetailedStops(primary, false)}
                    <div className="invite-actions" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="suggest-btn" style={{flex: 1, padding: "10px", borderRadius: 10, background: "#FFF4EF", color: "#D4622A", border: "1.5px solid #FADED3", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer"}} onClick={() => handleSuggestChanges(primary)}>✏️ Edit & Resend</button>
                      {anyAccepted && <button onClick={() => { group.forEach(inv => { if (inv.status === 'accepted') handleInviteAction(inv.id, 'completed'); }); }} style={{flex: 1, padding: "10px", borderRadius: 10, background: "#E8F5E9", color: "#3D8B4B", border: "1.5px solid #C8E6C9", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, cursor: "pointer"}}>✅ Mark Complete</button>}
                    </div>
                  </div>
                );
              });
            })()}
          </>)}
        </div>)}

        {/* FRIENDS TAB */}
        {tab === "friends" && (<div className="narrow-container">
          <div className="section-title">Your Friends</div>
          <div className="section-sub">{acceptedFriends.length} friend{acceptedFriends.length !== 1 ? "s" : ""}{pendingReceived.length > 0 ? ` · ${pendingReceived.length} pending` : ""}</div>

          <button className="search-btn" style={{ marginBottom: 16 }} onClick={() => { setShowAddFriend(!showAddFriend); setShowInviteLink(false); }}>
            {showAddFriend ? "Cancel" : "+ Add Friend"}
          </button>

          {showAddFriend && (
            <div className="add-friend-card">
              <div className="loc-row" style={{ border: "none" }}>
                <span className="loc-label" style={{ width: "auto" }}>Email</span>
                <input className="loc-input" value={addFriendEmail} onChange={e => setAddFriendEmail(e.target.value)} placeholder="friend@email.com" onKeyDown={e => e.key === "Enter" && handleAddFriend()} />
              </div>
              <button className="search-btn" onClick={handleAddFriend} style={{ marginTop: 8 }}>Send Request</button>
              {showInviteLink && (
                <div className="invite-link-section">
                  <div className="invite-link-title">👋 They're not on the app yet!</div>
                  <div className="invite-link-sub">Share this link so they can sign up:</div>
                  <div className="invite-link-box">
                    <span>{registrationLink}</span>
                    <button onClick={() => { navigator.clipboard.writeText(registrationLink); showToast("Link copied!"); }}>📋 Copy</button>
                  </div>
                  <div className="invite-link-qr">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(registrationLink)}`} alt="QR Code" width={120} height={120} />
                    <div style={{ fontSize: 11, color: "#9A8A78", marginTop: 6 }}>Scan to sign up</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {pendingReceived.length > 0 && (<>
            <div className="friend-section-label">Friend Requests</div>
            {pendingReceived.map(f => (
              <div key={f.id} className="friend-card">
                <div className="friend-card-left">
                  <div className="friend-card-avatar" style={{ background: f.color }}>{f.avatar_letter}</div>
                  <div className="friend-card-info"><div className="friend-card-name">{f.name}</div><div className="friend-card-sub">{f.email || f.location}</div></div>
                </div>
                <div className="friend-card-actions">
                  <button className="fc-accept" onClick={() => handleFriendAction(f.friendship_id, "accepted")}>✓</button>
                  <button className="fc-decline" onClick={() => handleFriendAction(f.friendship_id, "declined")}>✕</button>
                </div>
              </div>
            ))}
          </>)}

          {pendingSent.length > 0 && (<>
            <div className="friend-section-label">Sent Requests</div>
            {pendingSent.map(f => (
              <div key={f.id} className="friend-card">
                <div className="friend-card-left">
                  <div className="friend-card-avatar" style={{ background: f.color }}>{f.avatar_letter}</div>
                  <div className="friend-card-info"><div className="friend-card-name">{f.name}</div><div className="friend-card-sub">Pending…</div></div>
                </div>
                <button className="fc-remove" onClick={() => handleRemoveFriend(f.friendship_id)}>Cancel</button>
              </div>
            ))}
          </>)}

          {acceptedFriends.length > 0 && (<>
            <div className="friend-section-label">Friends</div>
            {acceptedFriends.map(f => (
              <div key={f.id} className="friend-card" style={{ borderLeft: f.is_pinned ? '4px solid #D4622A' : '1.5px solid #EDE5DA' }}>
                <div className="friend-card-left">
                  <div className="friend-card-avatar" style={{ background: f.color }}>{f.avatar_letter}</div>
                  <div className="friend-card-info"><div className="friend-card-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{f.name} {f.is_pinned ? <span style={{ fontSize: 12 }}>📌</span> : null}</div><div className="friend-card-sub">{f.location || f.email}</div></div>
                </div>
                <div className="friend-card-actions">
                  <button className="fc-remove" style={{ border: 'none', background: 'transparent', padding: '0 8px', fontSize: 16 }} onClick={() => togglePin(f)} title="Pin friend">{f.is_pinned ? "📍" : "📌"}</button>
                  <button className="fc-remove" onClick={() => setShowRemoveFriendConfirm({ id: f.friendship_id, name: f.name })}>Remove</button>
                </div>
              </div>
            ))}
          </>)}

          {friends.length === 0 && !showAddFriend && <div className="empty"><div className="empty-emoji">👥</div><div className="empty-title">No friends yet</div><div className="empty-sub">Add friends by email to start planning!</div></div>}
        </div>)}
      </div>

      {/* ITINERARY BAR */}
      {itinerary.length > 0 && (
        <div className="itin-bar">
          <div className="itin-header" style={{ padding: '20px 20px 8px', margin: 0 }}><div className="itin-title">{suggestingInviteId ? "Suggesting Changes" : "Your Plan"} · {itinerary.length} stop{itinerary.length > 1 ? "s" : ""}</div><span className="itin-toggle" onClick={() => { setItinerary([]); setSuggestingInviteId(null); setDraftOriginalItinerary(null); }}>Clear</span></div>
          <div className="itin-content" style={{ padding: '0 20px 20px', margin: 0 }}>
            {narrative.length > 0 && <div className="route-narrative" style={{ marginTop: 12 }}>{narrative.map((l, i) => <div key={i} className="narrative-line" dangerouslySetInnerHTML={{ __html: l }} />)}</div>}
            <div className="itin-stops" style={{ marginTop: 12 }}>{itinerary.map((stop, i) => (
              <div key={stop.google_place_id} className="itin-stop-card" style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: '#F8F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{stop.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2416', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop.name}</div>
                    <div style={{ fontSize: 11, color: '#D4622A', fontWeight: 600 }}>
                      {stop.etas?.[0]?.text ? `🕒 Typically ${stop.etas[0].text} for you` : ''}
                    </div>
                  </div>
                  <button className="itin-remove" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9A8A78', padding: 4 }} onClick={() => removeFromItinerary(stop.google_place_id)}>×</button>
                </div>
                <div className="transport-picker" style={{ marginBottom: 4 }}>
                  {TRANSPORT_MODES.map(m => (
                    <button key={m.id} className={`transport-btn ${(stop.transport_mode || "DRIVING") === m.id ? "active" : ""}`} onClick={() => updateStopTransport(i, m.id)} style={{ fontSize: 11, padding: '4px 8px' }}>
                      {m.icon} {m.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}</div>
          </div>
          <div className="itin-actions" style={{ padding: '16px 20px', borderTop: '1.5px solid #F0E8DD', background: '#FDFCFB', borderRadius: '0 0 24px 24px' }}>
            {selectedFriends.length > 0 && <button className="itin-send-btn" style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#D4622A', color: 'white', border: 'none', fontFamily: 'DM Sans', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(212,98,42,0.2)' }} onClick={() => setShowInviteModal(true)}>📬 Email Plan to {friendNames}</button>}
          </div>
        </div>
      )}

      {/* SEND INVITE MODAL */}
      {showInviteModal && <div className="modal-overlay" onClick={() => setShowInviteModal(false)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <div className="modal-title">{suggestingInviteId ? "Send Suggestion" : `Send to ${friendNames}`}</div>
        <div className="modal-sub">{itinerary.length} stops</div>

        {/* Event Date */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B5B4E', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>
             📅 Event Date {suggestingInviteId && eventDate && <span style={{ color: '#D4622A', fontWeight: 700, fontSize: 10 }}>· KEEPING ORIGINAL</span>}
          </label>
          <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #EDE5DA', borderRadius: 10, fontFamily: 'DM Sans', fontSize: 14, color: '#2C2416', boxSizing: 'border-box', background: '#FAFAFA' }} />
        </div>

        {/* Schedule Section */}
        {/* Schedule Section */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#6B5B4E', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}>🕐 Day Schedule</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <button 
              onClick={() => setIs24h(false)} 
              style={{ fontSize: 10, border: '1px solid #EDE5DA', background: !is24h ? '#2C2416' : 'white', color: !is24h ? 'white' : '#2C2416', padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
            >12H</button>
            <button 
              onClick={() => setIs24h(true)} 
              style={{ fontSize: 10, border: '1px solid #EDE5DA', background: is24h ? '#2C2416' : 'white', color: is24h ? 'white' : '#2C2416', padding: '2px 6px', borderRadius: 4, cursor: 'pointer' }}
            >24H</button>
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
             <span style={{ fontSize: 11, color: '#9A8A78' }}>🌐 Time Zone:</span>
             <select 
               value={timezone} 
               onChange={e => setTimezone(e.target.value)}
               style={{ border: 'none', background: 'transparent', fontSize: 11, color: '#2C2416', fontWeight: 600, outline: 'none', cursor: 'pointer' }}
             >
                <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>Local ({Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
                <option value="America/New_York">New York (EST/EDT)</option>
                <option value="America/Chicago">Chicago (CST/CDT)</option>
                <option value="America/Denver">Denver (MST/MDT)</option>
                <option value="America/Los_Angeles">Los Angeles (PST/PDT)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
             </select>
          </div>
        </div>
        <div className="modal-spots" style={{maxHeight: 300, overflowY: 'auto', marginBottom: 16}}>
          {itinerary.map((s, idx) => (
            <div key={s.google_place_id} className="modal-spot selected" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{s.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div className="modal-spot-name" style={{ fontSize: 13, fontWeight: 600 }}>Stop {idx + 1}: {s.name}</div>
                  <div style={{ fontSize: 11, color: '#9A8A78' }}>{s.etas?.[0]?.text ? `ETA: ${s.etas[0].text}` : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label style={{ fontSize: 10, color: '#9A8A78', fontWeight: 600 }}>
                    Start {suggestingInviteId && stopSchedules[idx]?.start && stopSchedules[idx]?.start === draftOriginalItinerary?.[idx]?.start_time && <span style={{color: '#D4622A', fontSize: 9}}>· ORIGINAL</span>}
                  </label>
                  <input type="time" value={stopSchedules[idx]?.start || ''} onChange={e => setStopSchedules(prev => ({ ...prev, [idx]: { ...prev[idx], start: e.target.value } }))} style={{ padding: '6px 8px', border: '1px solid #EDE5DA', borderRadius: 6, fontFamily: 'DM Sans', fontSize: 12, color: '#2C2416', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <label style={{ fontSize: 10, color: '#9A8A78', fontWeight: 600 }}>
                    End {suggestingInviteId && stopSchedules[idx]?.end && stopSchedules[idx]?.end === draftOriginalItinerary?.[idx]?.end_time && <span style={{color: '#D4622A', fontSize: 9}}>· ORIGINAL</span>}
                  </label>
                  <input type="time" value={stopSchedules[idx]?.end || ''} onChange={e => setStopSchedules(prev => ({ ...prev, [idx]: { ...prev[idx], end: e.target.value } }))} style={{ padding: '6px 8px', border: '1px solid #EDE5DA', borderRadius: 6, fontFamily: 'DM Sans', fontSize: 12, color: '#2C2416', boxSizing: 'border-box' }} />
                </div>
              </div>
              {/* Visual feedback for format */}
              <div style={{ fontSize: 10, color: '#9A8A78', textAlign: 'right' }}>
                {stopSchedules[idx]?.start && stopSchedules[idx]?.end && (
                  <span>
                    Preview: {(() => {
                      const format = (t) => {
                        if (!t) return "";
                        const [h, m] = t.split(":");
                        if (is24h) return t;
                        const hr = parseInt(h);
                        const ampm = hr >= 12 ? "pm" : "am";
                        const displayHr = hr % 12 || 12;
                        return `${displayHr}:${m}${ampm}`;
                      };
                      return `${format(stopSchedules[idx].start)} - ${format(stopSchedules[idx].end)}`;
                    })()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {suggestingInviteId && (
          <div style={{marginBottom: 14}}>
            <textarea 
              placeholder="Add a comment... (e.g., 'Instead of the cookie shop, how about this cake shop?')"
              value={suggestMessage}
              onChange={e => setSuggestMessage(e.target.value)}
              style={{width: '100%', height: 75, padding: 12, borderRadius: 10, border: '1.5px solid #EDE5DA', fontFamily: 'DM Sans', fontSize: 13, resize: 'none', boxSizing: 'border-box'}}
            />
          </div>
        )}

        {/* Guest list privacy toggle - only show for multi-person invites */}
        {selectedFriends.length > 1 && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F8F3EE', borderRadius: 12, border: '1px solid #EDE5DA' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2416', marginBottom: 2 }}>
                  {showGuestList ? '👁️ Guest list visible' : '🔒 Guest list hidden'}
                </div>
                <div style={{ fontSize: 11, color: '#9A8A78', lineHeight: 1.4 }}>
                  {showGuestList 
                    ? 'Your friends can see who else is invited' 
                    : 'Your friends won\'t see other invitees'}
                </div>
              </div>
              <button
                onClick={() => setShowGuestList(!showGuestList)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none',
                  background: showGuestList ? '#D4622A' : '#D4B8A8',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                  flexShrink: 0,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: 'white',
                  position: 'absolute', top: 3,
                  left: showGuestList ? 23 : 3,
                  transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }} />
              </button>
            </div>
          </div>
        )}

        <button className="modal-confirm" onClick={saveAndSendInvite}>{suggestingInviteId ? "📬 Reply with Suggestion →" : "📬 Send Invite →"}</button>
      </div></div>}

      {/* SMS MODAL */}
      {showShareModal && <div className="modal-overlay" onClick={() => setShowShareModal(false)}><div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Share via Text</div><div className="modal-sub">Send your itinerary as a text message</div>
        <div style={{ marginBottom: 16 }}><div className="auth-field"><label>Phone Number</label><input type="tel" value={sharePhone} onChange={e => setSharePhone(e.target.value)} placeholder="+1 (555) 123-4567" style={{ padding: "10px 14px", border: "1.5px solid #EDE5DA", borderRadius: 10, fontFamily: "DM Sans", fontSize: 15, width: "100%", boxSizing: "border-box" }} /></div></div>
        <button className="modal-confirm" onClick={sendViaSMS} disabled={!sharePhone}>📱 Send Text →</button>
      </div></div>}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div className="modal-title">Profile Settings</div>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#9A8A78', padding: 0 }}>×</button>
            </div>
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#9A8A78', marginBottom: 4, display: 'block' }}>
                    Username {user.username_last_changed_at && Math.ceil((new Date() - new Date(user.username_last_changed_at)) / (1000 * 60 * 60 * 24)) < 30 && <span style={{fontWeight: 400, fontSize: 10}}>(Locked for {30 - Math.ceil((new Date() - new Date(user.username_last_changed_at)) / (1000 * 60 * 60 * 24))} more days)</span>}
                  </label>
                  <input 
                    type="text" 
                    className="modal-input" 
                    placeholder="Unique username" 
                    value={settingsData.username} 
                    onChange={e => setSettingsData(p => ({ ...p, username: e.target.value }))} 
                    disabled={user.username_last_changed_at && Math.ceil((new Date() - new Date(user.username_last_changed_at)) / (1000 * 60 * 60 * 24)) < 30}
                    style={{ 
                      width: '100%', 
                      padding: 12, 
                      border: '1.5px solid #EDE5DA', 
                      borderRadius: 10, 
                      fontSize: 14,
                      background: (user.username_last_changed_at && Math.ceil((new Date() - new Date(user.username_last_changed_at)) / (1000 * 60 * 60 * 24)) < 30) ? '#F5F5F5' : '#FAFAFA',
                      color: (user.username_last_changed_at && Math.ceil((new Date() - new Date(user.username_last_changed_at)) / (1000 * 60 * 60 * 24)) < 30) ? '#9A8A78' : '#2C2416',
                      cursor: (user.username_last_changed_at && Math.ceil((new Date() - new Date(user.username_last_changed_at)) / (1000 * 60 * 60 * 24)) < 30) ? 'not-allowed' : 'text'
                    }} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#9A8A78', marginBottom: 4, display: 'block' }}>Display Name</label>
                  <input type="text" className="modal-input" placeholder="Your name (visible to friends)" value={settingsData.name} onChange={e => setSettingsData(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', padding: 12, border: '1.5px solid #EDE5DA', borderRadius: 10, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#9A8A78', marginBottom: 4, display: 'block' }}>Email Address</label>
                  <input type="email" className="modal-input" placeholder="Email" value={settingsData.email} disabled style={{ width: '100%', padding: 12, border: '1.5px solid #EDE5DA', borderRadius: 10, fontSize: 14, background: '#F5F5F5', color: '#9A8A78', cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#9A8A78', marginBottom: 4, display: 'block' }}>Default Location</label>
                  <div style={{ position: 'relative' }}>
                    <PlaceAutocompleteInput className="modal-input" value={settingsData.location} onChange={v => setSettingsData(p => ({ ...p, location: v }))} placeholder="City or specific address" style={{ width: '100%', padding: 12, border: '1.5px solid #EDE5DA', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ fontSize: 11, color: '#9A8A78', marginTop: 6, lineHeight: 1.4 }}>
                    We'll automatically use this location when your friends invite you to a hangout. You won't have to enter it manually every time.
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 24, padding: 16, background: '#F8F3EE', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="user-avatar" style={{ background: settingsData.profile_picture ? 'transparent' : user.color, backgroundImage: settingsData.profile_picture ? `url(${settingsData.profile_picture})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', width: 48, height: 48, fontSize: 20, minWidth: 48, cursor: 'pointer', border: settingsData.profile_picture ? '1.5px solid #EDE5DA' : 'none' }} onClick={() => document.getElementById('profile-pic-upload').click()}>
                  {!settingsData.profile_picture && user.avatar_letter}
                </div>
                <input type="file" id="profile-pic-upload" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePicUpload} />
                <div>
                  <div style={{ fontWeight: 600, color: '#2C2416' }}>Profile Picture</div>
                  <div style={{ fontSize: 12, color: '#9A8A78' }}>Click your avatar to upload a custom picture.</div>
                </div>
              </div>

              <button className="modal-confirm" onClick={handleSaveSettings} disabled={settingsLoading} style={{ marginTop: 24 }}>
                {settingsLoading ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CROP MODAL */}
      {cropModalSrc && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal" style={{ width: 400, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1.5px solid #EDE5DA' }}>
              <div className="modal-title" style={{ margin: 0 }}>Crop Profile Picture</div>
              <button onClick={() => setCropModalSrc(null)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#9A8A78', padding: 0 }}>×</button>
            </div>
            <div style={{ position: 'relative', width: '100%', height: 300, background: '#333' }}>
              <Cropper
                image={cropModalSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                onCropChange={setCrop}
                onCropComplete={(c, p) => setCroppedAreaPixels(p)}
                onZoomChange={setZoom}
              />
            </div>
            <div style={{ padding: 20 }}>
              <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '100%', marginBottom: 20 }} />
              <button className="modal-confirm" onClick={applyCrop}>Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* REMOVE FRIEND CONFIRM MODAL */}
      {showRemoveFriendConfirm && (
        <div className="modal-overlay" onClick={() => setShowRemoveFriendConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: '32px 24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🚮</div>
              <div className="modal-title" style={{ marginBottom: 8 }}>Remove {showRemoveFriendConfirm.name}?</div>
              <div className="modal-sub" style={{ marginBottom: 32 }}>Are you sure you want to remove this friend? You won't be able to plan hangouts together unless you re-add them.</div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  className="auth-btn-secondary" 
                  onClick={() => setShowRemoveFriendConfirm(null)}
                  style={{ flex: 1, padding: '14px', fontSize: 15, fontWeight: 600 }}
                >
                  Keep Friend
                </button>
                <button 
                  className="modal-confirm" 
                  style={{ flex: 1, margin: 0, padding: '14px', fontSize: 15, fontWeight: 600, background: '#C0392B' }}
                  onClick={() => {
                    handleRemoveFriend(showRemoveFriendConfirm.id);
                    setShowRemoveFriendConfirm(null);
                  }}
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGOUT CONFIRM MODAL */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: '32px 24px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>👋</div>
              <div className="modal-title" style={{ marginBottom: 8 }}>Logging out?</div>
              <div className="modal-sub" style={{ marginBottom: 32 }}>Are you sure you want to end your current session? You'll need to sign back in to access your plans.</div>
              
              <div style={{ display: 'flex', gap: 12 }}>
                <button 
                  className="auth-btn-secondary" 
                  onClick={() => setShowLogoutConfirm(false)}
                  style={{ flex: 1, padding: '14px', fontSize: 15, fontWeight: 600 }}
                >
                  Stay Logged In
                </button>
                <button 
                  className="modal-confirm" 
                  onClick={() => { setShowLogoutConfirm(false); logout(); }}
                  style={{ flex: 1, margin: 0, padding: '14px', fontSize: 15, fontWeight: 600 }}
                >
                  Yes, Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DIRECTIONS DIALOG - Bug #8: Better multiple routes UI, fix "calculating route" text, Bug #10: correct origin */}
      {showDirectionsFor && (
        <div className="modal-overlay" onClick={() => { setShowDirectionsFor(null); setDirectionRoutes([]); setDirectionsLoaded(false); setSelectedRouteIndex(0); }} style={{ zIndex: 9999 }}>
          <div className="modal" key={showDirectionsFor.inv.id + "_" + showDirectionsFor.stopIdx} onClick={e => e.stopPropagation()} style={{ padding: 0, width: '100%', maxWidth: 450, borderRadius: '24px 24px 0 0', overflow: 'hidden', height: 'calc(100vh - 60px)', maxHeight: 950, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: 16, borderBottom: '1.5px solid #EDE5DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ fontWeight: 700, color: '#2C2416' }}>🛣️ Trip Directions</div>
              <button onClick={() => { setShowDirectionsFor(null); setDirectionRoutes([]); setDirectionsLoaded(false); setSelectedRouteIndex(0); }} style={{ background: 'none', border: 'none', fontSize: 24, padding: 4, cursor: 'pointer', color: '#9A8A78' }}>×</button>
            </div>
            
            {/* Bug #8: Show route comparison BEFORE the map when multiple routes */}
            {directionRoutes.length > 1 && (
              <div style={{ padding: '14px 20px', borderBottom: '1.5px solid #EDE5DA', background: 'linear-gradient(135deg, #FFF4EF, #FFF9F5)', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#D4622A', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 18 }}>📊</span> {directionRoutes.length} routes available — Compare times:
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {directionRoutes.map((r, i) => (
                    <div 
                      key={i} 
                      onClick={() => setSelectedRouteIndex(i)}
                      style={{ flex: 1, background: i === selectedRouteIndex ? '#2C2416' : 'white', color: i === selectedRouteIndex ? 'white' : '#2C2416', borderRadius: 12, padding: '10px 12px', border: i === selectedRouteIndex ? '2px solid #2C2416' : '2.5px solid #EDE5DA', textAlign: 'center', transition: 'all 0.2s', cursor: 'pointer' }}
                    >
                      <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{i === 0 ? '⭐ Fastest' : `Route ${i + 1}`}</div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{r.duration}</div>
                      <div style={{ fontSize: 10, opacity: 0.7 }}>{r.distance}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ height: 300, position: 'relative', flexShrink: 0 }}>
              <DirectionsMap 
                origin={showDirectionsFor.stopIdx === 0 
                  ? (showDirectionsFor.inv.it_friend_id === user.id ? (showDirectionsFor.inv.friend_location || showDirectionsFor.inv.sender_location || user?.location) : (showDirectionsFor.inv.user_location || user?.location))
                  : { lat: showDirectionsFor.inv.stops[showDirectionsFor.stopIdx - 1].lat, lng: showDirectionsFor.inv.stops[showDirectionsFor.stopIdx - 1].lng }
                } 
                destination={{ lat: showDirectionsFor.inv.stops[showDirectionsFor.stopIdx].lat, lng: showDirectionsFor.inv.stops[showDirectionsFor.stopIdx].lng }} 
                mode={showDirectionsFor.inv.stops[showDirectionsFor.stopIdx].transport_mode}
                onRoutesFound={(routes) => { setDirectionRoutes(routes); setDirectionsLoaded(true); }}
                selectedRouteIndex={selectedRouteIndex}
              />
            </div>
            
            <div style={{ padding: 20, flex: 1, overflowY: 'auto', background: '#FAFAFA' }}>
                <div className="modal-title" style={{ fontSize: 18, marginBottom: 4 }}>{showDirectionsFor.inv.stops[showDirectionsFor.stopIdx].spot_name}</div>
                <div className="modal-sub" style={{ marginBottom: 4 }}>📍 {showDirectionsFor.inv.stops[showDirectionsFor.stopIdx].address}</div>
                {showDirectionsFor.stopIdx > 0 && (
                   <div style={{ fontSize: 11, color: '#D4622A', fontWeight: 600, marginBottom: 12 }}>
                     🚕 Directions from previous stop ({showDirectionsFor.inv.stops[showDirectionsFor.stopIdx - 1].spot_name})
                   </div>
                )}
                {/* Bug #8: Show loading state only before directions load, remove "Calculating route..." once loaded */}
                {!directionsLoaded && (
                  <div style={{ textAlign: 'center', padding: '20px 0', color: '#9A8A78', fontSize: 13 }}>
                    <div className="loading-bar" style={{ width: 200, margin: '0 auto 8px' }}><div className="loading-fill" /></div>
                    Loading directions...
                  </div>
                )}
                <div id="directions-panel" style={{ fontSize: 13, color: '#2C2416' }}></div>
            </div>
            
            <div style={{ padding: 16, background: 'white', flexShrink: 0, borderTop: '1.5px solid #EDE5DA' }}>
              <button className="modal-confirm" onClick={() => {
                const stops = showDirectionsFor.inv.stops;
                const idx = showDirectionsFor.stopIdx;
                const s = stops[idx];
                
                // Bug #10: For idx > 0, use previous stop as origin
                let myStart;
                if (idx === 0) {
                   myStart = showDirectionsFor.inv.it_friend_id === user.id ? (showDirectionsFor.inv.friend_location || showDirectionsFor.inv.sender_location || user?.location) : (showDirectionsFor.inv.user_location || user?.location);
                } else {
                   const prev = stops[idx-1];
                   myStart = prev.address || `${prev.lat},${prev.lng}`;
                }

                const dest = s.address || `${s.lat},${s.lng}`;
                window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(myStart)}&destination=${encodeURIComponent(dest)}&travelmode=${(s.transport_mode || 'DRIVING').toLowerCase()}`, '_blank');
              }} style={{ margin: 0 }}>
                📱 Open in Google Maps
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPLORE MODAL -> SIDE PANEL */}
      {showExploreModal && (
        <div className="explore-side-panel">
            <div style={{ padding: '16px 20px', borderBottom: '1.5px solid #EDE5DA', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAF6F1' }}>
               <div>
                 <div className="modal-title" style={{ fontSize: 18, marginBottom: 2 }}>Nearby {showExploreModal.name}</div>
                 <div style={{ fontSize: 12, color: '#9A8A78' }}>Add more stops to your trip</div>
               </div>
               <button onClick={() => setShowExploreModal(null)} style={{ background: 'white', border: '1.5px solid #EDE5DA', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9A8A78', fontSize: 24 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
               <MapExplorer 
                 isLoaded={isLoaded} 
                 coords={allCoords} 
                 midpoint={{ lat: showExploreModal.lat, lng: showExploreModal.lng }} 
                 peopleLabels={peopleLabels} 
                 itinerary={itinerary} 
                 onAddToItinerary={(spot, etaData) => {
                   addToItinerary(spot, etaData);
                   // Keep the panel open so they can add more!
                   showToast(`Added ${spot.name}!`);
                 }} 
                 onRemoveFromItinerary={removeFromItinerary} 
               />
            </div>
        </div>
      )}

    </div></>
  );
}

const styles = `
${FONTS}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', sans-serif; background: #FAF6F1; color: #2C2416; }
.app { max-width: 1000px; margin: 0 auto; min-height: 100vh; background: #FAF6F1; position: relative; overflow-x: hidden; transition: margin 0.3s, max-width 0.3s; }
.narrow-container { max-width: 500px; margin: 0 auto; padding: 0 40px; box-sizing: border-box; transition: padding 0.3s; }

@media (min-width: 1350px) {
  .app { max-width: 1000px; margin: 0 auto; }
}
@media (max-width: 1350px) and (min-width: 820px) {
  .app { max-width: 1000px; margin: 0 auto; }
  .narrow-container { padding: 0 20px; }
}
@media (max-width: 820px) {
  .app { max-width: 430px; margin: 0 auto; }
  .narrow-container { padding: 0 20px; margin: 0 auto; max-width: 100%; }
}

/* Auth */
.auth-page { min-height: 100vh; background: linear-gradient(160deg, #FAF6F1 0%, #F0E8DD 50%, #E8DFD2 100%); display: flex; align-items: center; justify-content: center; padding: 20px; }
.auth-card { background: white; border-radius: 24px; padding: 32px 24px; width: 100%; max-width: 400px; border: 1.5px solid #EDE5DA; box-shadow: 0 8px 40px rgba(0,0,0,0.06); }
.auth-logo { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: #2C2416; text-align: center; margin-bottom: 4px; }
.auth-logo span { color: #D4622A; }
.auth-tagline { text-align: center; font-size: 12px; color: #9A8A78; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 28px; }
.auth-form { display: flex; flex-direction: column; gap: 4px; }
.auth-title { font-family: 'Playfair Display', serif; font-size: 22px; font-weight: 700; color: #2C2416; margin-bottom: 2px; }
.auth-sub { font-size: 14px; color: #9A8A78; margin-bottom: 16px; }
.auth-field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
.auth-field label { font-size: 12px; font-weight: 600; color: #6B5B4E; text-transform: uppercase; letter-spacing: 0.5px; }
.auth-field .optional { text-transform: none; font-weight: 400; color: #9A8A78; letter-spacing: 0; }
.auth-field input { padding: 12px 14px; border: 1.5px solid #EDE5DA; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 15px; color: #2C2416; outline: none; transition: border-color 0.2s; background: #FAFAFA; }
.auth-field input:focus { border-color: #D4622A; background: white; }
.auth-btn { padding: 14px; background: #D4622A; color: white; border: none; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 8px; }
.auth-btn:hover { background: #C0541F; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(212,98,42,0.3); }
.auth-btn:disabled { background: #D4B8A8; cursor: not-allowed; transform: none; box-shadow: none; }
.auth-btn-secondary { flex: 1; padding: 10px; background: white; color: #6B5B4E; border: 1.5px solid #EDE5DA; border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; }
.auth-error { background: #FBE9E7; color: #C0392B; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; }
.auth-success { background: #E8F5E9; color: #3D8B4B; padding: 10px 14px; border-radius: 10px; font-size: 13px; margin-bottom: 12px; }
.auth-switch { text-align: center; margin-top: 20px; font-size: 14px; color: #9A8A78; }
.auth-link { background: none; border: none; color: #D4622A; font-weight: 600; cursor: pointer; font-size: 14px; font-family: 'DM Sans', sans-serif; }

/* Header */
.header { padding: 20px 20px 0; }
.logo { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #2C2416; }
.logo span { color: #D4622A; }
.tagline { font-size: 12px; color: #9A8A78; letter-spacing: 0.5px; text-transform: uppercase; }
.user-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; }
.logout-btn { background: none; border: 1.5px solid #EDE5DA; border-radius: 8px; padding: 4px 8px; cursor: pointer; color: #9A8A78; font-size: 14px; }

/* Nav */
.nav { display: flex; gap: 4px; padding: 16px 20px 0; border-bottom: 1px solid #EDE5DA; }
.nav-btn { flex: 1; padding: 10px 4px; background: none; border: none; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; color: #9A8A78; cursor: pointer; text-align: center; border-bottom: 2px solid transparent; transition: all 0.2s; text-transform: uppercase; letter-spacing: 0.3px; }
.nav-btn.active { color: #D4622A; border-bottom-color: #D4622A; }
.nav-icon { font-size: 16px; display: block; margin-bottom: 2px; }
.badge-dot { margin-left: 4px; background: #D4622A; color: white; border-radius: 100px; font-size: 10px; padding: 1px 5px; font-weight: 700; }
.content { padding: 20px; }

/* Shared */
.section-label { font-size: 13px; color: #9A8A78; margin-bottom: 8px; }
.section-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; margin-bottom: 4px; }
.section-sub { font-size: 13px; color: #9A8A78; margin-bottom: 20px; }
.muted-text { font-size: 13px; color: #9A8A78; font-style: italic; }
.status-msg { font-size: 13px; font-weight: 600; text-align: center; padding: 8px 0 0; }
.status-msg.green { color: #3D8B4B; }
.empty { text-align: center; padding: 40px 20px; }
.empty-emoji { font-size: 40px; margin-bottom: 12px; }
.empty-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 600; margin-bottom: 6px; }
.empty-sub { font-size: 13px; color: #9A8A78; line-height: 1.5; }

/* Friends chips */
.friend-selector { display: flex; gap: 8px; flex-wrap: wrap; }
.friend-chip { display: flex; align-items: center; gap: 6px; padding: 6px 12px 6px 8px; border-radius: 100px; border: 1.5px solid #EDE5DA; background: white; cursor: pointer; transition: all 0.2s; font-size: 13px; font-weight: 500; color: #2C2416; font-family: 'DM Sans', sans-serif; }
.friend-chip.active { border-color: #D4622A; background: #FFF4EF; }
.friend-avatar { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; }

/* Location */
.location-section { margin-bottom: 16px; }
.location-card { background: white; border-radius: 16px; padding: 16px; border: 1.5px solid #EDE5DA; box-shadow: 0 2px 12px rgba(0,0,0,0.04); }
.loc-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #EDE5DA; }
.loc-row:last-child { border-bottom: none; }
.loc-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.loc-dot.you { background: #D4622A; }
.loc-dot.friend { background: #6B8F71; }
.loc-label { font-size: 11px; color: #9A8A78; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; width: 60px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.loc-input { flex: 1; border: none; background: transparent; font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 500; color: #2C2416; outline: none; min-width: 0; }
.loc-input::placeholder { color: #C4B8AC; }
.search-btn { width: 100%; padding: 14px; background: #D4622A; color: white; border: none; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: 12px; }
.search-btn:hover { background: #C0541F; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(212,98,42,0.3); }
.search-btn:disabled { background: #D4B8A8; cursor: not-allowed; transform: none; box-shadow: none; }
.loading-bar { height: 3px; background: #EDE5DA; border-radius: 100px; margin-top: 16px; overflow: hidden; }
.loading-fill { height: 100%; background: linear-gradient(90deg, #D4622A, #E8A87C); border-radius: 100px; animation: loadAnim 1.6s ease-in-out infinite; }
@keyframes loadAnim { 0%{width:0%;margin-left:0}50%{width:60%;margin-left:20%}100%{width:0%;margin-left:100%} }

/* Map */
.map-explorer { margin-bottom: 16px; }
.map-container { height: 350px; border-radius: 16px; overflow: hidden; border: 1.5px solid #EDE5DA; margin-bottom: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.map-loading { height: 250px; display: flex; align-items: center; justify-content: center; background: #EDF2EC; border-radius: 16px; color: #9A8A78; }
.map-categories { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.map-cat-btn { padding: 6px 12px; border-radius: 100px; border: 1.5px solid #EDE5DA; background: white; font-size: 12px; font-weight: 500; color: #6B5B4E; cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
.map-cat-btn.active { background: #2C2416; color: white; border-color: #2C2416; }
.explore-back-btn { padding: 8px 14px; border-radius: 8px; border: 1.5px solid #D4622A; background: #FFF4EF; color: #D4622A; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 12px; }
.map-spots-count { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.map-spots-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.transport-btn { padding: 4px 8px; border-radius: 6px; border: 1px solid #EDE5DA; background: white; cursor: pointer; font-size: 12px; transition: all 0.15s; font-family: 'DM Sans', sans-serif; }
.transport-btn.active { background: #2C2416; color: white; border-color: #2C2416; }
.map-info-btn { flex: 1; padding: 8px; border-radius: 8px; border: 1.5px solid #D4622A; background: transparent; color: #D4622A; font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600; cursor: pointer; }
.map-info-btn:hover { background: #D4622A; color: white; }
.map-info-btn.added { background: #6B8F71; border-color: #6B8F71; color: white; }
.map-info-btn.explore { border-color: #6B8F71; color: #6B8F71; }

/* Spots */
.spot-card { background: white; border-radius: 16px; padding: 16px; border: 1.5px solid #EDE5DA; transition: all 0.2s; cursor: pointer; display: flex; flex-direction: column; height: 100%; box-sizing: border-box; }
.spot-card:hover { border-color: #D4622A; box-shadow: 0 4px 20px rgba(212,98,42,0.1); }
.spot-card.in-itinerary { border-color: #6B8F71; background: #F6FBF7; }
.spot-top { display: flex; align-items: flex-start; gap: 10px; }
.spot-emoji { font-size: 28px; }
.spot-info { flex: 1; }
.spot-name { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 600; margin-bottom: 3px; }
.spot-meta { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 4px; }
.spot-rating { font-size: 12px; font-weight: 500; }
.spot-price { font-size: 12px; color: #9A8A78; }
.spot-address { font-size: 12px; color: #9A8A78; margin-bottom: 8px; }
.spot-photo { border-radius: 10px; overflow: hidden; margin: 8px 0; aspect-ratio: 16/9; width: 100%; flex-shrink: 0; }
.spot-photo img { width: 100%; height: 100%; object-fit: cover; }
.add-btn { width: 100%; padding: 10px; border-radius: 10px; border: 1.5px solid #D4622A; background: transparent; color: #D4622A; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; margin-top: auto; }
.add-btn:hover { background: #D4622A; color: white; }
.add-btn.added { background: #6B8F71; border-color: #6B8F71; color: white; }

/* Itinerary */
.itin-bar { position: fixed; bottom: 20px; left: max(20px, calc(50% - 250px - 440px)); width: 420px; background: white; border: 2.5px solid #D4622A; z-index: 100; box-shadow: 0 12px 60px rgba(0,0,0,0.15); max-height: calc(100vh - 40px); border-radius: 24px; transition: all 0.3s; display: flex; flex-direction: column; overflow: hidden; }
.itin-content { overflow-y: auto; flex: 1; scrollbar-width: none; }
.itin-content::-webkit-scrollbar { width: 0; display: none; }
@media (max-width: 1350px) {
  .itin-bar { left: 20px; width: 340px; }
}
@media (max-width: 820px) {
  .itin-bar { left: 50%; bottom: 0; transform: translateX(-50%); max-height: 75vh; border-radius: 20px 20px 0 0; width: 100%; max-width: 430px; }
}
.itin-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #F0E8DD; padding-bottom: 8px; }
.itin-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 700; color: #2C2416; }
.itin-toggle { font-size: 13px; color: #D4622A; font-weight: 600; cursor: pointer; background: #FFF4EF; padding: 4px 10px; border-radius: 8px; }
.route-narrative { background: linear-gradient(135deg, #FFF4EF, #FFF9F5); border: 1.5px solid #F5C4A4; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
.narrative-line { font-size: 13px; color: #6B5B4E; line-height: 1.6; margin-bottom: 4px; border-left: 2px solid #F5C4A4; padding-left: 10px; }
.narrative-line strong { color: #2C2416; }
.itin-stops { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
.itin-stop-card { background: #F8F3EE; border-radius: 10px; padding: 10px 12px; }
.itin-remove { background: none; border: none; cursor: pointer; color: #9A8A78; font-size: 18px; }
.transport-picker { display: flex; gap: 4px; }
.itin-actions { display: flex; gap: 8px; }
.itin-opt-btn { flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid #EDE5DA; background: white; font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600; cursor: pointer; color: #2C2416; }
.itin-send-btn { flex: 1; padding: 10px; border-radius: 10px; background: #D4622A; color: white; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; }

/* Friends tab */
.add-friend-card { background: white; border-radius: 16px; padding: 16px; border: 1.5px solid #EDE5DA; margin-bottom: 16px; }
.friend-section-label { font-size: 12px; font-weight: 600; color: #9A8A78; text-transform: uppercase; letter-spacing: 0.5px; margin: 16px 0 8px; }
.friend-card { display: flex; align-items: center; justify-content: space-between; background: white; border-radius: 14px; padding: 12px 14px; border: 1.5px solid #EDE5DA; margin-bottom: 10px; }
.friend-card-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
.friend-card-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: white; flex-shrink: 0; }
.friend-card-info { flex: 1; min-width: 0; }
.friend-card-name { font-weight: 600; font-size: 15px; color: #2C2416; }
.friend-card-sub { font-size: 12px; color: #9A8A78; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.friend-card-actions { display: flex; gap: 6px; flex-shrink: 0; }
.fc-accept { width: 36px; height: 36px; border-radius: 10px; border: none; background: #2C2416; color: white; cursor: pointer; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.fc-decline { width: 36px; height: 36px; border-radius: 10px; border: 1.5px solid #F5C4BA; background: white; color: #C0392B; cursor: pointer; font-size: 16px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.fc-remove { padding: 6px 12px; border-radius: 8px; border: 1.5px solid #EDE5DA; background: white; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500; cursor: pointer; color: #9A8A78; flex-shrink: 0; }
.fc-remove:hover { border-color: #C0392B; color: #C0392B; }

/* Side Panel - Bug #3: Made bigger for better usability */
.explore-side-panel { position: fixed; top: 20px; right: max(20px, calc(50% - 250px - 520px)); left: auto; width: 520px; background: white; border-radius: 24px; border: 1.5px solid #EDE5DA; box-shadow: 0 12px 60px rgba(0,0,0,0.15); z-index: 1000; display: flex; flex-direction: column; overflow: hidden; height: calc(100vh - 40px); transition: all 0.3s; scrollbar-width: none; }
.explore-side-panel::-webkit-scrollbar { width: 0; display: none; }
@media (max-width: 1350px) {
  .explore-side-panel { right: 20px; width: 440px; }
}
@media (max-width: 820px) {
  .explore-side-panel { left: 2.5%; right: auto; width: 95%; top: 2.5%; height: 95%; }
}

/* Invite link */
.invite-link-section { margin-top: 14px; padding-top: 14px; border-top: 1px dashed #EDE5DA; }
.invite-link-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
.invite-link-sub { font-size: 13px; color: #9A8A78; margin-bottom: 8px; }
.invite-link-box { display: flex; align-items: center; gap: 8px; background: #F8F3EE; border-radius: 8px; padding: 8px 12px; }
.invite-link-box span { font-size: 12px; color: #2C2416; flex: 1; word-break: break-all; }
.invite-link-box button { padding: 4px 10px; border-radius: 6px; border: 1px solid #D4622A; background: white; color: #D4622A; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: 'DM Sans', sans-serif; }
.invite-link-qr { text-align: center; margin-top: 12px; }

/* Invite cards */
.invite-card { background: white; border-radius: 16px; padding: 16px; border: 1.5px solid #EDE5DA; margin-bottom: 14px; transition: all 0.2s; }
.invite-card.accepted { border-color: #6B8F71; background: #F6FBF7; }
.invite-card.completed { border-color: #B0BEC5; background: #F5F5F5; opacity: 0.85; }
.invite-top { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.invite-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 700; color: white; flex-shrink: 0; }
.invite-who { flex: 1; min-width: 0; }
.invite-name { font-weight: 600; font-size: 15px; }
.invite-date { font-size: 12px; color: #9A8A78; }
.invite-status { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 100px; flex-shrink: 0; }
.invite-status.pending { background: #FFF3E0; color: #E07C2A; }
.invite-status.accepted { background: #E8F5E9; color: #3D8B4B; }
.invite-status.declined { background: #FBE9E7; color: #C0392B; }
.invite-status.counter { background: #FFF4EF; color: #D4622A; }
.invite-status.completed { background: #ECEFF1; color: #607D8B; }
.invite-message { font-size: 13px; color: #6B5B4E; font-style: italic; margin-bottom: 12px; padding: 10px 12px; background: #F8F3EE; border-radius: 8px; }
.invite-stops { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px; align-items: center; }
.invite-stop-chip { display: inline-flex; align-items: center; gap: 4px; background: #F3EEE8; border-radius: 8px; padding: 5px 10px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.feed-arrow { color: #C4B8AC; font-size: 12px; }
.invite-actions { display: flex; gap: 8px; }
.accept-btn { flex: 2; padding: 10px; border-radius: 10px; background: #2C2416; color: white; border: none; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; }
.decline-btn { padding: 10px 14px; border-radius: 10px; border: 1.5px solid #F5C4BA; background: white; font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; color: #C0392B; }

/* Modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(44,36,22,0.4); z-index: 200; display: flex; align-items: flex-end; justify-content: center; }
.modal { background: white; width: 100%; max-width: 430px; border-radius: 24px 24px 0 0; padding: 24px 20px 36px; animation: slideUp 0.3s ease; }
@keyframes slideUp { from{transform:translateY(100%)}to{transform:translateY(0)} }
@keyframes scaleIn { from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)} }
.modal-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 700; margin-bottom: 4px; }
.modal-sub { font-size: 13px; color: #9A8A78; margin-bottom: 20px; }
.modal-spots { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.modal-spot { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 12px; border: 1.5px solid #EDE5DA; }
.modal-spot.selected { border-color: #D4622A; background: #FFF4EF; }
.modal-spot-name { flex: 1; font-size: 13px; font-weight: 500; }
.modal-spot-eta { font-size: 12px; color: #9A8A78; }
.modal-confirm { width: 100%; padding: 14px; background: #D4622A; color: white; border: none; border-radius: 12px; font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; }
.modal-confirm:disabled { background: #D4B8A8; }

/* Toast */
.toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #2C2416; color: white; padding: 12px 20px; border-radius: 100px; font-size: 14px; font-weight: 500; z-index: 300; animation: toastIn 0.3s ease; white-space: nowrap; max-width: 90vw; overflow: hidden; text-overflow: ellipsis; }
@keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)} }

/* Autocomplete dropdown */
.autocomplete-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1.5px solid #EDE5DA; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); z-index: 1100; max-height: 240px; overflow-y: auto; margin-top: 4px; }
.autocomplete-item { padding: 10px 14px; cursor: pointer; transition: background 0.15s; }
.autocomplete-item:hover { background: #FFF4EF; }
.autocomplete-item:first-child { border-radius: 10px 10px 0 0; }
.autocomplete-item:last-child { border-radius: 0 0 10px 10px; }
.autocomplete-main { font-size: 14px; font-weight: 500; color: #2C2416; }
.autocomplete-secondary { font-size: 12px; color: #9A8A78; }

/* Selected spot detail */
.selected-spot-detail { background: white; border: 1.5px solid #EDE5DA; border-radius: 16px; padding: 16px; margin-bottom: 16px; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
.detail-close { position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 20px; cursor: pointer; color: #9A8A78; }
.detail-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
.detail-emoji { font-size: 28px; }
.detail-name { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 600; }
.detail-meta { display: flex; gap: 8px; font-size: 12px; color: #6B5B4E; }
.detail-address { font-size: 12px; color: #9A8A78; margin-bottom: 10px; }
`;
