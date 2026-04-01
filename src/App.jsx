import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Apartments from './pages/Apartments';
import ApartmentDetail from './pages/ApartmentDetail';
import FloorPlan from './pages/FloorPlan';
import CostAnalyzer from './pages/CostAnalyzer';
import Marketplace from './pages/Marketplace';
import Community from './pages/Community';
import AIChat from './pages/AIChat';
import FloorPlanLabeler from './pages/FloorPlanLabeler';
import FloorPlanTracer from './pages/FloorPlanTracer';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="apartments" element={<Apartments />} />
          <Route path="apartments/:id" element={<ApartmentDetail />} />
          <Route path="floorplan" element={<FloorPlan />} />
          <Route path="cost" element={<CostAnalyzer />} />
          <Route path="marketplace" element={<Marketplace />} />
          <Route path="community" element={<Community />} />
          <Route path="aichat" element={<AIChat />} />
          <Route path="label" element={<FloorPlanLabeler />} />
          <Route path="trace" element={<FloorPlanTracer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
