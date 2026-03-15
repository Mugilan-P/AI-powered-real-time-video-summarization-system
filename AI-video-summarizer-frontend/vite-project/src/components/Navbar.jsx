import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="logo">
          <h3>Video Summarizer</h3>
        </div>
        
        <div className="nav-links">
          <Link 
            to="/home" 
            className={isActive('/home') ? 'active' : ''}
          >
            Home
          </Link>
          <Link 
            to="/transcription" 
            className={isActive('/transcription') ? 'active' : ''}
          >
            Video Transcription
          </Link>
          <Link 
            to="/static" 
            className={isActive('/static') ? 'active' : ''}
          >
            Video Summary
          </Link>
          <Link 
            to="/dynamic" 
            className={isActive('/dynamic') ? 'active' : ''}
          >
            Dynamic Transcription
          </Link>
        </div>

        <button 
          className="hamburger" 
          onClick={() => setMenuOpen(!menuOpen)}
        >
          ☰
        </button>

        {menuOpen && (
          <div className="mobile-menu">
            <Link 
              to="/home" 
              onClick={() => setMenuOpen(false)}
              className={isActive('/home') ? 'active' : ''}
            >
              Home
            </Link>
            <Link 
              to="/transcription" 
              onClick={() => setMenuOpen(false)}
              className={isActive('/transcription') ? 'active' : ''}
            >
              Video Transcription
            </Link>
            <Link 
              to="/static" 
              onClick={() => setMenuOpen(false)}
              className={isActive('/static') ? 'active' : ''}
            >
              Static Summary
            </Link>
            <Link 
              to="/dynamic" 
              onClick={() => setMenuOpen(false)}
              className={isActive('/dynamic') ? 'active' : ''}
            >
              Dynamic Summary
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;