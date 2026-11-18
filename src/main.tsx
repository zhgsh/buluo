import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { preloadBuildingSprites } from './game/buildingAssets.ts';
import { preloadTroopSprites } from './game/troopAssets.ts';
import './index.css';

preloadBuildingSprites();
preloadTroopSprites();

createRoot(document.getElementById('root')!).render(<App />);
