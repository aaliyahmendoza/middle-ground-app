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
  const [selectedInviteId, setSelectedInviteId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState(new Set());
  const [stopStep, setStopStep] = useState(0);
  const [showAllStops, setShowAllStops] = useState(false);
  const [stopTimeInputs, setStopTimeInputs] = useState({});
  const [dateError, setDateError] = useState("");
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
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragSrcIdx = useRef(null);
  const exploreBeforeInvite = useRef(null);
  const [directionRoutes, setDirectionRoutes] = useState([]);
  const [directionsLoaded, setDirectionsLoaded] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showRemoveFriendConfirm, setShowRemoveFriendConfirm] = useState(null);
  const [showDirectionsFor, setShowDirectionsFor] = useState(null);
  const [settingsData, setSettingsData] = useState({ name: "", email: "", location: "", profile_picture: "" });
  const [settingsLoading, setSettingsLoading] = useState(false);

  // Cropper State
  const [cropModalSrc, setCropModalSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  function openSettings() {
    setSettingsData({ name: user.name || "", email: user.email || "", location: user.location || "", profile_picture: user.profile_picture || "" });
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

  useEffect(() => { setStopStep(0); setShowAllStops(false); }, [selectedInviteId]);

  // Close explore panel + suggestion state when user navigates away
  useEffect(() => {
    setShowExploreModal(null);
    setShowInviteModal(false);
    if (suggestingInviteId) {
      setItinerary([]);
      setSuggestingInviteId(null);
      setDraftOriginalItinerary(null);
    }
  }, [tab, inviteSubTab, selectedInviteId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        // Always include the user's profile location first so ETAs are calculated from their home
        if (yourLocation) locs.push({ label: "You", address: yourLocation });
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
      // In city mode, always center the map on the city (last coord), not the midpoint between home + city
      if (planMode === "city") {
        const cityCoord = data.coords[data.coords.length - 1];
        setMidpoint({ lat: cityCoord.lat, lng: cityCoord.lng });
      } else {
        setMidpoint(data.midpoint);
      }
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

  function removeFromItinerary(pid) {
    setItinerary(prev => {
      const next = prev.filter(s => s.google_place_id !== pid);
      const removedIdx = prev.findIndex(s => s.google_place_id === pid);
      if (removedIdx >= 0 && next.length > 0) setTimeout(() => recalculateStopETAs(next, removedIdx), 0);
      return next;
    });
  }

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

  async function recalculateStopETAs(stops, fromIdx = 0) {
    const updated = [...stops];
    const userCoord = allCoords[0] ? { lat: allCoords[0].lat, lng: allCoords[0].lng } : null;
    for (let i = fromIdx; i < updated.length; i++) {
      const stop = updated[i];
      const origin = i === 0
        ? (userCoord || yourLocation || user?.location || null)
        : { lat: updated[i - 1].lat, lng: updated[i - 1].lng };
      if (!origin) continue;
      try {
        const dir = await api.getDirections({
          origin,
          destination: { lat: stop.lat, lng: stop.lng },
          mode: (stop.transport_mode || 'DRIVING').toLowerCase(),
        });
        updated[i] = {
          ...updated[i],
          etas: [
            { label: 'You', text: dir.duration?.text || '', seconds: dir.duration?.value || 0 },
            ...(stop.etas?.slice(1) || []),
          ],
        };
      } catch { /* keep existing ETA on failure */ }
    }
    setItinerary(updated);
  }

  function reorderItinerary(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const next = [...itinerary];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setItinerary(next);
    recalculateStopETAs(next, Math.min(fromIdx, toIdx));
  }

  async function saveAndSendInvite() {
    if (selectedFriends.length === 0 || itinerary.length === 0) return;
    if (!eventDate) { setDateError("Please pick a date before sending."); return; }
    setDateError("");
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
              finalMessage = `I swapped ${removed[0]} for ${added[0]} in our plan!`;
           } else if (added.length > 0) {
              finalMessage = `I added ${added[0]} to our plan!`;
           } else if (removed.length > 0) {
              finalMessage = `I removed ${removed[0]} from our plan.`;
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
      setEventDate(""); setStopSchedules({}); setStopTimeInputs({}); setShowGuestList(true); setDateError("");
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

  async function handleDeleteInvite(id) {
    try {
      await api.deleteInvite(id);
      setInvites(prev => ({
        received: (prev.received || []).filter(inv => inv.id !== id),
        sent: (prev.sent || []).filter(inv => inv.id !== id)
      }));
      setSelectedInviteId(null);
      showToast("Invite deleted");
    } catch { showToast("Failed to delete"); }
  }

  async function handleMassDelete() {
    const ids = [...selectedForDelete];
    if (!ids.length) return;
    try {
      await Promise.all(ids.map(id => api.deleteInvite(id)));
      setInvites(prev => ({
        received: (prev.received || []).filter(inv => !ids.includes(inv.id)),
        sent: (prev.sent || []).filter(inv => !ids.includes(inv.id))
      }));
      setSelectedForDelete(new Set());
      setSelectMode(false);
      setSelectedInviteId(null);
      showToast(`Deleted ${ids.length} invite${ids.length > 1 ? 's' : ''}`);
    } catch { showToast("Failed to delete some invites"); }
  }

  async function handleSuggestChanges(inv, { silent = false, keepTab = false } = {}) {
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
    if (!keepTab) setTab("plan");
    if (!silent) showToast("Loaded original plan for editing");
    
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

  function formatRelativeDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00');
    if (isNaN(date.getTime())) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const target = new Date(date); target.setHours(0,0,0,0);
    const diff = Math.round((target - today) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff === -1) return 'Yesterday';
    if (diff > 1 && diff <= 6) return `This ${date.toLocaleDateString('en-US', { weekday: 'long' })}`;
    if (diff >= 7 && diff <= 13) return `Next ${date.toLocaleDateString('en-US', { weekday: 'long' })}, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    if (diff < 0) return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  function parseTimeRange(text) {
    if (!text.trim()) return { start: '', end: '' };
    const t = text.toLowerCase().replace(/\s+/g, '');
    const seps = ['–', '-', 'to', 'until'];
    let parts = null;
    for (const sep of seps) {
      const idx = t.lastIndexOf(sep);
      if (idx > 0) { parts = [t.slice(0, idx), t.slice(idx + sep.length)]; break; }
    }
    if (!parts) parts = [t, ''];
    const parseOne = (s) => {
      const m = s.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
      if (!m) return '';
      let h = parseInt(m[1]); const min = parseInt(m[2] || '0'); const ap = m[3];
      if (ap === 'pm' && h !== 12) h += 12;
      if (ap === 'am' && h === 12) h = 0;
      if (h > 23 || min > 59) return '';
      return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
    };
    return { start: parseOne(parts[0]), end: parseOne(parts[1]) };
  }

  function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':'); const hr = parseInt(h);
    return `${hr % 12 || 12}:${m}${hr >= 12 ? 'pm' : 'am'}`;
  }

  function renderEventDate(dateStr) {
    if (!dateStr) return null;
    const date = new Date(dateStr + 'T00:00');
    if (isNaN(date.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const isPast = date < today;
    const rel = formatRelativeDate(dateStr);
    const full = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (isPast) {
      return <span style={{ color: '#C0392B', fontWeight: 600 }}> · {full} <span style={{ fontWeight: 400, fontStyle: 'italic' }}>(date passed)</span></span>;
    }
    return <span style={{ color: '#D4622A', fontWeight: 600 }}> · {rel} <span style={{ fontWeight: 400, color: '#9A8A78' }}>({full})</span></span>;
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
    const transportEmoji = { DRIVING: '🚗', WALKING: '🚶', TRANSIT: '🚌', BICYCLING: '🚲' };
    const transportWord = { DRIVING: 'drive', WALKING: 'walk', TRANSIT: 'ride', BICYCLING: 'bike' };
    const cleanEmoji = (em) => (!em || em.includes('\uFFFD') || em.length > 5) ? '📍' : em;
    const formatTime = (t) => {
      if (!t) return '?';
      const [h, m] = t.split(':');
      const hr = parseInt(h);
      if (isNaN(hr)) return t;
      return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
    };

    const total = inv.stops.length;
    const isLastStep = stopStep === total - 1;

    // ── single-stop card ──────────────────────────────────────────
    const renderStopCard = (s, idx, compact = false) => (
      <div key={idx} style={{ border: '1.5px solid #EDE5DA', borderRadius: 16, overflow: 'hidden', background: 'white', boxShadow: compact ? 'none' : '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ height: compact ? 80 : 160, background: '#E0D8CE', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(44,36,22,0.85)', color: 'white', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, zIndex: 10 }}>
            Stop {idx + 1} of {total}
          </div>
          {(s.start_time || s.end_time) && (
            <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(212,98,42,0.92)', color: 'white', padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, zIndex: 10 }}>
              🕐 {formatTime(s.start_time)} — {formatTime(s.end_time)}
            </div>
          )}
          {s.lat && s.lng
            ? <MiniMap lat={s.lat} lng={s.lng} emoji={cleanEmoji(s.emoji)} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A8A78', fontSize: 13 }}>📍 Map unavailable</div>}
        </div>
        <div style={{ padding: compact ? '10px 14px' : '14px 16px' }}>
          <div style={{ fontWeight: 700, fontSize: compact ? 14 : 17, marginBottom: 2, color: '#2C2416' }}>{cleanEmoji(s.emoji)} {s.spot_name}</div>
          <div style={{ fontSize: 12, color: '#9A8A78', marginBottom: 10, lineHeight: 1.4 }}>📍 {s.address || 'Address unlisted'}</div>
          {(() => {
            const btnBase = { fontWeight: 700, margin: 0, borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Sans', border: 'none', padding: compact ? '7px 0' : '10px 0', fontSize: compact ? 11 : 11 };
            return (<>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <button className="itin-opt-btn" style={{ ...btnBase, flex: 1, background: '#F8F3EE' }} onClick={() => { setDirectionRoutes([]); setDirectionsLoaded(false); setShowDirectionsFor({ inv, stopIdx: idx }); }}>🛣️ Directions</button>
              <button className="itin-opt-btn" style={{ ...btnBase, flex: 1, background: '#F8F3EE' }} onClick={() => {
                let myStart = idx === 0 ? (inv.it_friend_id === user.id ? inv.friend_location : inv.user_location) : (inv.stops[idx-1].address || `${inv.stops[idx-1].lat},${inv.stops[idx-1].lng}`);
                window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(myStart)}&destination=${encodeURIComponent(s.address || `${s.lat},${s.lng}`)}&travelmode=${(s.transport_mode || 'DRIVING').toLowerCase()}`, '_blank');
              }}>📱 Open in Maps</button>
              <button className="itin-opt-btn" style={{ ...btnBase, flex: 1, background: 'linear-gradient(135deg, #F8F3EE, #FFF4EF)', color: '#D4622A', border: '1px solid #FADED3' }} onClick={() => {
                handleSuggestChanges(inv, { silent: true, keepTab: true });
                const lastStop = inv.stops[inv.stops.length - 1];
                setShowExploreModal({ lat: lastStop.lat, lng: lastStop.lng, name: lastStop.spot_name });
              }}>🔍 Explore</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {idx === 0 ? (<>
                <div style={{ flex: 1, background: '#FFF4EF', padding: 8, borderRadius: 8 }}>
                  <span style={{ fontSize: 10, color: '#D4622A', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'block', marginBottom: 2 }}>{isReceived ? `${inv.sender_name}'s ETA` : 'Your ETA'}</span>
                  <span style={{ fontSize: 13, color: '#2C2416', fontWeight: 600 }}>{s.eta_text_user || '—'}</span>
                </div>
                <div style={{ flex: 1, background: '#F6FBF7', padding: 8, borderRadius: 8 }}>
                  <span style={{ fontSize: 10, color: '#3D8B4B', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'block', marginBottom: 2 }}>{isReceived ? 'Your ETA' : `${inv.receiver_name || 'Friend'}'s ETA`}</span>
                  <span style={{ fontSize: 13, color: '#2C2416', fontWeight: 600 }}>{s.eta_text_friend || '—'}</span>
                </div>
              </>) : (
                <div style={{ flex: 1, background: '#F8F3EE', padding: 10, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px dashed #D4622A' }}>
                  <div>
                    <span style={{ fontSize: 9, color: '#6B5B4E', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, display: 'block' }}>From {inv.stops[idx-1].spot_name}</span>
                    <span style={{ fontSize: 14, color: '#2C2416', fontWeight: 700 }}>{transportEmoji[s.transport_mode] || '🚗'} {s.eta_text_user || '—'} {transportWord[s.transport_mode] || 'drive'}</span>
                  </div>
                  <div style={{ fontSize: 20 }}>🏁</div>
                </div>
              )}
            </div>
          </>);
          })()}
        </div>
      </div>
    );

    // ── SHOW-ALL view (after last step) ───────────────────────────
    if (showAllStops) {
      return (
        <div style={{ marginTop: 16, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#9A8A78', textTransform: 'uppercase', letterSpacing: 0.5 }}>Full itinerary · {total} stop{total !== 1 ? 's' : ''}</div>
            <div style={{ flex: 1, height: 1, background: '#EDE5DA' }} />
          </div>
          {inv.stops.map((s, idx) => (
            <div key={idx}>
              {idx > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
                  <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #EDE5DA, #D4622A22)' }} />
                  <div style={{ padding: '4px 14px', background: '#FFF4EF', borderRadius: 100, fontSize: 11, color: '#D4622A', fontWeight: 600, border: '1px solid #FADED3', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                    {transportEmoji[s.transport_mode] || '🚗'} {s.eta_text_user || 'Travel'} {transportWord[s.transport_mode] || 'drive'}
                  </div>
                  <div style={{ flex: 1, height: 2, background: 'linear-gradient(90deg, #D4622A22, #EDE5DA)' }} />
                </div>
              )}
              {renderStopCard(s, idx, true)}
            </div>
          ))}
          <button onClick={() => { setStopStep(0); setShowAllStops(false); }} style={{ marginTop: 16, width: '100%', padding: '10px', borderRadius: 10, background: 'white', color: '#9A8A78', border: '1.5px solid #EDE5DA', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            ← Back to step-by-step
          </button>
        </div>
      );
    }

    // ── STEP-BY-STEP view ─────────────────────────────────────────
    const s = inv.stops[stopStep];
    return (
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        {/* Progress dots */}
        {total > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            {inv.stops.map((_, i) => (
              <div key={i} style={{ flex: i === stopStep ? 2 : 1, height: 4, borderRadius: 100, background: i === stopStep ? '#D4622A' : i < stopStep ? '#E07C5A88' : '#EDE5DA', transition: 'all 0.3s' }} />
            ))}
          </div>
        )}

        {renderStopCard(s, stopStep, false)}

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          {stopStep > 0 && (
            <button onClick={() => setStopStep(p => p - 1)} style={{ padding: '12px 18px', borderRadius: 12, background: 'white', color: '#6B5B4E', border: '1.5px solid #EDE5DA', fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              ← Back
            </button>
          )}
          {!isLastStep ? (
            <button onClick={() => setStopStep(p => p + 1)} style={{ flex: 1, padding: '14px', borderRadius: 12, background: '#2C2416', color: 'white', border: 'none', fontFamily: 'DM Sans', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              Next location → <span style={{ opacity: 0.7, fontSize: 13 }}>Stop {stopStep + 2} of {total}</span>
            </button>
          ) : (
            <button onClick={() => setShowAllStops(true)} style={{ flex: 1, padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, #D4622A, #E07C5A)', color: 'white', border: 'none', fontFamily: 'DM Sans', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              See full itinerary ✓
            </button>
          )}
        </div>

        {total > 1 && !isLastStep && (
          <button onClick={() => setShowAllStops(true)} style={{ marginTop: 8, width: '100%', padding: '8px', borderRadius: 10, background: 'transparent', color: '#9A8A78', border: 'none', fontFamily: 'DM Sans', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            Skip to full itinerary
          </button>
        )}
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

      <div className="header-container">
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

      <div className="content" style={{ paddingBottom: tab === 'invites' ? 0 : itinerary.length > 0 ? 450 : 30, maxWidth: tab === 'invites' ? '100%' : undefined }}>

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

          <div style={{ padding: '0 10px' }} className={itinerary.length > 0 ? 'map-container-with-itinerary' : ''}>
            {searched && midpoint && <MapExplorer isLoaded={isLoaded} coords={allCoords} midpoint={midpoint} peopleLabels={peopleLabels} itinerary={itinerary} onAddToItinerary={addToItinerary} onRemoveFromItinerary={removeFromItinerary} useOriginalCoords={false} />}
            {!searched && !searchLoading && <div className="narrow-container"><div className="empty"><div className="empty-emoji">🤝</div><div className="empty-title">Ready to plan?</div><div className="empty-sub">Select friends and a location to find spots with real Google Maps ETAs.</div></div></div>}
          </div>
        </>)}

        {/* INVITES TAB — two-column inbox layout */}
        {tab === "invites" && (() => {
          // Build sent groups once
          const sentGroups = [];
          const seenIts = new Set();
          sentList.forEach(inv => {
            if (!seenIts.has(inv.itinerary_id)) {
              seenIts.add(inv.itinerary_id);
              sentGroups.push(sentList.filter(i => i.itinerary_id === inv.itinerary_id));
            }
          });

          // Find the selected item (received invite or sent group primary)
          const selectedReceived = inviteSubTab === 'received' ? receivedList.find(i => i.id === selectedInviteId) : null;
          const selectedSentGroup = inviteSubTab === 'sent' ? sentGroups.find(g => g[0].itinerary_id === selectedInviteId) : null;

          const statusLabel = (s) => s === 'pending' ? 'Pending' : s === 'accepted' ? 'Going ✓' : s === 'counter' ? 'Countered' : s === 'completed' ? 'Done ✓' : 'Declined';
          const statusColor = (s) => s === 'accepted' || s === 'completed' ? '#3D8B4B' : s === 'declined' ? '#C0392B' : s === 'counter' ? '#D4622A' : '#9A8A78';
          const statusBg = (s) => s === 'accepted' || s === 'completed' ? '#E8F5E9' : s === 'declined' ? '#FDECEA' : s === 'counter' ? '#FFF4EF' : '#F5F5F5';

          return (
            <div style={{ display: 'flex', height: 'calc(100vh - 120px)', overflow: 'hidden', padding: '0 16px 0 16px', gap: 0 }}>

              {/* ── LEFT PANEL: summary list ── */}
              <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1.5px solid #EDE5DA', paddingRight: 16 }}>
                <div style={{ paddingTop: 20, paddingBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: '#2C2416' }}>Invites</div>
                    {selectMode ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {selectedForDelete.size > 0 && (
                          <button onClick={handleMassDelete} style={{ padding: '6px 12px', borderRadius: 8, background: '#C0392B', color: 'white', border: 'none', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            🗑 Delete ({selectedForDelete.size})
                          </button>
                        )}
                        <button onClick={() => { setSelectMode(false); setSelectedForDelete(new Set()); }} style={{ padding: '6px 12px', borderRadius: 8, background: '#F0E8DD', color: '#6B5B4E', border: 'none', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setSelectMode(true)} style={{ padding: '6px 12px', borderRadius: 8, background: '#F0E8DD', color: '#6B5B4E', border: 'none', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Select
                      </button>
                    )}
                  </div>
                  {/* Tab toggle */}
                  <div style={{ display: 'flex', gap: 0, background: '#F0E8DD', borderRadius: 10, padding: 3 }}>
                    {[{ id: 'received', label: '💌 Received', count: receivedList.filter(i=>i.status==='pending').length },
                      { id: 'sent', label: '📤 Sent', count: 0 }].map(t => (
                      <button key={t.id} onClick={() => { setInviteSubTab(t.id); setSelectedInviteId(null); }} style={{
                        flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                        background: inviteSubTab === t.id ? 'white' : 'transparent',
                        color: inviteSubTab === t.id ? '#D4622A' : '#9A8A78',
                        boxShadow: inviteSubTab === t.id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                      }}>
                        {t.label}{t.count > 0 && <span style={{ background: '#D4622A', color: 'white', borderRadius: 100, padding: '1px 6px', fontSize: 10, marginLeft: 5 }}>{t.count}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scrollable list */}
                <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
                  {inviteSubTab === 'received' && (<>
                    {receivedList.length === 0 && (
                      <div style={{ textAlign: 'center', paddingTop: 60, color: '#9A8A78' }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>💌</div>
                        <div style={{ fontWeight: 600, color: '#2C2416', marginBottom: 4 }}>No invites yet</div>
                        <div style={{ fontSize: 13 }}>When friends invite you, they'll show here</div>
                      </div>
                    )}
                    {receivedList.map(inv => {
                      const relDate = formatRelativeDate(inv.event_date);
                      const stopCount = inv.stops?.length || 0;
                      const isSelected = selectedInviteId === inv.id;
                      const isPending = inv.status === 'pending';
                      const isChecked = selectedForDelete.has(inv.id);
                      return (
                        <div key={inv.id} onClick={() => {
                          if (selectMode) {
                            setSelectedForDelete(prev => { const n = new Set(prev); isChecked ? n.delete(inv.id) : n.add(inv.id); return n; });
                          } else {
                            setSelectedInviteId(inv.id);
                          }
                        }} style={{
                          padding: '14px 12px', borderRadius: 12, marginBottom: 6, cursor: 'pointer', transition: 'all 0.15s',
                          background: isChecked ? '#FDECEA' : isSelected ? '#FFF4EF' : 'white',
                          border: isChecked ? '1.5px solid #C0392B' : isSelected ? '1.5px solid #D4622A' : '1.5px solid #EDE5DA',
                          boxShadow: isSelected ? '0 2px 12px rgba(212,98,42,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {selectMode && (
                              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isChecked ? '#C0392B' : '#D4B8A8'}`, background: isChecked ? '#C0392B' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontSize: 13 }}>
                                {isChecked && '✓'}
                              </div>
                            )}
                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: inv.sender_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0, position: 'relative' }}>
                              {inv.sender_avatar}
                              {isPending && !selectMode && <div style={{ position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: '#D4622A', border: '2px solid white' }} />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: isPending ? 700 : 600, color: '#2C2416', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {inv.sender_name}
                              </div>
                              <div style={{ fontSize: 12, color: '#6B5B4E', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                invited you to {stopCount} place{stopCount !== 1 ? 's' : ''}
                                {relDate
                                  ? <span style={{ color: '#D4622A', fontWeight: 600 }}> · {relDate}</span>
                                  : <span style={{ color: '#9A8A78' }}> · No date set</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: statusBg(inv.status), color: statusColor(inv.status), flexShrink: 0 }}>
                              {statusLabel(inv.status)}
                            </span>
                          </div>
                          {inv.message && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#9A8A78', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: 50 }}>
                              "{inv.message}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>)}

                  {inviteSubTab === 'sent' && (<>
                    {sentGroups.length === 0 && (
                      <div style={{ textAlign: 'center', paddingTop: 60, color: '#9A8A78' }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📤</div>
                        <div style={{ fontWeight: 600, color: '#2C2416', marginBottom: 4 }}>No invites sent</div>
                        <div style={{ fontSize: 13 }}>Build a plan and send it to friends!</div>
                      </div>
                    )}
                    {sentGroups.map(group => {
                      const primary = group[0];
                      const receivers = group.map(i => ({ id: i.receiver_id, name: i.receiver_name, avatar: i.receiver_avatar, color: i.receiver_color, status: i.status }));
                      const allCompleted = group.every(i => i.status === 'completed');
                      const anyAccepted = group.some(i => i.status === 'accepted');
                      const combinedStatus = allCompleted ? 'completed' : anyAccepted ? 'accepted' : 'pending';
                      const allNames = receivers.map(r => r.name);
                      const nameStr = allNames.length === 1 ? allNames[0] : allNames.length === 2 ? allNames.join(' & ') : `${allNames[0]} & ${allNames.length - 1} others`;
                      const stopCount = primary.stops?.length || 0;
                      const relDate = formatRelativeDate(primary.event_date);
                      const isSelected = selectedInviteId === primary.itinerary_id;
                      const groupIds = group.map(i => i.id);
                      const isChecked = groupIds.some(id => selectedForDelete.has(id));
                      return (
                        <div key={primary.itinerary_id} onClick={() => {
                          if (selectMode) {
                            setSelectedForDelete(prev => { const n = new Set(prev); isChecked ? groupIds.forEach(id => n.delete(id)) : groupIds.forEach(id => n.add(id)); return n; });
                          } else {
                            setSelectedInviteId(primary.itinerary_id);
                          }
                        }} style={{
                          padding: '14px 12px', borderRadius: 12, marginBottom: 6, cursor: 'pointer', transition: 'all 0.15s',
                          background: isChecked ? '#FDECEA' : isSelected ? '#FFF4EF' : 'white',
                          border: isChecked ? '1.5px solid #C0392B' : isSelected ? '1.5px solid #D4622A' : '1.5px solid #EDE5DA',
                          boxShadow: isSelected ? '0 2px 12px rgba(212,98,42,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {selectMode && (
                              <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${isChecked ? '#C0392B' : '#D4B8A8'}`, background: isChecked ? '#C0392B' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'white', fontSize: 13 }}>
                                {isChecked && '✓'}
                              </div>
                            )}
                            <div style={{ display: 'flex', position: 'relative', width: Math.min(receivers.length, 3) * 14 + 26, height: 40, flexShrink: 0 }}>
                              {receivers.slice(0, 3).map((r, i) => (
                                <div key={r.id} style={{ width: 40, height: 40, borderRadius: '50%', background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white', border: '2px solid white', position: i === 0 ? 'relative' : 'absolute', left: i * 14, zIndex: 3-i }}>{r.avatar}</div>
                              ))}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2416', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {nameStr}
                              </div>
                              <div style={{ fontSize: 12, color: '#6B5B4E', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {stopCount} place{stopCount !== 1 ? 's' : ''}
                                {relDate
                                  ? <span style={{ color: '#D4622A', fontWeight: 600 }}> · {relDate}</span>
                                  : <span style={{ color: '#9A8A78' }}> · No date set</span>}
                              </div>
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100, background: statusBg(combinedStatus), color: statusColor(combinedStatus), flexShrink: 0 }}>
                              {statusLabel(combinedStatus)}
                            </span>
                          </div>
                          {primary.message && (
                            <div style={{ marginTop: 8, fontSize: 12, color: '#9A8A78', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingLeft: 50 }}>
                              "{primary.message}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>)}
                </div>
              </div>

              {/* ── RIGHT PANEL: detail view ── */}
              <div style={{ flex: 1, overflowY: 'auto', paddingLeft: 24, paddingTop: 20, paddingBottom: 40 }}>
                {!selectedInviteId && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9A8A78', gap: 12 }}>
                    <div style={{ fontSize: 48 }}>👈</div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#6B5B4E' }}>Select an invite to view details</div>
                    <div style={{ fontSize: 13 }}>Click any invite from the list on the left</div>
                  </div>
                )}

                {/* RECEIVED detail */}
                {selectedReceived && (() => {
                  const inv = selectedReceived;
                  return (
                    <div>
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: '1.5px solid #EDE5DA' }}>
                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: inv.sender_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'white', flexShrink: 0 }}>{inv.sender_avatar}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#2C2416' }}>{inv.sender_name} invited you</div>
                          <div style={{ fontSize: 13, color: '#9A8A78', marginTop: 2 }}>
                            {inv.stops?.length || 0} stop{(inv.stops?.length || 0) !== 1 ? 's' : ''}
                            {renderEventDate(inv.event_date)}
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 100, background: statusBg(inv.status), color: statusColor(inv.status) }}>
                          {statusLabel(inv.status)}
                        </span>
                      </div>

                      {inv.message && (
                        <div style={{ margin: '0 0 20px 0', padding: '14px 16px', background: '#FFF8F5', borderRadius: 12, borderLeft: '3px solid #D4622A', fontSize: 14, color: '#2C2416', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{inv.message}"
                        </div>
                      )}

                      {inv.co_invitees && inv.co_invitees.length > 0 && (
                        <div style={{ marginBottom: 20, padding: '12px 14px', background: '#F8F3EE', borderRadius: 10, border: '1px solid #EDE5DA' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#9A8A78', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Also invited</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {inv.co_invitees.map(ci => (
                              <div key={ci.receiver_id} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'white', borderRadius: 100, padding: '4px 10px 4px 4px', border: '1px solid #EDE5DA', fontSize: 12, fontWeight: 500 }}>
                                <div style={{ width: 22, height: 22, borderRadius: '50%', background: ci.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'white' }}>{ci.avatar_letter}</div>
                                {ci.name}
                                <span style={{ fontSize: 10, color: ci.status === 'accepted' ? '#3D8B4B' : ci.status === 'declined' ? '#C0392B' : '#E07C2A', fontWeight: 700, marginLeft: 2 }}>
                                  {ci.status === 'accepted' ? '✓' : ci.status === 'declined' ? '✕' : '⏳'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {renderDetailedStops(inv, true)}

                      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {inv.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button className="accept-btn" style={{ flex: 1 }} onClick={() => handleInviteAction(inv.id, 'accepted')}>✓ Accept</button>
                            <button className="suggest-btn" style={{ flex: 2, padding: '12px', borderRadius: 10, background: '#FFF4EF', color: '#D4622A', border: '1.5px solid #FADED3', fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={() => handleSuggestChanges(inv)}>✏️ Suggest Changes</button>
                            <button className="decline-btn" onClick={() => handleInviteAction(inv.id, 'declined')}>✕</button>
                          </div>
                        ) : inv.status === 'completed' ? (
                          <div style={{ padding: 12, textAlign: 'center', color: '#6B8F71', fontWeight: 600 }}>✅ Hangout completed!</div>
                        ) : (
                          <>
                            {inv.status === 'accepted' && <div style={{ color: '#3D8B4B', fontWeight: 600, marginBottom: 4 }}>🎉 You're going!</div>}
                            {inv.status === 'declined' && <div style={{ color: '#C0392B', fontWeight: 600, marginBottom: 4 }}>Declined</div>}
                            {inv.status === 'counter' && <div style={{ color: '#D4622A', fontWeight: 600, marginBottom: 4 }}>Counter proposed</div>}
                            <div style={{ display: 'flex', gap: 10 }}>
                              {inv.status !== 'accepted' && <button className="accept-btn" style={{ flex: 1 }} onClick={() => handleInviteAction(inv.id, 'accepted')}>Accept</button>}
                              {inv.status !== 'declined' && <button className="decline-btn" style={{ flex: 1 }} onClick={() => handleInviteAction(inv.id, 'declined')}>Decline</button>}
                              <button className="suggest-btn" style={{ flex: 2, padding: '10px', borderRadius: 10, background: '#FFF4EF', color: '#D4622A', border: '1.5px solid #FADED3', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} onClick={() => handleSuggestChanges(inv)}>✏️ Edit Itinerary</button>
                            </div>
                            {inv.status === 'accepted' && (
                              <button onClick={() => handleInviteAction(inv.id, 'completed')} style={{ padding: '10px', borderRadius: 10, background: '#E8F5E9', color: '#3D8B4B', border: '1.5px solid #C8E6C9', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>✅ Mark as Completed</button>
                            )}
                          </>
                        )}
                        <button onClick={() => handleDeleteInvite(inv.id)} style={{ padding: '8px', borderRadius: 10, background: 'transparent', color: '#C0392B', border: '1.5px solid #F5C4BA', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' }}>🗑 Delete Invite</button>
                      </div>
                    </div>
                  );
                })()}

                {/* SENT detail */}
                {selectedSentGroup && (() => {
                  const group = selectedSentGroup;
                  const primary = group[0];
                  const receivers = group.map(i => ({ id: i.receiver_id, name: i.receiver_name, avatar: i.receiver_avatar, color: i.receiver_color, status: i.status, inviteId: i.id }));
                  const allCompleted = group.every(i => i.status === 'completed');
                  const anyAccepted = group.some(i => i.status === 'accepted');
                  const combinedStatus = allCompleted ? 'completed' : anyAccepted ? 'accepted' : 'pending';
                  const allNames = receivers.map(r => r.name);
                  const nameStr = allNames.length <= 2 ? allNames.join(' & ') : `${allNames[0]} & ${allNames.length - 1} others`;
                  const isExpanded = expandedGuestGroups[primary.itinerary_id];
                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: '1.5px solid #EDE5DA' }}>
                        <div style={{ display: 'flex', position: 'relative', width: Math.min(receivers.length, 3) * 16 + 36, height: 52, flexShrink: 0 }}>
                          {receivers.slice(0, 3).map((r, i) => (
                            <div key={r.id} style={{ width: 52, height: 52, borderRadius: '50%', background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: 'white', border: '2px solid white', position: i === 0 ? 'relative' : 'absolute', left: i * 16, zIndex: 3-i }}>{r.avatar}</div>
                          ))}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#2C2416' }}>You invited {nameStr}</div>
                          <div style={{ fontSize: 13, color: '#9A8A78', marginTop: 2 }}>
                            {primary.stops?.length || 0} stop{(primary.stops?.length || 0) !== 1 ? 's' : ''}
                            {renderEventDate(primary.event_date)}
                          </div>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 100, background: statusBg(combinedStatus), color: statusColor(combinedStatus) }}>
                          {statusLabel(combinedStatus)}
                        </span>
                      </div>

                      {/* Guest list */}
                      {receivers.length >= 1 && (
                        <div style={{ marginBottom: 20 }}>
                          <button onClick={() => setExpandedGuestGroups(prev => ({ ...prev, [primary.itinerary_id]: !prev[primary.itinerary_id] }))}
                            style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #EDE5DA', background: '#F8F3EE', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#6B5B4E', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span>👥 {receivers.length} {receivers.length === 1 ? 'person' : 'people'} invited</span>
                            <span style={{ fontSize: 14, transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none' }}>▾</span>
                          </button>
                          {isExpanded && (
                            <div style={{ marginTop: 8, padding: '10px 14px', background: 'white', borderRadius: 10, border: '1px solid #EDE5DA' }}>
                              {receivers.map(r => (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F5F0EB' }}>
                                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0 }}>{r.avatar}</div>
                                  <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{r.name}</div>
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: statusBg(r.status), color: statusColor(r.status) }}>{statusLabel(r.status)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {primary.message && (
                        <div style={{ margin: '0 0 20px 0', padding: '14px 16px', background: '#FFF8F5', borderRadius: 12, borderLeft: '3px solid #D4622A', fontSize: 14, color: '#2C2416', fontStyle: 'italic', lineHeight: 1.5 }}>
                          "{primary.message}"
                        </div>
                      )}

                      {renderDetailedStops(primary, false)}

                      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button className="suggest-btn" style={{ flex: 1, padding: '12px', borderRadius: 10, background: '#FFF4EF', color: '#D4622A', border: '1.5px solid #FADED3', fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600, cursor: 'pointer' }} onClick={() => handleSuggestChanges(primary)}>✏️ Edit & Resend</button>
                          {anyAccepted && <button onClick={() => { group.forEach(inv => { if (inv.status === 'accepted') handleInviteAction(inv.id, 'completed'); }); }} style={{ flex: 1, padding: '12px', borderRadius: 10, background: '#E8F5E9', color: '#3D8B4B', border: '1.5px solid #C8E6C9', fontFamily: 'DM Sans', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>✅ Mark Complete</button>}
                        </div>
                        <button onClick={() => { group.forEach(inv => handleDeleteInvite(inv.id)); }} style={{ padding: '8px', borderRadius: 10, background: 'transparent', color: '#C0392B', border: '1.5px solid #F5C4BA', fontFamily: 'DM Sans', fontSize: 13, fontWeight: 600, cursor: 'pointer', width: '100%' }}>🗑 Delete Invite</button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })()}

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
      {itinerary.length > 0 && !showInviteModal && (
        <div className="itin-bar">
          <div className="itin-header" style={{ padding: '20px 20px 8px', margin: 0 }}><div className="itin-title">{suggestingInviteId ? "Suggesting Changes" : "Your Plan"} · {itinerary.length} stop{itinerary.length > 1 ? "s" : ""}</div><span className="itin-toggle" onClick={() => { setItinerary([]); setSuggestingInviteId(null); setDraftOriginalItinerary(null); }}>Clear</span></div>
          <div className="itin-content" style={{ padding: '0 20px 20px', margin: 0 }}>
            {narrative.length > 0 && <div className="route-narrative" style={{ marginTop: 12 }}>{narrative.map((l, i) => <div key={i} className="narrative-line" dangerouslySetInnerHTML={{ __html: l }} />)}</div>}
            <div className="itin-stops" style={{ marginTop: 12 }}>{itinerary.map((stop, i) => (
              <div
                key={stop.google_place_id}
                draggable
                onDragStart={() => { dragSrcIdx.current = i; }}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={e => { e.preventDefault(); setDragOverIdx(null); reorderItinerary(dragSrcIdx.current, i); dragSrcIdx.current = null; }}
                onDragEnd={() => { setDragOverIdx(null); dragSrcIdx.current = null; }}
                className="itin-stop-card"
                style={{ marginBottom: 8, border: dragOverIdx === i ? '2px dashed #D4622A' : undefined, opacity: dragSrcIdx.current === i ? 0.5 : 1, transition: 'border 0.15s, opacity 0.15s' }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  {/* Drag handle */}
                  <div style={{ cursor: 'grab', color: '#C4B8AE', fontSize: 16, lineHeight: 1, padding: '2px 0', userSelect: 'none', flexShrink: 0 }} title="Drag to reorder">⠿</div>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#F8F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{stop.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2C2416', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop.name}</div>
                    <div style={{ fontSize: 11, color: '#D4622A', fontWeight: 600 }}>
                      {stop.etas?.[0]?.text ? `🕒 ${stop.etas[0].text} from ${i === 0 ? 'you' : 'prev stop'}` : ''}
                    </div>
                  </div>
                  {/* Up/down arrows */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                    <button disabled={i === 0} onClick={() => reorderItinerary(i, i - 1)} style={{ background: 'none', border: 'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? '#DDD' : '#9A8A78', fontSize: 11, lineHeight: 1, padding: '1px 3px' }}>▲</button>
                    <button disabled={i === itinerary.length - 1} onClick={() => reorderItinerary(i, i + 1)} style={{ background: 'none', border: 'none', cursor: i === itinerary.length - 1 ? 'default' : 'pointer', color: i === itinerary.length - 1 ? '#DDD' : '#9A8A78', fontSize: 11, lineHeight: 1, padding: '1px 3px' }}>▼</button>
                  </div>
                  <button className="itin-remove" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9A8A78', padding: 4, flexShrink: 0 }} onClick={() => removeFromItinerary(stop.google_place_id)}>×</button>
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
            {selectedFriends.length > 0 && <button className="itin-send-btn" style={{ width: '100%', padding: '14px', borderRadius: 12, background: '#D4622A', color: 'white', border: 'none', fontFamily: 'DM Sans', fontSize: 15, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(212,98,42,0.2)' }} onClick={() => setShowInviteModal(true)}>{suggestingInviteId ? `📬 Reply with Suggestion to ${friendNames}` : `📬 Send Invite to ${friendNames}`}</button>}
          </div>
        </div>
      )}

      {/* SEND INVITE MODAL */}
      {showInviteModal && <div className="itin-bar" style={{ zIndex: 1001 }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1.5px solid #F0E8DD', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="itin-title">{suggestingInviteId ? "Send Suggestion" : `Send to ${friendNames}`}</div>
            <div style={{ fontSize: 12, color: '#9A8A78', marginTop: 2 }}>{itinerary.length} stop{itinerary.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={() => setShowInviteModal(false)} style={{ background: 'white', border: '1.5px solid #EDE5DA', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#9A8A78', fontSize: 24, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 20px' }}>

        {/* ── DATE ── */}
        {(() => {
          const toYMD = (d) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD
          const today = new Date();
          const chips = [
            { label: 'Today', value: toYMD(today) },
            { label: 'Tomorrow', value: toYMD(new Date(today.getTime() + 86400000)) },
            ...(() => {
              const days = [];
              for (let d = 2; d <= 8; d++) {
                const dt = new Date(today.getTime() + d * 86400000);
                const wd = dt.getDay();
                if (wd === 6 || wd === 0 || wd === 5) {
                  const label = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                  const val = toYMD(dt);
                  if (!days.find(x => x.value === val)) days.push({ label, value: val });
                  if (days.length === 3) break;
                }
              }
              return days;
            })(),
          ];
          return (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#6B5B4E', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
                📅 Date <span style={{ color: '#C0392B' }}>*</span>
              </label>
              {/* Quick-pick chips */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {chips.map(c => (
                  <button key={c.value} onClick={() => { setEventDate(c.value); setDateError(''); }} style={{ padding: '6px 12px', borderRadius: 100, border: '1.5px solid', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', background: eventDate === c.value ? '#2C2416' : 'white', color: eventDate === c.value ? 'white' : '#6B5B4E', borderColor: eventDate === c.value ? '#2C2416' : '#EDE5DA' }}>
                    {c.label}
                  </button>
                ))}
              </div>
              {/* Or pick exact date */}
              <input type="date" value={eventDate} onChange={e => { setEventDate(e.target.value); setDateError(''); }} style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${dateError ? '#C0392B' : '#EDE5DA'}`, borderRadius: 10, fontFamily: 'DM Sans', fontSize: 14, color: '#2C2416', boxSizing: 'border-box', background: '#FAFAFA' }} />
              {dateError && <div style={{ color: '#C0392B', fontSize: 12, marginTop: 5, fontWeight: 500 }}>{dateError}</div>}
            </div>
          );
        })()}

        {/* ── STOP TIMES ── */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#6B5B4E', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>🕐 Times <span style={{ fontWeight: 400, textTransform: 'none', color: '#9A8A78', fontSize: 11 }}>(optional)</span></label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {itinerary.map((s, idx) => {
              const raw = stopTimeInputs[idx] ?? '';
              const parsed = parseTimeRange(raw);
              const hasValid = parsed.start || parsed.end;
              const preview = [parsed.start && fmtTime(parsed.start), parsed.end && fmtTime(parsed.end)].filter(Boolean).join(' – ');
              return (
                <div key={s.google_place_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: '#F8F3EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{s.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#2C2416', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Stop {idx + 1}: {s.name}</div>
                    <input
                      type="text"
                      placeholder="e.g. 5pm–7pm or 5:30pm–8pm"
                      value={raw}
                      onChange={e => {
                        const v = e.target.value;
                        setStopTimeInputs(prev => ({ ...prev, [idx]: v }));
                        const { start, end } = parseTimeRange(v);
                        setStopSchedules(prev => ({ ...prev, [idx]: { start, end } }));
                      }}
                      style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #EDE5DA', borderRadius: 8, fontFamily: 'DM Sans', fontSize: 13, color: '#2C2416', boxSizing: 'border-box', background: '#FAFAFA' }}
                    />
                  </div>
                  {hasValid && <div style={{ fontSize: 11, color: '#6B8F71', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>✓ {preview}</div>}
                </div>
              );
            })}
          </div>
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
        <div className="modal-overlay" onClick={() => { setShowDirectionsFor(null); setDirectionRoutes([]); setDirectionsLoaded(false); setSelectedRouteIndex(0); }} style={{ zIndex: 9999, alignItems: 'flex-end' }}>
          <div className="modal" key={showDirectionsFor.inv.id + "_" + showDirectionsFor.stopIdx} onClick={e => e.stopPropagation()} style={{ padding: 0, width: '100%', maxWidth: 960, borderRadius: '24px 24px 0 0', overflow: 'hidden', height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
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
            
            <div style={{ height: 420, position: 'relative', flexShrink: 0 }}>
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
                 <div className="modal-title" style={{ fontSize: 18, marginBottom: 2 }}>Near {showExploreModal.name}</div>
                 <div style={{ fontSize: 12, color: '#9A8A78' }}>Exploring around last stop · add to plan</div>
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
                 useOriginalCoords={true}
                 onAddToItinerary={(spot, etaData) => {
                   addToItinerary(spot, etaData);
                   if (suggestingInviteId) {
                     setSuggestMessage(prev => prev || `I added ${spot.name} to our plan!`);
                   }
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
.app { max-width: 100%; min-height: 100vh; background: #FAF6F1; position: relative; overflow-x: hidden; }
.narrow-container { max-width: 1000px; margin: 0 auto; padding: 0 40px; box-sizing: border-box; }
.header-container { max-width: 100%; padding: 0 40px; box-sizing: border-box; }

@media (max-width: 900px) {
  .narrow-container { padding: 0 20px; max-width: 100%; }
  .header-container { padding: 0 16px; }
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
.header { padding: 16px 0 0; }
.logo { font-family: 'Playfair Display', serif; font-size: 26px; font-weight: 700; color: #2C2416; }
.logo span { color: #D4622A; }
.tagline { font-size: 12px; color: #9A8A78; letter-spacing: 0.5px; text-transform: uppercase; }
.user-avatar { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; }
.logout-btn { background: none; border: 1.5px solid #EDE5DA; border-radius: 8px; padding: 4px 8px; cursor: pointer; color: #9A8A78; font-size: 14px; }

/* Nav */
.nav { display: flex; gap: 4px; padding: 12px 0 0; border-bottom: 1px solid #EDE5DA; }
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
.map-container-with-itinerary { margin-left: 460px; transition: margin-left 0.3s; }
@media (max-width: 1350px) {
  .map-container-with-itinerary { margin-left: 360px; }
}
@media (max-width: 820px) {
  .map-container-with-itinerary { margin-left: 0; }
}
.map-container { height: 350px; border-radius: 16px; overflow: hidden; border: 1.5px solid #EDE5DA; margin-bottom: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
.map-loading { height: 250px; display: flex; align-items: center; justify-content: center; background: #EDF2EC; border-radius: 16px; color: #9A8A78; }
.map-categories { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.map-cat-btn { padding: 6px 12px; border-radius: 100px; border: 1.5px solid #EDE5DA; background: white; font-size: 12px; font-weight: 500; color: #6B5B4E; cursor: pointer; transition: all 0.15s; font-family: 'DM Sans', sans-serif; white-space: nowrap; }
.map-cat-btn.active { background: #2C2416; color: white; border-color: #2C2416; }
.explore-back-btn { padding: 8px 14px; border-radius: 8px; border: 1.5px solid #D4622A; background: #FFF4EF; color: #D4622A; font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 12px; }
.map-spots-count { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 600; margin-bottom: 12px; }
.map-spots-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
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
.itin-bar { position: fixed; bottom: 20px; left: 20px; width: 420px; background: white; border: 2.5px solid #D4622A; z-index: 1002; box-shadow: 0 12px 60px rgba(0,0,0,0.15); max-height: calc(100vh - 40px); border-radius: 24px; transition: all 0.3s; display: flex; flex-direction: column; overflow: hidden; }
.itin-content { overflow-y: auto; flex: 1; scrollbar-width: none; }
.itin-content::-webkit-scrollbar { width: 0; display: none; }
@media (max-width: 820px) {
  .itin-bar { left: 50%; bottom: 0; transform: translateX(-50%); max-height: 75vh; border-radius: 20px 20px 0 0; width: 100%; max-width: 430px; }
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

/* Side Panel — always anchored right of the itin-bar (20px + 420px + 20px gap = 460px) */
.explore-side-panel { position: fixed; top: 20px; bottom: 20px; left: 460px; right: 20px; width: auto; background: white; border-radius: 24px; border: 1.5px solid #EDE5DA; box-shadow: 0 12px 60px rgba(0,0,0,0.15); z-index: 1000; display: flex; flex-direction: column; overflow: hidden; height: auto; transition: all 0.3s; scrollbar-width: none; }
.explore-side-panel::-webkit-scrollbar { width: 0; display: none; }
@media (max-width: 820px) {
  .explore-side-panel { left: 2.5%; right: 2.5%; bottom: 2.5%; top: 2.5%; }
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
@media (min-width: 900px) {
  .modal-overlay { align-items: center; }
  .modal { max-width: 640px; border-radius: 24px; padding: 28px 32px 32px; animation: scaleIn 0.2s ease; }
}
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
