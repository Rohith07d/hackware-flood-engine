import MapCanvas from '../components/MapCanvas';
import RainfallSlider from '../components/RainfallSlider';
import AlertHUD from '../components/AlertHUD';

export default function HomePage() {
  return (
    <main>
      <h1>HackWave Flood Engine</h1>
      <RainfallSlider />
      <MapCanvas />
      <AlertHUD />
    </main>
  );
}
