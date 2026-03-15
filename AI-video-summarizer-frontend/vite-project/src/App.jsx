import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import StaticSummary from './pages/StaticSummary';
import DynamicSummary from './pages/DynamicSummary';
import './App.css';
import FullTranscription from './pages/FullTranscription';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/static" element={<StaticSummary />} />
          <Route path="/dynamic" element={<DynamicSummary />} />
          <Route path="/transcription" element={<FullTranscription />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;