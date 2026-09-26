"use client";

import { useState } from "react";
import AppShell from "../../components/AppShell";
import PageHeader from "../../components/PageHeader";
import RequireUser from "../../components/RequireUser";
import { apiFetch, APIError } from "../../lib/api";

export default function NearbyHealthcarePage() { return <AppShell><RequireUser><Nearby /></RequireUser></AppShell>; }
function Nearby() { const [places, setPlaces] = useState<any[]>([]); const [message, setMessage] = useState(""); async function locate() { setMessage("Finding nearby providers…"); navigator.geolocation.getCurrentPosition(async (position) => { try { const body = await apiFetch<{ places: any[]; message?: string }>(`/nearby-healthcare?lat=${position.coords.latitude}&lon=${position.coords.longitude}`); setPlaces(body.places); setMessage(body.message || `${body.places.length} places found.`); } catch (e) { setMessage(e instanceof APIError ? e.message : "Unable to search"); } }, () => setMessage("Location permission is needed to search nearby.")); } return <><PageHeader eyebrow="Care, closer to you" title="Nearby healthcare" description="Find hospitals, clinics, and pharmacies around your current location." action={<button className="btn btn-primary" onClick={locate}>Use my location</button>} /><p className="notice">BabyStar does not verify providers. Confirm details and availability directly before visiting.</p><div className="card" style={{ marginTop: 18 }}><p className="muted">{message || "Your search results will appear here."}</p><div className="list">{places.map((place, index) => <div className="list-item" key={place.properties?.place_id || index}><div><strong>{place.properties?.name || "Healthcare provider"}</strong><div className="muted">{place.properties?.formatted || "Address unavailable"}</div></div></div>)}</div></div></>; }

