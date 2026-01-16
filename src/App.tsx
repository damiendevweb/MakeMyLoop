import { useState, useRef, useEffect } from 'react'
import { Helmet } from 'react-helmet';
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

interface Loop {
  id: number
  address: string
  distance: number
  unit: string
  actualDistance: string
  color: string
  polyline: L.Polyline
}

function App() {
  const [address, setAddress] = useState('')
  const [distance, setDistance] = useState('5')
  const [loops, setLoops] = useState<Loop[]>([])
  const [message, setMessage] = useState('')
  const mapRef = useRef<L.Map>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mapDivRef.current && !mapRef.current) {
      const map = L.map(mapDivRef.current).setView([48.8566, 2.3522], 13)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map)
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
    const waypoints = [[lng, lat]]

    const numPoints = 6
    const totalCircumferenceKm = targetDistanceKm * 0.50

    const radiusKm = totalCircumferenceKm / (2 * Math.PI)
    const radiusDegrees = radiusKm / 111

    const startAngle = Math.random() * 2 * Math.PI

    for (let i = 0; i < numPoints; i++) {
      const angle = startAngle + (i / numPoints) * 2 * Math.PI
      waypoints.push([
        lng + radiusDegrees * Math.cos(angle),
        lat + radiusDegrees * Math.sin(angle)
      ])
    }
    waypoints.push([lng, lat])

    const coords = waypoints.map(w => w.join(',')).join(';')
    const url = `https://router.project-osrm.org/route/v1/foot-walking/${coords}?overview=full&geometries=geojson`

    const res = await fetch(url)
    const data = await res.json()
    if (!data.routes?.[0]) return null

    const route = data.routes[0]
    return {
      coords: route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]),
      distance: (route.distance / 1000).toFixed(2)
    }
  }

  const addLoop = async () => {
    const coords = await geocodeAddress(address)
    if (!coords || !mapRef.current) {
      setMessage('❌ Adresse non trouvée')
      return
    }

    const distKm = parseFloat(distance)
    console.log(distKm);
  for (let i = 0; i < 3; i++) {
    const route = await generateLoopRoute(coords.lat, coords.lng, distKm)
    if (!route || !mapRef.current) return

    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b']
    const color = colors[(loops.length + i) % colors.length]
  
    const polyline = L.polyline(route.coords, { color, weight: 4 }).addTo(mapRef.current)
    mapRef.current.fitBounds(polyline.getBounds())
  
    setLoops([...loops, {
      id: Date.now(),
      address,
      distance: parseFloat(distance),
      unit: 'km',
      actualDistance: route.distance,
      color,
      polyline
    }])
  
    setMessage('Boucles ajoutée !')
  }

  }

  return (
    <>
      <Helmet>
        <title>🗺️ Route Shuffle</title>
        <meta name="description" content="Generate your own loop !" />
      </Helmet>
      <div className="main-page">
        <div className="sidebar">
          <h1>🗺️ Route Loop Generator</h1>
          <input 
            value={address} 
            onChange={(e) => setAddress(e.target.value)} 
            placeholder="Adresse (ex: Paris, France)"
          />
          <input 
            type="number" 
            value={distance} 
            onChange={(e) => setDistance(e.target.value)} 
            placeholder="Distance"
            min="1" max="50" step="0.5"
          />

          <button className="add-btn" onClick={addLoop}>
            Générer 3 boucles de {distance} km
          </button>
          <div className="status">{message}</div>
          <div className="loops-count">📍 Boucles: {loops.length}</div>
          <div className="loops-list">
            {loops.slice(-6).map(loop => (
              <div key={loop.id} className="loop-item" style={{ borderLeftColor: loop.color }}>
                <div>
                  <div className="loop-title">{loop.address}</div>
                  <div className="loop-distances">
                    🎯 {loop.distance.toFixed(1)}km → 📏 {loop.actualDistance}km
                  </div>
                </div>
                <div className="loop-color" style={{ backgroundColor: loop.color }}></div>
              </div>
            ))}
          </div>
        </div>
        <div className="map-container" ref={mapDivRef} />
      </div>
    </>
  )
}

export default App
