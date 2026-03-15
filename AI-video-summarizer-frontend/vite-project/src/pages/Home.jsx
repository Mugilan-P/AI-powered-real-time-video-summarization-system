import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const Home = () => {
  const [showAbout, setShowAbout] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-overlay" />
        
        <div className="hero-content">
          <h1>Summarize Your Videos Instantly</h1>
          <p>
            Leverage AI technology to extract key points and insights from lengthy videos in just seconds.
          </p>
          <button
            className="cta-button"
            onClick={() => navigate('/static')}
          >
            Let's Summarize
          </button>
        </div>
      </section>
    </div>
  );
};

export default Home;
