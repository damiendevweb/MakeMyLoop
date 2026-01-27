import { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet';
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.less'

interface Loop {
  id: number
  address: string
  distance: number
  unit: string
  actualDistance: string
  actualMinutes?: string
  color: string
  polyline: L.Polyline
  coords?: [number, number][]
  waypoints?: number[][]
}

function App() {
  const [address, setAddress] = useState('')
  const [distance, setDistance] = useState('5')
  const [loops, setLoops] = useState<Loop[]>([])
  const [message, setMessage] = useState('')
  const [shuffleMode, setShuffleMode] = useState<'km' | 'min'>('km')

  const mapRef = useRef<L.Map>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const clickMarkerRef = useRef<L.Marker>(null)

  useEffect(() => {
    if (mapDivRef.current && !mapRef.current) {
      mapDivRef.current.innerHTML = ''
      const map = L.map(mapDivRef.current).setView([47.7484, -3.3700], 15)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map)
      map.on('click', async (e) => {
        const { lat, lng } = e.latlng
        if (clickMarkerRef.current) {
          map.removeLayer(clickMarkerRef.current)
        }
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`
        )
        const data = await res.json()
        const addr = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
        setAddress(addr)
        clickMarkerRef.current = L.marker([lat, lng])
          .addTo(map)
          .bindPopup(`<b>${addr}</b>`)
          .openPopup()

        .on('popupclose', () => {
          if (clickMarkerRef.current) {
            map.removeLayer(clickMarkerRef.current)
          }
        })
      })
      mapRef.current = map
    }
  }, [])

  const geocodeAddress = async (addr: string) => {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json`)
    const data = await res.json()
    if (data.length === 0) return null
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon)
    }
  }

  const generateLoopRoute = async (lat: number, lng: number, targetDistanceKm: number) => {
    const oneWayDistanceKm = targetDistanceKm / 2
    const randomAngle = Math.random() * 2 * Math.PI
    const endLat = lat + (oneWayDistanceKm / 111) * Math.sin(randomAngle)
    const endLng = lng + (oneWayDistanceKm / 111) * Math.cos(randomAngle)

    const waypoints = [
      [lng, lat],
      [endLng, endLat],
      [lng, lat]
    ]

    const coords = waypoints.map(w => w.join(',')).join(';')
    const url = `https://router.project-osrm.org/route/v1/foot-walking/${coords}?overview=full&geometries=geojson`

    const res = await fetch(url)
    const data = await res.json()
    if (!data.routes?.[0]) return null

    const route = data.routes[0]
    const actualKm = route.distance / 1000
    const actualMinutes = Math.round(actualKm * 12)
    return {
      coords: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
      distance: actualKm.toFixed(2),
      actualMinutes: actualMinutes.toString(),
      waypoints
    }
  }

  const openInGoogleMaps = (address: string, coords: [number, number][]) => {
    const step = Math.floor(coords.length / 10)
    const waypoints = coords
      .filter((_, i) => i % step === 0 || i === coords.length - 1)
      .slice(1, -1) 
      .map(([lat, lng]) => `${lat},${lng}`)
      .join('|')
    const origin = encodeURIComponent(address)
    const destination = encodeURIComponent(address)
    window.open(
      `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=walking`,
      '_blank'
    )
  }

  const addLoop = async () => {
    const coords = await geocodeAddress(address)
    if (!coords || !mapRef.current) {
      setMessage('❌ Adresse non trouvée')
      return
    }

    const rawValue = parseFloat(distance)
    if (isNaN(rawValue) || rawValue <= 0) {
      setMessage('❌ Valeur de distance/durée invalide')
      return
    }

    let distKm: number
    let displayedUnit = 'km'
    let displayedInput = rawValue

    if (shuffleMode === 'km') {
      distKm = rawValue
    } else {
      const speedKmPerMin = 5 / 60
      distKm = rawValue * speedKmPerMin
      displayedUnit = 'min'
      displayedInput = rawValue
    }
    const route = await generateLoopRoute(coords.lat, coords.lng, distKm)
    if (!route || !mapRef.current) return

    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b']
    const color = colors[loops.length % colors.length]

    const polyline = L.polyline(route.coords, { color, weight: 4 }).addTo(mapRef.current)
    mapRef.current.fitBounds(polyline.getBounds())

    setLoops([...loops, {
      id: Date.now(),
      address,
      distance: displayedInput,
      unit: displayedUnit,
      actualDistance: route.distance,
      actualMinutes: route.actualMinutes,
      color,
      polyline,
      waypoints: route.waypoints,
      coords: route.coords,
    }])
  }

  return (
    <>
      <Helmet>
        <title>Make My Loop</title>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗺️</text></svg>" />
        <meta name="description" content="Generate your own loop !" />
      </Helmet>
      <div className="main-page">
        <div className="sidebar">
          <h1 className='sidebar__title'>🗺️ Make My Loop</h1>
          <div className="shuffle-infos__container">
            <label htmlFor="shuffle-address" className="shuffle-address__title">Adresse</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Adresse (ex: Paris, France)"
              id='shuffle-address'
            />
            <label htmlFor='shuffle-select' className="shuffle-type__title">Type de boucle</label>
            <select
              value={shuffleMode}
              onChange={(e) => setShuffleMode(e.target.value as 'km' | 'min')}
              className="select-mode"
              id='shuffle-select'
            >
              <option value="km">Distance (km)</option>
              <option value="min">Durée (minutes)</option>
            </select>

            <label htmlFor="shuffle-distance-minute" className='shuffle-type__title'>
              {shuffleMode === 'km' ? 'Distance (km)' : 'Durée (minutes)'}
            </label>
            <input
              type="number"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder={shuffleMode === 'km' ? 'Distance en km' : 'Durée en minutes'}
              min="1"
              max="300"
              step="0.5"
              id='shuffle-distance-minute'
            />
          </div>

          <button className="add-btn" onClick={addLoop}>
            Générer 1 boucle de {distance} {shuffleMode === "km" ? "km" : "min"}
          </button>
          {message && <div className="status">{message}</div>}
          {loops.length !== 0 && <div className="loops-count">📍 Boucles: {loops.length}</div>}
          <ul className="loops-list">
            {loops.slice(-6).map(loop => (
              <li key={loop.id} className="loop-item" style={{ borderRightColor: loop.color }}>
                <div className="loop-title">{loop.address}</div>
                <div className="loop-distances">
                  {loop.unit === 'km' ? (
                    <>
                      🎯 {loop.distance.toFixed(1)} km → 📏 {loop.actualDistance} km
                    </>
                  ) : (
                    <>
                      🎯 {loop.distance.toFixed(0)} min → ⏱️ {loop.actualMinutes} min / {loop.actualDistance} km
                    </>
                  )}
                </div>
                {loop.coords && (  // 👈 Ajoute coords dans Loop
                  <button
                    onClick={() => openInGoogleMaps(loop.address, loop.coords!)}
                    className="google-maps-btn"
                    style={{ background: '#4285f4', color: 'white' }}
                  >
                    Ouvrir dans Google Maps
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="map-container" ref={mapDivRef} />
      </div>
    </>
  )
}

export default App
